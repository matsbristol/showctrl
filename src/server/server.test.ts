// End to end without Cloudflare: real CloudflareStore clients talking to a real EventHub
// over a fake network, so permissions, redaction and live updates are tested together.

import { describe, expect, it } from 'vitest'
import { CloudflareStore, type SocketLike } from '../data/cloudflareStore'
import { buildSample } from '../data/sample'
import type { AuditEntry } from '../data/store'
import { riderItems } from '../lib/riders'
import { EventCore, type CoreStorage } from './core'
import { EventHub, type Peer } from './hub'

const T = Date.UTC(2026, 6, 10, 18)
const tick = () => new Promise(r => setTimeout(r, 0))

function setup() {
  const sample = buildSample(T)
  const audit: AuditEntry[] = []
  const writes: [string, string, unknown][] = []
  const storage: CoreStorage = {
    putDoc: (c, id, d) => { writes.push([c, id, d]) },
    putConfig: () => {},
    appendAudit: e => { audit.push(e) },
  }
  const core = new EventCore({ cfg: sample.cfg, roles: sample.roles, col: sample.col, owner: 'owner@example.com' }, storage)
  const peers: Peer[] = []
  const hub = new EventHub(core, { peers: () => peers, now: () => T + 1000, readAudit: n => audit.slice(-n).reverse() })
  const sockets: { close: () => void }[] = []

  function client(email: string) {
    const store = new CloudflareStore({
      backoff: [0],
      connect: () => {
        const sock: SocketLike = {
          onopen: null, onmessage: null, onclose: null,
          send: d => hub.message(peer, d),
          close: () => { peers.splice(peers.indexOf(peer), 1); queueMicrotask(() => sock.onclose?.()) },
        }
        const peer: Peer = { email, send: d => queueMicrotask(() => sock.onmessage?.({ data: d })) }
        sockets.push(sock)
        queueMicrotask(() => { peers.push(peer); sock.onopen?.(); hub.connect(peer) })
        return sock
      },
    })
    return store
  }
  return { core, hub, client, audit, writes, sockets }
}

describe('server: what each user sees', () => {
  it('sends members the event and hides other people’s direct messages and prefs', async () => {
    const { client, core } = setup()
    core.col.msgs.dm = { id: 'dm', from: 'demo-pm', to: { t: 'user', id: 'demo-al' }, text: 'private', pri: 'normal', at: T, acks: {} }
    core.col.prefs['demo-al'] = { id: 'demo-al', lastRead: 1 }
    const crew = client('demo-crew-main-3')
    await tick()
    expect(Object.keys(crew.peek('stages')!)).toHaveLength(5)
    expect(crew.peek('msgs')!.dm).toBeUndefined()
    expect(crew.peek('prefs')!['demo-al']).toBeUndefined()
    const al = client('demo-al')
    await tick()
    expect(al.peek('msgs')!.dm.text).toBe('private')
    expect(al.peek('prefs')!['demo-al']).toBeDefined()
  })

  it('redacts artist contacts, hotel details and booking refs for roles without contact access', async () => {
    const { client } = setup()
    const hosp = client('demo-hosp')
    await tick()
    const a0 = hosp.peek('artists')!.a0
    expect(a0.contacts).toEqual([])
    expect(hosp.peek('hotels')!.h1.address).toBeUndefined()
    expect(Object.values(hosp.peek('bookings')!).every(b => b.conf === undefined)).toBe(true)
    const admin = client('owner@example.com')
    await tick()
    expect(admin.peek('artists')!.a0.contacts.length).toBeGreaterThan(0)
  })

  it('shows someone without access only the stages and their own request', async () => {
    const { client, core } = setup()
    const stranger = client('new@example.com')
    await tick()
    expect(Object.keys(stranger.peek('ros')!)).toHaveLength(0)
    expect(Object.keys(stranger.peek('stages')!)).toHaveLength(5)
    await stranger.set('requests', 'new@example.com', { at: T, note: 'Backline tech', stage: 'main' })
    expect(core.col.requests['new@example.com'].note).toBe('Backline tech')
    expect(Object.keys(stranger.peek('requests')!)).toEqual(['new@example.com'])
  })
})

describe('server: writes', () => {
  it('refuses writes the role doesn’t allow, and leaves the data alone', async () => {
    const { client, core } = setup()
    const crew = client('demo-crew-main-3')
    await tick()
    const show = Object.values(core.col.ros).find(r => r.stage === 'main' && r.kind === 'show')!
    await expect(crew.update('ros', show.id, { delay: 99 })).rejects.toMatchObject({ code: 'denied' })
    expect(core.col.ros[show.id].delay).toBe(show.delay)
  })

  it('applies an allowed write and pushes it to everyone else live', async () => {
    const { client, core, audit } = setup()
    const sm = client('demo-sm-main')
    const crew = client('demo-crew-main-3')
    await tick()
    const show = Object.values(core.col.ros).find(r => r.stage === 'main' && r.kind === 'show')!
    await sm.update('ros', show.id, { delay: 300000, delayNote: 'Rain' })
    await tick()
    expect(crew.peek('ros')![show.id].delay).toBe(300000)
    expect(audit.at(-1)).toMatchObject({ actor: 'demo-sm-main', op: 'update', col: 'ros', id: show.id })
  })

  it('deletes keys sent as undefined (across JSON)', async () => {
    const { client, core } = setup()
    const admin = client('owner@example.com')
    await tick()
    const r = Object.values(core.col.riders)[0]
    const [first] = riderItems(r)
    await admin.update('riders', r.id, { items: { [first.id]: undefined } })
    expect(core.col.riders[r.id].items[first.id]).toBeUndefined()
    await admin.update('members', 'demo-sm-main', { stages: { main: undefined } })
    expect(core.col.members['demo-sm-main'].stages.main).toBeUndefined()
  })

  it('keeps contacts a writer can’t see when they save the artist', async () => {
    const { client, core } = setup()
    const admin = client('owner@example.com')
    await tick()
    const roles = structuredClone(core.roles!.roles)
    roles.hosp.perms.artists = 2
    await admin.setConfig('roles', { roles })
    const hosp = client('demo-hosp')
    await tick()
    const seen = hosp.peek('artists')!.a0
    expect(seen.contacts).toEqual([])
    await hosp.set('artists', 'a0', { ...seen, vehicles: '9 buses' })
    expect(core.col.artists.a0.vehicles).toBe('9 buses')
    expect(core.col.artists.a0.contacts.length).toBeGreaterThan(0)
  })

  it('stamps messages with the server’s time', async () => {
    const { client, core } = setup()
    const sm = client('demo-sm-main')
    await tick()
    await sm.set('msgs', 'x', { from: 'demo-sm-main', to: { t: 'stage', id: 'main' }, text: 'hi', pri: 'normal', at: 1, acks: {} })
    expect(core.col.msgs.x.at).toBe(T + 1000)
  })

  it('keeps the locked admin role whatever is sent', async () => {
    const { client, core } = setup()
    const admin = client('owner@example.com')
    await tick()
    const roles = structuredClone(core.roles!.roles)
    roles.admin.perms.admin = 0
    delete (roles as Record<string, unknown>).none
    await admin.setConfig('roles', { roles })
    expect(core.roles!.roles.admin.perms.admin).toBe(2)
    expect(core.roles!.roles.none).toBeDefined()
  })

  it('applies a batch all or nothing', async () => {
    const { client, core } = setup()
    const sm = client('demo-sm-main')
    await tick()
    const mine = Object.values(core.col.ros).find(r => r.stage === 'main')!
    const theirs = Object.values(core.col.ros).find(r => r.stage === 'tent')!
    await expect(sm.setMany('ros', [{ ...mine, notes: 'a' }, { ...theirs, notes: 'b' }])).rejects.toMatchObject({ code: 'denied' })
    expect(core.col.ros[mine.id].notes).not.toBe('a')
  })
})

describe('server: access changes and connections', () => {
  it('re-sends a snapshot when someone’s access changes', async () => {
    const { client } = setup()
    const admin = client('owner@example.com')
    const crew = client('demo-crew-main-3')
    await tick()
    expect(Object.keys(crew.peek('ros')!).length).toBeGreaterThan(0)
    await admin.set('stageteam', 'main', { crew: { 'demo-crew-main-6': true } })
    await tick()
    expect(Object.keys(crew.peek('ros')!)).toHaveLength(0)
  })

  it('only lets admins read the change history', async () => {
    const { client } = setup()
    const admin = client('owner@example.com')
    const crew = client('demo-crew-main-3')
    await tick()
    await expect(crew.audit()).rejects.toMatchObject({ code: 'denied' })
    await admin.update('stages', 'main', { radio: 'Ch 9' })
    expect((await admin.audit(5))[0]).toMatchObject({ col: 'stages', id: 'main' })
  })

  it('goes offline when the connection drops, then reconnects and keeps working', async () => {
    const { client, sockets } = setup()
    const admin = client('owner@example.com')
    await tick()
    const statuses: string[] = []
    admin.onStatus(s => statuses.push(s))
    sockets[0].close()
    await tick()
    await tick()
    expect(statuses).toContain('offline')
    expect(admin.status).toBe('online')
    await admin.update('stages', 'main', { radio: 'Ch 7' })
  })
})
