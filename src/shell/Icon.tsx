/* Line icons from the prototype, drawn on a 24×24 grid with the current text colour. */

const PATHS = {
  overview: '<path d="M3 4h18v12H3z"/><path d="M8 20h8M12 16v4"/>',
  today: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  clocks: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  schedule: '<path d="M3 6h18M3 12h18M3 18h18"/><path d="M8 4v4M15 10v4M11 16v4"/>',
  runsheet: '<path d="M3 6h18M3 12h18M3 18h18"/><path d="M8 4v4M15 10v4M11 16v4"/>',
  messages: '<path d="M4 5h16v11H9l-5 4z"/>',
  artists: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  personnel: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.5.9 2.5 2.6 3 5.2"/>',
  accommodation: '<path d="M3 20V9l9-5 9 5v11"/><path d="M8 20v-6h8v6"/>',
  riders: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  admin: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  setup: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  display: '<rect x="2" y="4" width="20" height="13" rx="1"/><path d="M8 21h8M12 17v4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  wall: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name }: { name: IconName }) {
  // The paths are fixed strings above, never user data, so injecting them is safe.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
  )
}
