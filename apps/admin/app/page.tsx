// Tymczasowy dashboard – dane pojawią się po podłączeniu Supabase (schematy marketing / analytics).
const kpis = [
  { label: "Zapisy na listę", value: "–" },
  { label: "Aktywni (7 dni)", value: "–" },
  { label: "Retencja po 4 tyg.", value: "–" },
  { label: "Check-iny w dni treningowe", value: "–" },
  { label: "Akceptacja propozycji", value: "–" },
  { label: "Koszt AI (miesiąc)", value: "–" },
];

export default function Dashboard() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">Aloha Training</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Panel</h1>
      </header>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
            <span className="text-sm text-text-muted">{kpi.label}</span>
            <span className="font-display text-3xl font-semibold">{kpi.value}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
