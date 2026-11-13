#!/usr/bin/env node
// Plansze zrzutów ekranu: hasło u góry, ekran apki w ramce, tło marki.
// Google Play: 1080 × 1920 (9:16) → out/<lang>/. App Store: iPhone 6.3″, 1206 × 2622 (rozmiar wymagany w App Store Connect od 2026) → out-ios/<lang>/.
// Surowe zrzuty z symulatora: raw/<lang>/*.png (iPhone 17 Pro, 1206 × 2622, pasek statusu 9:41).
// Wynik: aloha-<pl|en-us>-NN.png. Render przez Chrome headless (jak grafika główna).
//
//   node design/store/screens/build.mjs          # Google Play, wszystkie języki, które mają surowe zrzuty
//   node design/store/screens/build.mjs pl       # Google Play, tylko polski
//   node design/store/screens/build.mjs --ios    # App Store (iPhone 6.3″), wszystkie języki

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const font = (w, f) => pathToFileURL(join(root, `node_modules/@expo-google-fonts/plus-jakarta-sans/${w}/PlusJakartaSans_${f}.ttf`)).href;

// Kolejność = kolejność w sklepie. Pierwsze trzy widać bez przewijania – muszą bronić się same.
// Hasła PL: scenariusz z marketing/sklepy/2026-11-10-karty-sklepowe-pl.md (bez „bez zegarka” – apka nie nagrywa biegu).
// W haśle fragment w [nawiasach] dostaje kolor akcentu. Bez kropek na końcu – font daje przed nimi szeroki odstęp.
const BOARDS = {
  pl: [
    { shot: '06-dzisiaj-checkin', title: 'Plan biegowy, który [pyta, jak się czujesz]' },
    { shot: '08-malo-czasu', title: 'Mało czasu? [Plan się dopasuje]' },
    { shot: '07-propozycja', title: 'Gorszy dzień to nie porażka, [to zmiana planu]' },
    { shot: '09-plan-kalendarz', title: 'Twój tydzień, [ułożony pod Ciebie]' },
    { shot: '10-trening-szczegoly', title: 'Każdy trening [krok po kroku]' },
    { shot: '11-trener-ai', title: 'Zapytaj trenera [przed treningiem]' },
  ],
  en: [
    { shot: '06-today-checkin', title: 'The running plan that [asks how you feel]' },
    // EN: dzisiejszy bieg miał już minimum 30 min, więc check-in nie proponował zmiany – propozycja jest z czatu,
    // a plansza 03 pokazuje odpowiedź na „So-so” (trening zostaje, „slow down, no guilt”).
    { shot: '08-short-on-time', title: 'Busy day? [Your coach adjusts the plan]' },
    { shot: '07-proposal', title: 'Rough day? [Slow down, no guilt]' },
    { shot: '09-plan-calendar', title: 'Your week, [built around you]' },
    { shot: '10-workout-details', title: 'Every run, [step by step]' },
    { shot: '11-ai-coach', title: 'Ask your coach [before you run]' },
  ],
};

const FILE_TAG = { pl: 'pl', en: 'en-us' };

// Wymiary planszy i proporcje układu. Telefon w wersji iOS jest wyższy, więc mieści się cały.
const FORMATS = {
  play: { outDir: 'out', w: 1080, h: 1920, side: 80, titleH: 470, font: 76, phoneW: 760, pad: 18, radius: 96, glow: 640 },
  ios: { outDir: 'out-ios', w: 1206, h: 2622, side: 88, titleH: 548, font: 88, phoneW: 914, pad: 22, radius: 115, glow: 712 },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const title = (t) => esc(t).replace(/\[(.+?)\]/g, '<em>$1</em>');

function html(lang, board, f) {
  const img = pathToFileURL(join(here, 'raw', lang, `${board.shot}.png`)).href;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
@font-face{font-family:PJS;font-weight:800;src:url("${font('800ExtraBold', '800ExtraBold')}")}
html,body{margin:0;padding:0}
body{width:${f.w}px;height:${f.h}px;overflow:hidden;font-family:PJS,sans-serif;
  background:radial-gradient(circle at 50% 108%,rgba(255,214,150,.28) 0,rgba(255,214,150,0) ${f.glow}px),linear-gradient(170deg,#0E6E66 0%,#0E6E66 50%,#0A5852 100%)}
h1{position:absolute;left:${f.side}px;right:${f.side}px;top:0;height:${f.titleH}px;margin:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:${f.font}px;line-height:1.08;letter-spacing:-.02em;text-align:center;text-wrap:balance}
h1 em{font-style:normal;color:#FFB547}
.phone{position:absolute;left:50%;top:${f.titleH}px;width:${f.phoneW}px;transform:translateX(-50%);
  border-radius:${f.radius}px;padding:${f.pad}px;background:#0C1514;box-shadow:0 40px 90px rgba(0,0,0,.35)}
.phone img{display:block;width:100%;border-radius:${f.radius - f.pad}px}
</style></head><body><h1><span>${title(board.title)}</span></h1><div class="phone"><img src="${img}"></div></body></html>`;
}

const args = process.argv.slice(2);
const f = FORMATS[args.includes('--ios') ? 'ios' : 'play'];
const langArg = args.find((a) => !a.startsWith('--'));
const langs = langArg ? [langArg] : Object.keys(BOARDS);
for (const lang of langs) {
  const outDir = join(here, f.outDir, lang);
  mkdirSync(outDir, { recursive: true });
  BOARDS[lang].forEach((board, i) => {
    if (!existsSync(join(here, 'raw', lang, `${board.shot}.png`))) {
      console.log(`– pomijam ${lang}/${board.shot} (brak surowego zrzutu)`);
      return;
    }
    const n = String(i + 1).padStart(2, '0');
    const file = `aloha-${FILE_TAG[lang]}-${n}.png`; // unikalne nazwy – Play Console bierze takie same za duplikaty
    const tmp = join(outDir, `.${n}.html`);
    writeFileSync(tmp, html(lang, board, f));
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      '--force-device-scale-factor=1', `--window-size=${f.w},${f.h}`, `--screenshot=${join(outDir, file)}`, pathToFileURL(tmp).href],
      { stdio: 'ignore' });
    rmSync(tmp);
    console.log(`✓ ${lang}/${file}  ${board.title.replace(/[[\]]/g, '')}`);
  });
}
