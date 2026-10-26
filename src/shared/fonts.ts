// The typefaces a person can choose for showctrl. Each sets the three font roles the styles use:
// display (headings), body (running text and tables) and clock (every clock and countdown).
// Shared so the Worker can check a saved choice.

export interface FontOption {
  label: string
  /** What it is, for the picker. */
  note: string
  /** Google Fonts `family=` query (several joined with &family=). Empty: only fonts on the device. */
  google: string
  display: string
  body: string
  clock: string
  displayWeight?: number
  clockWeight?: number
  /** font-stretch for variable-width families (Archivo). */
  displayStretch?: string
  clockStretch?: string
}

const NARROW = "'Arial Narrow', 'Roboto Condensed', sans-serif"
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif"
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace"

export const FONTS = {
  classic: {
    label: 'Classic', note: 'Barlow Condensed and Atkinson Hyperlegible',
    google: 'Atkinson+Hyperlegible:wght@400;700&family=Barlow+Condensed:wght@500;600;700',
    display: `'Barlow Condensed', ${NARROW}`, body: `'Atkinson Hyperlegible', ${SANS}`, clock: `'Barlow Condensed', ${NARROW}`,
  },
  signage: {
    label: 'Signage', note: 'Schibsted Grotesk with Big Shoulders Display',
    google: 'Schibsted+Grotesk:wght@400;500;700&family=Big+Shoulders+Display:wght@600;700;800',
    display: `'Big Shoulders Display', ${NARROW}`, body: `'Schibsted Grotesk', ${SANS}`, clock: `'Big Shoulders Display', ${NARROW}`,
    displayWeight: 700, clockWeight: 800,
  },
  schibsted: {
    label: 'Schibsted Grotesk', note: 'Schibsted Grotesk for everything',
    google: 'Schibsted+Grotesk:wght@400;500;600;700;800',
    display: `'Schibsted Grotesk', ${SANS}`, body: `'Schibsted Grotesk', ${SANS}`, clock: `'Schibsted Grotesk', ${SANS}`,
    displayWeight: 700, clockWeight: 700,
  },
  plex: {
    label: 'IBM Plex', note: 'Plex Sans, Plex Sans Condensed and Plex Mono',
    google: 'IBM+Plex+Sans:wght@400;500;700&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@500;600',
    display: `'IBM Plex Sans Condensed', ${NARROW}`, body: `'IBM Plex Sans', ${SANS}`, clock: `'IBM Plex Mono', ${MONO}`,
  },
  overpass: {
    label: 'Overpass', note: 'Overpass and Overpass Mono (road-sign lettering)',
    google: 'Overpass:wght@400;600;700;800&family=Overpass+Mono:wght@500;600;700',
    display: `'Overpass', ${SANS}`, body: `'Overpass', ${SANS}`, clock: `'Overpass Mono', ${MONO}`,
    displayWeight: 800, clockWeight: 700,
  },
  archivo: {
    label: 'Archivo', note: 'Archivo, normal width for text and narrow for headings and clocks',
    google: 'Archivo:wdth,wght@62..125,400..800',
    display: `'Archivo', ${NARROW}`, body: `'Archivo', ${SANS}`, clock: `'Archivo', ${NARROW}`,
    displayWeight: 700, clockWeight: 700, displayStretch: '72%', clockStretch: '68%',
  },
  futura: {
    label: 'Futura', note: 'Futura Demibold where the device has it (Apple devices), otherwise Jost, a free font drawn after Futura',
    google: 'Jost:wght@400;500;600;700',
    display: `'Futura PT', Futura, 'Jost', ${SANS}`, body: `'Futura PT', Futura, 'Jost', ${SANS}`, clock: `'Futura PT', Futura, 'Jost', ${SANS}`,
    displayWeight: 600, clockWeight: 600,
  },
  helvetica: {
    label: 'Helvetica', note: 'Helvetica where the device has it (Apple devices), otherwise Arial',
    google: '',
    display: `'Helvetica Neue', Helvetica, Arial, ${SANS}`, body: `'Helvetica Neue', Helvetica, Arial, ${SANS}`, clock: `'Helvetica Neue', Helvetica, Arial, ${SANS}`,
    displayWeight: 700, clockWeight: 700,
  },
  chivo: {
    label: 'Chivo', note: 'Chivo and Chivo Mono',
    google: 'Chivo:wght@400;700;800&family=Chivo+Mono:wght@500;700',
    display: `'Chivo', ${SANS}`, body: `'Chivo', ${SANS}`, clock: `'Chivo Mono', ${MONO}`,
    displayWeight: 800, clockWeight: 700,
  },
} satisfies Record<string, FontOption>

export type FontId = keyof typeof FONTS
export const FONT_IDS = Object.keys(FONTS) as FontId[]
export const DEFAULT_FONT: FontId = 'classic'
export const isFontId = (v: unknown): v is FontId => typeof v === 'string' && v in FONTS
