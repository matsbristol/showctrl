// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { setLangValue } from '../i18n'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(() => { cleanup(); setLangValue('en'); localStorage.clear(); history.replaceState(null, '', '/') })
const calls: string[] = []
beforeAll(() => {
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url))
    const body = String(url).startsWith('/api/me') && !String(url).includes('prefs') ? { error: 'Not signed in.' } : String(url).startsWith('/api/auth/start') ? { ok: true, devCode: '123456' } : { ok: true }
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

  it('opens the sign-in email’s link as a one-press sign-in', async () => {
    history.replaceState(null, '', '/#login=abcDEF123_-xyz')
    await act(async () => { render(<ShowctrlRoot />) })
    expect(screen.getByText('Press Sign in to finish signing in to showctrl.')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in' })) })
    expect(calls).toContain('/api/auth/magic')
  })
})
