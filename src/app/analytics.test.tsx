// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Analytics } from '../shared/analytics'
import { AnalyticsPage } from './Analytics'

const now = Date.now()
const data: Analytics = {
  days: 30, superadmins: ['boss@showctrl.no'],
  names: { 'trine@tor.no': 'Trine', 'boss@showctrl.no': 'Boss' },
  events: [{ id: 'e1', name: 'Tons of Rock', org: 'TOR' }, { id: 'e2', name: 'Nordlys', org: 'TOR' }],
  signins: [{ at: now - 3600_000, email: 'trine@tor.no', method: 'link', country: 'NO', device: 'iPhone · Safari' }, { at: now, email: 'boss@showctrl.no', method: 'code', country: 'NO', device: 'Mac · Safari' }],
  usage: [
    { email: 'trine@tor.no', event: 'e1', view: 'hq/schedule', n: 12, days: 3, last: now - 60_000 },
    { email: 'trine@tor.no', event: 'e1', view: 'hq/comms', n: 4, days: 1, last: now - 120_000 },
    { email: 'trine@tor.no', event: 'e2', view: 'stage/runsheet', n: 2, days: 1, last: now - 600_000 },
    { email: 'boss@showctrl.no', event: 'e1', view: 'hq/admin', n: 30, days: 5, last: now },
  ],
  daily: [{ day: '2026-10-27', users: 2, views: 48 }],
  edits: [{ event: 'e1', actor: 'trine@tor.no', col: 'ros', n: 7, last: now - 30_000 }, { event: 'e1', actor: 'trine@tor.no', col: 'prefs', n: 9, last: now }],
}

afterEach(cleanup)
beforeAll(() => { globalThis.fetch = (async () => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch })

describe('analytics', () => {
  it('shows people, modules and sign-ins, without superadmins unless asked', async () => {
    await act(async () => { render(<AnalyticsPage onBack={() => {}} />) })
    expect(screen.getAllByText('Trine').length).toBeGreaterThan(0)
    expect(screen.queryByText('Boss')).toBeNull()
    // Running order is a core page; Comm channels a module; run sheet edits are "Run sheets"; read markers don't count.
    for (const label of ['Running order', 'Comm channels', 'Run sheets']) expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    expect(screen.getByText('Sign-in link')).toBeTruthy()
    const tiles = [...document.querySelectorAll('.an-n')].map(n => n.textContent)
    expect(tiles).toEqual(['1', '1', '18', '7'])

    await act(async () => { fireEvent.click(screen.getByLabelText('Include superadmins')) })
    expect(screen.getAllByText('Boss').length).toBeGreaterThan(0)

    await act(async () => { fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'e2' } }) })
    expect(screen.queryByText('Comm channels')).toBeNull()
    expect(screen.getAllByText('Run sheet').length).toBeGreaterThan(0)
  })
})
