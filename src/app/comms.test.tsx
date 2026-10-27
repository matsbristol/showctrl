// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { createAccess } from '../shared/access'
import { canWrite } from '../shared/writeRules'
import { canOpenHqView } from '../shared/views'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(cleanup)
beforeAll(() => { globalThis.fetch = (async () => { throw new Error('offline') }) as unknown as typeof fetch })

function mount(path: string, me: string) {
  const store = new LocalStore({ initial: () => buildSample(Date.now()), storageKey: null })
  render(<MemoryRouter initialEntries={[path]}><Routes>{showctrlRoutes(<ShowctrlRoot store={store} initialMe={me} />)}</Routes></MemoryRouter>)
  return store
}
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }

describe('comm channels', () => {
  it('lists festival-wide and stage channels at HQ, and adds one', async () => {
    const store = mount('/hq/comms', 'demo-admin')
    expect(screen.getByRole('heading', { name: 'Whole festival' })).toBeTruthy()
    expect(screen.getByText('Ch 7')).toBeTruthy()
    await click(screen.getByRole('button', { name: '+ Add channel' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Medical' } })
    fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'Ch 8' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    const med = Object.values(store.peek('comms')).find(c => c.name === 'Medical')!
    expect(med).toMatchObject({ channel: 'Ch 8', stage: null, kind: 'radio', depts: [] })
  })

  it('lets a stage manager edit their own stage’s channels only', async () => {
    mount('/s/main/comms', 'demo-sm-main')
    expect(screen.getByText('Ch 1')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit Production' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit Main Stage' })).toBeTruthy()
    expect(screen.queryByText('Fjord Stage')).toBeNull()

    const d = buildSample(Date.now())
    const a = createAccess({ me: 'demo-sm-main', roles: d.roles, members: d.col.members, stageteam: d.col.stageteam, stages: d.col.stages })
    const ctx = { artistStage: (id: string) => d.col.artists[id]?.stage }
    const doc = (stage: string | null) => ({ id: 'x', name: 'X', kind: 'radio' as const, channel: 'Ch 3', stage, depts: [], order: 0 })
    expect(canWrite(a, { col: 'comms', id: 'x', prev: null, next: doc('main') }, ctx).ok).toBe(true)
    expect(canWrite(a, { col: 'comms', id: 'x', prev: null, next: doc(null) }, ctx).ok).toBe(false)
    expect(canWrite(a, { col: 'comms', id: 'x', prev: null, next: doc('fjord') }, ctx).ok).toBe(false)
  })

  it('shows the stage’s channels on Today, and disappears when the module is off', async () => {
    const store = mount('/s/main/today', 'demo-sm-main')
    const panel = screen.getByRole('heading', { name: 'Comm channels' }).closest('section')!
    expect(within(panel).getByText('Ch 2')).toBeTruthy()
    expect(within(panel).getByText('Ch 1')).toBeTruthy()
    await act(async () => { await store.setConfig('event', { ...store.peekConfig('event')!, modules: { ...store.peekConfig('event')!.modules, comms: false } }) })
    expect(screen.queryByRole('heading', { name: 'Comm channels' })).toBeNull()
    const d = buildSample(Date.now())
    const admin = createAccess({ me: 'demo-admin', roles: d.roles, members: d.col.members, stageteam: d.col.stageteam, stages: d.col.stages })
    expect(canOpenHqView(admin, store.peekConfig('event'), 'comms')).toBe(false)
  })
})
