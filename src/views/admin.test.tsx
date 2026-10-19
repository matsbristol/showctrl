// @vitest-environment jsdom
/* Interaction tests for Admin and Stage setup. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { DataProvider } from '../data/DataProvider'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { SessionProvider } from '../session/SessionProvider'
import { AppRoutes } from '../shell/AppRoutes'
import { FormProvider } from '../ui/FormProvider'
import { ToastProvider } from '../ui/ToastProvider'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

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

const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))
const dialog = () => screen.findByRole('dialog')
const save = async (d: HTMLElement, name = 'Save') => fireEvent.click(within(d).getByRole('button', { name }))
const nav = () => screen.getByRole('navigation', { name: 'Sections' })

describe('stages and managers', () => {
  it('appoints a stage manager from the personnel list, then removes them', async () => {
    const store = setup('/hq/admin', 'demo-admin')
    const card = screen.getByRole('region', { name: 'Harbour Club' })
    fireEvent.click(within(card).getByRole('button', { name: 'Appoint stage manager' }))
    const d = await dialog()
    const person = Object.values(store.snapshot().col.people).find(p => p.stages.includes('club') && p.title === 'Assistant stage manager')!
    fireEvent.change(within(d).getByLabelText('Personnel entry'), { target: { value: person.id } })
    await save(d, 'Appoint')
    await waitFor(() => expect(Object.values(store.snapshot().col.members).find(m => m.person === person.id)).toMatchObject({ stages: { club: 'manager' }, role: 'none' }))
    const uid = Object.values(store.snapshot().col.members).find(m => m.person === person.id)!.id

    fireEvent.click(within(card).getByRole('button', { name: `Remove ${person.name} as manager of Harbour Club` }))
    await waitFor(() => expect(store.get('members', uid)!.stages).toEqual({}))
  })

  it("won't delete a stage that still has artists, but deletes an empty one", async () => {
    const store = setup('/hq/admin', 'demo-admin')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Main Stage' }))
    let d = await dialog()
    expect(within(d).queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(within(d).getByText(/first move or delete its 9 artists/)).toBeTruthy()
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }))

    fireEvent.click(screen.getByRole('button', { name: 'Add stage' }))
    d = await dialog()
    fireEvent.change(within(d).getByLabelText('Name'), { target: { value: 'Silent Disco' } })
    await save(d)
    await waitFor(() => expect(Object.values(store.snapshot().col.stages).find(s => s.name === 'Silent Disco')).toBeTruthy())
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Silent Disco' }))
    d = await dialog()
    fireEvent.click(within(d).getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(d).getByRole('button', { name: 'Yes, delete for everyone' }))
    await waitFor(() => expect(Object.values(store.snapshot().col.stages).find(s => s.name === 'Silent Disco')).toBeUndefined())
  })
})

describe('people with access', () => {
  it('gives a new person a festival role and crew places', async () => {
    const store = setup('/hq/admin', 'demo-admin')
    tab('People with access')
    fireEvent.click(screen.getByRole('button', { name: 'Give someone access' }))
    const d = await dialog()
    fireEvent.change(within(d).getByLabelText('Name'), { target: { value: 'Rita Rigger' } })
    fireEvent.change(within(d).getByLabelText('Festival role'), { target: { value: 'tech' } })
    fireEvent.click(within(within(d).getByRole('group', { name: 'Stage crew on' })).getByLabelText('The Tent'))
    await save(d)
    await waitFor(() => expect(Object.values(store.snapshot().col.members).find(m => m.name === 'Rita Rigger')).toMatchObject({ role: 'tech' }))
    const uid = Object.values(store.snapshot().col.members).find(m => m.name === 'Rita Rigger')!.id
    expect(store.get('stageteam', 'tent')!.crew[uid]).toBe(true)
    expect(screen.getByText('Rita Rigger')).toBeTruthy()
  })

  it("takes someone off a stage's crew, and removes access entirely", async () => {
    const store = setup('/hq/admin', 'demo-admin')
    tab('People with access')
    const crewName = store.get('members', 'demo-crew-main-3')!.name!
    fireEvent.click(screen.getByRole('button', { name: `Edit access for ${crewName}` }))
    let d = await dialog()
    fireEvent.click(within(within(d).getByRole('group', { name: 'Stage crew on' })).getByLabelText('Main Stage'))
    await save(d)
    await waitFor(() => expect(store.get('stageteam', 'main')!.crew['demo-crew-main-3']).toBeUndefined())

    fireEvent.click(screen.getByRole('button', { name: `Edit access for ${crewName}` }))
    d = await dialog()
    fireEvent.click(within(d).getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(d).getByRole('button', { name: 'Yes, delete for everyone' }))
    await waitFor(() => expect(store.get('members', 'demo-crew-main-3')).toBeUndefined())
  })

  it("doesn't let you remove your own access", async () => {
    const store = setup('/hq/admin', 'demo-admin')
    tab('People with access')
    fireEvent.click(screen.getByRole('button', { name: `Edit access for ${store.get('members', 'demo-admin')!.name}` }))
    expect(within(await dialog()).queryByRole('button', { name: 'Delete' })).toBeNull()
  })
})

describe('roles and preview', () => {
  it('changes what a role may do', async () => {
    const store = setup('/hq/admin', 'demo-admin')
    tab('Roles')
    fireEvent.change(screen.getByLabelText('Hospitality: Accommodation'), { target: { value: '2' } })
    fireEvent.click(screen.getByLabelText('Hospitality sees artist contacts'))
    await waitFor(() => expect(store.snapshot().roles.hosp).toMatchObject({ contacts: true, perms: { accommodation: 2 } }))
    // Built-in locked roles can't be changed.
    expect(screen.queryByLabelText('Festival admin: Admin')).toBeNull()
  })

  it('adds a custom role and removes it', async () => {
    const store = setup('/hq/admin', 'demo-admin')
    tab('Roles')
    fireEvent.click(screen.getByRole('button', { name: 'Add role' }))
    const d = await dialog()
    fireEvent.change(within(d).getByLabelText('Role name'), { target: { value: 'Medical' } })
    await save(d)
    await waitFor(() => expect(Object.values(store.snapshot().roles).some(r => r.label === 'Medical')).toBe(true))
    // "Medical" is also in the preview picker; the role's row is the table one.
    const row = within(screen.getByRole('table')).getByText('Medical').closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(Object.values(store.snapshot().roles).some(r => r.label === 'Medical')).toBe(false))
  })

  it('previews the app as stage crew, then stops', async () => {
    setup('/hq/admin', 'demo-admin')
    tab('Roles')
    fireEvent.change(screen.getByLabelText('Preview the app as'), { target: { value: 'stage:crew:tent' } })
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/s/tent/today'))
    expect(screen.getByText(/Previewing as/).textContent).toContain('Previewing as Stage crew, The Tent')
    expect(within(nav()).queryByText('Stage setup')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stop preview' }))
    await waitFor(() => expect(within(nav()).getByText('Stage setup')).toBeTruthy())
  })
})

describe('event, modules and departments', () => {
  it('switches to conference vocabulary', async () => {
    const store = setup('/hq/admin', 'demo-admin')
    tab('Event')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const d = await dialog()
    fireEvent.change(within(d).getByLabelText('Event type'), { target: { value: 'conference' } })
    await save(d)
    await waitFor(() => expect(store.snapshot().cfg!.terms.performers).toBe('Speakers'))
    expect(within(nav()).getByText('Speakers')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Rooms & managers' })).toBeTruthy()
  })

  it('refuses a last day before the first', async () => {
    setup('/hq/admin', 'demo-admin')
    tab('Event')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const d = await dialog()
    fireEvent.change(within(d).getByLabelText('Last day'), { target: { value: '2000-01-01' } })
    await save(d)
    expect((await within(d).findByRole('alert')).textContent).toBe('The last day must be after the first day.')
  })

  it('switches a module off, which removes it from the nav', async () => {
    setup('/hq/admin', 'demo-admin')
    tab('Event')
    expect(within(nav()).getByText('Riders')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Riders'))
    await waitFor(() => expect(within(nav()).queryByText('Riders')).toBeNull())
  })

  it('adds a department', async () => {
    const store = setup('/hq/admin', 'demo-admin')
    tab('Departments')
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    const d = await dialog()
    fireEvent.change(within(d).getByLabelText('Name'), { target: { value: 'Medical' } })
    fireEvent.change(within(d).getByLabelText('Spike tape colour'), { target: { value: 'red' } })
    await save(d)
    await waitFor(() => expect(store.snapshot().cfg!.depts.find(x => x.name === 'Medical')).toMatchObject({ tape: 'red' }))
  })

  it('starts a blank event in demo mode', async () => {
    const store = setup('/hq/admin', 'demo-admin')
    tab('Event')
    fireEvent.click(screen.getByRole('button', { name: 'Start a blank event' }))
    await save(await dialog(), 'Start blank')
    await waitFor(() => expect(store.snapshot().cfg!.name).toBe('New festival'))
    expect(Object.keys(store.snapshot().col.stages)).toEqual([])
    expect(Object.keys(store.snapshot().col.members)).toEqual(['demo-admin'])
    expect(screen.getByTestId('path').textContent).toBe('/hq/admin')
  })
})

describe('stage setup', () => {
  it("lets a stage manager change their stage's day sheet template", async () => {
    const store = setup('/s/main/setup', 'demo-sm-main')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    const d = await dialog()
    expect((within(d).getByLabelText('Arrival (min before show)') as HTMLInputElement).value).toBe('240')
    fireEvent.change(within(d).getByLabelText('Arrival (min before show)'), { target: { value: '300' } })
    fireEvent.change(within(d).getByLabelText('Changeover length (min)'), { target: { value: '40' } })
    await save(d)
    await waitFor(() => expect(store.get('stages', 'main')!.template).toMatchObject({ arrival: -300, changeover: 40, getin: -180 }))
  })

  it('adds and removes crew', async () => {
    const store = setup('/s/main/setup', 'demo-sm-main')
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    const d = await dialog()
    fireEvent.change(within(d).getByLabelText('Personnel entry'), { target: { value: '' } })
    fireEvent.change(within(d).getByLabelText('Name'), { target: { value: 'Temp Hand' } })
    await save(d, 'Add to team')
    await waitFor(() => expect(Object.values(store.snapshot().col.members).find(m => m.name === 'Temp Hand')).toBeTruthy())
    const uid = Object.values(store.snapshot().col.members).find(m => m.name === 'Temp Hand')!.id
    expect(store.get('stageteam', 'main')!.crew[uid]).toBe(true)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Temp Hand from the team' }))
    await waitFor(() => expect(store.get('stageteam', 'main')!.crew[uid]).toBeUndefined())
  })

  it("doesn't offer stage managers deleting their stage", async () => {
    setup('/s/main/setup', 'demo-sm-main')
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    const d = await dialog()
    expect(within(d).queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(within(d).queryByText(/first move or delete/)).toBeNull()
  })
})
