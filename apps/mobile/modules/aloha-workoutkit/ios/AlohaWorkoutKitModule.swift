import ExpoModulesCore
import HealthKit
import SwiftUI
import WorkoutKit

// Trening Aloha jako trening własny w aplikacji Trening na Apple Watch (WorkoutKit, iOS 17+).
// Układ (rozgrzewka → bloki z powtórzeniami → schłodzenie) przychodzi z JS już w kształcie WorkoutKit,
// przełożenie z odcinków planu robi `toWatchWorkout` w @aloha/plan-engine.

struct SpeedRecord: Record {
  @Field var lowMps: Double = 0
  @Field var highMps: Double = 0
}

struct StepRecord: Record {
  @Field var durationS: Double = 0
  @Field var speed: SpeedRecord?
  /// Nazwa odcinka na zegarku (iOS 18+), np. „Spokojnie”.
  @Field var name: String?
}

struct IntervalRecord: Record {
  /// `work` albo `recovery`.
  @Field var purpose: String = "work"
  @Field var step: StepRecord = StepRecord()
}

struct BlockRecord: Record {
  @Field var iterations: Int = 1
  @Field var steps: [IntervalRecord] = []
}

struct WorkoutRecord: Record {
  /// UUID treningu z planu – ten sam trening zaplanowany ponownie zastępuje poprzedni.
  @Field var id: String = ""
  @Field var name: String = ""
  @Field var warmup: StepRecord?
  @Field var blocks: [BlockRecord] = []
  @Field var cooldown: StepRecord?
}

struct DateRecord: Record {
  @Field var year: Int = 0
  @Field var month: Int = 0
  @Field var day: Int = 0
  @Field var hour: Int?
  @Field var minute: Int?
}

final class UnsupportedException: Exception {
  override var reason: String { "WorkoutKit wymaga iOS 17 i sparowanego Apple Watch" }
}

final class InvalidWorkoutException: GenericException<String> {
  override var reason: String { "Nieprawidłowy trening: \(param)" }
}

final class PreviewBusyException: Exception {
  override var reason: String { "Nie ma ekranu, na którym można pokazać podgląd treningu" }
}

public class AlohaWorkoutKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AlohaWorkoutKit")

    /// Czy da się planować treningi na zegarek (iOS 17+ i urządzenie, które to obsługuje).
    Function("isSupported") { () -> Bool in
      guard #available(iOS 17.0, *) else { return false }
      return WorkoutScheduler.isSupported
    }

    /// `notDetermined` | `restricted` | `denied` | `authorized` | `unsupported`.
    AsyncFunction("getAuthorizationState") { () async -> String in
      guard #available(iOS 17.0, *) else { return "unsupported" }
      return Self.name(await WorkoutScheduler.shared.authorizationState)
    }

    AsyncFunction("requestAuthorization") { () async -> String in
      guard #available(iOS 17.0, *) else { return "unsupported" }
      return Self.name(await WorkoutScheduler.shared.requestAuthorization())
    }

    /// Planuje trening na dzień (i opcjonalnie godzinę). Ten sam `id` zaplanowany wcześniej jest najpierw usuwany.
    AsyncFunction("schedule") { (workout: WorkoutRecord, date: DateRecord) async throws in
      guard #available(iOS 17.0, *) else { throw UnsupportedException() }
      let plan = try Self.plan(from: workout)
      let scheduler = WorkoutScheduler.shared
      for existing in await scheduler.scheduledWorkouts where existing.plan.id == plan.id {
        await scheduler.remove(existing.plan, at: existing.date)
      }
      await scheduler.schedule(plan, at: Self.components(date))
    }

    /// Usuwa z zegarka zaplanowany trening o tym `id` (wszystkie daty).
    AsyncFunction("remove") { (id: String) async throws in
      guard #available(iOS 17.0, *) else { throw UnsupportedException() }
      let scheduler = WorkoutScheduler.shared
      for existing in await scheduler.scheduledWorkouts where existing.plan.id.uuidString.lowercased() == id.lowercased() {
        await scheduler.remove(existing.plan, at: existing.date)
      }
    }

    /// Treningi zaplanowane przez Aloha: `{ id, date: 'YYYY-MM-DD', complete }`.
    AsyncFunction("getScheduled") { () async -> [[String: Any]] in
      guard #available(iOS 17.0, *) else { return [] }
      return await WorkoutScheduler.shared.scheduledWorkouts.map { item in
        let d = item.date
        let date = String(format: "%04d-%02d-%02d", d.year ?? 0, d.month ?? 0, d.day ?? 0)
        return ["id": item.plan.id.uuidString.lowercased(), "date": date, "complete": item.complete]
      }
    }

    Constant("maxScheduled") { () -> Int in
      guard #available(iOS 17.0, *) else { return 0 }
      return WorkoutScheduler.maxAllowedScheduledWorkoutCount
    }

    /// Systemowy podgląd treningu z przyciskiem „Dodaj do Apple Watch”. Kończy się, gdy użytkownik zamknie arkusz.
    AsyncFunction("preview") { (workout: WorkoutRecord, promise: Promise) in
      guard #available(iOS 17.0, *) else { throw UnsupportedException() }
      let plan = try Self.plan(from: workout)
      guard let presenter = self.appContext?.utilities?.currentViewController() else { throw PreviewBusyException() }

      var host: UIViewController?
      let view = WorkoutPreviewHost(plan: plan) {
        host?.dismiss(animated: false)
        host = nil
        promise.resolve(nil)
      }
      let controller = UIHostingController(rootView: view)
      controller.view.backgroundColor = .clear
      controller.modalPresentationStyle = .overFullScreen
      host = controller
      presenter.present(controller, animated: false)
    }.runOnQueue(.main)
  }

  @available(iOS 17.0, *)
  private static func name(_ state: WorkoutScheduler.AuthorizationState) -> String {
    switch state {
    case .notDetermined: return "notDetermined"
    case .restricted: return "restricted"
    case .denied: return "denied"
    case .authorized: return "authorized"
    @unknown default: return "notDetermined"
    }
  }

  private static func components(_ d: DateRecord) -> DateComponents {
    DateComponents(calendar: .current, year: d.year, month: d.month, day: d.day, hour: d.hour, minute: d.minute)
  }

  @available(iOS 17.0, *)
  private static func step(_ r: StepRecord) -> WorkoutStep {
    let goal: WorkoutGoal = r.durationS > 0 ? .time(r.durationS, .seconds) : .open
    var alert: (any WorkoutAlert)?
    if let s = r.speed, s.lowMps > 0, s.highMps >= s.lowMps {
      let candidate = SpeedRangeAlert.speed(s.lowMps...s.highMps, unit: .metersPerSecond, metric: .current)
      if CustomWorkout.supportsAlert(candidate, activity: .running, location: .outdoor) { alert = candidate }
    }
    if #available(iOS 18.0, *), let name = r.name, !name.isEmpty {
      return WorkoutStep(goal: goal, alert: alert, displayName: name)
    }
    return WorkoutStep(goal: goal, alert: alert)
  }

  @available(iOS 17.0, *)
  private static func plan(from w: WorkoutRecord) throws -> WorkoutPlan {
    guard let id = UUID(uuidString: w.id) else { throw InvalidWorkoutException("id nie jest UUID") }
    let blocks = w.blocks
      .filter { !$0.steps.isEmpty }
      .map { b in
        IntervalBlock(
          steps: b.steps.map { IntervalStep($0.purpose == "recovery" ? .recovery : .work, step: step($0.step)) },
          iterations: max(1, b.iterations)
        )
      }
    guard !blocks.isEmpty || w.warmup != nil || w.cooldown != nil else { throw InvalidWorkoutException("brak odcinków") }
    let custom = CustomWorkout(
      activity: .running,
      location: .outdoor,
      displayName: w.name.isEmpty ? nil : w.name,
      warmup: w.warmup.map(step),
      blocks: blocks,
      cooldown: w.cooldown.map(step)
    )
    return WorkoutPlan(.custom(custom), id: id)
  }
}

/// Przezroczysty widok, który od razu otwiera systemowy arkusz podglądu i daje znać, gdy go zamknięto.
@available(iOS 17.0, *)
private struct WorkoutPreviewHost: View {
  let plan: WorkoutPlan
  let onClose: () -> Void
  @State private var presented = false

  var body: some View {
    Color.clear
      .ignoresSafeArea()
      .workoutPreview(plan, isPresented: $presented)
      .onAppear { presented = true }
      .onChange(of: presented) { _, isOpen in
        if !isOpen { onClose() }
      }
  }
}
