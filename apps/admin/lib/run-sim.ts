import type { SimOptions } from '@aloha/plan-engine';

// Warianty symulowanego biegu w testerze: „jak poszło” w pięciu wersjach, od wykonania zgodnego z planem
// po treningi wyraźnie obok planu. Liczby dobrane tak, żeby reguły oceny (review.ts) miały co nazwać –
// to one, a nie te wartości, decydują o werdykcie.

export const RUN_VARIANTS = ['ok', 'slow', 'fast', 'more', 'less'] as const;
export type RunVariant = (typeof RUN_VARIANTS)[number];

/** Szum tempa jak z GPS – bez niego przebieg jest nienaturalnie równy. */
const GPS = { noiseS: 6 };

export const RUN_VARIANT_INFO: Record<RunVariant, { label: string; detail: string; sim: SimOptions }> = {
  ok: {
    label: 'Zgodnie z planem',
    detail: 'Czas i tempo w widełkach każdego odcinka, wszystkie powtórzenia zrobione.',
    sim: { ...GPS },
  },
  slow: {
    label: 'Za wolno',
    detail: 'Tempo ok. 35 s/km wolniej od środka strefy, mocne odcinki ok. 20 s/km wolniej od swoich widełek.',
    sim: { ...GPS, paceOffsetS: 35, repOffsetS: 20 },
  },
  fast: {
    label: 'Za szybko',
    detail: 'Tempo ok. 40 s/km szybciej od środka strefy, mocne odcinki ok. 30 s/km szybciej od swoich widełek.',
    sim: { ...GPS, paceOffsetS: -40, repOffsetS: -30 },
  },
  more: {
    label: 'Za dużo',
    detail: 'Trening o ok. 35% dłuższy – dołożone minuty w spokojnym tempie.',
    sim: { ...GPS, volume: 1.35 },
  },
  less: {
    label: 'Za mało',
    detail: 'Trening urwany na ok. 55% zaplanowanego czasu.',
    sim: { ...GPS, volume: 0.55 },
  },
};

/** Tętno dokładamy tylko przy zgodzie na dane zdrowotne – jak w aplikacji. */
export const SIM_HR = { max: 185, easy: 0.72 };
