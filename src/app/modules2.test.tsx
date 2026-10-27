// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(cleanup)
beforeAll(() => {
  globalThis.fetch = (async () => { throw new Error('offline') }) as unknown as typeof fetch
  // The sample festival is built around "now"; pin it to a festival afternoon so results don't depend on the time of day.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-12T14:00:00+02:00'))
})
afterAll(() => { vi.useRealTimers() })

function mount(path: string, me: string) {
  const store = new LocalStore({ initial: () => buildSample(Date.now()), storageKey: null })
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{showctrlRoutes(<ShowctrlRoot store={store} initialMe={me} />)}</Routes>
    </MemoryRouter>,
  )
  return store
}
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
const nav = () => within(document.querySelector<HTMLElement>('nav.side')!)

describe('risk assessment', () => {
  it('rates an act from its page, and the rating shows on the artist list', async () => {
    const store = mount('/s/main/artists/a0', 'demo-sm-main')
    const panel = screen.getByRole('heading', { name: 'Risk assessment' }).closest('section')!
    await click(within(panel).getByRole('button', { name: /Edit|Assess/ }))
    await click(screen.getByRole('radio', { name: /Red/ }))
    fireEvent.click(screen.getByLabelText('Pyrotechnics'))
    fireEvent.change(screen.getByLabelText('Measures and notes'), { target: { value: 'Fire watch side stage' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(store.peek('risks').a0).toMatchObject({ level: 'red', notes: 'Fire watch side stage', by: 'demo-sm-main' })
    expect(store.peek('risks').a0.factors).toContain('Pyrotechnics')
  })

  it('summarises the day and filters by rating', async () => {
    mount('/hq/risk', 'demo-admin')
    const before = document.querySelectorAll('main tbody tr').length
    await click(screen.getByRole('button', { name: /Red/ }))
    const reds = document.querySelectorAll('main tbody tr')
    expect(reds.length).toBeLessThan(before)
    expect([...reds].every(tr => tr.textContent?.includes('Red') || tr.textContent?.includes('No shows'))).toBe(true)
  })

  it('disappears when the module is switched off', async () => {
    const store = mount('/hq/artists', 'demo-admin')
    expect(nav().getByRole('link', { name: /Risk/ })).toBeTruthy()
    await act(async () => { await store.setConfig('event', { ...store.peekConfig('event')!, modules: { risk: false } }) })
    expect(nav().queryByRole('link', { name: /Risk/ })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Risk' })).toBeNull()
  })
})

describe('trucks & docks', () => {
  it('sets trucks and a destination on a load in, and shows them on the run sheet', async () => {
    const store = mount('/s/forest/runsheet', 'demo-sm-forest')
    const loadin = Object.values(store.peek('ros')).find(r => r.stage === 'forest' && r.kind === 'loadin' && r.status !== 'done')!
    const row = document.querySelector<HTMLElement>(`tr[data-id="${loadin.id}"]`)!
    await click(within(row).getByRole('button', { name: /^Edit/ }))
    fireEvent.change(screen.getByLabelText('Trucks'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Send trucks to'), { target: { value: 'staging-n' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(store.peek('ros')[loadin.id]).toMatchObject({ trucks: 3, dest: 'staging-n' })
    expect(document.querySelector(`tr[data-id="${loadin.id}"] .truckline`)?.textContent).toMatch(/3 trucks → Staging area North/)
  })

  it('flags a clash when two loads are booked into a one-truck bay at once', async () => {
    const store = mount('/s/tent/trucks', 'demo-sm-tent')
    const loads = Object.values(store.peek('ros')).filter(r => r.stage === 'tent' && r.kind === 'loadin').sort((a, b) => a.start - b.start)
    await act(async () => {
      await store.update('ros', loads[0].id, { trucks: 1, dest: 'lb-tent' })
      await store.update('ros', loads[1].id, { trucks: 1, dest: 'lb-tent', start: loads[0].start, end: loads[0].end, delay: loads[0].delay })
    })
    expect(screen.getByRole('heading', { name: 'Clashes' })).toBeTruthy()
    expect(document.querySelectorAll('main tr.clash').length).toBeGreaterThanOrEqual(2)
  })

  it('adds a stage load bay from the Trucks page', async () => {
    const store = mount('/s/main/trucks', 'demo-sm-main')
    await click(screen.getByRole('button', { name: '+ Add location' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Load bay 2' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(Object.values(store.peek('locations')).find(l => l.name === 'Load bay 2')).toMatchObject({ kind: 'loadbay', stage: 'main' })
  })
})
