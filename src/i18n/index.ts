// Interface language. The English text in the code is the key: tr('Save') shows "Lagre" in
// Norwegian and "Save" in English. Missing translations fall back to the English text, so a
// screen is never blank. Crew terms (Run sheet, Running order, Doors, Changeover, Rider…) stay in
// English in the Norwegian version on purpose: see GLOSSARY in ./glossary.ts.

import { NB } from './nb'

export type Lang = 'en' | 'nb'
export const LANGS: Record<Lang, string> = { en: 'English', nb: 'Norsk' }
export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'nb'

let current: Lang = 'en'
const listeners = new Set<() => void>()

export const getLang = (): Lang => current
export function setLangValue(l: Lang) {
  if (l === current) return
  current = l
  listeners.forEach(f => f())
}
export function subscribeLang(f: () => void) {
  listeners.add(f)
  return () => { listeners.delete(f) }
}

/** Translates an English interface text; `{name}` placeholders are filled from `vars`. */
export function tr(en: string, vars?: Record<string, string | number>): string {
  const s = current === 'nb' ? NB[en] ?? en : en
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

/** The same, in a given language rather than the current one (for emails sent by the server). */
export function trIn(lang: Lang, en: string, vars?: Record<string, string | number>): string {
  const s = lang === 'nb' ? NB[en] ?? en : en
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

/** For Intl date and number formatting. */
export const locale = (): string => (current === 'nb' ? 'nb-NO' : 'en-GB')
