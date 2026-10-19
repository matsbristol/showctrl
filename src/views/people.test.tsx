// @vitest-environment jsdom
/* Interaction tests for artists, the artist page and personnel. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { DataProvider } from '../data/DataProvider'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { fromLocal, toLocal } from '../domain/time'
import { SessionProvider } from '../session/SessionProvider'
import { AppRoutes } from '../shell/AppRoutes'
import { FormProvider } from '../ui/FormProvider'
import { ToastProvider } from '../ui/ToastProvider'

afterEach(cleanup)

/** Shows the current path, so tests can check where a form navigated to. */
function Where() {
  return <output data-testid="path">{useLocation().pathname}</output>
}

function setup(path: string, uid: string) {
  const store = new LocalStore({ storage: null, seed: () => buildSample(Date.now()) })
  render(
    <DataProvider store={store}>
      <SessionProvider initialUser={uid}>
        <ToastProvider>
          <FormProvider>
            <MemoryRouter initialEntries={[path]}>
              <AppRoutes />
              <Where />
            </MemoryRouter>
          </FormProvider>
        </ToastProvider>
      </SessionProvider>
    </DataProvider>,
  )
  return store
}

const path = () => screen.getByTestId('path').textContent
const firstArtistOn = (store: LocalStore, sid: string) =>
  Object.values(store.snapshot().col.artists).filter(a => a.stage === sid).sort((a, b) => a.name.localeCompare(b.name))[0]

describe('artists list', () => {
  it("shows a stage manager their stage's artists, with contacts and a status picker", async () => {
    const store = setup('/s/main/artists', 'demo-sm-main')
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(9)
    const a = firstArtistOn(store, 'main')
    expect(screen.getByText(a.contacts[0].name, { exact: false })).toBeTruthy()
    fireEvent.change(screen.getByLabelText(`Status of ${a.name}`), { target: { value: 'arrived' } })
    await waitFor(() => expect(store.get('artists', a.id)!.status).toBe('arrived'))
  })

  it('hides contacts from roles without contact access', () => {
    setup('/hq/artists', 'demo-hosp')
    expect(screen.getAllByText('Hidden for your role').length).toBeGreaterThan(0)
    // Hospitality can view artists but not edit them.
    expect(screen.queryByRole('button', { name: /Add artist/ })).toBeNull()
    expect(screen.queryByLabelText(/^Status of/)).toBeNull()
  })

  it('searches by name', () => {
    const store = setup('/hq/artists', 'demo-admin')
    const a = firstArtistOn(store, 'tent')
    fireEvent.change(screen.getByLabelText('Search artists'), { target: { value: a.name } })
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.every(r => r.textContent!.includes(a.name))).toBe(true)
  })

  it('adds an artist with a tour manager and a day sheet, then opens their page', async () => {
    const store = setup('/s/tent/artists', 'demo-sm-tent')
    fireEvent.click(screen.getByRole('button', { name: 'Add artist' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Nye Band' } })
    fireEvent.change(within(dialog).getByLabelText('Tour manager name'), { target: { value: 'Tora Vik' } })
    fireEvent.change(within(dialog).getByLabelText('Tour manager phone'), { target: { value: '+47 900 11 222' } })
    const start = toLocal(fromLocal(`${store.snapshot().cfg!.start}T21:00`))
    fireEvent.change(within(dialog).getByLabelText('On stage (creates a day sheet)'), { target: { value: start } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(path()).toMatch(/^\/s\/tent\/artist\//))
    const id = path()!.split('/').pop()!
    expect(store.get('artists', id)).toMatchObject({ name: 'Nye Band', stage: 'tent', contacts: [{ role: 'Tour manager', name: 'Tora Vik', phone: '+47 900 11 222' }] })
    expect(Object.values(store.snapshot().col.ros).filter(i => i.artist === id)).toHaveLength(8)
    expect(await screen.findByRole('heading', { name: 'Nye Band' })).toBeTruthy()
  })
})

describe('artist page', () => {
  it('adds and edits a contact', async () => {
    const store = setup('/s/main/artists', 'demo-sm-main')
    const a = firstArtistOn(store, 'main')
    fireEvent.click(screen.getByRole('link', { name: a.name }))
    expect(await screen.findByRole('heading', { name: a.name })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    let dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Role'), { target: { value: 'Driver' } })
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Per Sjåfør' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(store.get('artists', a.id)!.contacts.map(c => c.name)).toContain('Per Sjåfør'))

    fireEvent.click(screen.getByRole('button', { name: 'Edit Per Sjåfør' }))
    dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Phone'), { target: { value: '+47 99 88 77 66' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(store.get('artists', a.id)!.contacts.find(c => c.name === 'Per Sjåfør')!.phone).toBe('+47 99 88 77 66'))
    // Editing kept the other contacts.
    expect(store.get('artists', a.id)!.contacts.length).toBe(a.contacts.length + 1)
  })

  it("refuses another stage's artist page", () => {
    const store = setup('/s/main/artists', 'demo-sm-main')
    cleanup()
    const tent = firstArtistOn(store, 'tent')
    setup(`/s/main/artist/${tent.id}`, 'demo-sm-main')
    expect(screen.getByText('Your access does not include this page')).toBeTruthy()
  })

  it('deletes an artist together with their day sheet', async () => {
    const store = setup('/hq/artists', 'demo-admin')
    const a = firstArtistOn(store, 'forest')
    fireEvent.click(screen.getByRole('link', { name: a.name }))
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete for everyone' }))
    await waitFor(() => expect(store.get('artists', a.id)).toBeUndefined())
    expect(Object.values(store.snapshot().col.ros).filter(i => i.artist === a.id)).toEqual([])
    expect(path()).toBe('/hq/artists')
  })
})

describe('personnel', () => {
  it('pastes a crew list onto the stage', async () => {
    const store = setup('/s/main/personnel', 'demo-sm-main')
    fireEvent.click(screen.getByRole('button', { name: 'Paste list' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/One person per line/), { target: { value: 'Kari Nordmann, Stagehand, +47 900 00 000\nOla Hansen\tRigger' } })
    fireEvent.change(within(dialog).getByLabelText('Department'), { target: { value: 'stage' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add people' }))
    expect(await screen.findByText('Added 2 people.')).toBeTruthy()
    const added = Object.values(store.snapshot().col.people).filter(p => p.name === 'Kari Nordmann' || p.name === 'Ola Hansen')
    expect(added.map(p => [p.title, p.stages, p.dept, p.accred])).toEqual([['Stagehand', ['main'], 'stage', 'Stage'], ['Rigger', ['main'], 'stage', 'Stage']])
    expect(screen.getByText('12 people')).toBeTruthy()
  })

  it('filters by department and search', () => {
    setup('/hq/personnel', 'demo-admin')
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'audio' } })
    expect(screen.getByText('10 people')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'fjord' } })
    expect(screen.getByText('2 people')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search personnel'), { target: { value: 'monitor' } })
    expect(screen.getByText('1 person')).toBeTruthy()
  })

  it('lets crew read the list but not change it', () => {
    setup('/s/main/personnel', 'demo-crew-main-3')
    expect(screen.getByText('10 people')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add person' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull()
  })

  it('marks people who also use the app', () => {
    setup('/s/main/personnel', 'demo-sm-main')
    // The stage manager and two crew members are app users.
    expect(screen.getAllByText('App')).toHaveLength(3)
  })
})
