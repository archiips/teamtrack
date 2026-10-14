import { useId } from "react";

/** TeamTrack mark: two interlocking rounded bands. Decorative; pair with the wordmark. */
export function Logo({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7d97e4" />
          <stop offset="1" stopColor="#6a86dc" />
        </linearGradient>
        <linearGradient id={`${id}d`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6152dc" />
          <stop offset="1" stopColor="#5546d2" />
        </linearGradient>
        {/* Everything above-left of the diagonal seam belongs to the light band. */}
        <clipPath id={`${id}c`}>
          <polygon points="0,0 99.2,0 0,99.2" />
        </clipPath>
      </defs>
      <path
        d="M66 20.2 H83.5 Q91 20.2 91 27.7 V35 Q91 42.5 83.5 42.5 H46.3 Q38.8 42.5 38.8 50 V79.8"
        fill="none"
        stroke={`url(#${id}d)`}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 50 V27.7 Q9 20.2 16.5 20.2 H95"
        fill="none"
        stroke={`url(#${id}l)`}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath={`url(#${id}c)`}
      />
    </svg>
  );
}
