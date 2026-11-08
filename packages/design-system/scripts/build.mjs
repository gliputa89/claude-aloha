// Generuje formaty platformowe z tokens/*.json:
//   build/theme.css  – zmienne CSS (light/dark) + motyw Tailwind v4  → apps/web, apps/admin
//   build/tokens.ts  – obiekt TS                                    → apps/mobile
// Uruchom: pnpm tokens (z katalogu głównego). Nie edytuj plików w build/ ręcznie.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(readFileSync(join(root, "tokens", f), "utf8"));
const { palette } = read("color.json");
const semantic = read("semantic.json");
const base = read("base.json");

// {"a":{"$value":1}} → {"a":1}; pomija klucze zaczynające się od $
const values = (node) =>
  "$value" in node
    ? node.$value
    : Object.fromEntries(
        Object.entries(node)
          .filter(([k]) => !k.startsWith("$"))
          .map(([k, v]) => [k, values(v)]),
      );

const paletteValues = values(palette);
const resolve = (v) =>
  typeof v === "string" && v.startsWith("{")
    ? v
        .slice(1, -1)
        .split(".")
        .slice(1)
        .reduce((o, k) => {
          if (o?.[k] === undefined) throw new Error(`Nieznany token: ${v}`);
          return o[k];
        }, paletteValues)
    : v;
const scheme = (s) =>
  Object.fromEntries(Object.entries(values(semantic[s])).map(([k, v]) => [k, resolve(v)]));

const colors = { light: scheme("light"), dark: scheme("dark") };
const { font, space, radius, motion } = values(base);
const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
const header = "/* WYGENEROWANE z packages/design-system/tokens – nie edytuj ręcznie. Zmień tokeny i uruchom `pnpm tokens`. */\n";

// ---------- CSS ----------
const colorVars = (c, indent) =>
  Object.entries(c).map(([k, v]) => `${indent}--aloha-color-${kebab(k)}: ${v};`).join("\n");
const fontStack = (name, fallback) =>
  `var(--font-${name}-loaded, "${font.family[name]}"), ${fallback}`;

const css = `${header}
:root {
${colorVars(colors.light, "  ")}
  --aloha-font-display: ${fontStack("display", "ui-sans-serif, system-ui, sans-serif")};
  --aloha-font-body: ${fontStack("body", "ui-sans-serif, system-ui, sans-serif")};
${Object.entries(radius).map(([k, v]) => `  --aloha-radius-${k}: ${v}px;`).join("\n")}
${Object.entries(motion.duration).map(([k, v]) => `  --aloha-duration-${k}: ${v}ms;`).join("\n")}
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${colorVars(colors.dark, "    ")}
    color-scheme: dark;
  }
}

:root[data-theme="dark"] {
${colorVars(colors.dark, "  ")}
  color-scheme: dark;
}

/* Motyw Tailwind v4: klasy bg-surface, text-text-muted, rounded-card, font-display itd. */
@theme inline {
${Object.keys(colors.light).map((k) => `  --color-${kebab(k)}: var(--aloha-color-${kebab(k)});`).join("\n")}
  --font-display: var(--aloha-font-display);
  --font-sans: var(--aloha-font-body);
${Object.keys(radius).map((k) => `  --radius-${k}: var(--aloha-radius-${k});`).join("\n")}
}
`;

// ---------- TypeScript (React Native) ----------
const ts = `${header}
export const palette = ${JSON.stringify(paletteValues, null, 2)} as const;

export const colors = ${JSON.stringify(colors, null, 2)} as const;

export type ColorScheme = keyof typeof colors;
export type ColorRole = keyof typeof colors.light;

export const font = ${JSON.stringify(font, null, 2)} as const;

export const space = ${JSON.stringify(space, null, 2)} as const;

export const radius = ${JSON.stringify(radius, null, 2)} as const;

export const motion = ${JSON.stringify(motion, null, 2)} as const;
`;

mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(join(root, "build/theme.css"), css);
writeFileSync(join(root, "build/tokens.ts"), ts);
console.log("design-system: build/theme.css, build/tokens.ts");
