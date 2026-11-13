import {
  AI_FUNCTIONS,
  AI_OPERATION_KINDS,
  AI_OPERATION_LABEL,
  CHAT_DAILY_LIMIT,
  CHECKIN_RULES,
  ENGINE_PARAM_GROUPS,
  ENGINE_RULES,
  ENGINE_VERSION,
  LEVEL_10K_ELITE_S,
  LEVEL_10K_FAST_S,
  METRIC_SPECS,
  MIN_PREP_WEEKS,
  REVIEW_VERSION,
  STRAVA_HISTORY_RULES,
  THRESHOLD_LADDER,
  TRAINING_LEVEL_INFO,
  TRAINING_LEVELS,
  VIOLATION_LABEL,
  WEATHER_FLAGS,
  ZONE_INFO,
  paramsForLevel,
  type ParamGroup,
} from '@aloha/plan-engine';
import Link from 'next/link';
import { Suspense } from 'react';

import { loadAiRuntime } from '@/lib/ai/runtime';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

// Ekran „Jak to działa” – jedno miejsce, z którego da się opowiedzieć trenerowi cały system:
// skąd biorą się treningi, na jakiej podstawie, co w nich jest regułą, co liczbą, a co decyzją modelu.
// Liczby i listy pochodzą z aktywnej wersji parametrów i z kodu silnika (nic nie jest tu przepisane ręcznie),
// więc ekran nie rozjedzie się z aplikacją po zmianie parametrów czy reguł.

export const metadata = { title: 'Jak to działa – Aloha' };

/** Ostrzeżenia pogodowe po polsku – w kodzie są kodami, tu opisujemy je trenerowi. */
const WEATHER_FLAG_PL: Record<(typeof WEATHER_FLAGS)[number], string> = {
  storm: 'burza',
  ice: 'gołoledź',
  heat: 'upał',
  frost: 'mróz',
  smog: 'smog',
  wind: 'wiatr',
  rain: 'deszcz',
  uv: 'silne UV',
  dark: 'ciemno',
};

const SECTIONS = [
  { id: 'skrot', label: 'W skrócie' },
  { id: 'wejscie', label: 'Na czym opiera się plan' },
  { id: 'poziom', label: 'Poziom 1–5' },
  { id: 'tydzien', label: 'Jak powstaje tydzień' },
  { id: 'liczby', label: 'Liczby silnika' },
  { id: 'trening', label: 'Budowa treningu' },
  { id: 'ai', label: 'Co robi AI' },
  { id: 'pozniej', label: 'Po treningu' },
  { id: 'zmiany', label: 'Co można zmienić' },
  { id: 'pytania', label: 'Pytania do trenera' },
] as const;

export default function HowItWorksPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl min-w-0 flex-1 flex-col gap-10 px-4 py-8">
      <Suspense fallback={<p className="text-text-muted">Wczytuję opis systemu…</p>}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  await requireAdmin();
  const { engine } = await loadAiRuntime(createServiceClient());
  const p = (level: (typeof TRAINING_LEVELS)[number]) => paramsForLevel(engine.params, level);
  const mid = p(3);
  const metricsOf = (group: ParamGroup) => METRIC_SPECS.filter((m) => m.group === group);
  const minutes = (s: number) => Math.round(s / 60);

  return (
    <>
      <header className="flex flex-col gap-3">
        <span className="text-sm text-text-muted">Aloha Training · podkładka do rozmowy z trenerem</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Jak dziś działa system</h1>
        <p className="text-text-muted">
          Ten ekran opisuje stan faktyczny: skąd biorą się treningi w aplikacji, na jakiej podstawie są wyliczane, co jest
          twardą regułą, co liczbą do ustawienia, a co decyzją modelu. Liczby poniżej są wczytane z aktywnej wersji
          parametrów (<b>{engine.version ? `v${engine.version}` : 'wartości wbudowane w kod'}</b>), a listy reguł wprost z kodu
          silnika (<b>{ENGINE_VERSION}</b>) – nie ma tu nic przepisanego ręcznie, więc opis nie rozejdzie się z aplikacją.
        </p>
        <nav aria-label="Spis treści" className="flex flex-wrap gap-2 text-sm print:hidden">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-pill bg-background px-3 py-1 text-text-muted hover:text-text">
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="skrot" title="W skrócie: kto właściwie układa trening">
        <p>
          Planu <b>nie układa model językowy</b>. Układa go deterministyczny silnik reguł – ten sam kod liczy w aplikacji, w
          funkcjach serwera i w testerze w tym panelu, więc to, co widzisz w testerze, jest dokładnie tym, co dostanie
          biegacz. Claude dostaje gotowy, bezpieczny szkic i może go tylko <i>poprawić</i>: zwraca listę operacji (skróć,
          zmień rodzaj, przenieś, usuń, dodaj, ułóż część główną), a silnik nakłada je po kolei i cofa każdą, która
          wprowadza nowe naruszenie reguł. Wynik jest więc zawsze nie gorszy – pod względem reguł – niż szkic. Gdy model nie
          odpowie albo odpowie błędnie, zostaje szkic. Aplikacja działa bez AI.
        </p>
        <Flow
          steps={[
            'Ankieta startowa (opcjonalnie wypełniona podpowiedziami ze Stravy)',
            'Poziom zaawansowania 1–5',
            'Szkic 2 pierwszych tygodni – silnik reguł',
            'Claude: lista operacji na szkicu + rady do treningów',
            'Walidacja każdej operacji regułami silnika',
            'Plan w aplikacji (tygodnie, treningi, odcinki)',
            'Wykonanie: odhaczenie albo bieg ze Stravy / zegarka',
            'Ocena treningu z reguł + notka trenera od AI',
            'Check-in i czat: korekty w bieżącym tygodniu',
            'Co tydzień: przegląd poziomu → kolejny tydzień',
          ]}
        />
      </Section>

      <Section id="wejscie" title="Na czym opiera się plan">
        <p>
          Wejściem jest ankieta startowa. Nic poza nią (i poza tym, co biegacz sam zrobi później w aplikacji) nie wpływa na
          treningi – nie ma żadnych ukrytych danych ani profilowania.
        </p>
        <Table
          head={['Z ankiety', 'Co z tego wynika w planie']}
          rows={[
            ['Cel: zawody (dystans, data, czas docelowy) albo cel ogólny (zacznij biegać / popraw formę / biegaj regularnie)', 'Czy w tygodniu jest mocna jednostka, jaki jej rodzaj, czy jest wyciszenie przed startem, minimalny czas przygotowań'],
            ['Jak teraz biegasz: nie biegam / okazjonalnie / regularnie', 'Punkt wyjścia poziomu zaawansowania 1–5'],
            ['Ostatni wynik (dystans + czas)', 'Koryguje poziom (przeliczenie na 10 km), daje strefy tempa odcinków i prognozę czasu na zawody'],
            ['Preferowane dni tygodnia', 'Jedyne dni, w które silnik stawia treningi'],
            ['Liczba treningów w tygodniu', 'Tyle treningów ma pełny tydzień (w niepełnym proporcjonalnie mniej)'],
            ['Limit minut: dzień roboczy / weekend', 'Twardy limit długości każdego treningu w tym dniu – ani silnik, ani AI go nie przekroczy'],
            ['Przeciwwskazania zdrowotne', `Tylko spokojne jednostki, krótsze o ${mid.gentleReductionPct}%`],
            ['Ile biegów w tygodniu i jaki kilometraż teraz', 'Kontekst dla AI (czy szkic nie jest za ambitny) i dla prognozy startu'],
            ['Strefa czasowa', 'Co jest „dzisiaj” – dla planu, check-inu i pogody'],
          ]}
        />
        <h3 className="font-semibold">Strava – tylko podpowiedzi do ankiety</h3>
        <p>
          Po połączeniu konta silnik analizuje biegi z ostatnich {STRAVA_HISTORY_RULES.weeks} tygodni i proponuje odpowiedzi:
          najlepszy wynik z całego okna, poziom i typowy czas biegu z ostatnich {STRAVA_HISTORY_RULES.formWeeks} tygodni, a
          liczbę biegów i kilometraż z ostatnich {STRAVA_HISTORY_RULES.recentWeeks} tygodni (bo „teraz” waży więcej niż „trzy
          miesiące temu”). Biegacz widzi propozycje i może każdą zmienić – nic nie wchodzi do planu po cichu. Zapisy krótsze
          niż {STRAVA_HISTORY_RULES.minDistanceM / 1000} km albo {minutes(STRAVA_HISTORY_RULES.minMovingTimeS)} min nie liczą
          się jako bieg.
        </p>
        <h3 className="font-semibold">Cele: jeden prowadzi, do trzech jest obok</h3>
        <p>
          Plan prowadzi jeden cel (zawody A albo cel ogólny). Cele obok mają własny postęp, a na tygodnie wpływają tylko
          lokalnie: zawody B i sprawdziany formy wchodzą w swój tydzień jako start i <b>zastępują</b> mocny trening tego
          tygodnia – drugi mocny bodziec w tym samym tygodniu byłby za dużo.
        </p>
        <h3 className="font-semibold">Kiedy cel jest nierealny</h3>
        <p>
          Przy celu „zawody” reguły sprawdzają dwie rzeczy, zanim plan powstanie: czy do startu zostało dość tygodni i czy
          czas docelowy jest osiągalny. Minimalny czas przygotowań zależy od dystansu i obecnego poziomu – od{' '}
          {MIN_PREP_WEEKS.advanced[5000]} tygodni (5 km, biegacz zaawansowany) do {MIN_PREP_WEEKS.beginner[42195]} tygodni
          (maraton od zera). Za krótko → aplikacja proponuje krótszy dystans albo późniejszą datę. Czas docelowy szybszy niż
          prognoza → proponuje realny czas. Prognozę liczą tabele Danielsa (VDOT) skorygowane o kilometraż i o malejącą
          poprawę formy; model dostaje te widełki i tylko doprecyzowuje wynik w ich granicach.
        </p>
      </Section>

      <Section id="poziom" title="Poziom zaawansowania 1–5 – od niego zależy wszystko">
        <p>
          Poziom to jedna liczba, która wybiera kolumnę wszystkich parametrów silnika. Na starcie liczy go deklaracja z
          ankiety, skorygowana ostatnim wynikiem przeliczonym na 10 km (wzór Riegela): próg szybki ={' '}
          {minutes(LEVEL_10K_FAST_S)} min, próg wyczynowy = {minutes(LEVEL_10K_ELITE_S)} min na 10 km.
        </p>
        <Table
          head={['Poziom', 'Nazwa', 'Kryterium z ankiety', 'Bazowy trening', 'Przyrost', 'Mocne jednostki', 'Lżejszy tydzień']}
          rows={TRAINING_LEVELS.map((l) => {
            const lp = p(l);
            return [
              String(l),
              TRAINING_LEVEL_INFO[l].label,
              TRAINING_LEVEL_INFO[l].criterion,
              `${lp.baseEasyMin} min`,
              `${lp.weeklyGrowthPct}%`,
              l === 1 ? 'nigdy' : `do ${lp.maxHardPerWeek}/tyg.`,
              lp.deloadEveryWeeks >= 3 ? `co ${lp.deloadEveryWeeks}. tydzień` : 'brak',
            ];
          })}
        />
        <h3 className="font-semibold">Przegląd poziomu – raz w tygodniu, zawsze o jeden</h3>
        <p>
          Przy generowaniu kolejnego tygodnia silnik sprawdza trzy grupy reguł w tej kolejności; wygrywa pierwsza pasująca i
          zmienia poziom najwyżej o jeden. Progi to parametry z kolumny obecnego poziomu (poniżej dla poziomu 3).
        </p>
        <Ol
          items={[
            `Spadek – bezpieczeństwo pierwsze: ból lub czerwona flaga w check-inie w ostatnich 14 dniach; ${mid.levelBreakDays} dni bez wykonanego treningu; mniej niż ${mid.levelDownMaxDonePct}% wykonanych treningów w każdym z 2 ostatnich pełnych tygodni.`,
            'Nowa ankieta albo nowy wynik – o jeden poziom w stronę tego, co wychodzi z ankiety (w górę tylko, gdy nie było bólu w 28 dniach).',
            `Awans – co najmniej ${mid.levelUpMinWeeks} tyg. na obecnym poziomie, co najmniej ${mid.levelUpMinDonePct}% wykonanych treningów w 3 ostatnich pełnych tygodniach i brak bólu w 28 dniach.`,
          ]}
        />
        <p className="text-sm text-text-muted">
          Zmiana poziomu nie przestawia objętości na bazową wartość nowego poziomu – kolejny tydzień rośnie od bazy
          poprzedniego tygodnia, tylko już przyrostem nowego poziomu. Po spadku: bez przyrostu, najwyżej bazowy trening
          nowego poziomu. Każda decyzja zapisuje się z uzasadnieniem i liczbami, na których ją oparto.
        </p>
      </Section>

      <Section id="tydzien" title="Jak powstaje jeden tydzień – krok po kroku">
        <p>
          Wszystko poniżej liczy się z jednej liczby: <b>bazy objętości</b> tygodnia, czyli długości spokojnego biegu. Baza
          pierwszego tygodnia to bazowy trening poziomu, każdy kolejny tydzień to baza poprzedniego × przyrost. Baza jest
          zapisywana przy tygodniu, żeby małe przyrosty nie gubiły się w zaokrągleniach.
        </p>
        <Ol
          items={[
            'Kalendarz: plan zaczyna się w dniu startu, tydzień 0 trwa do najbliższej niedzieli, dalej pon–nd. Jeśli w niepełnym tygodniu 0 nie wypada żaden trening, plan startuje od poniedziałku.',
            'Dni treningowe: tylko dni preferowane z ankiety, wybrane tak, by odstępy były jak największe (z premią za dzień weekendowy). Najwyżej jeden trening dziennie.',
            'Liczba treningów: tyle, ile w ankiecie; w niepełnym tygodniu proporcjonalnie mniej, ale co najmniej 1.',
            `Spokojne biegi: długość = baza, zaokrąglona do 5 min, nie krócej niż ${mid.minSessionMin} min i nie dłużej niż limit dnia.`,
            `Długi bieg: baza × ${mid.longFactor}, w ostatnim dniu weekendowym (albo ostatnim treningu tygodnia). Jest przy co najmniej 2 treningach i nigdy na poziomie 1.`,
            `Mocna jednostka: baza + 5 min, nie krócej niż ${mid.qualityMinMin} min, w dniu odległym od długiego biegu o co najmniej ${mid.minDaysHardToLong} dni. Silnik stawia najwyżej jedną; w tygodniu jest tylko przy co najmniej 3 treningach, od poziomu 2 i tylko przy celu „popraw formę” albo zawodach (od 2. tygodnia, na poziomach 4–5 od 1.).`,
            `Twardy limit przyrostu: suma minut pełnego tygodnia ≤ poprzedni pełny tydzień × ${(1 + mid.weeklyGrowthPct / 100).toFixed(2)}. Nadmiar jest przycinany po 5 min z najdłuższych treningów (nigdy poniżej minimum, nigdy z zawodów).`,
            `Lżejszy tydzień cyklu (poziomy z ustawionym cyklem): treningi krótsze o ${mid.deloadReductionPct}%, mocna jednostka to krótkie interwały z ok. 60% powtórzeń. Baza nie rośnie – tydzień po lżejszym wraca na bazę sprzed niego plus przyrost.`,
            `Zawody i starty kontrolne: start w dniu zawodów, dzień przed i po wolne, ostatnie ${mid.raceEasyDaysBefore} dni przed startem tylko spokojnie i krótko (do 20 min).`,
            `Przeciwwskazania: wyłącznie spokojne jednostki, wszystkie krótsze o ${mid.gentleReductionPct}%.`,
            'Poziom 1: wyłącznie marszobieg (rozgrzewka marszem, potem powtórzenia bieg/marsz – od 2. tygodnia 2 min biegu zamiast 1), bez długiego biegu i bez mocnych jednostek.',
          ]}
        />
        <Note>
          Pełna lista reguł, które są logiką w kodzie (a nie liczbą do ustawienia), jest też w{' '}
          <Link href="/ai/rules" className="font-medium text-text-brand hover:underline">
            Ramach planu
          </Link>{' '}
          – tam widać je w tej samej postaci, w jakiej dostaje je Claude w prompcie. Poniżej te same reguły, dla kompletu:
        </Note>
        <ul className="flex flex-col gap-2 text-sm">
          {ENGINE_RULES.map((r) => (
            <li key={r.title}>
              <b>{r.title}.</b> <span className="text-text-muted">{r.detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="liczby" title="Liczby silnika – co dokładnie da się ustawić bez programisty">
        <p>
          Każda metryka ma osobną wartość dla każdego poziomu 1–5. Te liczby edytuje się w panelu, w wersjach (aktywna wersja
          obowiązuje od następnego generowania). Granice [min, max] są w kodzie i panel ich nie przekroczy; wartość spoza
          granic nie jest po cichu przycinana – silnik wraca wtedy do wartości wbudowanych. Logika, która z tych liczb
          korzysta, zostaje w kodzie.
        </p>
        {(Object.keys(ENGINE_PARAM_GROUPS) as ParamGroup[]).map((group) => (
          <div key={group} className="flex flex-col gap-2">
            <h3 className="font-semibold">{ENGINE_PARAM_GROUPS[group]}</h3>
            <Table
              head={['Co to jest', ...TRAINING_LEVELS.map((l) => `Poz. ${l}`), 'Zakres']}
              rows={metricsOf(group).map((m) => [
                <span key="l" className="flex flex-col">
                  <b>
                    {m.label} <span className="font-normal text-text-muted">({m.unit})</span>
                  </b>
                  <span className="text-xs text-text-muted">{m.description}</span>
                </span>,
                ...TRAINING_LEVELS.map((l) => String(engine.params[`${m.metric}L${l}`])),
                `${m.min}–${m.max}`,
              ])}
            />
          </div>
        ))}
      </Section>

      <Section id="trening" title="Budowa pojedynczego treningu">
        <p>
          Każdy trening to lista odcinków: rozgrzewka → część główna (powtórzenia i przerwy) → schłodzenie; suma odcinków
          równa się długości treningu. Ten sam zapis idzie na zegarek (Apple WorkoutKit: rozgrzewka, bloki powtórzeń,
          schłodzenie – Garmin i COROS mają te same elementy). Każdy odcinek ma strefę wysiłku, a gdy znamy ostatni wynik
          biegacza – także zakres tempa w s/km. Bez wyniku zostaje sama strefa.
        </p>
        <Table
          head={['Strefa', 'Opis wysiłku']}
          rows={(Object.keys(ZONE_INFO) as (keyof typeof ZONE_INFO)[]).map((z) => [ZONE_INFO[z].label, ZONE_INFO[z].effort])}
        />
        <h3 className="font-semibold">Rodzaje treningów</h3>
        <Table
          head={['Rodzaj', 'Jak go liczy silnik']}
          rows={[
            ['Marszobieg', '5 min marszu na rozgrzewkę, potem powtórzenia: 1–2 min biegu + 2 min marszu, co najmniej 3 powtórzenia'],
            ['Spokojny bieg', 'Jednostajny bieg o długości bazy tygodnia'],
            ['Długi bieg', `Jednostajny, baza × ${mid.longFactor}`],
            ['Interwały', 'Rozgrzewka 8–10 min, 3–8 powtórzeń po 2 min (poziomy 4–5: 3 min) z 2 min przerwy, schłodzenie 7–10 min'],
            ['Trening progowy / tempo', 'Odcinki w strefie tempo wg drabinki poniżej; gdy żaden szczebel się nie mieści – tempo ciągłe 10–25 min'],
            ['Zawody / sprawdzian', 'Sam start – silnik ani AI nie zmieniają go nigdy'],
          ]}
        />
        <h3 className="font-semibold">Drabinka treningu progowego</h3>
        <p>
          Przy każdym kolejnym treningu progowym biegacz wchodzi o szczebel wyżej – odcinek się wydłuża, aż do biegu
          ciągłego. Poziomy 4–5 startują od drugiego szczebla. Szczebel, który nie mieści się w długości treningu albo w
          limicie mocnych minut ({mid.maxTempoSharePct}% treningu w strefach tempo + interwał + przebieżka), jest zastępowany
          niższym.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          {THRESHOLD_LADDER.map((rung, i) => (
            <span key={i} className="rounded-pill bg-background px-3 py-1">
              {i + 1}. {rung.repeats > 1 ? `${rung.repeats}×${rung.workMin} min` : `${rung.workMin} min ciągiem`}
              {rung.recoveryMin ? <span className="text-text-muted"> (przerwa {rung.recoveryMin} min)</span> : null}
            </span>
          ))}
        </div>
        <p className="text-sm text-text-muted">
          Rodzaj mocnej jednostki: poziom 2 – tylko interwały; od poziomu 3 na zmianę interwały i trening progowy; półmaraton
          i maraton – co tydzień tempo ciągłe. W lżejszym tygodniu zawsze krótkie interwały (bodziec zostaje, zmęczenie nie).
        </p>
      </Section>

      <Section id="ai" title="Co dokładnie robi AI – i czego nie może">
        <p>
          Model odpowiada za <b>dopasowanie i słowa</b>, nigdy za bezpieczeństwo. Każde wywołanie ma własny prompt, model i
          limit tokenów (wersjonowane w panelu) i zapisuje się w logu z pełnym wejściem, odpowiedzią, kosztem i wynikiem
          walidacji.
        </p>
        <Table
          head={['Funkcja', 'Co robi model']}
          rows={(Object.keys(AI_FUNCTIONS) as (keyof typeof AI_FUNCTIONS)[]).map((fn) => [
            AI_FUNCTIONS[fn].label,
            AI_FUNCTIONS[fn].description,
          ])}
        />
        <h3 className="font-semibold">Operacje na szkicu planu</h3>
        <ul className="flex flex-col gap-1 text-sm">
          {AI_OPERATION_KINDS.map((k) => (
            <li key={k}>
              <b>{AI_OPERATION_LABEL[k]}</b> <code className="text-xs text-text-muted">{k}</code>
            </li>
          ))}
        </ul>
        <p>
          Granice: model może skracać treningi zawsze (do minimum), ale wydłużyć tydzień najwyżej o{' '}
            {mid.aiMaxIncreasePct}% względem szkicu; nie doda więcej treningów, niż było w szkicu; nie ułoży struktury
          treningu (rozgrzewkę, powtórzenia i schłodzenie zawsze dokłada silnik); nie dotknie zawodów. Gdy sam układa część
          główną, mocne minuty muszą zmieścić się w limitach ({mid.maxHardSharePct}% w strefach interwał / przebieżka,{' '}
          {mid.maxTempoSharePct}% razem z tempem).
        </p>
        <h3 className="font-semibold">Co silnik odrzuca</h3>
        <ul className="grid gap-x-4 gap-y-1 text-sm text-text-muted sm:grid-cols-2">
          {Object.entries(VIOLATION_LABEL).map(([code, label]) => (
            <li key={code}>{label}</li>
          ))}
        </ul>
        <p className="text-sm text-text-muted">
          Operacja, która wprowadza nowe naruszenie, jest cofana; model dostaje listę odrzuconych z powodami i jedno
          ponowienie. Gdy i ono nie przejdzie – zostaje szkic silnika.
        </p>
      </Section>

      <Section id="pozniej" title="Co się dzieje wokół planu">
        <Table
          head={['Moment', 'Reguły (bez AI)', 'Rola AI']}
          rows={[
            [
              'Po wykonanym treningu',
              `Ocena (wersja ${REVIEW_VERSION}) z dwóch osi: objętość (czas / dystans względem planu) i intensywność (tempo względem stref treningu, a przy zgodzie na dane zdrowotne – także tętno). Każde odchylenie ma wagę 0–3, najcięższe decyduje o werdykcie: „w punkt”, „dobra robota”, „zaliczone, ale…”, „inny trening niż w planie”.`,
              'Pisze 2–3 zdania do gotowej oceny – nie zmienia werdyktu.',
            ],
            [
              'Check-in „jak się dziś czujesz?”',
              `Ocena 1–5 i podpowiedzi. Od oceny ${CHECKIN_RULES.lowWellbeing} w dół lżejsza wersja: mocna jednostka staje się spokojnym biegiem, spokojny – krótszym (${Math.round(CHECKIN_RULES.easierFactor * 100)}% albo ${Math.round(CHECKIN_RULES.easiestFactor * 100)}% długości). „Mało czasu” → trening skrócony do ok. ${CHECKIN_RULES.littleTimeMin} min. „Mało snu” → liczone jak ocena o jeden niższa. „Coś boli” → reguły nie proponują nic, aplikacja kieruje do czatu.`,
              'Brak – to jedno tapnięcie, nie rozmowa.',
            ],
            [
              'Czat z trenerem (Pan Aloha)',
              `Model może zaproponować jedną zmianę w planie; silnik sprawdza ją tymi samymi regułami co plan, a zapis następuje dopiero po akceptacji biegacza. Limit ${CHAT_DAILY_LIMIT} wiadomości na dzień. Wiadomości o zdrowiu wymagają osobnej zgody – bez niej nie są zapisywane ani wysyłane do modelu.`,
              'Odpowiada na pytania z kontekstem planu, ocen i pogody.',
            ],
            [
              'Pogoda do treningu',
              `Reguły wybierają najlepsze okno godzinowe i ostrzeżenia: ${WEATHER_FLAGS.map((f) => WEATHER_FLAG_PL[f]).join(', ')}.`,
              'Ubiera gotowy wynik w jedno zdanie; bez AI aplikacja składa tekst ze słownika.',
            ],
            [
              'Zegarek i Strava',
              'Trening eksportowany jako rozgrzewka → bloki powtórzeń → schłodzenie z celami tempa. Bieg ze Stravy sam odhacza trening (z wykrywaniem duplikatów i pytaniem o przesunięty dzień).',
              'Brak.',
            ],
          ]}
        />
      </Section>

      <Section id="zmiany" title="Co można zmienić – i gdzie to się robi">
        <p>System ma cztery warstwy zmian, od najtańszej do najdroższej. Warto je rozdzielić w rozmowie z trenerem.</p>
        <Layer
          n={1}
          title="Biegacz w aplikacji"
          what="Cel i cele obok, deklarowany poziom i ostatni wynik, dni tygodnia, liczba treningów, limity minut, przeciwwskazania, check-in, czat."
          effect="Dni, limity i liczba treningów działają od kolejnego generowanego tygodnia. Bieżący tydzień zmienia się tylko przez check-in albo czat (po akceptacji propozycji). Nowa ankieta lub nowy wynik wchodzą do planu przez przegląd poziomu – o jeden poziom na tydzień."
        />
        <Layer
          n={2}
          title="Panel → AI → Ramy planu (liczby, bez programisty)"
          what="Wszystkie liczby z sekcji „Liczby silnika”, osobno dla każdego poziomu: bazowe długości, przyrost, cykl i głębokość lżejszego tygodnia, mnożnik długiego biegu, minima, domyślne limity czasu, liczba i odstęp mocnych jednostek, udziały mocnych minut, wyciszenie przed zawodami, progi awansu i spadku, granica wydłużenia dla AI."
          effect="Zapisywane jako wersja; aktywna obowiązuje od następnego generowania. Granice są w kodzie, więc żadna wartość nie wyjdzie poza bezpieczny zakres. Efekt dowolnej zmiany można sprawdzić na żywym koncie w Testerze planów, zanim stanie się aktywna."
        />
        <Layer
          n={3}
          title="Panel → AI → Prompty (słowa i zachowanie modelu)"
          what="Model, poziom „wysiłku”, limit tokenów i treść promptu systemowego dla każdej z funkcji AI – osobno dla układania planu, notek, czatu, pogody i prognozy."
          effect="Zmienia ton i decyzje modelu, nie zmienia granic: prompt nie może rozszerzyć tego, na co pozwala walidacja. Każda wersja promptu ma swój koszt i statystyki w logu wywołań."
        />
        <Layer
          n={4}
          title="Kod (commit i testy)"
          what="Logika: progi poziomów z ankiety i kolejność reguł przeglądu, sposób rozkładania dni, to, który dzień dostaje długi bieg i mocną jednostkę, drabinka progowa i budowa interwałów, zasady wyciszenia, lista operacji dostępnych dla AI i cała walidacja, osie i wagi oceny treningu, reguły check-inu, pogody i Stravy, podział na moduły i pakiety."
          effect="Każda taka zmiana to commit z testami. To tu trafiają wnioski z rozmowy z trenerem, których nie da się wyrazić jedną liczbą – na przykład nowy rodzaj treningu albo inna progresja długiego biegu."
        />
      </Section>

      <Section id="pytania" title="Pytania do trenera – tu najbardziej brakuje wiedzy trenerskiej">
        <p>
          Lista rzeczy, które dziś są świadomym uproszczeniem albo decyzją podjętą „na rozsądek”. Każda z nich jest do
          zmiany; przy części wystarczy inna liczba, przy części trzeba dopisać regułę.
        </p>
        <Ul
          items={[
            'Bazowe długości i przyrost na poziom (dziś 25–50 min i 10% tygodniowo dla wszystkich): czy to dobre punkty wyjścia i czy przyrost powinien zależeć od poziomu?',
            `Długi bieg to dziś baza × ${mid.longFactor} na każdym poziomie – czy powinien rosnąć szybciej niż reszta tygodnia i mieć własny limit?`,
            'Cykl z lżejszym tygodniem mają dziś tylko poziomy 4–5. Czy początkujący nie potrzebują go bardziej?',
            'Awans po 4 tygodniach i 85% wykonanych treningów, spadek poniżej 50% w 2 tygodniach, przerwa 14 dni – czy te progi odpowiadają praktyce trenerskiej?',
            'Spadek poziomu po jednym bólu w check-inie: zbyt ostre czy właśnie dobrze?',
            'Przy półmaratonie i maratonie mocna jednostka to co tydzień tempo ciągłe – bez interwałów i bez progresji długiego biegu. Jak powinien wyglądać taki tydzień?',
            `Wyciszenie przed startem to ${mid.raceEasyDaysBefore} dni na każdym dystansie – maraton prawdopodobnie potrzebuje dłuższego i innego.`,
            'Po głównych zawodach plan się kończy – nie ma tygodnia regeneracji ani „co dalej”.',
            'W planie jest tylko bieganie: brak siły, mobilności, podbiegów i treningu w terenie. Co dołożyć najpierw i jak to policzyć w minutach tygodnia?',
            'Najwyżej jedna mocna jednostka od silnika (AI może dołożyć drugą do limitu) – kiedy druga ma sens?',
            'Tempo odcinków bierzemy wyłącznie z ostatniego wyniku (Riegel / VDOT). Bez wyniku zostaje opis wysiłku – czy to wystarcza, czy potrzebny jest test wejściowy?',
          ]}
        />
        <Note>
          Dobre miejsca na wspólne „pokaż mi, jak to wygląda”:{' '}
          <Link href="/tester" className="font-medium text-text-brand hover:underline">
            Tester planów
          </Link>{' '}
          (konto testowe, ankieta, generowanie dowolnego tygodnia) i{' '}
          <Link href="/ai/simulator" className="font-medium text-text-brand hover:underline">
            Symulator
          </Link>{' '}
          (porównanie tygodni przy różnych parametrach).
        </Note>
      </Section>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-4">
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Flow({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-start gap-3 rounded-card border border-border bg-surface px-4 py-2.5 text-sm">
          <span className="font-display text-sm font-semibold text-text-muted tabular-nums">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Table({ head, rows }: { head: React.ReactNode[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[32rem] text-sm">
        <thead className="text-left text-xs text-text-muted">
          <tr className="border-b border-border">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border align-top last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2 ${j === 0 ? '' : 'text-text-muted'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ol({ items }: { items: string[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ol>
  );
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-card border border-border bg-background px-4 py-3 text-sm text-text-muted">{children}</p>;
}

function Layer({ n, title, what, effect }: { n: number; title: string; what: string; effect: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
      <h3 className="flex items-baseline gap-2 font-semibold">
        <span className="rounded-pill bg-surface-brand-soft px-2 py-0.5 text-xs font-semibold text-text-brand">{n}</span>
        {title}
      </h3>
      <p className="text-sm">
        <b>Co:</b> <span className="text-text-muted">{what}</span>
      </p>
      <p className="text-sm">
        <b>Od kiedy i z jakim skutkiem:</b> <span className="text-text-muted">{effect}</span>
      </p>
    </section>
  );
}
