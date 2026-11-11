"use client";

import { useEffect, useState } from "react";

/**
 * Zmieniające się słowo w nagłówku hero („do Twojego dnia / tygodnia / życia…”).
 * Czytniki ekranu dostają stały nagłówek (aria-label na h1), a przy „ogranicz ruch” zostaje pierwsze słowo.
 */
export function RotatingWord({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % words.length), 2600);
    return () => window.clearInterval(timer);
  }, [words.length]);

  return (
    <span key={index} className="word-in inline-block text-accent">
      {words[index]}.
    </span>
  );
}
