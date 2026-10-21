// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(cleanup)
beforeAll(() => { globalThis.fetch = (async () => { throw new Error('offline') }) as unknown as typeof fetch })

function mount(path: string, me: string, store = new LocalStore({ initial: () => buildSample(Date.now()), storageKey: null })) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{showctrlRoutes(<ShowctrlRoot store={store} initialMe={me} />)}</Routes>
    </MemoryRouter>,
  )
  return store
}
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
const change = async (el: HTMLElement, value: string) => { await act(async () => { fireEvent.change(el, { target: { value } }) }) }
const nav = () => within(document.querySelector<HTMLElement>('nav.side')!)
const withConfirm = async (fn: () => Promise<void>) => { const o = globalThis.confirm; globalThis.confirm = () => true; try { await fn() } finally { globalThis.confirm = o } }

describe('admin', () => {
  it('shows a view-only admin no edit controls', () => {
    mount('/hq/admin', 'demo-pm') // Production manager: admin = view
    expect(screen.getByRole('tab', { name: 'Stages & managers' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Add stage/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Appoint stage manager/ })).toBeNull()
  })

  it('switches the event to a conference and the vocabulary follows', async () => {
    const store = mount('/hq/admin?tab=event', 'demo-admin')
    await click(screen.getByRole('button', { name: 'Edit' }))
    await change(screen.getByLabelText('Event type'), 'conference')
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(store.peekConfig('event')?.terms.performers).toBe('Speakers')
    expect(nav().getByRole('link', { name: /Speakers/ })).toBeTruthy()
  })

  it('turns a module off and hides it from the nav and the roles matrix', async () => {
    const store = mount('/hq/admin?tab=modules', 'demo-admin')
    expect(nav().queryByRole('link', { name: /Riders/ })).toBeTruthy()
    await click(screen.getByRole('switch', { name: 'Riders' }))
    expect(store.peekConfig('event')?.modules.riders).toBe(false)
    expect(nav().queryByRole('link', { name: /Riders/ })).toBeNull()
    await click(screen.getByRole('tab', { name: 'Roles' }))
    const heads = [...document.querySelectorAll('table.matrix th')].map(th => th.textContent)
    expect(heads).not.toContain('Technical riders')
    expect(heads).toContain('Messages')
  })

  it('switches Messages off everywhere: nav, overview block and urgent banner', async () => {
    const store = mount('/s/tent/today', 'demo-sm-tent')
    expect(screen.getByRole('alert')).toBeTruthy() // urgent message for The Tent
    await act(async () => { await store.setConfig('event', { ...store.peekConfig('event')!, modules: { messages: false } }) })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(nav().queryByRole('link', { name: /Messages/ })).toBeNull()
    expect(screen.queryByText('Messages for this stage')).toBeNull()
  })

  it('keeps the stage display working with Clocks switched off', async () => {
    const store = mount('/s/main/display', 'demo-crew-main-3')
    await act(async () => { await store.setConfig('event', { ...store.peekConfig('event')!, modules: { clocks: false } }) })
    expect(nav().queryByRole('link', { name: /Clocks/ })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Stage display' })).toBeTruthy()
  })

  it('edits a role’s permission and adds and removes a custom role', async () => {
    const store = mount('/hq/admin?tab=roles', 'demo-admin')
    await change(screen.getByLabelText('Hospitality schedule'), '0')
    expect(store.peekConfig('roles')?.roles.hosp.perms.schedule).toBe(0)

    await click(screen.getByRole('button', { name: '+ Add role' }))
    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Medical coordinator' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    const roles = store.peekConfig('roles')!.roles
    const key = Object.keys(roles).find(k => roles[k].label === 'Medical coordinator')!
    expect(roles[key].perms).toEqual(roles.site.perms)

    const row = screen.getByText('Medical coordinator', { selector: 'td b' }).closest('tr')!
    await click(within(row).getByRole('button', { name: 'Remove' }))
    expect(store.peekConfig('roles')!.roles[key]).toBeUndefined()
  })

  it('appoints and removes a stage manager', async () => {
    const store = mount('/hq/admin', 'demo-admin')
    const card = screen.getByRole('heading', { name: 'Forest Stage' }).closest('section')!
    await click(within(card).getByRole('button', { name: '+ Appoint stage manager' }))
    await change(screen.getByLabelText('Person'), 'demo-pm')
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(store.peek('members')['demo-pm'].stages.forest).toBe('manager')

    const card2 = screen.getByRole('heading', { name: 'Forest Stage' }).closest('section')!
    const pmRow = within(card2).getByText(store.peek('people')[store.peek('members')['demo-pm'].person!].name).closest('.row') as HTMLElement
    await click(within(pmRow).getByRole('button', { name: 'Remove' }))
    expect(store.peek('members')['demo-pm'].stages.forest).toBeUndefined()
  })

  it('gives a new person crew access to a stage', async () => {
    const store = mount('/hq/admin?tab=access', 'demo-admin')
    await click(screen.getByRole('button', { name: '+ Give someone access' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rita Rigger' } })
    const crewSet = screen.getByText('Stage crew on').closest('fieldset')!
    fireEvent.click(within(crewSet).getByLabelText('The Tent'))
    await click(screen.getByRole('button', { name: 'Save' }))
    const [uid] = Object.entries(store.peek('members')).find(([, m]) => m.name === 'Rita Rigger')!
    expect(store.peek('stageteam').tent.crew[uid]).toBe(true)
  })

  it('stops admins removing their own admin role', async () => {
    const store = mount('/hq/admin?tab=access', 'demo-admin')
    const me = store.peek('people')[store.peek('members')['demo-admin'].person!].name
    await click(screen.getByRole('button', { name: `Edit access for ${me}` }))
    await change(screen.getByLabelText('Festival role'), 'pm')
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert').textContent).toMatch(/own admin role/)
    expect(store.peek('members')['demo-admin'].role).toBe('admin')
  })

  it('adds and deletes a department', async () => {
    const store = mount('/hq/admin?tab=depts', 'demo-admin')
    await click(screen.getByRole('button', { name: '+ Add' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Medical' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(store.peekConfig('event')!.depts.at(-1)!.name).toBe('Medical')
    await click(screen.getByRole('button', { name: 'Edit Medical' }))
    await withConfirm(() => click(screen.getByRole('button', { name: 'Delete' })))
    expect(store.peekConfig('event')!.depts.some(d => d.name === 'Medical')).toBe(false)
  })

  it('starts a blank event with only the admin', async () => {
    const store = mount('/hq/admin?tab=event', 'demo-admin')
    await withConfirm(() => click(screen.getByRole('button', { name: 'Start blank' })))
    expect(Object.keys(store.peek('stages'))).toHaveLength(0)
    expect(Object.keys(store.peek('members'))).toEqual(['demo-admin'])
    expect(store.peekConfig('event')?.name).toBe('New festival')
  })
})
