// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
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
const rows = () => document.querySelectorAll('main tbody tr.click')

describe('artists', () => {
  it('lists every artist for HQ and only the stage’s own for a stage', () => {
    mount('/hq/artists', 'demo-admin')
    expect(rows()).toHaveLength(45)
    cleanup()
    mount('/s/tent/artists', 'demo-sm-tent')
    expect(rows()).toHaveLength(9)
  })

  it('hides contact details from roles without contact access', () => {
    mount('/hq/artists', 'demo-hosp')
    expect(screen.getAllByText('Hidden for your role').length).toBeGreaterThan(0)
  })

  it('changes status inline', async () => {
    const store = mount('/s/main/artists', 'demo-sm-main')
    const a = Object.values(store.peek('artists')).filter(x => x.stage === 'main').sort((x, y) => x.name.localeCompare(y.name))[0]
    await act(async () => { fireEvent.change(screen.getByLabelText(`Status of ${a.name}`), { target: { value: 'arrived' } }) })
    expect(store.peek('artists')[a.id].status).toBe('arrived')
  })

  it('adds a contact and edits the artist on the artist page', async () => {
    const store = mount('/s/main/artists/a0', 'demo-sm-main')
    expect(screen.getByRole('heading', { name: 'The Velvet Arcs' })).toBeTruthy()
    await click(screen.getByRole('button', { name: '+ Add' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pat Driver' } })
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Driver' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(store.peek('artists').a0.contacts.at(-1)).toMatchObject({ name: 'Pat Driver', role: 'Driver' })

    await click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Vehicles at dock'), { target: { value: '3 trucks' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(store.peek('artists').a0.vehicles).toBe('3 trucks')
  })

  it('deletes an artist together with their run sheet items', async () => {
    const store = mount('/s/main/artists/a0', 'demo-sm-main')
    const orig = globalThis.confirm
    globalThis.confirm = () => true
    await click(screen.getByRole('button', { name: 'Edit' }))
    await click(screen.getByRole('button', { name: 'Delete' }))
    globalThis.confirm = orig
    expect(store.peek('artists').a0).toBeUndefined()
    expect(Object.values(store.peek('ros')).some(r => r.artist === 'a0')).toBe(false)
  })

  it('shows crew the artist without edit controls', () => {
    mount('/s/main/artists/a0', 'demo-crew-main-3')
    expect(screen.getByRole('heading', { name: 'The Velvet Arcs' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Regenerate' })).toBeNull()
  })
})

describe('personnel', () => {
  it('imports a pasted crew list onto the stage', async () => {
    const store = mount('/s/forest/personnel', 'demo-sm-forest')
    const before = Object.keys(store.peek('people')).length
    await click(screen.getByRole('button', { name: 'Paste list' }))
    fireEvent.change(screen.getByLabelText(/One person per line/), { target: { value: 'Kari Nordmann, Stagehand, +47 900 00 000\nOla Hansen\tRigger' } })
    await click(screen.getByRole('button', { name: 'Add 2 people' }))
    const added = Object.values(store.peek('people')).slice(before)
    expect(added.map(p => p.name)).toEqual(['Kari Nordmann', 'Ola Hansen'])
    expect(added.every(p => p.stages.join() === 'forest')).toBe(true)
  })

  it('filters HQ personnel by stage', () => {
    mount('/hq/personnel', 'demo-admin')
    const all = document.querySelectorAll('main tbody tr').length
    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'main' } })
    expect(document.querySelectorAll('main tbody tr').length).toBe(10)
    expect(all).toBeGreaterThan(10)
  })
})

describe('stage setup', () => {
  it('edits the day sheet template', async () => {
    const store = mount('/s/tent/setup', 'demo-sm-tent')
    await click(screen.getAllByRole('button', { name: 'Edit' })[0])
    fireEvent.change(screen.getByLabelText('Arrival (min before show)'), { target: { value: '300' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(store.peek('stages').tent.template?.arrival).toBe(-300)
  })

  it('removes crew and adds a demo crew member', async () => {
    const store = mount('/s/main/setup', 'demo-sm-main')
    await click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(Object.keys(store.peek('stageteam').main.crew)).toHaveLength(1)
    await click(screen.getByRole('button', { name: '+ Add' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Hand' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(Object.keys(store.peek('stageteam').main.crew)).toHaveLength(2)
    expect(Object.values(store.peek('members')).some(m => m.name === 'New Hand')).toBe(true)
  })
})
