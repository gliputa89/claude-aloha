// Treści landing page'a (PL + EN). Opisujemy wyłącznie funkcje, które działają w aplikacji –
// stan na 11.11.2026: plan z ankiety, kolejne tygodnie układane na bieżąco, pogoda, Strava,
// ocena treningu, notatki trenera. Check-in przed treningiem NIE jest jeszcze zbudowany.

export const locales = ["pl", "en"] as const;
export type Locale = (typeof locales)[number];

export const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

/** PL jest pod adresem głównym, EN pod /en (tak linkuje aplikacja mobilna). */
export const localePath = (locale: Locale) => (locale === "pl" ? "/" : "/en");

/** Adresy stron prawnych – takie same jak w aplikacji mobilnej (apps/mobile/src/lib/links.ts). */
export type LegalDoc = "privacy" | "terms";
export const legalPath: Record<LegalDoc, Record<Locale, string>> = {
  privacy: { pl: "/polityka-prywatnosci", en: "/en/privacy" },
  terms: { pl: "/regulamin", en: "/en/terms" },
};

export type WorkoutKind = "easy" | "long" | "intervals" | "rest";

export type WeekDay = {
  short: string;
  name: string;
  kind: WorkoutKind;
  /** Minuty – wysokość słupka w pasku tygodnia; 0 = dzień wolny. */
  minutes: number;
  title: string;
  meta: string;
  steps: string[];
  /** Pusty tekst = dzień bez biegu, pogody nie pokazujemy. */
  weather: string;
  coach: string;
};

export type Content = {
  meta: { title: string; description: string };
  nav: { features: string; how: string; faq: string; download: string; soon: string; switchLabel: string };
  store: {
    ios: [string, string];
    android: [string, string];
    note: string;
    /** Wersja sprzed premiery: plakietki bez linku, dopóki sklep nie ma adresu (storeLinks). */
    soon: { ios: [string, string]; android: [string, string] };
  };
  hero: {
    title: string;
    /** Nagłówek w wierszach; ostatni wiersz kończy zmieniające się słowo. */
    titleLines: [string, string, string];
    titleWords: string[];
    lead: string;
    pause: string;
    play: string;
    switchVideo: string;
    phoneAlt: string;
  };
  audience: { title: string; body: string };
  screens: {
    title: string;
    note?: string;
    items: { image: "today" | "plan" | "workout" | "review"; title: string; body: string; alt: string }[];
  };
  week: {
    title: string;
    lead: string;
    hint: string;
    weatherLabel: string;
    coachLabel: string;
    legend: Record<WorkoutKind, string>;
    days: WeekDay[];
  };
  start: { title: string; body: string; points: string[]; photoAlt: string };
  review: {
    title: string;
    body: string;
    points: string[];
    card: {
      source: string;
      verdict: string;
      workout: string;
      rows: [string, string][];
      note: string;
      link: string;
    };
  };
  chat: {
    title: string;
    body: string;
    points: string[];
    coaches: { name: string; kind: string; body: string }[];
    demo: {
      name: string;
      role: string;
      user: string;
      reply: string;
      proposalTitle: string;
      proposal: string;
      accept: string;
      decline: string;
    };
  };
  coaches: {
    title: string;
    body: string[];
    available: string;
    years: string;
    demo: string;
  };
  weather: {
    title: string;
    body: string;
    points: string[];
    card: { place: string; best: string; bestTime: string; avoid: string; avoidTime: string; tip: string };
    photoAlt: string;
  };
  how: { title: string; steps: { title: string; body: string }[] };
  voice: { title: string; quotes: string[]; marks: [string, string]; label: string };
  faq: { title: string; items: { q: string; a: string }[] };
  final: { title: string; body: string; bodySoon: string; photoAlt: string };
  footer: { tagline: string; privacy: string; terms: string; legalLabel: string };
};

const pl: Content = {
  meta: {
    title: "Aloha App – plan biegowy, który dopasowuje się do Twojego dnia",
    description:
      "Plan biegowy dla zapracowanych amatorów. Aloha układa każdy kolejny tydzień na podstawie tego, jak poszedł poprzedni, podpowiada najlepszą porę na bieg i ocenia trening po synchronizacji ze Stravą.",
  },
  nav: {
    features: "Co potrafi",
    how: "Jak zacząć",
    faq: "Pytania",
    download: "Pobierz",
    soon: "Wkrótce",
    switchLabel: "Język",
  },
  store: {
    ios: ["Pobierz w", "App Store"],
    android: ["Pobierz z", "Google Play"],
    note: "Bezpłatnie.",
    soon: {
      ios: ["Wkrótce w", "App Store"],
      android: ["Wkrótce w", "Google Play"],
    },
  },
  hero: {
    title: "Plan biegowy, który dopasowuje się do Twojego dnia.",
    titleLines: ["Plan biegowy, który", "dopasowuje się", "do Twojego"],
    titleWords: ["dnia", "tygodnia", "życia", "tempa", "samopoczucia"],
    lead: "Każdy kolejny tydzień układa się pod to, jak poszedł Ci poprzedni.",
    pause: "Zatrzymaj film",
    play: "Odtwórz film",
    switchVideo: "Film w tle",
    phoneAlt: "Ekran Dzisiaj w aplikacji Aloha: powitanie, notatka trenera, następny trening i pogoda",
  },
  audience: {
    title: "Dla tych, którzy biegają między pracą a odbieraniem dzieci.",
    body: "Większość planów zakłada idealny tydzień. Aloha zaczyna od Twojego: ile masz dni, ile minut i w jakiej jesteś formie. Bez tabel z tętnem na start i bez poczucia winy, kiedy coś wypadnie.",
  },
  screens: {
    title: "Otwierasz aplikację i od razu wiesz, co dziś biegasz.",
    items: [
      {
        image: "today",
        title: "Dzisiaj",
        body: "Najbliższy trening, pogoda i słowo od trenera.",
        alt: "Ekran Dzisiaj: powitanie, notatka trenera, następny trening i pogoda",
      },
      {
        image: "plan",
        title: "Plan",
        body: "Cały miesiąc w kalendarzu. Kolor kropki mówi, jaki to trening.",
        alt: "Ekran Plan: kalendarz miesiąca z kropkami w kolorach typów treningu",
      },
      {
        image: "workout",
        title: "Trening",
        body: "Przebieg krok po kroku, z tempami i radą trenera.",
        alt: "Ekran treningu: czas, dystans, rada trenera i wykres przebiegu",
      },
      {
        image: "review",
        title: "Po biegu",
        body: "Krótkie podsumowanie, liczby ze Stravy i notatka na następny raz.",
        alt: "Ekran po biegu: podsumowanie, dystans, czas, tempo i notatka trenera",
      },
    ],
  },
  week: {
    title: "Tak wygląda tydzień w Aloha",
    lead: "Przykład: cztery biegi dla osoby, która biega 10 km w około 55 minut. Najwyżej jeden mocniejszy trening w tygodniu. Wybierz dzień, żeby zobaczyć szczegóły.",
    hint: "Wybierz dzień",
    weatherLabel: "Pogoda",
    coachLabel: "Rada trenera",
    legend: { easy: "bieg spokojny", long: "długi bieg", intervals: "interwały", rest: "odpoczynek" },
    days: [
      {
        short: "Pon",
        name: "Poniedziałek",
        kind: "rest",
        minutes: 0,
        title: "Odpoczynek",
        meta: "Dziś wolne",
        steps: [],
        weather: "",
        coach: "Odpoczynek to też trening. Nogi Ci podziękują.",
      },
      {
        short: "Wt",
        name: "Wtorek",
        kind: "easy",
        minutes: 40,
        title: "Bieg spokojny",
        meta: "40 min, ok. 6 km",
        steps: ["Rozgrzewka: 5 min truchtu", "Odcinek: 30 min spokojnie, 6:30–7:00 /km", "Schłodzenie: 5 min truchtu"],
        weather: "Do 17:00 pada. Najlepiej między 17:30 a 19:00 – będzie już ciemno, weź odblaski.",
        coach: "Tempo rozmowy. Brakuje tchu? Zwolnij – spokojne bieganie buduje bazę.",
      },
      {
        short: "Śr",
        name: "Środa",
        kind: "rest",
        minutes: 0,
        title: "Odpoczynek",
        meta: "Dziś wolne",
        steps: [],
        weather: "",
        coach: "Dziś bez biegania. Spacer albo rozciąganie – jeśli masz ochotę.",
      },
      {
        short: "Czw",
        name: "Czwartek",
        kind: "intervals",
        minutes: 45,
        title: "Interwały",
        meta: "45 min, ok. 7 km",
        steps: ["Rozgrzewka: 10 min truchtu", "6× 3 min mocniej (5:20–5:35 /km), 2 min truchtu", "Schłodzenie: 5 min truchtu"],
        weather: "Rano ślisko po przymrozku. Najlepiej między 16:00 a 18:30.",
        coach: "Odcinki mocno, ale równo – ostatni tak szybki jak pierwszy. Przerwy truchtem.",
      },
      {
        short: "Pt",
        name: "Piątek",
        kind: "rest",
        minutes: 0,
        title: "Odpoczynek",
        meta: "Dziś wolne",
        steps: [],
        weather: "",
        coach: "Wczoraj było mocniej, więc dziś nogi odpoczywają. Jutro krótki, lekki bieg.",
      },
      {
        short: "Sob",
        name: "Sobota",
        kind: "easy",
        minutes: 30,
        title: "Bieg spokojny",
        meta: "30 min, ok. 4,5 km",
        steps: ["Rozgrzewka: 5 min truchtu", "Odcinek: 20 min spokojnie, 6:30–7:00 /km", "Schłodzenie: 5 min truchtu"],
        weather: "Pora dowolna. Sucho i bez wiatru przez cały dzień.",
        coach: "Krótko i lekko. Jutro długi bieg, więc nie nadrabiaj tempa.",
      },
      {
        short: "Ndz",
        name: "Niedziela",
        kind: "long",
        minutes: 70,
        title: "Długi bieg",
        meta: "70 min, ok. 10 km",
        steps: ["Rozgrzewka: 5 min truchtu", "Odcinek: 60 min spokojnie, 6:45–7:15 /km", "Schłodzenie: 5 min marszu"],
        weather: "Najlepiej między 9:00 a 12:00. Po południu mocno wieje.",
        coach: "Zacznij spokojniej, niż Ci się wydaje. Biegniesz ponad godzinę? Weź wodę.",
      },
    ],
  },
  start: {
    title: "Plan zaczyna od Twojego miejsca, nie od idealnego.",
    body: "Krótka ankieta zamiast formularza na pół godziny. Mówisz, po co biegasz, ile masz czasu i jak Ci idzie teraz, a plan na pierwsze dwa tygodnie jest gotowy od razu.",
    points: [
      "Cel: zacząć biegać, przebiec 5 km bez przerwy, biegać regularnie albo start na 5, 10, 21 lub 42 km.",
      "Twoje dni tygodnia i limit minut osobno na dni robocze i weekend.",
      "Jeśli cel jest zbyt ambitny na ten termin, Aloha zaproponuje bliższy dystans, późniejszą datę albo realny czas. Decyzja zostaje u Ciebie.",
      "Kolejne tygodnie powstają na bieżąco. Poziom planu rośnie lub spada zależnie od tego, jak Ci szło.",
    ],
    photoAlt: "Biegaczka w świetle zachodzącego słońca",
  },
  review: {
    title: "Po biegu wiesz, jak poszło.",
    body: "Połącz Stravę, a biegi same trafią do planu. Aloha dopasuje je do zaplanowanych treningów i podpowie, co poszło dobrze, a co warto zmienić następnym razem.",
    points: [
      "Krótkie podsumowanie po każdym biegu, od „W punkt” po „Inny trening niż w planie”. Bez ocen w skali i bez zawstydzania.",
      "Sprawdza czas i dystans, równość tempa i liczbę powtórzeń.",
      "Tętno bierze pod uwagę tylko wtedy, gdy wyrazisz na to zgodę.",
      "Wypadł Ci trening? Zdarza się. Kolejny tydzień ułoży się pod to, co faktycznie udało się zrobić.",
    ],
    card: {
      source: "Bieg ze Stravy",
      verdict: "Dobra robota",
      workout: "Bieg spokojny, wtorek",
      rows: [
        ["W planie", "40 min"],
        ["Zrobione", "41 min, 6,2 km"],
        ["Tempo", "druga połowa wolniejsza o 18 s/km"],
      ],
      note: "Czas i dystans zgodne z planem. Druga połowa wyszła trochę wolniej – następnym razem zacznij spokojniej, a końcówka przyjdzie łatwiej.",
      link: "Zobacz w Stravie",
    },
  },
  chat: {
    title: "Coś wypadło? Napisz do trenera.",
    body: "W aplikacji jest czat z trenerem AI – to Keanu Biegała, który zna Twój plan i ostatnie biegi. Piszesz zwykłymi słowami, odpowiedź masz od razu.",
    points: [
      "Przed treningiem zapytasz, jak go pobiec albo co zrobić, gdy masz mniej czasu. Po treningu: jak poszło i co poprawić następnym razem.",
      "Trener może zaproponować zmianę w planie: przenieść, skrócić, zmienić rodzaj albo odpuścić trening. To zawsze propozycja, decyzja jest Twoja.",
      "Przy bólu i chorobie nie udaje lekarza. Wybiera łagodniejszy wariant i odsyła do specjalisty, a o zdrowiu rozmawia dopiero po Twojej zgodzie.",
    ],
    coaches: [
      {
        name: "Keanu Biegała 🌺",
        kind: "Trener AI",
        body: "Odpowiada od razu, o każdej porze. Do 40 wiadomości na dobę.",
      },
      {
        name: "Prawdziwy trener",
        kind: "Osobny pakiet",
        body: "Człowiek, który widzi Twój plan. Odpisuje zwykle w ciągu doby.",
      },
    ],
    demo: {
      name: "Keanu Biegała 🌺",
      role: "Trener AI",
      user: "Nie mam jutro czasu na trening",
      reply: "Jasne, zdarza się. Jutrzejsze interwały możemy przenieść na piątek. Sobota zostaje spokojna, więc nogi zdążą odpocząć przed niedzielą.",
      proposalTitle: "Propozycja zmiany w planie",
      proposal: "Interwały z czwartku na piątek",
      accept: "Akceptuj",
      decline: "Zostaw plan bez zmian",
    },
  },
  coaches: {
    title: "Nasi trenerzy",
    body: [
      "Aloha nie wzięła się z tabelki. Aplikacja i sam pomysł powstały z wieloletniego doświadczenia trenerów, którzy na co dzień pracują z ludźmi: zapracowanymi, wracającymi po przerwie, zaczynającymi od zera.",
      "To z tej pracy pochodzą zasady, według których powstaje każdy plan, i ton, w jakim Aloha z Tobą rozmawia.",
    ],
    available: "Trenerzy są też do Twojej dyspozycji: w pakiecie z prawdziwym trenerem piszesz do jednego z nich na czacie.",
    years: "{n} lat pracy z biegaczami",
    demo: "Profil przykładowy",
  },
  weather: {
    title: "O której dziś biegać? Sprawdzone, zanim zapytasz.",
    body: "Przy każdym treningu widzisz najlepsze okno na bieg i godziny, których lepiej unikać. Do tego jedno, dwa zdania praktycznej rady.",
    points: [
      "Ostrzega przed burzą, gołoledzią, upałem, mrozem, smogiem, wiatrem i zmrokiem.",
      "Lokalizacja zaokrąglona do około 10 km. Możesz też po prostu wpisać miejscowość.",
      "Biegasz na wyjeździe? Ustaw inne miejsce tylko dla jednego treningu.",
    ],
    card: {
      place: "Czwartek, Gdynia",
      best: "Najlepsza pora",
      bestTime: "16:00–18:30",
      avoid: "Unikaj",
      avoidTime: "6:00–9:00, ślisko",
      tip: "Po 16:00 będzie ciemno – weź odblaski albo czołówkę.",
    },
    photoAlt: "Biegacz na plaży o zachodzie słońca",
  },
  how: {
    title: "Od instalacji do pierwszego biegu",
    steps: [
      {
        title: "Odpowiadasz na kilka pytań",
        body: "Cel, obecna forma, dni i minuty, które naprawdę masz. Zajmuje to około minuty.",
      },
      {
        title: "Dostajesz dwa pierwsze tygodnie",
        body: "Każdy trening rozpisany krok po kroku: rozgrzewka, część główna, schłodzenie.",
      },
      {
        title: "Biegasz, a Strava zapisuje",
        body: "Bieg sam trafia do planu i dostaje ocenę. Nie musisz niczego przepisywać.",
      },
      {
        title: "Co tydzień plan się aktualizuje",
        body: "Następny tydzień powstaje na podstawie tego, jak poszedł poprzedni.",
      },
    ],
  },
  voice: {
    title: "Trener, ale kumpel",
    marks: ["„", "”"],
    label: "Cytat",
    quotes: [
      "Odpoczynek to też trening. Nogi Ci podziękują.",
      "W punkt. Tempo równe od pierwszego do ostatniego kilometra.",
      "Marsz to część planu, nie porażka.",
      "Trzeci tydzień bez opuszczonego biegu. To liczy się bardziej niż rekord.",
      "Szczerze – plan zacznie od Twojego miejsca, nie od idealnego.",
      "Dobra robota. Wszystkie odcinki zrobione, ostatni tak mocny jak pierwszy.",
      "Zacznij spokojniej, niż Ci się wydaje.",
      "Wyjść pobiegać po takim dniu to już jest sukces.",
      "Brakuje tchu? Zwolnij – spokojne bieganie buduje bazę.",
      "Dwa z dwóch treningów w tym tygodniu zaliczone. Tak trzymaj.",
      "Na dziś nic nie ma w planie. Luz.",
      "Dziś bez biegania. Spacer albo rozciąganie – jeśli masz ochotę.",
      "Na dziś to już dużo pytań – wróć jutro, pogadamy dalej.",
    ],
  },
  faq: {
    title: "Zanim pobierzesz",
    items: [
      {
        q: "Czy muszę mieć konto w Stravie?",
        a: "Plan i pogoda działają bez niej. Ocenę treningu i automatyczne odhaczanie biegów dostajesz po połączeniu ze Stravą, bo stamtąd Aloha pobiera Twoje biegi.",
      },
      {
        q: "A Garmin, Apple Health i Health Connect?",
        a: "Są w przygotowaniu. Na razie biegi z Garmina lub Apple Health trafią do Aloha, jeśli synchronizujesz je ze Stravą.",
      },
      {
        q: "Dopiero zaczynam. Czy to dla mnie?",
        a: "Tak. Zaczynasz od marszobiegów, a plan krok po kroku szykuje Cię do 5 km bez zatrzymywania. Jeśli biegasz już regularnie, dostaniesz plan na swoim poziomie, aż po przygotowania do maratonu.",
      },
      {
        q: "Kto jest trenerem w Aloha?",
        a: "Na co dzień Keanu Biegała, czyli trener AI. Plan powstaje według zasad treningowych, a rady, notatki i odpowiedzi na czacie pisze AI. Rozmowa z prawdziwym trenerem, człowiekiem, to osobny pakiet.",
      },
      {
        q: "Wracam po kontuzji albo po dłuższej przerwie. Co wtedy?",
        a: "Napisz o tym w ankiecie, a plan zacznie łagodniej. Aloha nie zastępuje lekarza ani fizjoterapeuty, więc przy wątpliwościach skonsultuj się przed startem.",
      },
      {
        q: "Co dzieje się z moimi danymi o zdrowiu?",
        a: "Tętno i informacje o zdrowiu są używane wyłącznie za Twoją osobną zgodą. Lokalizacja do pogody jest zaokrąglana do około 10 km.",
      },
      {
        q: "Ile to kosztuje?",
        a: "Aloha App jest teraz bezpłatna, razem z czatem z trenerem AI. Rozmowa z prawdziwym trenerem to osobny pakiet.",
      },
    ],
  },
  final: {
    title: "Pierwszy tydzień możesz mieć za minutę.",
    body: "Pobierz aplikację, odpowiedz na kilka pytań i wyjdź na pierwszy spokojny bieg.",
    bodySoon:
      "Aloha App wkrótce pojawi się w App Store i Google Play. Potem wystarczy odpowiedzieć na kilka pytań i wyjść na pierwszy spokojny bieg.",
    photoAlt: "Osoba idąca leśną ścieżką w porannym słońcu",
  },
  footer: {
    tagline: "Plan biegowy, który dopasowuje się do Twojego życia, a nie odwrotnie.",
    privacy: "Polityka prywatności",
    terms: "Regulamin",
    legalLabel: "Dokumenty",
  },
};

const en: Content = {
  meta: {
    title: "Aloha App – a running plan that fits around your day",
    description:
      "A running plan for busy amateur runners. Aloha builds each new week from how the last one went, suggests the best time to head out, and reviews your run once it syncs from Strava.",
  },
  nav: {
    features: "What it does",
    how: "Getting started",
    faq: "Questions",
    download: "Download",
    soon: "Coming soon",
    switchLabel: "Language",
  },
  store: {
    ios: ["Download on the", "App Store"],
    android: ["Get it on", "Google Play"],
    note: "Free.",
    soon: {
      ios: ["Soon on the", "App Store"],
      android: ["Soon on", "Google Play"],
    },
  },
  hero: {
    title: "A running plan that fits around your day.",
    titleLines: ["A running plan", "that fits", "around your"],
    titleWords: ["day", "week", "life", "pace", "energy"],
    lead: "Each new week is built around how your last one went.",
    pause: "Pause video",
    play: "Play video",
    switchVideo: "Background video",
    phoneAlt: "The Today screen in Aloha: greeting, coach note, next workout and weather",
  },
  audience: {
    title: "For people who run between work and the school pick-up.",
    body: "Most plans assume a perfect week. Aloha starts from yours: how many days you have, how many minutes, and where your fitness is today. No heart-rate tables to begin with, and no guilt when life gets in the way.",
  },
  screens: {
    title: "Open the app and you know what you're running today.",
    note: "Screens shown in Polish. The app is also in English.",
    items: [
      {
        image: "today",
        title: "Today",
        body: "Your next workout, the weather and a word from your coach.",
        alt: "Today screen: greeting, coach note, next workout and weather",
      },
      {
        image: "plan",
        title: "Plan",
        body: "The whole month in a calendar. The dot colour tells you the workout type.",
        alt: "Plan screen: month calendar with dots coloured by workout type",
      },
      {
        image: "workout",
        title: "Workout",
        body: "Laid out step by step, with paces and a coach's tip.",
        alt: "Workout screen: time, distance, coach's tip and a chart of the session",
      },
      {
        image: "review",
        title: "After the run",
        body: "A short summary, your Strava numbers and a note for next time.",
        alt: "After-run screen: summary, distance, time, pace and coach note",
      },
    ],
  },
  week: {
    title: "What a week in Aloha looks like",
    lead: "An example: four runs for someone who runs 10 km in about 55 minutes. One harder session a week at most. Pick a day to see the details.",
    hint: "Pick a day",
    weatherLabel: "Weather",
    coachLabel: "Coach's tip",
    legend: { easy: "easy run", long: "long run", intervals: "intervals", rest: "rest" },
    days: [
      {
        short: "Mon",
        name: "Monday",
        kind: "rest",
        minutes: 0,
        title: "Rest",
        meta: "Rest day",
        steps: [],
        weather: "",
        coach: "Rest is training too. Your legs will thank you.",
      },
      {
        short: "Tue",
        name: "Tuesday",
        kind: "easy",
        minutes: 40,
        title: "Easy run",
        meta: "40 min, about 6 km",
        steps: ["Warm-up: 5 min jog", "Main part: 30 min easy, 6:30–7:00 /km", "Cool-down: 5 min jog"],
        weather: "Rain until 5:00 pm. Best between 5:30 and 7:00 pm – it'll be dark, so wear reflectives.",
        coach: "Conversation pace. Out of breath? Slow down – easy running builds your base.",
      },
      {
        short: "Wed",
        name: "Wednesday",
        kind: "rest",
        minutes: 0,
        title: "Rest",
        meta: "Rest day",
        steps: [],
        weather: "",
        coach: "No running today. A walk or some stretching – if you feel like it.",
      },
      {
        short: "Thu",
        name: "Thursday",
        kind: "intervals",
        minutes: 45,
        title: "Intervals",
        meta: "45 min, about 7 km",
        steps: ["Warm-up: 10 min jog", "6× 3 min harder (5:20–5:35 /km), 2 min jog", "Cool-down: 5 min jog"],
        weather: "Icy in the morning after frost. Best between 4:00 and 6:30 pm.",
        coach: "Hard but even – the last rep as fast as the first. Jog the recoveries.",
      },
      {
        short: "Fri",
        name: "Friday",
        kind: "rest",
        minutes: 0,
        title: "Rest",
        meta: "Rest day",
        steps: [],
        weather: "",
        coach: "Yesterday was harder, so today your legs rest. A short, light run tomorrow.",
      },
      {
        short: "Sat",
        name: "Saturday",
        kind: "easy",
        minutes: 30,
        title: "Easy run",
        meta: "30 min, about 4.5 km",
        steps: ["Warm-up: 5 min jog", "Main part: 20 min easy, 6:30–7:00 /km", "Cool-down: 5 min jog"],
        weather: "Any time works. Dry and calm all day.",
        coach: "Short and light. The long run is tomorrow, so don't chase the pace.",
      },
      {
        short: "Sun",
        name: "Sunday",
        kind: "long",
        minutes: 70,
        title: "Long run",
        meta: "70 min, about 10 km",
        steps: ["Warm-up: 5 min jog", "Main part: 60 min easy, 6:45–7:15 /km", "Cool-down: 5 min walk"],
        weather: "Best between 9:00 am and noon. Strong wind in the afternoon.",
        coach: "Start slower than you think. Running over an hour? Take water.",
      },
    ],
  },
  start: {
    title: "The plan starts from where you are, not from ideal.",
    body: "A short questionnaire instead of a half-hour form. Say why you run, how much time you have and how it's going now, and your first two weeks are ready straight away.",
    points: [
      "Goal: start running, run 5 km without stopping, run regularly, or race a 5k, 10k, half or full marathon.",
      "Your days of the week, with separate minute limits for weekdays and weekends.",
      "If the goal is too ambitious for the date, Aloha suggests a shorter distance, a later date or a realistic time. The decision stays with you.",
      "Later weeks are built as you go. The plan's level moves up or down with how you've been doing.",
    ],
    photoAlt: "A woman running in golden evening light",
  },
  review: {
    title: "After the run, you know how it went.",
    body: "Connect Strava and your runs land in the plan on their own. Aloha matches them to planned workouts and tells you what went well and what to change next time.",
    points: [
      "A short summary after every run, from “Spot on” to “A different workout than planned”. No scores, no shaming.",
      "It checks time and distance, how even your pace was, and the number of reps.",
      "Heart rate is only used if you give consent.",
      "Missed a workout? It happens. The next week is built around what you actually managed to do.",
    ],
    card: {
      source: "Run from Strava",
      verdict: "Good work",
      workout: "Easy run, Tuesday",
      rows: [
        ["Planned", "40 min"],
        ["Done", "41 min, 6.2 km"],
        ["Pace", "second half 18 s/km slower"],
      ],
      note: "Time and distance matched the plan. The second half came out a little slower – start easier next time and the finish will feel better.",
      link: "View on Strava",
    },
  },
  chat: {
    title: "Something came up? Message your coach.",
    body: "The app has a chat with Keanu Biegała, an AI coach who knows your plan and your recent runs. Write in plain words and get an answer straight away.",
    points: [
      "Before a workout, ask how to run it or what to do with less time. Afterwards, ask how it went and what to improve next time.",
      "The coach can suggest a change to your plan: move, shorten, swap or skip a workout. It is always a suggestion, and the decision is yours.",
      "With pain or illness it doesn't play doctor. It picks the gentler option and points you to a professional, and only discusses health once you consent.",
    ],
    coaches: [
      {
        name: "Keanu Biegała 🌺",
        kind: "AI coach",
        body: "Replies straight away, at any hour. Up to 40 messages a day.",
      },
      {
        name: "A real coach",
        kind: "Separate package",
        body: "A person who can see your plan. Usually replies within a day.",
      },
    ],
    demo: {
      name: "Keanu Biegała 🌺",
      role: "AI coach",
      user: "I have no time to train tomorrow",
      reply: "Sure, it happens. We can move tomorrow's intervals to Friday. Saturday stays easy, so your legs get a rest before Sunday.",
      proposalTitle: "Suggested plan change",
      proposal: "Intervals from Thursday to Friday",
      accept: "Accept",
      decline: "Keep the plan as is",
    },
  },
  coaches: {
    title: "Our coaches",
    body: [
      "Aloha didn't start in a spreadsheet. The app, and the idea behind it, grew out of the coaches' many years of working with people: busy ones, ones coming back after a break, ones starting from zero.",
      "That work is where the rules behind every plan come from, and the tone Aloha uses when it talks to you.",
    ],
    available: "The coaches are there for you too: with the real-coach package, you message one of them in the chat.",
    years: "{n} years coaching runners",
    demo: "Sample profile",
  },
  weather: {
    title: "When to run today? Checked before you ask.",
    body: "Every workout shows the best window for your run and the hours to avoid, plus a sentence or two of practical advice.",
    points: [
      "Warns you about storms, ice, heat, frost, smog, wind and darkness.",
      "Location is rounded to about 10 km. You can also just type in a town.",
      "Running away from home? Set a different place for a single workout.",
    ],
    card: {
      place: "Thursday, Gdynia",
      best: "Best time",
      bestTime: "4:00–6:30 pm",
      avoid: "Avoid",
      avoidTime: "6:00–9:00 am, icy",
      tip: "It'll be dark after 4:00 pm – wear reflectives or a head torch.",
    },
    photoAlt: "A runner on the beach at sunset",
  },
  how: {
    title: "From install to your first run",
    steps: [
      {
        title: "Answer a few questions",
        body: "Your goal, current fitness, and the days and minutes you actually have. It takes about a minute.",
      },
      {
        title: "Get your first two weeks",
        body: "Every workout laid out step by step: warm-up, main part, cool-down.",
      },
      {
        title: "You run, Strava records",
        body: "The run lands in your plan and gets a review. Nothing to type in.",
      },
      {
        title: "The plan updates every week",
        body: "The next week is built from how the last one went.",
      },
    ],
  },
  voice: {
    title: "A coach, but a mate",
    marks: ["“", "”"],
    label: "Quote",
    quotes: [
      "Rest is training too. Your legs will thank you.",
      "Spot on. Even pace from the first kilometre to the last.",
      "Walking is part of the plan, not a failure.",
      "Three weeks without a missed run. That counts for more than a personal best.",
      "Be honest – the plan starts where you are, not where you wish you were.",
      "Good work. Every rep done, the last as strong as the first.",
      "Start slower than you think.",
      "Getting out for a run after a day like that is already a win.",
      "Out of breath? Slow down – easy running builds your base.",
      "Two out of two workouts done this week. Keep it up.",
      "Nothing planned for today. Take it easy.",
      "No running today. A walk or some stretching – if you feel like it.",
      "That’s a lot of questions for today – come back tomorrow and we’ll carry on.",
    ],
  },
  faq: {
    title: "Before you download",
    items: [
      {
        q: "Do I need a Strava account?",
        a: "The plan and weather work without one. Workout reviews and automatic ticking-off need Strava, because that's where Aloha gets your runs.",
      },
      {
        q: "What about Garmin, Apple Health and Health Connect?",
        a: "They're in the works. For now, runs from Garmin or Apple Health reach Aloha if you sync them to Strava.",
      },
      {
        q: "I'm just starting. Is this for me?",
        a: "Yes. You start with walk-run sessions and the plan builds you up, step by step, towards 5 km without stopping. If you already run regularly, you get a plan at your level, all the way to marathon training.",
      },
      {
        q: "Who is the coach in Aloha?",
        a: "Day to day it is Keanu Biegała, an AI coach. The plan follows training rules, and the tips, notes and chat replies are written by AI. Chatting with a real, human coach is a separate package.",
      },
      {
        q: "I'm coming back from an injury or a long break. What then?",
        a: "Say so in the questionnaire and the plan starts more gently. Aloha doesn't replace a doctor or physio, so check with one first if you're unsure.",
      },
      {
        q: "What happens to my health data?",
        a: "Heart rate and health information are only used with your separate consent. Your location for weather is rounded to about 10 km.",
      },
      {
        q: "How much does it cost?",
        a: "Aloha App is free right now, including the chat with the AI coach. Chatting with a real coach is a separate package.",
      },
    ],
  },
  final: {
    title: "Your first week can be ready in a minute.",
    body: "Download the app, answer a few questions and head out for your first easy run.",
    bodySoon:
      "Aloha App is coming soon to the App Store and Google Play. After that, answer a few questions and head out for your first easy run.",
    photoAlt: "A person on a forest path in morning sun",
  },
  footer: {
    tagline: "A running plan that fits around your life, not the other way round.",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    legalLabel: "Legal",
  },
};

export const content: Record<Locale, Content> = { pl, en };

/**
 * Linki do sklepów. Dopóki zmienna środowiskowa sklepu jest pusta, strona pokazuje plakietkę
 * „Wkrótce w …” zamiast przycisku. Po publikacji wystarczy ustawić adres.
 */
export const storeLinks: Record<"ios" | "android", string | undefined> = {
  ios: process.env.NEXT_PUBLIC_APP_STORE_URL || undefined,
  android: process.env.NEXT_PUBLIC_PLAY_STORE_URL || undefined,
};

/** Czy aplikację da się już pobrać z któregokolwiek sklepu. */
export const appAvailable = Boolean(storeLinks.ios || storeLinks.android);
