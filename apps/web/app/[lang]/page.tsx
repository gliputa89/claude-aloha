import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mark, Plumeria, Wordmark } from "@/components/brand";
import { HeroVideo } from "@/components/hero-video";
import { QuoteRotator } from "@/components/quote-rotator";
import { RotatingWord } from "@/components/rotating-word";
import { StoreButtons } from "@/components/store-buttons";
import { WeekStrip } from "@/components/week-strip";
import { getCoaches, type Coach } from "@/lib/coaches";
import { content, isLocale, localePath, locales, type Content } from "@/lib/content";

const shell = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const h2 = "text-3xl font-extrabold tracking-tight text-balance sm:text-5xl sm:leading-[1.05]";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = content[lang];
  const coaches = await getCoaches(lang);

  return (
    <>
      <header className="absolute inset-x-0 top-0 z-30 text-white">
        <div className={`${shell} flex items-center justify-between gap-4 py-5`}>
          <Link href={localePath(lang)} aria-label="Aloha App">
            <Wordmark onDark />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-semibold md:flex">
            <a href="#funkcje" className="hover:text-accent">
              {t.nav.features}
            </a>
            <a href="#start" className="hover:text-accent">
              {t.nav.how}
            </a>
            <a href="#pytania" className="hover:text-accent">
              {t.nav.faq}
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <nav aria-label={t.nav.switchLabel} className="flex gap-1 text-sm font-bold">
              {locales.map((code) => (
                <Link
                  key={code}
                  href={localePath(code)}
                  hrefLang={code}
                  aria-current={code === lang ? "true" : undefined}
                  className={`rounded-sm px-2 py-1 uppercase ${
                    code === lang ? "bg-white/20" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  {code}
                </Link>
              ))}
            </nav>
            <a
              href="#pobierz"
              className="hidden rounded-button bg-accent px-4 py-2 text-sm font-bold text-text-on-accent hover:bg-white sm:block"
            >
              {t.nav.download}
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero: film na całą szerokość, tekst przy lewej krawędzi, karta „Dzisiaj” jak w aplikacji */}
        <section className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-deep text-white lg:justify-center">
          <HeroVideo
            pauseLabel={t.hero.pause}
            playLabel={t.hero.play}
            switchLabel={t.hero.switchVideo}
          />
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-deep/90 via-deep/55 to-deep/50" />
          <div
            className={`${shell} relative z-20 grid items-end gap-x-10 pt-24 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-center lg:pt-24 lg:pb-16`}
          >
            <div className="rise max-w-4xl pb-8 lg:pb-0">
              <h1
                aria-label={t.hero.title}
                className="text-[clamp(2.125rem,5.6vw,3.75rem)] leading-[1] font-extrabold tracking-[-0.035em]"
              >
                <span aria-hidden="true">
                  <span className="block">{t.hero.titleLines[0]}</span>
                  <span className="block">{t.hero.titleLines[1]}</span>
                  <span className="block xl:whitespace-nowrap">
                    {t.hero.titleLines[2]}{" "}
                    <span className="block xl:inline">
                      <RotatingWord words={t.hero.titleWords} />
                    </span>
                  </span>
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/85 sm:text-xl lg:mt-6">
                {t.hero.lead}
              </p>
              <div className="mt-8 hidden lg:block">
                <StoreButtons store={t.store} />
                <p className="mt-3 text-sm text-white/70">{t.store.note}</p>
              </div>
            </div>

            {/* Telefon z ekranem „Dzisiaj” – zawsze w całości, bez przycinania */}
            <div className="rise rise-late mx-auto w-56 overflow-hidden rounded-[2.5rem] border-[8px] border-deep bg-deep shadow-2xl lg:mb-0 lg:w-full">
              <Image
                src="/media/app/today.png"
                alt={t.hero.phoneAlt}
                width={720}
                height={1374}
                priority
                sizes="(min-width: 1024px) 290px, 224px"
                className="h-auto w-full rounded-[2rem]"
              />
            </div>

            {/* Na telefonie przyciski sklepów stoją pod telefonem, w jednym wierszu */}
            <div className="pt-6 pb-20 lg:hidden">
              <StoreButtons store={t.store} />
              <p className="mt-3 text-sm text-white/70">{t.store.note}</p>
            </div>
          </div>
        </section>

        {/* Dla kogo */}
        <section className={`${shell} grid gap-6 py-20 sm:py-28 lg:grid-cols-12`}>
          <h2 className={`${h2} lg:col-span-7`}>{t.audience.title}</h2>
          <p className="max-w-[60ch] text-lg leading-relaxed text-text-muted lg:col-span-5 lg:pt-3">
            {t.audience.body}
          </p>
        </section>

        {/* Nasi trenerzy – profile z bazy; tekst zostaje także wtedy, gdy profili jeszcze nie ma */}
        <section className="bg-surface py-20 sm:py-28">
          <div className={shell}>
            <div className="grid gap-8 lg:grid-cols-12 lg:gap-16">
              <h2 className={`${h2} lg:col-span-4`}>{t.coaches.title}</h2>
              <div className="max-w-[62ch] space-y-4 text-lg leading-relaxed lg:col-span-8">
                {t.coaches.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <p className="font-semibold text-text-brand">{t.coaches.available}</p>
              </div>
            </div>
            {coaches.length > 0 && (
              <ul className="-mx-5 mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-5 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 sm:overflow-visible sm:px-0 lg:grid-cols-3">
                {coaches.map((coach) => (
                  <CoachCard key={coach.id} coach={coach} labels={t.coaches} />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Ekrany aplikacji – zrzuty z symulatora, telefony wychodzą z dolnej krawędzi sekcji */}
        <section className="overflow-hidden bg-surface-brand pt-20 text-white sm:pt-28">
          <div className={shell}>
            <h2 className={`${h2} max-w-3xl`}>{t.screens.title}</h2>
            {t.screens.note && <p className="mt-4 text-sm text-white/70">{t.screens.note}</p>}
          </div>
          <ul className="mx-auto mt-12 flex w-full max-w-6xl snap-x snap-mandatory gap-5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-5 [scrollbar-width:none] sm:px-8 lg:grid lg:grid-cols-4 lg:gap-7 lg:overflow-visible">
            {t.screens.items.map((item, index) => (
              <li
                key={item.image}
                className={`flex w-[68vw] max-w-72 shrink-0 snap-center flex-col lg:w-auto lg:max-w-none ${
                  index % 2 ? "lg:pt-14" : ""
                }`}
              >
                <h3 className="text-xl font-bold tracking-tight">{item.title}</h3>
                <p className="mt-1 min-h-12 text-sm leading-snug text-white/80">{item.body}</p>
                <div className="mt-5 -mb-px flex-1 rounded-t-[2.25rem] border-[7px] border-b-0 border-deep bg-deep">
                  <Image
                    src={`/media/app/${item.image}.png`}
                    alt={item.alt}
                    width={720}
                    height={1373}
                    sizes="(min-width: 1024px) 260px, 68vw"
                    className="h-auto w-full rounded-t-[1.8rem]"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Tydzień planu – element interaktywny */}
        <section id="funkcje" className="bg-surface-brand-soft py-20 sm:py-28">
          <div className={shell}>
            <h2 className={h2}>{t.week.title}</h2>
            <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-text-muted">{t.week.lead}</p>
            <div className="mt-12">
              <WeekStrip week={t.week} />
            </div>
          </div>
        </section>

        {/* Plan od Twojego miejsca */}
        <section className={`${shell} grid items-center gap-10 py-20 sm:py-28 lg:grid-cols-12 lg:gap-16`}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-card lg:col-span-5">
            <Image
              src="/media/golden-hour.jpg"
              alt={t.start.photoAlt}
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="lg:col-span-7">
            <h2 className={h2}>{t.start.title}</h2>
            <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-text-muted">{t.start.body}</p>
            <Points items={t.start.points} />
          </div>
        </section>

        {/* Ocena treningu + Strava */}
        <section className="bg-surface py-20 sm:py-28">
          <div className={`${shell} grid items-center gap-12 lg:grid-cols-12 lg:gap-16`}>
            <div className="lg:col-span-7">
              <h2 className={h2}>{t.review.title}</h2>
              <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-text-muted">
                {t.review.body}
              </p>
              <Points items={t.review.points} />
            </div>
            <ReviewCard card={t.review.card} />
          </div>
        </section>

        {/* Czat z trenerem: Keanu Biegała (AI) i prawdziwy trener */}
        <section className={`${shell} grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-12 lg:gap-16`}>
          <ChatDemo demo={t.chat.demo} />
          <div className="lg:col-span-7">
            <h2 className={h2}>{t.chat.title}</h2>
            <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-text-muted">{t.chat.body}</p>
            <Points items={t.chat.points} />
            <dl className="mt-10 grid max-w-[62ch] gap-x-8 gap-y-6 border-t border-border-strong pt-6 sm:grid-cols-2">
              {t.chat.coaches.map((coach) => (
                <div key={coach.name}>
                  <dt className="text-xl font-bold tracking-tight">{coach.name}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-text-brand">{coach.kind}</dd>
                  <dd className="mt-2 leading-relaxed text-text-muted">{coach.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Pogoda */}
        <section className="relative isolate overflow-hidden bg-deep text-white">
          <Image
            src="/media/beach-sunset.jpg"
            alt={t.weather.photoAlt}
            fill
            sizes="100vw"
            className="-z-10 object-cover opacity-55"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-deep via-deep/70 to-transparent" />
          <div className={`${shell} grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-12 lg:gap-16`}>
            <div className="lg:col-span-7">
              <h2 className={h2}>{t.weather.title}</h2>
              <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-white/85">
                {t.weather.body}
              </p>
              <Points items={t.weather.points} onDark />
            </div>
            <WeatherCard card={t.weather.card} />
          </div>
        </section>

        {/* Jak zacząć – prawdziwa kolejność, więc numerujemy */}
        <section id="start" className={`${shell} py-20 sm:py-28`}>
          <h2 className={h2}>{t.how.title}</h2>
          <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {t.how.steps.map((step, index) => (
              <li key={step.title} className="border-t-2 border-text pt-5">
                <span className="text-5xl font-extrabold tracking-tight text-text-brand tabular-nums">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-xl font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Głos aplikacji – teksty z ekranów i przykłady notatek trenera (pochwały pisze AI, więc to przykłady) */}
        <section className="relative isolate overflow-hidden bg-surface-brand py-20 text-white sm:py-28">
          <Plumeria className="drift absolute -inset-14 -z-10 h-[calc(100%+7rem)] w-[calc(100%+7rem)] text-white opacity-[0.07]" />
          <div className={shell}>
            <h2 className="text-lg font-bold text-lagoon">{t.voice.title}</h2>
            <div className="mt-8">
              <QuoteRotator quotes={t.voice.quotes} marks={t.voice.marks} label={t.voice.label} />
            </div>
          </div>
        </section>

        {/* Pytania */}
        <section id="pytania" className={`${shell} grid gap-10 py-20 sm:py-28 lg:grid-cols-12`}>
          <h2 className={`${h2} lg:col-span-4`}>{t.faq.title}</h2>
          <div className="lg:col-span-8">
            {t.faq.items.map((item) => (
              <details key={item.q} className="group border-b border-border-strong py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-xl font-bold tracking-tight [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <svg
                    viewBox="0 0 24 24"
                    className="size-6 shrink-0 text-text-brand transition-transform duration-150 group-open:rotate-45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="mt-3 max-w-[62ch] leading-relaxed text-text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Pobierz */}
        <section id="pobierz" className={`${shell} pb-20 sm:pb-28`}>
          <div className="grid overflow-hidden rounded-card bg-accent text-text-on-accent lg:grid-cols-2">
            <div className="p-8 sm:p-14">
              <h2 className={h2}>{t.final.title}</h2>
              <p className="mt-5 max-w-[46ch] text-lg leading-relaxed">{t.final.body}</p>
              <div className="mt-8">
                <StoreButtons store={t.store} tone="dark" />
                <p className="mt-3 text-sm font-medium">{t.store.note}</p>
              </div>
            </div>
            <div className="relative min-h-72">
              <Image
                src="/media/path-morning.jpg"
                alt={t.final.photoAlt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div
          className={`${shell} flex flex-col gap-4 py-10 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between`}
        >
          <span className="text-text">
            <Wordmark />
          </span>
          <p className="max-w-md">{t.footer.tagline}</p>
          <p>
            © {2026} {t.footer.rights}
          </p>
        </div>
      </footer>
    </>
  );
}

function Points({ items, onDark = false }: { items: string[]; onDark?: boolean }) {
  return (
    <ul className="mt-8 max-w-[62ch] space-y-4">
      {items.map((item) => (
        <li key={item} className="flex gap-3.5 leading-relaxed">
          <span
            className={`mt-[0.6em] h-0.5 w-5 shrink-0 ${onDark ? "bg-accent" : "bg-surface-brand"}`}
            aria-hidden="true"
          />
          <span className={onDark ? "text-white/90" : ""}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({ card }: { card: Content["review"]["card"] }) {
  return (
    <div className="rounded-card bg-background p-6 sm:p-7 lg:col-span-5">
      <p className="text-sm font-semibold text-text-muted">{card.source}</p>
      <p className="mt-3 w-fit rounded-pill bg-surface-accent-soft px-4 py-1.5 text-lg font-extrabold tracking-tight text-text-accent-strong">
        {card.verdict}
      </p>
      <p className="mt-3 text-xl font-bold tracking-tight">{card.workout}</p>
      <dl className="mt-4 divide-y divide-border border-y border-border">
        {card.rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-6 py-2.5">
            <dt className="text-text-muted">{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-surface-brand">
          <Mark onDark className="size-6" />
        </span>
        <p className="rounded-card rounded-tl-sm bg-surface p-4 leading-relaxed">{card.note}</p>
      </div>
      <p className="mt-5 text-sm font-bold text-text-brand underline underline-offset-4">{card.link}</p>
    </div>
  );
}

function CoachCard({ coach, labels }: { coach: Coach; labels: Content["coaches"] }) {
  const facts = [
    coach.city,
    coach.years ? labels.years.replace("{n}", String(coach.years)) : null,
  ].filter(Boolean);
  return (
    <li className="w-[74vw] max-w-80 shrink-0 snap-center sm:w-auto sm:max-w-none">
      <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-surface-brand-soft">
        {coach.photo && (
          // Zdjęcia trenerów leżą poza stroną (adres z bazy), więc zwykły <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coach.photo} alt="" loading="lazy" className="size-full object-cover" />
        )}
        {coach.isDemo && (
          <span className="absolute top-3 left-3 rounded-pill bg-accent px-3 py-1 text-xs font-bold text-text-on-accent">
            {labels.demo}
          </span>
        )}
      </div>
      <h3 className="mt-5 text-2xl font-extrabold tracking-tight">{coach.name}</h3>
      {coach.title && <p className="mt-0.5 font-semibold text-text-brand">{coach.title}</p>}
      {facts.length > 0 && <p className="mt-1 text-sm text-text-muted">{facts.join(", ")}</p>}
      <p className="mt-3 leading-relaxed">{coach.headline}</p>
      {coach.specialties.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2 text-sm">
          {coach.specialties.map((item) => (
            <li key={item} className="rounded-pill bg-background px-3 py-1">
              {item}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ChatDemo({ demo }: { demo: Content["chat"]["demo"] }) {
  return (
    <div className="order-last rounded-card bg-surface p-5 sm:p-6 lg:order-first lg:col-span-5">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-surface-brand">
          <Mark onDark className="size-6" />
        </span>
        <p className="leading-tight">
          <span className="block font-bold">{demo.name}</span>
          <span className="block text-sm text-text-muted">{demo.role}</span>
        </p>
      </div>
      <div className="mt-5 space-y-3">
        <p className="ml-auto w-fit max-w-[85%] rounded-card rounded-br-sm bg-surface-brand px-4 py-2.5 text-white">
          {demo.user}
        </p>
        <p className="w-fit max-w-[90%] rounded-card rounded-bl-sm bg-background px-4 py-2.5 leading-relaxed">
          {demo.reply}
        </p>
        <div className="rounded-card border border-border-strong p-4">
          <p className="text-sm font-semibold text-text-muted">{demo.proposalTitle}</p>
          <p className="mt-1 flex items-center gap-2.5 text-lg font-bold tracking-tight">
            <span className="size-3 shrink-0 rounded-pill bg-workout-intervals" />
            {demo.proposal}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
            <span className="rounded-button bg-action px-4 py-2 text-white">{demo.accept}</span>
            <span className="rounded-button border border-border-strong px-4 py-2">{demo.decline}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Oś dnia 6:00–22:00: pas „najlepsza pora” i pas „unikaj”, jak w karcie pogody w aplikacji. */
function WeatherCard({ card }: { card: Content["weather"]["card"] }) {
  const hours = [6, 10, 14, 18, 22];
  return (
    <div className="rounded-card bg-surface p-6 text-text sm:p-7 lg:col-span-5">
      <p className="text-sm font-semibold text-text-muted">{card.place}</p>
      <div className="mt-5">
        <div className="relative h-10 overflow-hidden rounded-md bg-background">
          {/* 6–9 unikaj, 16–18:30 najlepiej; skala 16 godzin */}
          <span className="absolute inset-y-0 left-0 w-[18.75%] bg-accent/80" />
          <span className="absolute inset-y-0 left-[62.5%] w-[15.6%] bg-workout-easy" />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-text-muted tabular-nums">
          {hours.map((hour) => (
            <span key={hour}>{hour}:00</span>
          ))}
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <dt className="flex items-center gap-2 text-sm text-text-muted">
            <span className="size-2.5 rounded-pill bg-workout-easy" />
            {card.best}
          </dt>
          <dd className="mt-1 text-xl font-extrabold tracking-tight">{card.bestTime}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-sm text-text-muted">
            <span className="size-2.5 rounded-pill bg-accent" />
            {card.avoid}
          </dt>
          <dd className="mt-1 text-xl font-extrabold tracking-tight">{card.avoidTime}</dd>
        </div>
      </dl>
      <p className="mt-5 rounded-md bg-surface-accent-soft p-4 leading-relaxed text-text-on-accent">
        {card.tip}
      </p>
    </div>
  );
}
