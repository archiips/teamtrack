"use client";
import { useEffect, useRef, useState } from "react";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts from the previous value to the new one. Static under reduced motion. */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0),
    from = useRef(0);
  useEffect(() => {
    const a = from.current;
    from.current = value;
    // rAF never fires in hidden tabs; jump straight to the value there.
    if (reduced() || document.hidden) {
      const t = setTimeout(() => setShown(value));
      return () => clearTimeout(t);
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700),
        eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

/** Circular progress. The percentage is also given as text by the caller. */
export function Ring({ pct }: { pct: number }) {
  const r = 26,
    c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle className="ring-track" cx="32" cy="32" r={r} />
      <circle
        className="ring-fill"
        cx="32"
        cy="32"
        r={r}
        strokeDasharray={c}
        style={{ strokeDashoffset: c * (1 - pct / 100) }}
      />
      <text x="32" y="36.5" textAnchor="middle">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

const SPOT = ".spot, .panel, .stats > div, .board-card, .profiles button";

/**
 * Entrance animations start from an invisible frame and do not advance in
 * hidden tabs, so they are enabled only once the page is actually visible.
 */
export function useMotionGate() {
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      if (!document.hidden && !reduced()) root.classList.add("motion-ok");
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
}

/** Feeds the cursor position to `.spot` cards for a soft glow that follows it. */
export function useSpotlight() {
  useEffect(() => {
    if (reduced()) return;
    const move = (e: PointerEvent) => {
      const el = (e.target as Element).closest?.<HTMLElement>(SPOT);
      if (!el) return;
      const b = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - b.left}px`);
      el.style.setProperty("--my", `${e.clientY - b.top}px`);
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => document.removeEventListener("pointermove", move);
  }, []);
}
