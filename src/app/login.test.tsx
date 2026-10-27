// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { setLangValue } from '../i18n'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(() => { cleanup(); setLangValue('en'); localStorage.clear(); history.replaceState(null, '', '/') })
const calls: string[] = []
const bodies: unknown[] = []
let sameBrowser = false
beforeAll(() => {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push(String(url))
    const sent = init?.body ? JSON.parse(String(init.body)) : {}
    bodies.push(sent)
    const body = String(url).startsWith('/api/me') && !String(url).includes('prefs') ? { error: 'Not signed in.' }
      : String(url).startsWith('/api/auth/start') ? { ok: true, devCode: '123456' }
      : String(url) === '/api/auth/magic' && sent.auto && !sameBrowser ? { confirm: true }
      : { ok: true }
    return new Response(JSON.stringify(body), { status: String(url).startsWith('/api/me?') || String(url) === '/api/me' ? 401 : 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
})

describe('sign-in page', () => {
  it('keeps the code step when the language changes', async () => {
    await act(async () => { render(<ShowctrlRoot />) })
    await act(async () => { fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'kari@x.no' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send code' })) })
    expect(screen.getByLabelText('Code')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Norsk' })) })
    expect(screen.getByLabelText('Kode')).toBeTruthy()
    expect(screen.getByText('kari@x.no')).toBeTruthy()
  })

  it('signs in from the email’s link by itself in the browser that asked', async () => {
    sameBrowser = true
    const reload = vi.spyOn(location, 'reload').mockImplementation(() => {})
    history.replaceState(null, '', '/#login=abcDEF123_-xyz')
    await act(async () => { render(<ShowctrlRoot />) })
    expect(bodies).toContainEqual({ token: 'abcDEF123_-xyz', auto: true })
    expect(reload).toHaveBeenCalled()
    expect(location.hash).toBe('')
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()
    reload.mockRestore()
    sameBrowser = false
  })

  it('asks for one press when the link opens anywhere else', async () => {
    history.replaceState(null, '', '/#login=abcDEF123_-xyz')
    await act(async () => { render(<ShowctrlRoot />) })
    expect(screen.getByText('Press Sign in to finish signing in to showctrl.')).toBeTruthy()
    bodies.length = 0
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in' })) })
    expect(bodies).toContainEqual({ token: 'abcDEF123_-xyz' })
  })
})
