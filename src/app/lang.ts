// The interface language for this person. Live: saved with their login (users.lang), so it
// follows them to every device. Before sign-in, and in demo mode: the browser's language.

import { useSyncExternalStore } from 'react'
import { getLang, isLang, setLangValue, subscribeLang, type Lang } from '../i18n'

const DEMO_KEY = 'showctrl-demo-lang'
let live = false

const fromBrowser = (): Lang => (typeof navigator !== 'undefined' && /^(nb|nn|no)\b/i.test(navigator.language) ? 'nb' : 'en')

export function initLang(saved: unknown, isLive: boolean) {
  live = isLive
  // This browser's last choice: the demo's setting, or what was picked on the sign-in page.
  let here: unknown = null
  try { here = localStorage.getItem(DEMO_KEY) } catch { /* private window */ }
  if (isLive && !isLang(saved) && isLang(here)) { setLang(here); return } // first sign-in: keep the sign-in page's choice
  const l = isLive ? saved : here
  setLangValue(isLang(l) ? l : fromBrowser())
}

export function setLang(l: Lang) {
  setLangValue(l)
  try { localStorage.setItem(DEMO_KEY, l) } catch { /* private window: this visit only */ }
  if (live) {
    const as = new URLSearchParams(location.search).get('as')
    void fetch(`/api/me/prefs${as ? `?as=${encodeURIComponent(as)}` : ''}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: l }) }).catch(() => {})
  }
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, getLang)
}
