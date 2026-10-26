// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { setLangValue, tr } from '../i18n'
import { NB } from '../i18n/nb'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(() => { cleanup(); setLangValue('en') })
beforeAll(() => { globalThis.fetch = (async () => { throw new Error('offline') }) as unknown as typeof fetch })

function mount(path: string) {
  const store = new LocalStore({ initial: () => buildSample(Date.now()), storageKey: null })
  render(<MemoryRouter initialEntries={[path]}><Routes>{showctrlRoutes(<ShowctrlRoot store={store} initialMe="demo-admin" />)}</Routes></MemoryRouter>)
}

describe('Norwegian', () => {
  it('keeps crew terms in English, as agreed', () => {
    setLangValue('nb')
    for (const t of ['Run sheet', 'Running order', 'Doors', 'Changeover', 'Load in', 'Load out', 'Soundcheck']) expect(tr(t)).toBe(t)
    expect(tr('Overview')).toBe('Oversikt')
    expect(tr('Stage')).toBe('Scene')
  })

  it('keeps every {placeholder} the English has, except the article-free “a stage / an artist” forms', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
    const bad = Object.entries(NB).filter(([en, nb]) => ph(nb).some(p => !ph(en).includes(p) && !['stage', 'performer', 'stages', 'performers'].includes(p)))
    expect(bad).toEqual([])
  })

  it('shows the overview and the side menu in Norwegian, run sheet terms in English', () => {
    setLangValue('nb')
    mount('/s/main/runsheet')
    expect(screen.getAllByText('I dag').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Run sheet').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Meldinger').length).toBeGreaterThan(0)
    expect(document.body.textContent).toMatch(/Changeover/)
    expect(document.querySelector('.sc')?.getAttribute('lang')).toBe('nb')
  })
})
