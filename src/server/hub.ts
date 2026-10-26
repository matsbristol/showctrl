// Connected browsers for one event: handles their messages and sends each one only what
// they may see. No Cloudflare APIs, so the Durable Object stays thin and this is testable.

import { mergeRoles } from '../shared/access'
import type { ClientMsg, ServerMsg } from '../shared/protocol'
import type { AuditEntry } from '../data/store'
import type { Id } from '../types/model'
import { EventCore, type Effect } from './core'

export interface Peer {
  email: Id
  send(data: string): void
}

export interface HubOptions {
  /** Everyone connected right now. */
  peers: () => Peer[]
  now?: () => number
  readAudit: (limit: number) => AuditEntry[]
  /** Called when the set of members may have changed (to update the D1 membership index). */
  onMembersChanged?: (emails: Id[]) => void
  /** People who just got access, and who gave it (to send them an invitation). */
  onNewMembers?: (emails: Id[], by: Id) => void
}

export class EventHub {
  readonly core: EventCore
  private readonly opts: HubOptions

  constructor(core: EventCore, opts: HubOptions) {
    this.core = core
    this.opts = opts
  }

  private now() {
    return (this.opts.now ?? Date.now)()
  }

  private static send(p: Peer, m: ServerMsg) {
    try { p.send(JSON.stringify(m)) } catch { /* the socket closed; it will be cleaned up */ }
  }

  /** A browser just connected: send it everything it may see. */
  connect(p: Peer) {
    EventHub.send(p, { t: 'snapshot', me: p.email, isOwner: this.core.isOwner(p.email), ...this.core.snapshotFor(p.email) })
  }

  message(p: Peer, raw: string) {
    let m: ClientMsg
    try { m = JSON.parse(raw) as ClientMsg } catch { return }
    if (m.t === 'ping') return EventHub.send(p, { t: 'pong', req: m.req, now: this.now() })
    if (m.t === 'audit') {
      if (!this.core.access(p.email).canW('admin')) return EventHub.send(p, { t: 'error', req: m.req, code: 'denied', message: 'Only festival admins can read the change history.' })
      return EventHub.send(p, { t: 'audit', req: m.req, entries: this.opts.readAudit(Math.min(m.limit ?? 100, 1000)) })
    }
    if (m.t !== 'op') return
    const before = new Set(this.core.memberEmails())
    const r = this.core.apply(p.email, m.op, this.now())
    if (!r.ok) return EventHub.send(p, { t: 'error', req: m.req, code: r.code, message: r.message })
    this.broadcast(r.effects)
    EventHub.send(p, { t: 'ack', req: m.req })
    const added = this.core.memberEmails().filter(e => !before.has(e))
    if (added.length) this.opts.onNewMembers?.(added, p.email)
  }

  /** Send each viewer their own view of what changed. */
  broadcast(effects: Effect[]) {
    const peers = this.opts.peers()
    if (EventCore.changesAccess(effects)) {
      // Who sees what may have changed: simplest correct answer is a fresh snapshot for everyone.
      for (const p of peers) this.connect(p)
      this.opts.onMembersChanged?.(this.core.memberEmails())
      return
    }
    const byCol = new Map<Extract<Effect, { kind: 'doc' }>['col'], Extract<Effect, { kind: 'doc' }>['change'][]>()
    for (const e of effects) {
      if (e.kind === 'config') {
        const doc = e.which === 'event' ? this.core.cfg : { roles: mergeRoles(this.core.roles) }
        for (const p of peers) EventHub.send(p, { t: 'config', which: e.which, doc })
      } else {
        byCol.set(e.col, [...(byCol.get(e.col) ?? []), e.change])
      }
    }
    // One message per collection per viewer, even for a batch of hundreds of run sheet items.
    for (const [col, changes] of byCol) {
      for (const p of peers) EventHub.send(p, { t: 'changes', col, changes: changes.map(ch => this.core.viewChange(p.email, col, ch)) })
    }
  }
}
