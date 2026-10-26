// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { sortedInputs } from '../lib/lines'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(cleanup)
beforeAll(() => { globalThis.fetch = (async () => { throw new Error('offline') }) as unknown as typeof fetch })

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
const blur = async (el: HTMLElement, value: string) => { await act(async () => { fireEvent.change(el, { target: { value } }); fireEvent.blur(el) }) }

describe('navigation', () => {
  it('groups the side nav', () => {
    mount('/hq/overview', 'demo-admin')
    const heads = [...document.querySelectorAll('nav.side .navgroup')].map(h => h.textContent)
    expect(heads).toEqual(['Live', 'Production', 'Logistics', 'Team'])
  })
})

describe('screens', () => {
  it('opens the production office screen with every stage and the running order', () => {
    mount('/hq/screens/scr-office', 'demo-admin')
    expect(document.querySelectorAll('.sv-card')).toHaveLength(5)
    expect(document.querySelectorAll('.sv-schedule li').length).toBeGreaterThan(10)
    expect(document.querySelector('.sv-clock')).toBeTruthy()
  })

  it('adds a screen for one stage', async () => {
    const store = mount('/s/tent/screens', 'demo-sm-tent')
    await click(screen.getByRole('button', { name: '+ Add screen' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Side stage left' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    const s = Object.values(store.peek('screens')).find(x => x.name === 'Side stage left')!
    expect(s).toMatchObject({ scope: 'tent', stages: ['tent'] })
  })
})

describe('technical summary', () => {
  it('lists today’s shows and exports CSV', async () => {
    mount('/hq/summary', 'demo-admin')
    expect(document.querySelectorAll('main tbody tr').length).toBe(15)
    const create = vi.fn(() => 'blob:x')
    URL.createObjectURL = create as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = () => {}
    await click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(create).toHaveBeenCalledOnce()
  })
})

describe('input lists and plots', () => {
  it('pastes an input list and edits a channel inline', async () => {
    const store = mount('/s/main/lines?act=a0', 'demo-sm-main')
    await click(screen.getByRole('button', { name: 'Paste list' }))
    fireEvent.change(screen.getByLabelText(/One channel per line/), { target: { value: '1\tKick\tBeta 91\n2\tSnare\tSM57' } })
    fireEvent.click(screen.getByLabelText('Replace the current list'))
    await click(screen.getByRole('button', { name: 'Add 2 channels' }))
    expect(sortedInputs(store.peek('lines').a0).map(i => i.name)).toEqual(['Kick', 'Snare'])
    await blur(screen.getAllByLabelText('Source')[1], 'Snare top')
    expect(sortedInputs(store.peek('lines').a0)[1].name).toBe('Snare top')
  })

  it('adds a riser to a plot and sets its height', async () => {
    const store = mount('/s/forest/plots?act=a14', 'demo-sm-forest')
    const before = Object.keys(store.peek('plots').a14?.items ?? {}).length
    await click(screen.getByRole('button', { name: '+ Riser' }))
    const items = Object.values(store.peek('plots').a14.items)
    expect(items).toHaveLength(before + 1)
    await blur(screen.getByLabelText('Height (cm)'), '60')
    expect(Object.values(store.peek('plots').a14.items).find(i => i.kind === 'riser' && i.height === 60)).toBeTruthy()
  })

  it('rotates a riser with the button, the angle list and the R key', async () => {
    const store = mount('/s/forest/plots?act=a14', 'demo-sm-forest')
    await click(screen.getByRole('button', { name: '+ Riser' }))
    const riser = () => Object.values(store.peek('plots').a14.items).find(i => i.kind === 'riser' && i.label === 'Riser')!
    await click(screen.getByRole('button', { name: 'Rotate 90°' }))
    expect(riser().rot).toBe(90)
    await act(async () => { fireEvent.change(screen.getByLabelText('Rotation'), { target: { value: '45' } }) })
    expect(riser().rot).toBe(45)
    const g = document.querySelector<SVGGElement>(`g.plot-item[aria-label="Riser"]`)!
    await act(async () => { fireEvent.keyDown(g, { key: 'r' }) })
    expect(riser().rot).toBe(135)
    await act(async () => { fireEvent.keyDown(g, { key: 'R', shiftKey: true }) })
    expect(riser().rot).toBe(45)
    expect(g.querySelector('g')?.getAttribute('transform')).toBe('rotate(45)')
  })

  it('checks riser stock against the plots and flags shortages', async () => {
    const store = mount('/s/tent/risers', 'demo-sm-tent')
    expect(screen.getByRole('region', { name: 'Prolyte' })).toBeTruthy()
    const nivtec = within(screen.getByRole('region', { name: 'Nivtec' }))
    expect(nivtec.queryAllByRole('row').filter(r => r.classList.contains('clash'))).toHaveLength(0)
    await blur(nivtec.getByLabelText('Nivtec 2×1 m decks'), '0')
    expect(store.peek('risers').tent.systems?.nivtec?.decks?.['2x1']).toBe(0)
    expect(nivtec.queryAllByRole('row').filter(r => r.classList.contains('clash')).length).toBeGreaterThan(0)
  })

  it('opens the item editor only from Edit, a double-click or Enter, never from a click or drag', async () => {
    mount('/s/forest/plots?act=a14', 'demo-sm-forest')
    const item = () => document.querySelector<SVGGElement>('g.plot-item[aria-label="Lead vox"]')!
    await act(async () => { fireEvent.pointerDown(item(), { pointerId: 1 }) })
    await act(async () => { fireEvent.pointerUp(item(), { pointerId: 1 }) })
    expect(screen.queryByRole('dialog')).toBeNull()
    await click(screen.getByRole('button', { name: 'Edit Lead vox' }))
    expect(screen.getByRole('dialog', { name: 'Edit Lead vox' })).toBeTruthy()
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => { fireEvent.doubleClick(item()) })
    expect(screen.getByRole('dialog', { name: 'Edit Lead vox' })).toBeTruthy()
    await act(async () => { fireEvent.pointerDown(item(), { pointerId: 1 }) })
    await act(async () => { fireEvent.pointerUp(item(), { pointerId: 1 }) })
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => { fireEvent.keyDown(item(), { key: 'Enter' }) })
    expect(screen.getByRole('dialog', { name: 'Edit Lead vox' })).toBeTruthy()
  })

  it('gives a new riser this stage’s system, and lets you switch it', async () => {
    const store = mount('/s/forest/plots?act=a14', 'demo-sm-forest')
    await click(screen.getByRole('button', { name: '+ Riser' }))
    const riser = () => Object.values(store.peek('plots').a14.items).find(i => i.kind === 'riser' && i.label === 'Riser')!
    expect(riser()).toMatchObject({ system: 'nivtec', size: '2x1', w: 2, d: 1 })
    await act(async () => { fireEvent.change(screen.getByLabelText('System'), { target: { value: 'prolyte' } }) })
    await act(async () => { fireEvent.change(screen.getByLabelText('Deck'), { target: { value: '1x0.5' } }) })
    expect(riser()).toMatchObject({ system: 'prolyte', size: '1x0.5', w: 1, d: 0.5 })
  })
})

describe('transport and facilities', () => {
  it('books a ride for an arrival, and marks another as own transport', async () => {
    const store = mount('/hq/transport', 'demo-al')
    const before = Object.keys(store.peek('transfers')).length
    const needs = screen.getByRole('heading', { name: 'Still needs a ride' }).closest('section')!
    await click(within(needs).getAllByRole('button', { name: 'Own transport' })[0])
    expect(Object.keys(store.peek('transfers')).length).toBe(before + 1)
    await click(within(needs).getAllByRole('button', { name: 'Book ride' })[0])
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(Object.keys(store.peek('transfers')).length).toBe(before + 2)
  })

  it('books a dressing room for an act without one', async () => {
    const store = mount('/hq/facilities', 'demo-al')
    const before = Object.keys(store.peek('allocations')).length
    const needs = screen.getByRole('heading', { name: 'No dressing room yet' }).closest('section')!
    await click(within(needs).getAllByRole('button', { name: 'Book room' })[0])
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(Object.keys(store.peek('allocations')).length).toBe(before + 1)
  })
})

describe('documents', () => {
  it('adds a link, and refuses non-web links', async () => {
    const store = mount('/hq/documents', 'demo-admin')
    await click(screen.getByRole('button', { name: '+ Add document' }))
    await click(screen.getByRole('button', { name: 'Add a link' }))
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'ftp://nope' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Barrier plan' } })
    await click(screen.getByRole('button', { name: 'Add link' }))
    expect(screen.getByRole('alert').textContent).toMatch(/https/)
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'https://example.com/barrier.pdf' } })
    await click(screen.getByRole('button', { name: 'Add link' }))
    expect(Object.values(store.peek('files')).some(f => f.name === 'Barrier plan')).toBe(true)
  })
})

describe('artist page', () => {
  it('shows the act’s input list and plot at a glance', () => {
    mount('/s/main/artists/a0', 'demo-sm-main')
    const panel = screen.getByRole('heading', { name: 'At a glance' }).closest('section')!
    expect(panel.textContent).toMatch(/inputs/)
    expect(panel.textContent).toMatch(/items/)
  })
})
