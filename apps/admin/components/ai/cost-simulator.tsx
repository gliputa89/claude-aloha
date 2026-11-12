'use client';

import { useMemo, useState } from 'react';

import { Card, inputClass, secondaryButton } from '@/components/ai/ui';
import {
  CEILING_BEHAVIOR,
  CHAT_DAILY_LIMIT_SIM,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_FUNNEL,
  MARKETS,
  costOfItems,
  economics,
  netRevenue,
  trialCost,
  DEFAULT_PRICING,
  MODEL_OPTIONS,
  PRESETS,
  SIM_ITEMS,
  SIM_ITEM_INFO,
  defaultModels,
  margin,
  priceForMargin,
  simulate,
  type Assumptions,
  type Behavior,
  type Funnel,
  type ModelChoice,
  type Pricing,
  type SimItem,
  type UnitCost,
  type UnitStats,
} from '@/lib/ai/cost-sim';
import { formatDateTime, formatUsd } from '@/lib/format';

const SMALL_SAMPLE = 10;

const money = (v: number, currency: Pricing['currency']) => {
  const n = Math.abs(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = v < 0 ? '−' : '';
  return currency === 'USD' ? `${sign}$${n}` : `${sign}${n} zł`;
};
const pct = (v: number) => `${Math.round(v * 100)}%`;
const calls = (v: number) => v.toLocaleString('pl-PL', { maximumFractionDigits: v < 10 ? 1 : 0 });

export function CostSimulator({ data }: { data: UnitStats }) {
  const [behavior, setBehavior] = useState<Behavior>(PRESETS[1]!.behavior);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [models, setModels] = useState<ModelChoice>(defaultModels);
  const [overrides, setOverrides] = useState<Partial<Record<SimItem, number>>>({});
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  const [shares, setShares] = useState<Record<string, number>>(() => Object.fromEntries(PRESETS.map((p) => [p.id, p.share * 100])));
  const [target, setTarget] = useState(0.7);

  const [funnel, setFunnel] = useState<Funnel>(DEFAULT_FUNNEL);
  const pln = (v: number) => money(v, pricing.currency);
  const unit = pricing.currency === 'USD' ? '$' : 'zł';
  // Koszt AI jest w USD; drugą kwotę pokazujemy tylko, gdy rynek ma inną walutę.
  const local = pricing.currency !== 'USD';

  const run = (b: Behavior) => simulate(b, assumptions, models, data.stats, overrides);
  const result = run(behavior);
  const own = margin(result.totalUsd, pricing);
  const activePreset =
    PRESETS.find((p) => JSON.stringify({ ...p.behavior, firstMonth: behavior.firstMonth }) === JSON.stringify(behavior))?.id ?? null;

  const profiles = useMemo(
    () => [
      ...PRESETS.map((p) => ({ id: p.id, label: p.label, hint: p.hint, behavior: p.behavior })),
      { id: 'ceiling', label: 'Sufit', hint: `wszystko na maksimum, ${CHAT_DAILY_LIMIT_SIM} wiadomości każdego dnia, pierwszy miesiąc`, behavior: CEILING_BEHAVIOR },
    ],
    [],
  );
  const profileCosts = profiles.map((p) => ({ ...p, usd: run(p.behavior).totalUsd }));
  const shareSum = PRESETS.reduce((sum, p) => sum + (shares[p.id] ?? 0), 0);
  const blendedUsd =
    shareSum > 0 ? PRESETS.reduce((sum, p) => sum + (shares[p.id] ?? 0) * (profileCosts.find((c) => c.id === p.id)?.usd ?? 0), 0) / shareSum : 0;
  const blended = margin(blendedUsd, pricing);
  const maxLine = Math.max(...result.lines.map((l) => l.usd), 0);

  // Porównanie z modelami domyślnymi (te, na których aplikacja działa dziś): ta sama osoba, te same założenia.
  const baseModels = defaultModels();
  const changed = SIM_ITEMS.filter((i) => models[i] !== baseModels[i]);
  const baseOverrides = Object.fromEntries(Object.entries(overrides).filter(([k]) => !changed.includes(k as SimItem)));
  const runBase = (b: Behavior) => simulate(b, assumptions, baseModels, data.stats, baseOverrides).totalUsd;
  const baseOwnUsd = runBase(behavior);
  const baseBlendedUsd =
    shareSum > 0 ? PRESETS.reduce((sum, p) => sum + (shares[p.id] ?? 0) * runBase(p.behavior), 0) / shareSum : 0;
  const setAllModels = (model: string | null) => {
    setModels(model ? (Object.fromEntries(SIM_ITEMS.map((i) => [i, model])) as ModelChoice) : defaultModels());
    setOverrides({});
  };
  // Rachunek na płacącego: darmowi i okresy próbne zachowują się jak średnia ważona profili.
  const simArgs = { assumptions, models, stats: data.stats, overrides };
  const mix = (f: (b: Behavior) => number) =>
    shareSum > 0 ? PRESETS.reduce((sum, p) => sum + (shares[p.id] ?? 0) * f(p.behavior), 0) / shareSum : 0;
  const freeUsd = mix((b) => costOfItems(b, funnel.freeItems, simArgs));
  const trialUsd = mix((b) => trialCost(b, funnel.trialDays, simArgs));
  const eco = economics(pricing, funnel, { paying: blendedUsd, free: freeUsd, trial: trialUsd });
  const revenue = netRevenue(pricing);
  const allSame = (model: string) => SIM_ITEMS.every((i) => models[i] === model);

  const set = <K extends keyof Behavior>(key: K, value: Behavior[K]) => setBehavior((b) => ({ ...b, [key]: value }));

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Symulator kosztu na osobę</h1>
        <p className="max-w-3xl text-sm text-text-muted">
          Koszt jednego wywołania pochodzi z prawdziwych wywołań AI
          {data.calls ? ` (${data.calls} wywołań, ${formatDateTime(data.from)} – ${formatDateTime(data.to)})` : ' (brak wywołań – wartości zapasowe z kodu)'}.
          Częstotliwość wywołań to założenia o zachowaniu osoby: ustaw je suwakami.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Osoba">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.hint}
                onClick={() => setBehavior((b) => ({ ...p.behavior, firstMonth: b.firstMonth }))}
                className={`rounded-button border px-3 py-1.5 text-sm font-medium ${
                  activePreset === p.id
                    ? 'border-action bg-surface-brand-soft text-text-brand'
                    : 'border-border-strong text-text-muted hover:bg-background hover:text-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Slider label="Treningi w tygodniu" value={behavior.runsPerWeek} min={0} max={7} onChange={(v) => set('runsPerWeek', v)} />
          <Slider
            label="Wykonane i pobrane ze Stravy"
            value={Math.round(behavior.completion * 100)}
            min={0}
            max={100}
            step={5}
            unit="%"
            hint="tylko po wykonanym treningu powstaje notka trenera"
            onChange={(v) => set('completion', v / 100)}
          />
          <Slider
            label="Dni z otwarciem aplikacji w tygodniu"
            value={behavior.activeDaysPerWeek}
            min={0}
            max={7}
            hint="porady pogodowe i notki na dni bez biegu"
            onChange={(v) => set('activeDaysPerWeek', v)}
          />
          <Slider
            label="Wiadomości do trenera AI w tygodniu"
            value={behavior.chatPerWeek}
            min={0}
            max={CHAT_DAILY_LIMIT_SIM * 7}
            hint={`limit w aplikacji: ${CHAT_DAILY_LIMIT_SIM} na dobę, czyli ${CHAT_DAILY_LIMIT_SIM * 7} w tygodniu`}
            onChange={(v) => set('chatPerWeek', v)}
          />
          <Slider
            label="Przebudowy planu w miesiącu"
            value={behavior.rebuildsPerMonth}
            min={0}
            max={12}
            hint="zmiana dostępności albo celu, tydzień układany od nowa"
            onChange={(v) => set('rebuildsPerMonth', v)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={behavior.firstMonth} onChange={(e) => set('firstMonth', e.target.checked)} className="size-4 accent-[var(--color-action)]" />
            Pierwszy miesiąc (plan po ankiecie)
          </label>
        </Card>

        <Card title="Koszt AI tej osoby w miesiącu">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-4xl font-semibold tabular-nums">{formatUsd(result.totalUsd)}</span>
            {local ? <span className="text-lg text-text-muted tabular-nums">{pln(result.totalUsd * pricing.usdRate)}</span> : null}
          </div>
          <p className="text-xs text-text-muted">
            {formatUsd(result.baseUsd)} z wywołań + {pct(assumptions.buffer)} zapasu · rocznie {formatUsd(result.totalUsd * 12)}
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            {result.lines.map((l) => (
              <li key={l.item} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate">{SIM_ITEM_INFO[l.item].label}</span>
                  <span className="flex shrink-0 gap-3 tabular-nums">
                    <span className="text-text-muted">{calls(l.calls)}×</span>
                    <span className="w-16 text-right font-semibold">{formatUsd(l.usd)}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-pill bg-background">
                  <div className="h-full rounded-pill bg-action" style={{ width: `${maxLine > 0 ? (l.usd / maxLine) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-1 grid grid-cols-3 gap-3 border-t border-border pt-3 text-sm">
            <Figure label={`Z ceny ${pln(pricing.price)} zostaje`} value={pln(own.net)} />
            <Figure label="Marża po AI i kosztach" value={pln(own.profit)} tone={own.profit < 0 ? 'bad' : undefined} />
            <Figure label="Marża" value={pct(own.marginShare)} tone={own.profit < 0 ? 'bad' : undefined} />
          </div>
        </Card>
      </div>

      <Card
        title="Modele i koszt jednego wywołania"
        actions={
          Object.keys(overrides).length ? (
            <button type="button" className={secondaryButton} onClick={() => setOverrides({})}>
              Przywróć zmierzone
            </button>
          ) : (
            <span className="text-xs text-text-muted">koszt możesz wpisać ręcznie</span>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-muted">Ustaw wszystkie:</span>
          <button
            type="button"
            onClick={() => setAllModels(null)}
            className={`rounded-button border px-3 py-1.5 font-medium ${
              changed.length === 0 ? 'border-action bg-surface-brand-soft text-text-brand' : 'border-border-strong text-text-muted hover:bg-background hover:text-text'
            }`}
          >
            Jak dziś
          </button>
          {MODEL_OPTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setAllModels(m.id)}
              className={`rounded-button border px-3 py-1.5 font-medium ${
                allSame(m.id) ? 'border-action bg-surface-brand-soft text-text-brand' : 'border-border-strong text-text-muted hover:bg-background hover:text-text'
              }`}
            >
              {m.label.replace('Claude ', '')}
            </button>
          ))}
        </div>
        <div className="grid gap-3 rounded-card bg-background p-4 text-sm sm:grid-cols-2">
          <Compare
            label="Ta osoba"
            baseUsd={baseOwnUsd}
            usd={result.totalUsd}
            pricing={pricing}
            target={target}
            unchanged={changed.length === 0}
          />
          <Compare
            label="Średnia ważona profili"
            baseUsd={baseBlendedUsd}
            usd={blendedUsd}
            pricing={pricing}
            target={target}
            unchanged={changed.length === 0}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="text-left text-xs text-text-muted">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Funkcja</th>
                <th className="py-2 font-medium">Model</th>
                <th className="py-2 font-medium">Skąd liczba</th>
                <th className="py-2 text-right font-medium">Koszt wywołania (USD)</th>
                <th className="py-2 text-right font-medium">Wywołań / mies.</th>
                <th className="py-2 text-right font-medium">Koszt / mies.</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l) => (
                <tr key={l.item} className="border-b border-border align-top last:border-b-0">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{SIM_ITEM_INFO[l.item].label}</div>
                    <div className="text-xs text-text-muted">{SIM_ITEM_INFO[l.item].trigger}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      aria-label={`Model: ${SIM_ITEM_INFO[l.item].label}`}
                      value={models[l.item]}
                      onChange={(e) => {
                        setModels((m) => ({ ...m, [l.item]: e.target.value }));
                        setOverrides((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== l.item)));
                      }}
                      className={`${inputClass} py-1.5 ${models[l.item] !== baseModels[l.item] ? 'border-action' : ''}`}
                    >
                      {MODEL_OPTIONS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    <Basis unit={l.unit} manual={overrides[l.item] !== undefined} />
                  </td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      aria-label={`Koszt wywołania: ${SIM_ITEM_INFO[l.item].label}`}
                      min={0}
                      step="0.0001"
                      value={Number(l.unit.usd.toFixed(5))}
                      onChange={(e) => {
                        const v = e.target.valueAsNumber;
                        setOverrides((o) => (Number.isFinite(v) && v >= 0 ? { ...o, [l.item]: v } : o));
                      }}
                      className={`${inputClass} w-28 py-1.5 text-right tabular-nums`}
                    />
                  </td>
                  <td className="py-2 text-right tabular-nums">{calls(l.calls)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{formatUsd(l.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 border-t border-border pt-3 sm:grid-cols-3">
          <Slider
            label="Ponowienia planu po walidacji"
            value={Math.round(assumptions.planRetryRate * 100)}
            min={0}
            max={100}
            step={5}
            unit="%"
            hint={data.planRetryRate === null ? 'w testach: brak danych' : `w testach: ${pct(data.planRetryRate)}`}
            onChange={(v) => setAssumptions((a) => ({ ...a, planRetryRate: v / 100 }))}
          />
          <Slider
            label="Porady pogodowe na dzień z otwarciem"
            value={assumptions.weatherPerActiveDay}
            min={0}
            max={3}
            step={0.1}
            hint="jedno wywołanie obejmuje wszystkie treningi z 7 dni"
            onChange={(v) => setAssumptions((a) => ({ ...a, weatherPerActiveDay: v }))}
          />
          <Slider
            label="Zapas"
            value={Math.round(assumptions.buffer * 100)}
            min={0}
            max={100}
            step={5}
            unit="%"
            hint="błędy, dłuższe rozmowy, rosnące prompty"
            onChange={(v) => setAssumptions((a) => ({ ...a, buffer: v / 100 }))}
          />
        </div>
      </Card>

      <Card title="Cena">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-muted">Rynek:</span>
          {MARKETS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPricing(m.pricing)}
              className={`rounded-button border px-3 py-1.5 font-medium ${
                pricing.currency === m.pricing.currency ? 'border-action bg-surface-brand-soft text-text-brand' : 'border-border-strong text-text-muted hover:bg-background hover:text-text'
              }`}
            >
              {m.label}
            </button>
          ))}
          <span className="text-xs text-text-muted">wczytuje proponowane ceny i podatki dla rynku</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField label={`Cena miesięczna (${unit})`} value={pricing.price} step={1} onChange={(v) => setPricing((p) => ({ ...p, price: v }))} />
          <NumberField label={`Cena roczna (${unit})`} value={pricing.annualPrice} step={10} onChange={(v) => setPricing((p) => ({ ...p, annualPrice: v }))} />
          <NumberField label="Płacący na planie rocznym (%)" value={pricing.annualShare * 100} step={5} onChange={(v) => setPricing((p) => ({ ...p, annualShare: Math.min(v, 100) / 100 }))} />
          <NumberField label="Docelowa marża (%)" value={target * 100} step={5} onChange={(v) => setTarget(Math.min(v, 95) / 100)} />
          <NumberField label="VAT w cenie (%)" value={pricing.vat * 100} step={1} onChange={(v) => setPricing((p) => ({ ...p, vat: v / 100 }))} />
          <NumberField label="Prowizja sklepu (%)" value={pricing.storeFee * 100} step={1} onChange={(v) => setPricing((p) => ({ ...p, storeFee: Math.min(v, 99) / 100 }))} />
          {pricing.currency === 'PLN' ? (
            <NumberField label="Kurs USD (zł)" value={pricing.usdRate} step={0.05} onChange={(v) => setPricing((p) => ({ ...p, usdRate: v }))} />
          ) : null}
          <NumberField label={`Inne koszty na osobę (${unit})`} value={pricing.other} step={0.25} onChange={(v) => setPricing((p) => ({ ...p, other: v }))} />
        </div>
        <p className="text-xs text-text-muted">
          Z ceny odchodzi VAT (w USA podatek jest doliczany ponad cenę, stąd 0), potem prowizja sklepu (15% w programie dla małych firm,
          30% poza nim). Kurs i inne koszty to wartości do wpisania, nie pomiary. Tabela niżej liczy marżę dla planu miesięcznego.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="text-left text-xs text-text-muted">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Profil</th>
                <th className="py-2 text-right font-medium">Udział płacących (%)</th>
                <th className="py-2 text-right font-medium">Koszt AI / mies.</th>
                <th className="py-2 text-right font-medium">Marża przy {pln(pricing.price)}</th>
                <th className="py-2 text-right font-medium">Cena dla marży {pct(target)}</th>
              </tr>
            </thead>
            <tbody>
              {profileCosts.map((p) => {
                const m = margin(p.usd, pricing);
                const needed = priceForMargin(p.usd, pricing, target);
                const isPreset = p.id !== 'ceiling';
                return (
                  <tr key={p.id} className="border-b border-border">
                    <td className="py-2 pr-3">
                      <button type="button" className="font-medium text-text-brand hover:underline" onClick={() => setBehavior(p.behavior)}>
                        {p.label}
                      </button>
                      <div className="text-xs text-text-muted">{p.hint}</div>
                    </td>
                    <td className="py-2 text-right">
                      {isPreset ? (
                        <input
                          type="number"
                          aria-label={`Udział: ${p.label}`}
                          min={0}
                          max={100}
                          value={shares[p.id] ?? 0}
                          onChange={(e) => {
                            const v = e.target.valueAsNumber;
                            setShares((s) => ({ ...s, [p.id]: Number.isFinite(v) && v >= 0 ? v : 0 }));
                          }}
                          className={`${inputClass} w-20 py-1.5 text-right tabular-nums`}
                        />
                      ) : (
                        <span className="text-text-muted">–</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatUsd(p.usd)} {local ? <span className="text-text-muted">· {pln(p.usd * pricing.usdRate)}</span> : null}
                    </td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${m.profit < 0 ? 'text-danger' : ''}`}>
                      {pln(m.profit)} <span className="font-normal text-text-muted">· {pct(m.marginShare)}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{needed === null ? '–' : pln(needed)}</td>
                  </tr>
                );
              })}
              <tr className="bg-surface-brand-soft/50">
                <td className="py-2 pr-3 font-semibold">
                  Średnia ważona
                  {Math.round(shareSum) !== 100 ? <div className="text-xs font-normal text-text-accent-strong">udziały sumują się do {calls(shareSum)}%, liczę proporcjonalnie</div> : null}
                </td>
                <td className="py-2 text-right tabular-nums">{calls(shareSum)}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatUsd(blendedUsd)} {local ? <span className="text-text-muted">· {pln(blendedUsd * pricing.usdRate)}</span> : null}
                </td>
                <td className={`py-2 text-right font-semibold tabular-nums ${blended.profit < 0 ? 'text-danger' : ''}`}>
                  {pln(blended.profit)} <span className="font-normal text-text-muted">· {pct(blended.marginShare)}</span>
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">{pln(priceForMargin(blendedUsd, pricing, target) ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted">
          Profile liczone dla kolejnego miesiąca (bez planu po ankiecie); sufit – dla pierwszego. Kliknij profil, żeby wczytać go do suwaków.
        </p>
      </Card>

      <Card title="Rachunek na jednego płacącego">
        <p className="max-w-3xl text-sm text-text-muted">
          Płacący utrzymuje też darmowych i okresy próbne tych, którzy nie kupili. Darmowi i osoby w okresie próbnym zachowują się tu jak
          średnia ważona profili z tabeli wyżej.
        </p>
        <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 text-text-muted">AI w pakiecie darmowym</legend>
              {SIM_ITEMS.filter((i) => i !== 'plan-first').map((item) => (
                <label key={item} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={funnel.freeItems.includes(item)}
                    onChange={(e) =>
                      setFunnel((f) => ({
                        ...f,
                        freeItems: e.target.checked ? [...f.freeItems, item] : f.freeItems.filter((i) => i !== item),
                      }))
                    }
                    className="size-4 accent-[var(--color-action)]"
                  />
                  {SIM_ITEM_INFO[item].label}
                </label>
              ))}
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Aktywni darmowi na 1 płacącego" value={funnel.freePerPaying} step={1} onChange={(v) => setFunnel((f) => ({ ...f, freePerPaying: v }))} />
              <NumberField label="Okres próbny (dni, 0 = brak)" value={funnel.trialDays} step={7} onChange={(v) => setFunnel((f) => ({ ...f, trialDays: v }))} />
              <NumberField label="Kupuje po okresie próbnym (%)" value={funnel.trialConversion * 100} step={1} onChange={(v) => setFunnel((f) => ({ ...f, trialConversion: Math.min(v, 100) / 100 }))} />
              <NumberField label="Płacący zostaje (mies.)" value={funnel.lifetimeMonths} step={1} onChange={(v) => setFunnel((f) => ({ ...f, lifetimeMonths: v }))} />
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <EcoRow
              label="Przychód po podatku i prowizji"
              hint={`miesięczny ${pln(revenue.monthly)} · roczny ${pln(revenue.annual)} na mies. · ${pct(pricing.annualShare)} na rocznym`}
              value={pln(eco.revenue)}
              strong
            />
            <EcoRow label="AI płacącego" hint={`średnia ważona profili: ${formatUsd(blendedUsd)}`} value={pln(-eco.payingAi)} />
            <EcoRow
              label="AI darmowych"
              hint={`${calls(funnel.freePerPaying)} × ${formatUsd(freeUsd)} na darmowego w miesiącu`}
              value={pln(-eco.freeAi)}
            />
            <EcoRow
              label="Okresy próbne"
              hint={
                funnel.trialDays > 0 && funnel.trialConversion > 0
                  ? `${formatUsd(trialUsd)} za okres próbny · ${formatUsd(trialUsd / funnel.trialConversion)} na pozyskanego płacącego, rozłożone na ${calls(funnel.lifetimeMonths)} mies.`
                  : 'bez okresu próbnego'
              }
              value={pln(-eco.trialAi)}
            />
            <EcoRow label="Inne koszty" value={pln(-eco.other)} />
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <span className="font-semibold">Zostaje na płacącego w miesiącu</span>
              <span className={`font-display text-2xl font-semibold tabular-nums ${eco.profit < 0 ? 'text-danger' : ''}`}>
                {pln(eco.profit)} <span className="text-base font-normal text-text-muted">· {pct(eco.profitShare)}</span>
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Bez kosztu pozyskania użytkownika (reklamy), zwrotów i podatku dochodowego. Liczba darmowych na płacącego, konwersja i czas życia
              to założenia do wpisania – nie ma jeszcze danych, z których dałoby się je zmierzyć.
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}

/** Koszt i cena przy wybranych modelach obok tych samych liczb dla modeli używanych dziś. */
function Compare({
  label,
  baseUsd,
  usd,
  pricing,
  target,
  unchanged,
}: {
  label: string;
  baseUsd: number;
  usd: number;
  pricing: Pricing;
  target: number;
  unchanged: boolean;
}) {
  const now = margin(usd, pricing);
  const price = priceForMargin(usd, pricing, target);
  const basePrice = priceForMargin(baseUsd, pricing, target);
  const diff = baseUsd > 0 ? (usd - baseUsd) / baseUsd : 0;
  const pln = (v: number) => money(v, pricing.currency);
  const was = (text: string) => (unchanged ? null : <span className="text-text-muted line-through">{text}</span>);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-text-muted">Koszt AI / mies.:</span>
        {was(formatUsd(baseUsd))}
        <span className="font-semibold tabular-nums">{formatUsd(usd)}</span>
        {unchanged ? (
          <span className="text-xs text-text-muted">modele jak dziś</span>
        ) : (
          <span className={`text-xs font-semibold tabular-nums ${diff > 0 ? 'text-danger' : 'text-text-brand'}`}>
            {diff > 0 ? '+' : '−'}
            {pct(Math.abs(diff))}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-text-muted">Marża przy {pln(pricing.price)}:</span>
        {was(pct(margin(baseUsd, pricing).marginShare))}
        <span className={`font-semibold tabular-nums ${now.profit < 0 ? 'text-danger' : ''}`}>{pct(now.marginShare)}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-text-muted">Cena dla marży {pct(target)}:</span>
        {was(basePrice === null ? '–' : pln(basePrice))}
        <span className="font-semibold tabular-nums">{price === null ? '–' : pln(price)}</span>
      </div>
    </div>
  );
}

function EcoRow({ label, hint, value, strong }: { label: string; hint?: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <span className={strong ? 'font-semibold' : ''}>{label}</span>
        {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
      </span>
      <span className={`shrink-0 tabular-nums ${strong ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}

function Basis({ unit, manual }: { unit: UnitCost; manual: boolean }) {
  if (manual) return <span className="text-text-accent-strong">wpisane ręcznie</span>;
  if (unit.basis === 'fallback') return <span className="text-text-accent-strong">brak wywołań – wartość zapasowa z kodu</span>;
  const small = unit.n < SMALL_SAMPLE;
  const noun = unit.n === 1 ? 'wywołania' : 'wywołań';
  return (
    <span className={small ? 'text-text-accent-strong' : 'text-text-muted'}>
      {unit.basis === 'measured' ? `średnia z ${unit.n} ${noun}` : `tokeny z ${unit.n} ${noun} ${unit.sourceModel.replace('claude-', '')} × cennik tego modelu`}
      {small ? ' · mała próba' : ''}
    </span>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`font-semibold tabular-nums ${tone === 'bad' ? 'text-danger' : ''}`}>{value}</span>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-baseline justify-between gap-3">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">
          {value.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="w-full accent-[var(--color-action)]"
      />
      {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}

function NumberField({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-text-muted">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={Number(value.toFixed(2))}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v) && v >= 0) onChange(v);
        }}
        className={`${inputClass} tabular-nums`}
      />
    </label>
  );
}
