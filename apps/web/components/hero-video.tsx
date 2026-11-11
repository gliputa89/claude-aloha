"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Props = { pauseLabel: string; playLabel: string; switchLabel: string };

// Warianty filmu w hero – przełącznik służy do testów; po wyborze zostaw jeden wpis.
const variants = ["park", "beach", "forest", "street", "trail"] as const;
type Variant = (typeof variants)[number];
const storageKey = "aloha-hero-video-v2";
const changeEvent = "aloha-hero-video-change";

// Ostatnio wybrany wariant trzymamy w localStorage (tylko w tej przeglądarce).
const subscribe = (onChange: () => void) => {
  window.addEventListener(changeEvent, onChange);
  return () => window.removeEventListener(changeEvent, onChange);
};
const readVariant = (): Variant => {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved && (variants as readonly string[]).includes(saved)) return saved as Variant;
  } catch {}
  return variants[0];
};

/** Film w tle sekcji hero. Nie startuje przy „ogranicz ruch”; zawsze da się go zatrzymać. */
export function HeroVideo({ pauseLabel, playLabel, switchLabel }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const variant = useSyncExternalStore(subscribe, readVariant, () => variants[0]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.load();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.play().catch(() => {});
  }, [variant]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const choose = (next: Variant) => {
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {}
    window.dispatchEvent(new Event(changeEvent));
  };

  return (
    <>
      <video
        ref={ref}
        className="absolute inset-0 size-full object-cover"
        poster={`/media/run-${variant}-poster.jpg`}
        src={`/media/run-${variant}.mp4`}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className="absolute bottom-4 left-4 z-30 flex flex-row-reverse items-center gap-3 sm:left-8 lg:bottom-8">
        <div role="group" aria-label={switchLabel} className="flex items-center">
          {variants.map((name, index) => (
            <button
              key={name}
              type="button"
              onClick={() => choose(name)}
              aria-pressed={name === variant}
              aria-label={`${switchLabel} ${index + 1}`}
              className="grid size-6 place-items-center"
            >
              <span
                className={`block size-2 rounded-pill transition-colors duration-150 ${
                  name === variant ? "bg-white" : "bg-white/35 hover:bg-white/70"
                }`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? pauseLabel : playLabel}
          className="grid size-11 place-items-center rounded-pill bg-deep/60 text-white backdrop-blur-sm hover:bg-deep/80"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
            {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.5v13l11-6.5z" />}
          </svg>
        </button>
      </div>
    </>
  );
}
