// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { shiftTargets } from '../lib/runsheet'
import { MIN } from '../types/constants'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(cleanup)
// No server in tests: clock sync stays on device time.
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

const rowOf = (title: string) => screen.getAllByText(title, { selector: 'td b, td b a' })[0].closest('tr')!

describe('run sheet', () => {
  it('puts a show on stage and marks the artist on stage', async () => {
    const store = mount('/s/club/runsheet', 'demo-sm-club')
    const show = Object.values(store.peek('ros')).filter(r => r.stage === 'club' && r.kind === 'show' && r.status === 'pending').sort((a, b) => a.start - b.start)[0]
    const row = rowOf(show.title)
    await act(async () => { fireEvent.click(within(row).getByRole('button', { name: 'On stage' })) })
    expect(store.peek('ros')[show.id].status).toBe('live')
    expect(store.peek('ros')[show.id].actual).toBeTypeOf('number')
    expect(store.peek('artists')[show.artist!].status).toBe('on stage')
    expect(within(rowOf(show.title)).getByRole('button', { name: 'Done' })).toBeTruthy()
  })

  it('delays an item and everything after it that day', async () => {
    const store = mount('/s/club/runsheet', 'demo-sm-club')
    const ros = Object.values(store.peek('ros')).filter(r => r.stage === 'club' && r.kind === 'show' && r.status === 'pending').sort((a, b) => a.start - b.start)
    const first = ros[0]
    const targets = shiftTargets(store.peek('ros'), first, 'Europe/Oslo')
    const others = Object.values(store.peek('ros')).filter(r => !targets.includes(r))
    await act(async () => { fireEvent.click(within(rowOf(first.title)).getByRole('button', { name: 'Delay' })) })
    fireEvent.change(screen.getByLabelText('Minutes (negative pulls earlier)'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Power issue' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply delay' })) })
    const after = store.peek('ros')
    expect(targets.length).toBeGreaterThan(1)
    for (const x of targets) expect(after[x.id].delay).toBe(x.delay + 15 * MIN)
    for (const x of others) expect(after[x.id].delay).toBe(x.delay)
    expect(after[first.id].delayNote).toBe('Power issue')
    expect(screen.getByText(/moved \+15 min/)).toBeTruthy()
  })

  it('adds a performer with a full day sheet', async () => {
    const store = mount('/s/forest/runsheet', 'demo-sm-forest')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Add artist with day sheet/ })) })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test Band' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })) })
    const a = Object.values(store.peek('artists')).find(x => x.name === 'Test Band')!
    expect(a.stage).toBe('forest')
    expect(Object.values(store.peek('ros')).filter(r => r.artist === a.id)).toHaveLength(8)
  })

  it('shows no controls to stage crew', () => {
    mount('/s/main/runsheet', 'demo-crew-main-3')
    expect(screen.queryByRole('button', { name: 'Delay' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Add item/ })).toBeNull()
  })
})

describe('clocks and display', () => {
  it('starts, pauses and resets a timer', async () => {
    const store = mount('/s/main/clocks', 'demo-sm-main')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start' })) })
    expect(store.peek('clocks').ct).toMatchObject({ kind: 'timer' })
    expect((store.peek('clocks').ct as { runningSince: number | null }).runningSince).toBeTypeOf('number')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pause' })) })
    expect((store.peek('clocks').ct as { runningSince: number | null }).runningSince).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reset' })) })
    expect((store.peek('clocks').ct as { accum: number }).accum).toBe(0)
  })

  it('adds a festival-wide countdown', async () => {
    const store = mount('/hq/clocks', 'demo-pm')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Add clock/ })) })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gates close' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    const c = Object.values(store.peek('clocks')).find(x => x.label === 'Gates close')!
    expect(c).toMatchObject({ kind: 'countdown', scope: null })
  })

  it('shows the stage display', () => {
    mount('/s/main/display', 'demo-sm-main')
    expect(screen.getByRole('heading', { name: 'Stage display' })).toBeTruthy()
    expect(document.querySelector('.display .st')?.textContent).toBe('Main Stage')
    expect(document.querySelector('.display .lbl')?.textContent).toMatch(/time left|Next on stage|No more shows/)
  })

  it('shows every visible stage on the HQ overview', () => {
    mount('/hq/overview', 'demo-admin')
    expect(document.querySelectorAll('.stagecard')).toHaveLength(5)
  })
})
