// Jednostki biegacza (Profil w aplikacji: km · °C albo mile · °F).
// Dane w bazie i w silniku są zawsze metryczne. Do modelu trafia pole `units` z krótką instrukcją
// w samej wiadomości (`unitsNote`) – działa więc z każdą wersją promptu systemowego z panelu.

export type Units = 'metric' | 'imperial';

export const METERS_PER_MILE = 1609.344;
export const KM_PER_MILE = METERS_PER_MILE / 1000;

/** Wartość z bazy albo z żądania → jednostki; wszystko poza `imperial` to metryczne. */
export const parseUnits = (value: unknown): Units => (value === 'imperial' ? 'imperial' : 'metric');

/** Instrukcja dla modelu: w jakich jednostkach pisać do biegacza i jak przeliczać dane. */
export function unitsNote(units: Units): string {
  return units === 'imperial'
    ? 'Biegacz używa mil i stopni Fahrenheita. W tekście dla niego: dystans w milach (mi), tempo na milę (min/mi), temperatura w °F, wiatr w mph – nigdy km ani °C. ' +
        'Liczby w danych są metryczne (m, km, min/km, s/km, °C, km/h), chyba że nazwa pola mówi inaczej (np. Mi, F, Mph). ' +
        'Przeliczaj: 1 mi = 1,609 km, tempo na milę = tempo na km × 1,609, °F = °C × 9/5 + 32, mph = km/h ÷ 1,609. Zaokrąglaj po ludzku. Nazwy zawodów (5 km, 10 km, półmaraton) zostają bez zmian.'
    : 'Biegacz używa kilometrów i stopni Celsjusza (km, min/km, °C, km/h).';
}

/** Pola do wiadomości dla modelu: `units` i instrukcja `unitsNote`. */
export const unitsForModel = (units: Units) => ({ units, unitsNote: unitsNote(units) });

export const celsiusToF = (c: number) => Math.round((c * 9) / 5 + 32);
export const kmhToMph = (kmh: number) => Math.round(kmh / KM_PER_MILE);
/** Sekundy na km → sekundy na milę (tempo albo różnica tempa). */
export const perKmToPerMile = (s: number) => Math.round(s * KM_PER_MILE);
