// Tymczasowa strona startowa – właściwy landing z listą oczekujących to kolejny krok.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <span className="w-fit rounded-pill bg-surface-brand-soft px-3 py-1.5 text-xs font-semibold text-text-brand">
        Wkrótce · lista oczekujących
      </span>
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Plan biegowy, który pyta, jak się czujesz.
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-text-muted">
        I dopasowuje trening do Twojego dnia – a nie odwrotnie. Dla zapracowanych amatorów, od
        „wstaję z kanapy” do pierwszego półmaratonu.
      </p>
      <section className="flex flex-col gap-3 rounded-card bg-surface-brand p-6 text-text-on-brand">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-on-brand-muted">
          Przed treningiem
        </span>
        <p className="font-display text-2xl font-semibold">Jak się dzisiaj czujesz?</p>
        <p className="text-text-on-brand-muted">
          Jedno pytanie, kilka sekund. Na tej podstawie dopasuję dzisiejszy trening.
        </p>
        <span className="mt-2 w-fit rounded-button bg-accent px-5 py-3 font-semibold text-text-on-accent">
          Zapisz się – wkrótce
        </span>
      </section>
    </main>
  );
}
