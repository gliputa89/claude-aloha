# Aloha Training – stan prac i kolejne kroki

*Ostatnia aktualizacja: 8 listopada 2026*

Plik do wznowienia pracy w nowej sesji.

## Dokumenty

| Plik | Zawartość | Status |
|---|---|---|
| [`PROJECT.md`](PROJECT.md) | produkt i MVP: wizja, persony, przepływ, check-in, skala zmian 0–4, rola AI, RODO, technologia, decyzje | v0.4 |
| [`BUSINESS.md`](BUSINESS.md) | konkurencja, propozycja wartości i pozycjonowanie, koszty AI i infrastruktury | v0.4 |
| [`MARKETING.md`](MARKETING.md) | wejście na rynek, kanały, lista oczekujących, beta, plan 12 tygodni, budżet, KPI | v1.0 |
| [`../design/mockups/`](../design/mockups/) | źródła makiet 4 ekranów (Dzisiaj → Check-in → Propozycja → Dzisiaj po zmianie) | zaakceptowane |

Prototyp online: https://claude.ai/artifact/9fNTK4T8hFSpaJyb1RdYCB

## Kluczowe decyzje (skrót)

- Tylko bieganie; 30–40 lat; od początkujących do ~36–37 min / 10 km.
- Check-in w dni treningowe o porze ustawionej przez użytkownika: **jeden suwak + opcjonalny tekst i podpowiedzi**; „Pomiń” = trening wg planu (bez opcji „odpuszczam”).
- Zmiany planu: propozycja z uzasadnieniem + akceptacja jednym tapnięciem; skala 0–4.
- AI hybrydowo: silnik reguł + Claude API z backendu; model wybierany na podstawie testu jakości.
- MVP w pełni darmowe; paywall po MVP. PL + EN. Logowanie e-mail. React Native (Expo) + Supabase. Integracje po MVP.
- Ton: trener, ale kumpel. Identyfikacja wizualna – osobny wątek.

## Otwarte tematy

1. Sekcja 5 w `BUSINESS.md`: ryzyka i ich ograniczanie.
2. Tempo budowy MVP → dopasowanie dat w planie marketingowym (plan zakłada betę pod koniec stycznia 2027).
3. Weryfikacja u źródła: ceny Runna w PL, język polski w Runna / Daptiv, oferta chceByc.fit, ceny Supabase / Expo.
4. Weryfikacja prawna dokumentów przed publikacją.

## Proponowane kolejne kroki

1. Strona z listą oczekujących (projekt + teksty) – pierwsze zadanie z planu marketingowego.
2. Scenariusz rozmowy z użytkownikiem do testu makiety.
3. Zasady planowania (silnik reguł) + przykładowy plan dla jednego celu.
4. Makiety ankiety startowej i widoku tygodnia.
5. Szkielet aplikacji (Expo + Supabase).
