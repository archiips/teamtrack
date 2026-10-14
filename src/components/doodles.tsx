/** Original hand-drawn accents for navy surfaces. Decorative only. */
export function Doodles({ variant }: { variant: "band" | "welcome" }) {
  return (
    <div className={`doodles doodles--${variant}`} aria-hidden="true">
      <svg className="d-squiggle" viewBox="0 0 120 30">
        <path d="M4 18c10-14 20-14 28 0s18 14 28 0 18-14 28 0 18 14 28 0" />
      </svg>
      <svg className="d-star" viewBox="0 0 40 40">
        <path d="M20 2c2 11 7 16 18 18-11 2-16 7-18 18-2-11-7-16-18-18 11-2 16-7 18-18z" />
      </svg>
      <svg className="d-star small" viewBox="0 0 40 40">
        <path d="M20 2c2 11 7 16 18 18-11 2-16 7-18 18-2-11-7-16-18-18 11-2 16-7 18-18z" />
      </svg>
      <svg className="d-dots" viewBox="0 0 60 36">
        {[0, 1, 2].flatMap((r) =>
          [0, 1, 2, 3, 4].map((c) => (
            <circle key={`${r}${c}`} cx={6 + c * 12} cy={6 + r * 12} r="2.4" />
          )),
        )}
      </svg>
      <svg className="d-loop" viewBox="0 0 90 50">
        <path d="M4 40c18 4 30-6 28-18S14 8 16 20s22 22 40 14 24-20 30-28" />
      </svg>
      <svg className="d-birds" viewBox="0 0 70 30">
        <path d="M4 16c5-5 9-5 12 0 3-6 8-7 13-2" />
        <path d="M40 8c4-4 7-4 9 0 3-5 6-5 10-1" />
      </svg>
    </div>
  );
}
