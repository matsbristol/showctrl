// Line icons from the prototype (24×24, stroke).

const PATHS = {
  overview: <><path d="M3 4h18v12H3z" /><path d="M8 20h8M12 16v4" /></>,
  today: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  clocks: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>,
  schedule: <><path d="M3 6h18M3 12h18M3 18h18" /><path d="M8 4v4M15 10v4M11 16v4" /></>,
  messages: <path d="M4 5h16v11H9l-5 4z" />,
  artists: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  personnel: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.5.9 2.5 2.6 3 5.2" /></>,
  accommodation: <><path d="M3 20V9l9-5 9 5v11" /><path d="M8 20v-6h8v6" /></>,
  riders: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>,
  admin: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  setup: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  display: <><rect x="2" y="4" width="20" height="13" rx="1" /><path d="M8 21h8M12 17v4" /></>,
  risk: <><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
  truck: <><path d="M2 6h11v9H2zM13 9h4l4 4v2h-8z" /><circle cx="6" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></>,
  summary: <><path d="M4 4h16v16H4z" /><path d="M4 9h16M9 9v11" /></>,
  lines: <><path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11" /></>,
  plot: <><rect x="3" y="4" width="18" height="16" rx="1" /><rect x="9" y="6" width="6" height="5" /><path d="M5 17h3M16 17h3" /></>,
  riser: <><path d="M3 16h18v4H3zM6 12h12v4M9 8h6v4" /></>,
  car: <><path d="M3 16v-4l2-5h14l2 5v4z" /><path d="M3 12h18" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></>,
  room: <><path d="M4 21V3h11v18M15 7h5v14M2 21h20" /><path d="M11 12h.01" /></>,
  radio: <><rect x="7" y="7" width="10" height="14" rx="2" /><path d="M10 7V2M10 11h4M10 14h4" /></>,
  file: <><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  // Run sheet kinds
  arrival: <><path d="M3 12h11M10 8l4 4-4 4" /><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /></>,
  departure: <><path d="M10 12h11M17 8l4 4-4 4" /><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /></>,
  getin: <><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18" /><path d="M15 12h.01" /></>,
  loadin: <><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M12 8v7M9 12l3 3 3-3" /></>,
  loadout: <><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M12 15V8M9 11l3-3 3 3" /></>,
  access: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></>,
  soundcheck: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  linecheck: <path d="M3 12h3l2-6 4 12 2-6h7" />,
  changeover: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  show: <path d="M12 3l2.7 5.6 6.3.9-4.5 4.4 1 6.1L12 17l-5.5 3 1-6.1L3 9.5l6.3-.9z" />,
  doors: <path d="M4 21h16M6 21V4l8 2v15M14 6h4v15" />,
  curfew: <><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" /><path d="M9 12h6" /></>,
  meeting: <><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M3 20c.8-3 2.8-5 5-5s4.2 2 5 5M11 20c.8-3 2.8-5 5-5s4.2 2 5 5" /></>,
  other: <circle cx="12" cy="12" r="3" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
