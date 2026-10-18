// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(cleanup)
beforeEach(() => localStorage.clear())
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
const sideNav = () => within(document.querySelector<HTMLElement>('nav.side')!)

describe('messages', () => {
  it('shows an urgent banner until it is acknowledged', async () => {
    const store = mount('/s/tent/today', 'demo-sm-tent')
    const banner = screen.getByRole('alert')
    expect(banner.textContent).toMatch(/stuck in traffic/)
    await click(within(banner).getByRole('button', { name: 'Acknowledge' }))
    expect(store.peek('msgs').m3.acks['demo-sm-tent']).toBeTypeOf('number')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows an unread badge that clears when Messages opens', async () => {
    mount('/s/tent/today', 'demo-sm-tent')
    expect(sideNav().getByLabelText('2 unread')).toBeTruthy()
    await click(sideNav().getByRole('link', { name: /Messages/ }))
    expect(sideNav().queryByLabelText(/unread/)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeTruthy()
  })

  it('keeps read state with the user, not the browser', async () => {
    const store = mount('/s/tent/messages', 'demo-sm-tent')
    expect(store.peek('prefs')['demo-sm-tent']?.lastRead).toBeTypeOf('number')
    cleanup()
    localStorage.clear() // a different device
    render(
      <MemoryRouter initialEntries={['/s/tent/today']}>
        <Routes>{showctrlRoutes(<ShowctrlRoot store={store} initialMe="demo-sm-tent" />)}</Routes>
      </MemoryRouter>,
    )
    expect(sideNav().queryByLabelText(/unread/)).toBeNull()
  })

  it('sends an urgent message to a stage and alerts that stage’s crew', async () => {
    const store = mount('/s/main/messages', 'demo-sm-main')
    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'Clear the stage, wind warning' } })
    fireEvent.click(screen.getByLabelText('Urgent'))
    await click(screen.getByRole('button', { name: 'Send' }))
    const sent = Object.values(store.peek('msgs')).find(m => m.text === 'Clear the stage, wind warning')!
    expect(sent).toMatchObject({ from: 'demo-sm-main', to: { t: 'stage', id: 'main' }, pri: 'urgent' })
    cleanup()

    // Same data, now as a crew member on that stage.
    render(
      <MemoryRouter initialEntries={['/s/main/today']}>
        <Routes>{showctrlRoutes(<ShowctrlRoot store={store} initialMe="demo-crew-main-3" />)}</Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert').textContent).toMatch(/wind warning/)
  })

  it('filters by channel', async () => {
    mount('/hq/messages', 'demo-admin')
    expect(document.querySelectorAll('article.m')).toHaveLength(5)
    await click(screen.getByRole('button', { name: /^Urgent/ }))
    expect(document.querySelectorAll('article.m')).toHaveLength(1)
    await click(screen.getByRole('button', { name: 'The Tent' }))
    expect(document.querySelectorAll('article.m')).toHaveLength(1)
  })

  it('does not offer "Everyone" to stage crew', () => {
    mount('/s/main/messages', 'demo-crew-main-3')
    const to = screen.getByLabelText('To') as HTMLSelectElement
    const values = [...to.options].map(o => o.value)
    expect(values).not.toContain('all')
    expect(values).toContain('stage:main')
  })

  it('lets the sender delete their own message', async () => {
    const store = mount('/hq/messages', 'demo-pm')
    const orig = globalThis.confirm
    globalThis.confirm = () => true
    const mine = [...document.querySelectorAll<HTMLElement>('article.m')].find(el => el.textContent?.includes('Weather: rain'))!
    await click(within(mine).getByRole('button', { name: 'Delete' }))
    globalThis.confirm = orig
    expect(store.peek('msgs').m1).toBeUndefined()
  })
})
