// The interface language for this person. Live: saved with their login (users.lang), so it
// follows them to every device. Before sign-in, and in demo mode: the browser's language.

import { useSyncExternalStore } from 'react'
import { getLang, isLang, setLangValue, subscribeLang, type Lang } from '../i18n'

const DEMO_KEY = 'showctrl-demo-lang'
let live = false

const fromBrowser = (): Lang => (typeof navigator !== 'undefined' && /^(nb|nn|no)\b/i.test(navigator.language) ? 'nb' : 'en')

export function initLang(saved: unknown, isLive: boolean) {
  live = isLive
  let l = saved
  if (!isLive) { try { l = localStorage.getItem(DEMO_KEY) } catch { l = null } }
  setLangValue(isLang(l) ? l : fromBrowser())
}

export function setLang(l: Lang) {
  setLangValue(l)
  if (live) {
    const as = new URLSearchParams(location.search).get('as')
    void fetch(`/api/me/prefs${as ? `?as=${encodeURIComponent(as)}` : ''}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: l }) }).catch(() => {})
  } else {
    try { localStorage.setItem(DEMO_KEY, l) } catch { /* private window: this visit only */ }
  }
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, getLang)
}
