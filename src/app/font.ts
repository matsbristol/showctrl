// The chosen typeface for this person. Live: saved with their login on the server, so it
// follows them to every device. Demo mode keeps it in this browser, like the rest of the demo.

import { useSyncExternalStore, type CSSProperties } from 'react'
import { DEFAULT_FONT, FONTS, isFontId, type FontId, type FontOption } from '../shared/fonts'

const DEMO_KEY = 'showctrl-demo-font'
let current: FontId = DEFAULT_FONT
let live = false
const listeners = new Set<() => void>()

/** Adds the font's stylesheet once. Classic is already in showctrl.css. */
export function loadFont(id: FontId) {
  if (id === DEFAULT_FONT || !FONTS[id].google || typeof document === 'undefined' || document.getElementById(`sc-font-${id}`)) return
  const link = document.createElement('link')
  link.id = `sc-font-${id}`
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${FONTS[id].google}&display=swap`
  document.head.appendChild(link)
}

/** Sets the font at start-up: the saved choice (live) or this browser's (demo). */
export function initFont(saved: unknown, isLive: boolean) {
  live = isLive
  let id = saved
  if (!isLive) { try { id = localStorage.getItem(DEMO_KEY) } catch { id = null } }
  current = isFontId(id) ? id : DEFAULT_FONT
  loadFont(current)
  listeners.forEach(l => l())
}

export function setFont(id: FontId) {
  current = id
  loadFont(id)
  listeners.forEach(l => l())
  if (live) {
    const as = new URLSearchParams(location.search).get('as')
    void fetch(`/api/me/prefs${as ? `?as=${encodeURIComponent(as)}` : ''}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ font: id }) }).catch(() => {})
  } else {
    try { localStorage.setItem(DEMO_KEY, id) } catch { /* private window: this visit only */ }
  }
}

export function useFont(): FontId {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l) }, () => current, () => current)
}

/** The CSS custom properties for a font option, set on the .sc root. */
export function fontVars(f: FontOption): CSSProperties {
  return {
    ['--display' as string]: f.display,
    ['--body' as string]: f.body,
    ['--clock' as string]: f.clock,
    ['--display-w' as string]: String(f.displayWeight ?? 600),
    ['--clock-w' as string]: String(f.clockWeight ?? 600),
    ['--display-stretch' as string]: f.displayStretch ?? 'normal',
    ['--clock-stretch' as string]: f.clockStretch ?? 'normal',
  }
}
