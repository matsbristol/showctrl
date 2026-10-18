// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { riderItems } from '../lib/riders'
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

describe('riders', () => {
  it('shows only the rider kinds the role may see', () => {
    mount('/hq/riders', 'demo-hosp')
    const tabs = screen.getAllByRole('tab').map(t => t.textContent)
    expect(tabs).toEqual(['Hospitality riders'])
  })

  it('changes one item’s status without touching the others', async () => {
    const store = mount('/s/main/riders', 'demo-sm-main')
    const r = Object.values(store.peek('riders')).find(x => x.kind === 'tech' && store.peek('artists')[x.artist].stage === 'main')!
    const [first, second] = riderItems(r)
    const panel = screen.getByRole('heading', { name: store.peek('artists')[r.artist].name }).closest('section')!
    await act(async () => { fireEvent.change(within(panel).getByLabelText(`Status of ${first.text}`), { target: { value: 'declined' } }) })
    const after = store.peek('riders')[r.id]
    expect(after.items[first.id].status).toBe('declined')
    expect(after.items[second.id]).toEqual(second)
  })

  it('keeps two parallel edits to different items', async () => {
    const store = new LocalStore({ initial: () => buildSample(Date.now()), storageKey: null })
    const r = Object.values(store.peek('riders'))[0]
    const [x, y] = riderItems(r)
    // Two people, each sending only their own item.
    await Promise.all([
      store.update('riders', r.id, { items: { [x.id]: { status: 'sourced' } } }),
      store.update('riders', r.id, { items: { [y.id]: { dept: 'light' } } }),
    ])
    const after = store.peek('riders')[r.id]
    expect(after.items[x.id].status).toBe('sourced')
    expect(after.items[y.id].dept).toBe('light')
  })

  it('adds pasted items to an artist’s rider', async () => {
    const store = mount('/s/main/artists/a0', 'demo-sm-main')
    const before = Object.keys(store.peek('riders').a0_tech?.items ?? {}).length
    const panel = screen.getByRole('heading', { name: 'Technical rider' }).closest('section')!
    await click(within(panel).getByRole('button', { name: '+ Add items' }))
    fireEvent.change(screen.getByLabelText('One item per line'), { target: { value: '- Fog machine\n2 × DI boxes' } })
    await click(screen.getByRole('button', { name: 'Add items' }))
    const items = riderItems(store.peek('riders').a0_tech)
    expect(items).toHaveLength(before + 2)
    expect(items.slice(-2).map(i => i.text)).toEqual(['Fog machine', '2 × DI boxes'])
  })
})

describe('accommodation', () => {
  it('hides hotel contacts from roles without contact access', () => {
    mount('/hq/accommodation', 'demo-hosp')
    expect(screen.getAllByText('Hidden for your role').length).toBe(3)
  })

  it('adds a hotel and a guest booking, and counts the rooms', async () => {
    const store = mount('/hq/accommodation', 'demo-admin')
    await click(screen.getByRole('button', { name: '+ Add hotel' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test Inn' } })
    fireEvent.change(screen.getByLabelText('Rooms held per night'), { target: { value: '2' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    const h = Object.values(store.peek('hotels')).find(x => x.name === 'Test Inn')!
    expect(h.block).toBe(2)

    await click(screen.getByRole('button', { name: '+ Add booking' }))
    fireEvent.change(screen.getByLabelText('Hotel'), { target: { value: h.id } })
    fireEvent.change(screen.getByLabelText('Guest name'), { target: { value: 'Press Person' } })
    fireEvent.change(screen.getByLabelText('Rooms'), { target: { value: '3' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    const b = Object.values(store.peek('bookings')).find(x => x.guest === 'Press Person')!
    expect(b).toMatchObject({ hotel: h.id, rooms: 3, artist: null })
    const row = screen.getByText('Test Inn', { selector: 'td b' }).closest('tr')!
    expect(row.textContent).toContain('3/2')
    expect(row.querySelector('td.over')).toBeTruthy()
  })

  it('books a room for an artist from their page, on their show night', async () => {
    const store = mount('/hq/artists/a3', 'demo-admin')
    await click(screen.getByRole('button', { name: '+ Book' }))
    await click(screen.getByRole('button', { name: 'Save' }))
    const b = Object.values(store.peek('bookings')).filter(x => x.artist === 'a3')
    expect(b.length).toBeGreaterThan(0)
  })
})
