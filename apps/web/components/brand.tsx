/** Znak „Słońce nad falą”. `onDark` = biała fala na ciemnym tle. */
export function Mark({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  const wave = onDark ? "#FFFFFF" : "#0E6E66";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="27" r="14" fill="#FFB547" />
      <path
        d="M6 40c4.3 0 6.5-4.5 13-4.5S27.7 40 32 40s6.5-4.5 13-4.5S53.7 40 58 40v6c-4.3 0-6.5-4.5-13-4.5S36.3 46 32 46s-6.5-4.5-13-4.5S10.3 46 6 46z"
        fill={wave}
      />
      <path
        d="M12 52c3.3 0 5-3 10-3s6.7 3 10 3 5-3 10-3 6.7 3 10 3"
        fill="none"
        stroke={wave}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Mark onDark={onDark} className="size-9" />
      <span className="text-lg font-extrabold tracking-tight">Aloha App</span>
    </span>
  );
}

/** Wzór „Plumerie” – tonalnie, tylko jako tło sekcji na stronie. */
export function Plumeria({ className }: { className?: string }) {
  const petals = [0, 72, 144, 216, 288];
  const flower = (
    <>
      {petals.map((angle) => (
        <ellipse key={angle} cx="32" cy="18" rx="8.5" ry="14" transform={`rotate(${angle} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="6.5" />
    </>
  );
  return (
    <svg className={className} aria-hidden="true">
      <defs>
        <pattern id="plumeria" width="56" height="56" patternUnits="userSpaceOnUse">
          <g fill="currentColor">
            <g transform="translate(4 4) scale(.34)">{flower}</g>
            <g transform="translate(32 30) scale(.24) rotate(25 32 32)">{flower}</g>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#plumeria)" />
    </svg>
  );
}
