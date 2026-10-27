// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { FONT_IDS, FONTS } from '../shared/fonts'
import { initFont } from './font'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(cleanup)
beforeAll(() => { globalThis.fetch = (async () => { throw new Error('offline') }) as unknown as typeof fetch })

function mount() {
  const store = new LocalStore({ initial: () => buildSample(Date.now()), storageKey: null })
  render(<MemoryRouter initialEntries={['/hq/overview']}><Routes>{showctrlRoutes(<ShowctrlRoot store={store} initialMe="demo-admin" />)}</Routes></MemoryRouter>)
}
const root = () => document.querySelector('.sc') as HTMLElement

describe('fonts', () => {
  it('offers the classic fonts, the pairings, Schibsted Grotesk on its own, Futura, Helvetica and Inter', () => {
    expect(FONT_IDS).toEqual(['classic', 'signage', 'schibsted', 'plex', 'overpass', 'archivo', 'futura', 'helvetica', 'inter', 'chivo'])
  })

  it('switches the whole app, clocks included, from the Aa menu, and remembers it in demo mode', async () => {
    initFont(null, false)
    mount()
    expect(root().style.getPropertyValue('--clock')).toContain('Barlow Condensed')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Choose language and font' })) })
    const list = within(screen.getByRole('listbox', { name: 'Font' }))
    expect(list.getAllByRole('option')).toHaveLength(FONT_IDS.length)
    await act(async () => { fireEvent.click(list.getByRole('option', { name: /IBM Plex/ })) })
    expect(root().style.getPropertyValue('--clock')).toContain('IBM Plex Mono')
    expect(root().style.getPropertyValue('--body')).toContain('IBM Plex Sans')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(localStorage.getItem('showctrl-demo-font')).toBe('plex')
    cleanup()
    initFont(null, false)
    mount()
    expect(root().style.getPropertyValue('--display')).toBe(FONTS.plex.display)
  })
})
