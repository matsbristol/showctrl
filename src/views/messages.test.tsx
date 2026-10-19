// @vitest-environment jsdom
/* Interaction tests for messages, the urgent banner and the unread badge. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
  // The last-read marker lives in localStorage; start each test fresh.
  localStorage.clear()
})

function setup(path: string, uid: string, store = new LocalStore({ storage: null, seed: () => buildSample(Date.now()) })) {
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

const sendTo = () => screen.getByLabelText('Send to') as HTMLSelectElement
const options = () => [...sendTo().options].map(o => o.value)

describe('sending', () => {
  it('sends to the stage team by default from a stage, and shows it in the channel', async () => {
    const store = setup('/s/main/messages', 'demo-sm-main')
    expect(sendTo().value).toBe('stage:main')
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Wedges on 3 and 4 swapped' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(Object.values(store.snapshot().col.msgs).find(m => m.text === 'Wedges on 3 and 4 swapped')).toMatchObject({
      from: 'demo-sm-main', to: { t: 'stage', id: 'main' }, pri: 'normal', acks: {},
    }))
    expect(screen.getByText('Wedges on 3 and 4 swapped')).toBeTruthy()
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('')
  })

  it('sends with Ctrl+Enter, and can mark a message urgent', async () => {
    const store = setup('/hq/messages', 'demo-pm')
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Evacuate the pit' } })
    fireEvent.click(screen.getByLabelText('Urgent'))
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(Object.values(store.snapshot().col.msgs).find(m => m.text === 'Evacuate the pit')).toMatchObject({ to: { t: 'all' }, pri: 'urgent' }))
  })

  it('only lets festival-wide message editors write to everyone', () => {
    setup('/s/main/messages', 'demo-crew-main-3')
    // Crew can message their stage team, departments and people, but not everyone.
    expect(options()).not.toContain('all')
    expect(options()).toContain('stage:main')
    expect(options()).not.toContain('stage:tent')
    cleanup()
    setup('/hq/messages', 'demo-pm')
    expect(options()).toContain('all')
  })

  it('deletes your own message after confirming', async () => {
    const store = setup('/s/main/messages', 'demo-sm-main')
    const mine = screen.getByText(store.get('msgs', 'm2')!.text).closest('article')!
    fireEvent.click(within(mine).getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(mine).getByRole('button', { name: 'Delete for everyone?' }))
    await waitFor(() => expect(store.get('msgs', 'm2')).toBeUndefined())
  })
})

describe('channels', () => {
  it('filters to a channel', () => {
    const store = setup('/hq/messages', 'demo-admin')
    fireEvent.click(screen.getByRole('button', { name: /^Urgent/ }))
    expect(screen.getByText(store.get('msgs', 'm3')!.text)).toBeTruthy()
    expect(screen.queryByText(store.get('msgs', 'm1')!.text)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }))
    expect(screen.getByText(store.get('msgs', 'm1')!.text)).toBeTruthy()
    expect(screen.queryByText(store.get('msgs', 'm3')!.text)).toBeNull()
  })
})

describe('urgent banner', () => {
  it("flashes an urgent message for the stage until it's acknowledged", async () => {
    const store = setup('/s/tent/today', 'demo-sm-tent')
    const banner = screen.getByRole('alert')
    expect(banner.textContent).toContain(store.get('msgs', 'm3')!.text)
    fireEvent.click(within(banner).getByRole('button', { name: 'Acknowledge' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(store.get('msgs', 'm3')!.acks['demo-sm-tent']).toBeGreaterThan(0)
    // Someone else's acknowledgement is kept.
    expect(store.get('msgs', 'm3')!.acks['demo-pm']).toBeGreaterThan(0)
  })

  it("doesn't show to people the message wasn't for", () => {
    setup('/s/main/today', 'demo-sm-main')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('unread badge', () => {
  it('counts new messages until Messages is opened', async () => {
    setup('/s/main/today', 'demo-sm-main')
    // One message for everyone; their own stage message doesn't count.
    expect(screen.getByLabelText('1 unread')).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: /Messages/ }))
    await waitFor(() => expect(screen.queryByLabelText(/unread/)).toBeNull())
    fireEvent.click(screen.getByRole('link', { name: /Today/ }))
    expect(screen.queryByLabelText(/unread/)).toBeNull()
  })
})

describe('panels', () => {
  it("shows a stage's messages on its Today page", () => {
    const store = setup('/s/main/today', 'demo-crew-main-3')
    expect(screen.getByRole('heading', { name: 'Messages for this stage' })).toBeTruthy()
    expect(screen.getByText(store.get('msgs', 'm2')!.text)).toBeTruthy()
    // Not the Tent's messages.
    expect(screen.queryByText(store.get('msgs', 'm3')!.text)).toBeNull()
  })
})
