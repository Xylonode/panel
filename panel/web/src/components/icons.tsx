/** Minimal inline icon set (stroke-based, currentColor). */
type P = { size?: number };
const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconGrid = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
export const IconServer = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="4" width="18" height="7" rx="2" />
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01" />
  </svg>
);
export const IconNode = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
    <path d="M12 7v4m0 0-5 6m5-6 5 6" />
  </svg>
);
export const IconPuzzle = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M4 7h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v3h-3a2 2 0 1 0-4 0H4v-3a2 2 0 1 0 0-4V7Z" />
  </svg>
);
export const IconUsers = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6m5 9a6 6 0 0 0-4-5.6" />
  </svg>
);
export const IconShield = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z" />
  </svg>
);
export const IconSearch = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4-4" />
  </svg>
);
export const IconBell = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 19a2 2 0 0 0 4 0" />
  </svg>
);
export const IconSun = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
  </svg>
);
export const IconMoon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8Z" />
  </svg>
);
export const IconCpu = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9 1v3m6-3v3M9 20v3m6-3v3M1 9h3m-3 6h3m17-6h-3m3 6h-3" />
  </svg>
);
export const IconRam = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="2" y="7" width="20" height="10" rx="2" />
    <path d="M6 17v2m4-2v2m4-2v2m4-2v2" />
  </svg>
);
export const IconDisk = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconPlayers = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="8" r="3" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
);
