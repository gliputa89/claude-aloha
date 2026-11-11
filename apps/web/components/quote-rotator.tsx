"use client";

import { useEffect, useState } from "react";

type Props = { quotes: string[]; marks: [string, string]; label: string };

/**
 * Cytaty z aplikacji pokazywane po jednym. Zmieniają się same co kilka sekund;
 * zatrzymują się po najechaniu lub fokusie, a przy „ogranicz ruch” zmienia je tylko kliknięcie kropki.
 */
export function QuoteRotator({ quotes, marks, label }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % quotes.length), 4800);
    return () => window.clearInterval(timer);
  }, [paused, quotes.length]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Wszystkie cytaty leżą w tej samej komórce siatki, więc wysokość sekcji się nie zmienia. */}
      <div className="grid" aria-live="polite">
        {quotes.map((quote, i) => (
          <p
            key={quote}
            aria-hidden={i !== index}
            className={`col-start-1 row-start-1 max-w-4xl self-center text-3xl leading-tight font-extrabold tracking-tight text-balance transition-[opacity,transform] duration-500 ease-out sm:text-5xl sm:leading-[1.08] motion-reduce:transition-none ${
              i === index ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"
            }`}
          >
            {marks[0]}
            {quote}
            {marks[1]}
          </p>
        ))}
      </div>
      <div role="group" aria-label={label} className="mt-10 flex gap-1">
        {quotes.map((quote, i) => (
          <button
            key={quote}
            type="button"
            onClick={() => setIndex(i)}
            aria-pressed={i === index}
            aria-label={`${label} ${i + 1}`}
            className="grid h-6 place-items-center px-1"
          >
            <span
              className={`block h-1 rounded-pill transition-all duration-300 ${
                i === index ? "w-8 bg-accent" : "w-4 bg-white/35 hover:bg-white/70"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
