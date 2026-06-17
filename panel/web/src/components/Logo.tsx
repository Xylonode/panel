/** Saturn mark with a pink→purple gradient. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="sat" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EC4899" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <ellipse
        cx="24"
        cy="24"
        rx="22"
        ry="7"
        transform="rotate(-22 24 24)"
        stroke="url(#sat)"
        strokeWidth="2.5"
        fill="none"
        opacity="0.7"
      />
      <circle cx="24" cy="24" r="11" fill="url(#sat)" />
      <circle cx="20" cy="20" r="3" fill="#fff" opacity="0.35" />
    </svg>
  );
}
