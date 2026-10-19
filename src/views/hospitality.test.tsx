// @vitest-environment jsdom
/* Interaction tests for accommodation and riders. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { DataProvider } from '../data/DataProvider'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { addDays } from '../domain/time'
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

const bookingsFor = (store: LocalStore, pred: (b: ReturnType<LocalStore['snapshot']>['col']['bookings'][string]) => boolean) =>
  Object.values(store.snapshot().col.bookings).filter(pred)

describe('accommodation', () => {
  it('books a named guest, checking who it is for and the dates', async () => {
    // Artist liaison can edit accommodation in the default roles; hospitality can only view it.
    const store = setup('/hq/accommodation', 'demo-al')
    fireEvent.click(screen.getByRole('button', { name: 'Add booking' }))
    const dialog = await screen.findByRole('dialog')
    const save = within(dialog).getByRole('button', { name: 'Save' })

    fireEvent.click(save)
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Choose who the booking is for.')

    fireEvent.change(within(dialog).getByLabelText('Guest name'), { target: { value: 'Press pool' } })
    const checkIn = (within(dialog).getByLabelText('Check-in') as HTMLInputElement).value
    fireEvent.change(within(dialog).getByLabelText('Check-out'), { target: { value: checkIn } })
    fireEvent.click(save)
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Check-out must be after check-in.')

    fireEvent.change(within(dialog).getByLabelText('Check-out'), { target: { value: addDays(checkIn, 2) } })
    fireEvent.change(within(dialog).getByLabelText('Rooms'), { target: { value: '3' } })
    fireEvent.click(save)
    await waitFor(() => expect(bookingsFor(store, b => b.guest === 'Press pool')).toHaveLength(1))
    expect(bookingsFor(store, b => b.guest === 'Press pool')[0]).toMatchObject({ rooms: 3, status: 'requested', checkIn, checkOut: addDays(checkIn, 2), artist: undefined })
    expect(screen.getByText('Press pool')).toBeTruthy()
  })

  it('hides hotel contacts and booking references from roles without contact access', () => {
    setup('/hq/accommodation', 'demo-hosp')
    expect(screen.queryByRole('button', { name: 'Add booking' })).toBeNull()
    expect(screen.getAllByText('Hidden for your role').length).toBe(3)
    expect(screen.queryByRole('columnheader', { name: 'Ref' })).toBeNull()
    cleanup()
    setup('/hq/accommodation', 'demo-admin')
    expect(screen.getByText('Strandgata 12')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Ref' })).toBeTruthy()
  })

  it('marks a night red when bookings go over the block', async () => {
    const store = setup('/hq/accommodation', 'demo-admin')
    // Skogly Lodge holds 12 rooms; book 30 on the first event night.
    const night = store.snapshot().cfg!.start
    await store.set('bookings', 'big', { guest: 'Crew', hotel: 'h3', checkIn: night, checkOut: addDays(night, 1), rooms: 30, status: 'confirmed' })
    const row = (await screen.findAllByText('Skogly Lodge')).map(el => el.closest('tr')).find(Boolean)!
    expect(row.querySelector('td.over')).toBeTruthy()
  })

  it('books a room from the artist page', async () => {
    const store = setup('/hq/artists', 'demo-admin')
    const a = Object.values(store.snapshot().col.artists).find(x => x.stage === 'club')!
    fireEvent.click(screen.getByRole('link', { name: a.name }))
    fireEvent.click(await screen.findByRole('button', { name: 'Book' }))
    const dialog = await screen.findByRole('dialog')
    expect((within(dialog).getByLabelText('Artist') as HTMLSelectElement).value).toBe(a.id)
    // The guest fields are only for people who aren't artists.
    expect(within(dialog).queryByLabelText('Guest name')).toBeNull()
    const before = bookingsFor(store, b => b.artist === a.id).length
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(bookingsFor(store, b => b.artist === a.id)).toHaveLength(before + 1))
  })
})

describe('riders', () => {
  it("pastes a rider for a stage's artist and works through it", async () => {
    const store = setup('/s/main/riders', 'demo-sm-main')
    const a = Object.values(store.snapshot().col.artists).filter(x => x.stage === 'main' && !store.get('riders', `${x.id}_tech`))[0]
    const panel = screen.getByRole('region', { name: `Technical rider · ${a.name}` })
    fireEvent.click(within(panel).getByRole('button', { name: 'Add items' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('One item per line'), { target: { value: '- Drum riser 8×8\n2 × wireless SM58\n\n3. Hazer' } })
    fireEvent.change(within(dialog).getByLabelText('Department'), { target: { value: 'audio' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add items' }))
    await waitFor(() => expect(store.get('riders', `${a.id}_tech`)?.items.map(i => i.text)).toEqual(['Drum riser 8×8', '2 × wireless SM58', 'Hazer']))
    expect(store.get('riders', `${a.id}_tech`)!.items.every(i => i.dept === 'audio' && i.status === 'requested')).toBe(true)

    fireEvent.change(within(panel).getByLabelText('Status of Hazer'), { target: { value: 'declined' } })
    fireEvent.change(within(panel).getByLabelText('Department for Hazer'), { target: { value: 'light' } })
    await waitFor(() => expect(store.get('riders', `${a.id}_tech`)!.items[2]).toMatchObject({ status: 'declined', dept: 'light' }))
    expect(within(panel).getByText('1/3')).toBeTruthy()

    fireEvent.click(within(panel).getByRole('button', { name: 'Remove Drum riser 8×8' }))
    await waitFor(() => expect(store.get('riders', `${a.id}_tech`)!.items).toHaveLength(2))
  })

  it('shows crew technical riders only, read-only', () => {
    setup('/s/main/riders', 'demo-crew-main-3')
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Technical riders'])
    expect(screen.queryByRole('button', { name: 'Add items' })).toBeNull()
    expect(screen.queryByLabelText(/^Status of/)).toBeNull()
  })

  it('shows hospitality only the hospitality riders, which they can edit', () => {
    setup('/hq/riders', 'demo-hosp')
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Hospitality riders'])
    expect(screen.getAllByRole('button', { name: 'Add items' }).length).toBeGreaterThan(0)
  })

  it('switches between technical and hospitality', () => {
    setup('/hq/riders', 'demo-admin')
    expect(screen.getAllByRole('region')[0].getAttribute('aria-label')).toMatch(/^Technical/)
    fireEvent.click(screen.getByRole('tab', { name: 'Hospitality riders' }))
    expect(screen.getAllByRole('region')[0].getAttribute('aria-label')).toMatch(/^Hospitality/)
  })
})
