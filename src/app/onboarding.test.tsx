// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { blankEvent, buildSample } from '../data/sample'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(cleanup)
beforeAll(() => { globalThis.fetch = (async () => { throw new Error('offline') }) as unknown as typeof fetch })

function mount(path: string, blank = false) {
  const store = new LocalStore({ initial: () => (blank ? blankEvent() : buildSample(Date.now())), storageKey: null })
  render(<MemoryRouter initialEntries={[path]}><Routes>{showctrlRoutes(<ShowctrlRoot store={store} initialMe="demo-admin" />)}</Routes></MemoryRouter>)
  return store
}

describe('getting a new event ready', () => {
  it('shows the four setup steps on a new event, ticks them off, and can be hidden', async () => {
    const store = mount('/hq/overview', true)
    const list = screen.getByRole('region', { name: 'Get this event ready' })
    expect(list.textContent).toMatch(/0 of 4 done/)
    await act(async () => { await store.set('stages', 'park', { name: 'Park', tape: 'red', order: 0, location: '', radio: '', capacity: null }) })
    expect(screen.getByRole('region', { name: 'Get this event ready' }).textContent).toMatch(/1 of 4 done/)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Hide' })) })
    expect(screen.queryByRole('region', { name: 'Get this event ready' })).toBeNull()
    expect(store.peek('prefs')['demo-admin']?.setupHidden).toBe(true)
  })

  it('stays out of the way once an event is set up', () => {
    mount('/hq/overview')
    expect(screen.queryByRole('region', { name: 'Get this event ready' })).toBeNull()
  })

  it('manages logins on People, so Admin no longer has a second list', () => {
    mount('/hq/admin')
    expect(screen.queryByRole('tab', { name: 'People with access' })).toBeNull()
    cleanup()
    mount('/hq/personnel')
    expect(screen.getByRole('heading', { name: 'People' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Sign-in' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Edit access for / }).length).toBeGreaterThan(5)
  })
})
