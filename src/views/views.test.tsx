// @vitest-environment jsdom
/*
 * Interaction tests: click through the real screens in a simulated browser
 * and check what reaches the data store.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { MIN } from '../domain/constants'
import { eff } from '../domain/runsheet'
import { festDay } from '../domain/time'
import { DataProvider } from '../data/DataProvider'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { SessionProvider } from '../session/SessionProvider'
import { AppRoutes } from '../shell/AppRoutes'
import { FormProvider } from '../ui/FormProvider'
import { ToastProvider } from '../ui/ToastProvider'

afterEach(cleanup)

function setup(path: string, uid: string) {
  const store = new LocalStore({ storage: null, seed: () => buildSample(Date.now()) })
  render(
    <DataProvider store={store}>
      <SessionProvider initialUser={uid}>
        <ToastProvider>
          <FormProvider>
            <MemoryRouter initialEntries={[path]}>
              <AppRoutes />
            </MemoryRouter>
          </FormProvider>
        </ToastProvider>
      </SessionProvider>
    </DataProvider>,
  )
  return store
}

/** The next show on Main Stage today that hasn't started. */
function nextPendingShow(store: LocalStore) {
  const today = festDay(Date.now())
  return Object.values(store.snapshot().col.ros)
    .filter(i => i.stage === 'main' && i.kind === 'show' && i.status === 'pending' && festDay(i.start) === today)
    .sort((a, b) => a.start - b.start)[0]
}

/**
 * The sample is built around the current time, so the next show can be
 * anywhere from seconds to an hour away. Pin it to 30 minutes from now so
 * going on now is reliably "early".
 */
async function showIn30(store: LocalStore) {
  const show = nextPendingShow(store)
  const start = Date.now() + 30 * MIN
  await act(() => store.update('ros', show.id, { start, end: start + (show.end - show.start), delay: 0 }))
  return store.get('ros', show.id)!
}

/** The run sheet table row for an item (titles repeat in the lanes, so look in the table). */
const row = (title: string, kind = 'Show') =>
  within(screen.getByRole('table')).getAllByText(title).map(el => el.closest('tr')!).find(tr => within(tr).queryByText(kind))!

describe('run sheet', () => {
  it('puts a show on stage and finishes the previous live item', async () => {
    const store = setup('/s/main/runsheet', 'demo-sm-main')
    const show = await showIn30(store)
    const wasLive = Object.values(store.snapshot().col.ros).filter(i => i.stage === 'main' && i.status === 'live')
    fireEvent.click(within(row(show.title)).getByRole('button', { name: 'On stage' }))
    await waitFor(() => expect(store.get('ros', show.id)!.status).toBe('live'))
    expect(store.get('ros', show.id)!.actual).toBeGreaterThan(0)
    expect(store.get('artists', show.artist!)!.status).toBe('on stage')
    for (const x of wasLive) expect(store.get('ros', x.id)!.status).toBe('done')
    // 30 minutes early: offer to pull the rest of the day in.
    expect(await screen.findByRole('button', { name: /Shift the rest −(29|30) min/ })).toBeTruthy()
  })

  it('applies the shift offered after going on early', async () => {
    const store = setup('/s/main/runsheet', 'demo-sm-main')
    const show = await showIn30(store)
    const early = Math.round((eff(show).s - Date.now()) / MIN)
    fireEvent.click(within(row(show.title)).getByRole('button', { name: 'On stage' }))
    fireEvent.click(await screen.findByRole('button', { name: /Shift the rest/ }))
    await waitFor(() => expect(store.get('ros', show.id)!.delay).toBe(-early * MIN))
    expect(store.get('ros', show.id)!.delayNote).toBe('Started early')
  })

  it('delays an item and everything after it', async () => {
    const store = setup('/s/main/runsheet', 'demo-sm-main')
    const show = nextPendingShow(store)
    const before = show.delay
    fireEvent.click(within(row(show.title)).getByRole('button', { name: 'Delay' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Minutes (negative pulls earlier)'), { target: { value: '12' } })
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Power cut' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply delay' }))
    await waitFor(() => expect(store.get('ros', show.id)!.delay).toBe(before + 12 * MIN))
    expect(store.get('ros', show.id)!.delayNote).toBe('Power cut')
    expect(await screen.findByText(/moved \+12 min/)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('refuses an item that ends before it starts', async () => {
    setup('/s/main/runsheet', 'demo-sm-main')
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    const dialog = await screen.findByRole('dialog')
    const start = within(dialog).getByLabelText('Planned start') as HTMLInputElement
    // Same day, an hour earlier than the start.
    const [d, tm] = start.value.split('T')
    const earlier = `${d}T${String(Number(tm.slice(0, 2)) - 1).padStart(2, '0')}${tm.slice(2)}`
    fireEvent.change(within(dialog).getByLabelText('Planned end'), { target: { value: earlier } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect((await within(dialog).findByRole('alert')).textContent).toBe('The end must be after the start.')
  })

  it('adds an item titled after its kind, and deletes it after confirming', async () => {
    const store = setup('/s/main/runsheet', 'demo-sm-main')
    const count = Object.keys(store.snapshot().col.ros).length
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    let dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Activity'), { target: { value: 'meeting' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(Object.keys(store.snapshot().col.ros)).toHaveLength(count + 1))
    const added = Object.values(store.snapshot().col.ros).find(i => i.kind === 'meeting')!
    expect(added).toMatchObject({ title: 'Meeting', stage: 'main', status: 'pending', delay: 0 })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Meeting' }))
    dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete for everyone' }))
    await waitFor(() => expect(store.get('ros', added.id)).toBeUndefined())
  })

  it('generates a day sheet for an artist', async () => {
    const store = setup('/s/main/runsheet', 'demo-sm-main')
    fireEvent.click(screen.getByRole('button', { name: 'Generate day sheet' }))
    const dialog = await screen.findByRole('dialog')
    const artistId = (within(dialog).getByLabelText('Artist') as HTMLSelectElement).value
    const name = store.get('artists', artistId)!.name
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create day sheet' }))
    // Replaces that artist's existing day (8 items, plus a soundcheck for headliners) with 8 new ones.
    expect(await screen.findByText(`Day sheet created for ${name}: 8 items.`)).toBeTruthy()
    const today = Object.values(store.snapshot().col.ros).filter(i => i.artist === artistId)
    expect(today.map(i => i.kind).sort()).toEqual(['access', 'arrival', 'changeover', 'departure', 'getin', 'loadin', 'loadout', 'show'])
  })
})

describe('clocks', () => {
  it("runs the stage's changeover timer", async () => {
    const store = setup('/s/main/clocks', 'demo-sm-main')
    const tile = screen.getByText('Changeover timer').closest('article')!
    fireEvent.click(within(tile).getByRole('button', { name: 'Start' }))
    await waitFor(() => expect((store.get('clocks', 'ct') as { runningSince: number | null }).runningSince).toBeGreaterThan(0))
    fireEvent.click(await within(tile).findByRole('button', { name: 'Pause' }))
    await waitFor(() => expect((store.get('clocks', 'ct') as { runningSince: number | null }).runningSince).toBeNull())
    fireEvent.click(within(tile).getByRole('button', { name: '+1 min' }))
    await waitFor(() => expect((store.get('clocks', 'ct') as { duration: number }).duration).toBe(46 * MIN))
  })

  it("doesn't let crew edit clocks or run timers", () => {
    setup('/s/main/clocks', 'demo-crew-main-3')
    expect(screen.queryByRole('button', { name: 'Add clock' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull()
  })

  it('adds a countdown clock to the stage', async () => {
    const store = setup('/s/main/clocks', 'demo-sm-main')
    fireEvent.click(screen.getByRole('button', { name: 'Add clock' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Curfew' } })
    fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: 'countdown' } })
    // A stage manager can only add to their stage, not festival-wide.
    const scope = within(dialog).getByLabelText('Belongs to') as HTMLSelectElement
    expect([...scope.options].map(o => o.value)).toEqual(['main'])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(Object.values(store.snapshot().col.clocks).find(c => c.label === 'Curfew')).toMatchObject({ kind: 'countdown', scope: 'main' }))
  })
})

describe('display and overview', () => {
  it('shows the stage display with a countdown', () => {
    setup('/s/main/display', 'demo-sm-main')
    expect(screen.getByText('Main Stage', { selector: '.st' })).toBeTruthy()
    expect(document.querySelector('.display .big')?.textContent).toMatch(/^\+?\d/)
  })

  it('switches the HQ running order to another day', () => {
    setup('/hq/schedule', 'demo-admin')
    const day2 = screen.getByRole('button', { name: /^Day 2/ })
    fireEvent.click(day2)
    expect(day2.getAttribute('aria-pressed')).toBe('true')
  })
})
