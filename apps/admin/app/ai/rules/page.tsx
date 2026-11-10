import {
  AI_OPERATION_LABEL,
  AI_OPERATION_KINDS,
  ENGINE_RULES,
  ENGINE_VERSION,
  rulesPromptBlock,
  TRAINING_LEVEL_INFO,
  TRAINING_LEVELS,
  VIOLATION_LABEL,
  type TrainingLevel,
} from '@aloha/plan-engine';
import Link from 'next/link';
import { Suspense } from 'react';

import { ParamsWorkbench } from '@/components/ai/params-workbench';
import { Card, JsonBlock } from '@/components/ai/ui';
import { listEngineConfigs } from '@/lib/ai/data';
import { loadAiRuntime } from '@/lib/ai/runtime';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

const OPERATION_HINT: Record<string, string> = {
  set_duration: 'skraca lub wydłuża trening (w granicach limitu dnia, minimum i limitu wydłużenia)',
  set_type: 'zmienia rodzaj (np. interwały → spokojny); strukturę liczy silnik',
  move: 'przenosi trening na wolny dzień z ankiety',
  remove: 'usuwa trening (np. za dużo na start)',
  add: 'dodaje trening na wolny dzień – nie ponad liczbę treningów ze szkicu',
};

export default function AiRulesPage({ searchParams }: { searchParams: Promise<{ poziom?: string }> }) {
  return (
    <Suspense fallback={<p className="text-text-muted">Wczytuję ramy…</p>}>
      <Rules searchParams={searchParams} />
    </Suspense>
  );
}

const toLevel = (raw: string | undefined): TrainingLevel => {
  const n = Number(raw);
  return (TRAINING_LEVELS as readonly number[]).includes(n) ? (n as TrainingLevel) : 3;
};

async function Rules({ searchParams }: { searchParams: Promise<{ poziom?: string }> }) {
  await requireAdmin();
  const level = toLevel((await searchParams).poziom);
  const [versions, runtime] = await Promise.all([listEngineConfigs(), loadAiRuntime(createServiceClient())]);
  const { engine } = runtime;

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Ramy planu</h1>
        <p className="max-w-3xl text-sm text-text-muted">
          Silnik reguł ({ENGINE_VERSION}) układa bezpieczny szkic, Claude go dopasowuje, a silnik sprawdza każdą operację. Liczby poniżej
          edytujesz w wersjach (granice są w kodzie i panel ich nie przekroczy). Logika i lista operacji niżej są w kodzie – zmienia się je
          commitem i testami.
        </p>
        <p className="text-sm">
          Aktywne: <b>{engine.version ? `v${engine.version}` : 'wartości wbudowane'}</b>
        </p>
      </header>

      <ParamsWorkbench active={engine.params} activeVersion={engine.version} versions={versions} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Logika silnika (w kodzie)">
          <ul className="flex flex-col gap-2 text-sm">
            {ENGINE_RULES.map((r) => (
              <li key={r.title}>
                <b>{r.title}.</b> <span className="text-text-muted">{r.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="Co może AI (operacje na szkicu)">
            <ul className="flex flex-col gap-1.5 text-sm">
              {AI_OPERATION_KINDS.map((k) => (
                <li key={k}>
                  <code className="text-xs">{k}</code> – <b>{AI_OPERATION_LABEL[k]}</b>: <span className="text-text-muted">{OPERATION_HINT[k]}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-muted">
              Zawodów nie wolno zmieniać. Poziomy zmian 0–4 (check-in) dojdą z funkcją interpretacji check-inu – na tej samej liście operacji.
            </p>
          </Card>
          <Card title="Co silnik odrzuca (walidacja)">
            <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {Object.entries(VIOLATION_LABEL).map(([code, label]) => (
                <li key={code} className="text-text-muted">
                  {label}
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-muted">
              Operacja jest cofana, jeśli wprowadza nowe naruszenie; model dostaje listę odrzuconych i jedno ponowienie.
            </p>
          </Card>
        </div>
      </div>

      <Card title="Tak widzi to Claude – blok reguł w prompcie (z aktywnych parametrów)">
        <nav aria-label="Poziom zaawansowania" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-muted">Dla biegacza na poziomie:</span>
          {TRAINING_LEVELS.map((l) => (
            <Link
              key={l}
              href={`?poziom=${l}`}
              scroll={false}
              aria-current={l === level ? 'page' : undefined}
              className={`rounded-pill px-3 py-1 ${l === level ? 'bg-surface-brand-soft font-semibold text-text-brand' : 'bg-background text-text-muted hover:text-text'}`}
            >
              {l} · {TRAINING_LEVEL_INFO[l].label}
            </Link>
          ))}
        </nav>
        <JsonBlock value={rulesPromptBlock(engine.params, level)} />
      </Card>
    </>
  );
}
