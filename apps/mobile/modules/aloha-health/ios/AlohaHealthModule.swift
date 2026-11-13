import ExpoModulesCore
import HealthKit
import WorkoutKit

// Biegi i marsze z Apple Zdrowie (HealthKit) dla synchronizacji z planem Aloha (funkcja health-sync).
// Tylko odczyt: trening (czas, dystans, przewyższenie, tętno) i jego przebieg – skumulowany dystans
// i tętno w punktach czasu od startu, z których serwer liczy przebieg tempa tak jak dla Stravy.

final class HealthUnavailableException: Exception {
  override var reason: String { "Apple Zdrowie nie jest dostępne na tym urządzeniu" }
}

public class AlohaHealthModule: Module {
  private let store = HKHealthStore()

  private static let distanceType = HKQuantityType(.distanceWalkingRunning)
  private static let heartRateType = HKQuantityType(.heartRate)
  private static let bpm = HKUnit.count().unitDivided(by: .minute())

  public func definition() -> ModuleDefinition {
    Name("AlohaHealth")

    Function("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    /// Systemowa prośba o odczyt treningów, dystansu i tętna. iOS nie mówi, na co biegacz się zgodził –
    /// bez zgody zapytania po prostu zwracają mniej danych.
    AsyncFunction("requestAuthorization") { () async throws in
      guard HKHealthStore.isHealthDataAvailable() else { throw HealthUnavailableException() }
      let read: Set<HKObjectType> = [HKObjectType.workoutType(), Self.distanceType, Self.heartRateType]
      try await self.store.requestAuthorization(toShare: [], read: read)
    }

    /// Biegi i marsze od `sinceMs` (najnowsze najpierw, najwyżej `limit`).
    AsyncFunction("getWorkouts") { (sinceMs: Double, limit: Int) async throws -> [[String: Any]] in
      guard HKHealthStore.isHealthDataAvailable() else { throw HealthUnavailableException() }
      let since = Date(timeIntervalSince1970: sinceMs / 1000)
      let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
        HKQuery.predicateForSamples(withStart: since, end: nil),
        NSCompoundPredicate(orPredicateWithSubpredicates: [
          HKQuery.predicateForWorkouts(with: .running),
          HKQuery.predicateForWorkouts(with: .walking),
        ]),
      ])
      let query = HKSampleQueryDescriptor(
        predicates: [.workout(predicate)],
        sortDescriptors: [SortDescriptor(\.startDate, order: .reverse)],
        limit: max(1, min(limit, 200))
      )
      let workouts = try await query.result(for: self.store)
      var out: [[String: Any]] = []
      for workout in workouts {
        out.append(try await self.describe(workout))
      }
      return out
    }
  }

  private func describe(_ w: HKWorkout) async throws -> [String: Any] {
    var zone = TimeZone.current
    if let name = w.metadata?[HKMetadataKeyTimeZone] as? String, let tz = TimeZone(identifier: name) { zone = tz }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = zone
    let day = calendar.dateComponents([.year, .month, .day], from: w.startDate)

    let iso = ISO8601DateFormatter()
    var item: [String: Any] = [
      "id": w.uuid.uuidString,
      "activity": w.workoutActivityType == .walking ? "walk" : "run",
      "start": iso.string(from: w.startDate),
      "end": iso.string(from: w.endDate),
      "localDate": String(format: "%04d-%02d-%02d", day.year ?? 0, day.month ?? 0, day.day ?? 0),
      "durationS": w.duration,
      "distanceM": w.statistics(for: Self.distanceType)?.sumQuantity()?.doubleValue(for: .meter()) ?? 0,
    ]
    if let up = w.metadata?[HKMetadataKeyElevationAscended] as? HKQuantity {
      item["elevationM"] = up.doubleValue(for: .meter())
    }
    if let hr = w.statistics(for: Self.heartRateType) {
      if let avg = hr.averageQuantity() { item["avgHr"] = avg.doubleValue(for: Self.bpm) }
      if let max = hr.maximumQuantity() { item["maxHr"] = max.doubleValue(for: Self.bpm) }
    }
    // Bieg rozpoczęty z treningu wysłanego przez Aloha na zegarek – id planu to id treningu z planu.
    if #available(iOS 17.0, *), let plan = try? await w.workoutPlan {
      item["plannedSessionId"] = plan.id.uuidString.lowercased()
    }

    let stream = try await series(for: w)
    item["time"] = stream.time
    item["distance"] = stream.distance
    if let hr = stream.heartrate { item["heartrate"] = hr }
    return item
  }

  /// Próbki przypisane do treningu (zapisuje je zegarek) → punkty: sekundy od startu, skumulowany dystans, tętno.
  private func series(for w: HKWorkout) async throws -> (time: [Double], distance: [Double], heartrate: [Double]?) {
    let own = HKQuery.predicateForObjects(from: w)
    let byEnd = [SortDescriptor(\HKQuantitySample.endDate)]
    let distances = try await HKSampleQueryDescriptor(
      predicates: [.quantitySample(type: Self.distanceType, predicate: own)], sortDescriptors: byEnd
    ).result(for: store)
    guard !distances.isEmpty else { return ([], [], nil) }
    let beats = try await HKSampleQueryDescriptor(
      predicates: [.quantitySample(type: Self.heartRateType, predicate: own)], sortDescriptors: byEnd
    ).result(for: store)

    var time: [Double] = [0]
    var distance: [Double] = [0]
    var total = 0.0
    for sample in distances {
      total += sample.quantity.doubleValue(for: .meter())
      let t = sample.endDate.timeIntervalSince(w.startDate)
      if t <= (time.last ?? 0) { distance[distance.count - 1] = total; continue }
      time.append(t)
      distance.append(total)
    }

    // Tętno w tych samych punktach: najbliższy wcześniejszy pomiar (na starcie – pierwszy pomiar).
    var heartrate: [Double]?
    if !beats.isEmpty {
      var values: [Double] = []
      var i = 0
      for t in time {
        while i + 1 < beats.count && beats[i + 1].endDate.timeIntervalSince(w.startDate) <= t { i += 1 }
        values.append(beats[i].quantity.doubleValue(for: Self.bpm))
      }
      heartrate = values
    }
    return (time, distance, heartrate)
  }
}
