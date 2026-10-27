// Who may write what. The prototype enforced most of this in the UI only; the
// Worker must call canWrite() before applying every write. The UI can call it
// too, to hide buttons the server would refuse.

import type { CollectionName, Collections, ConfigName, Id } from '../types/model'
import type { Access, AccessKey } from './access'

export interface WriteRequest<K extends CollectionName = CollectionName> {
  col: K
  id: Id
  /** The record before the write. Null when creating. */
  prev: Collections[K] | null
  /** The record after the write (an update is already merged). Null when deleting. */
  next: Collections[K] | null
}

export interface WriteContext {
  /** Looks up an artist's stage (riders, risk, input lists, plots, transfers, documents). */
  artistStage: (artistId: Id) => Id | null | undefined
  /** Looks up a facility's stage (allocations). */
  facilityStage?: (facilityId: Id) => Id | null | undefined
}

export type WriteVerdict = { ok: true } | { ok: false; reason: string }

const OK: WriteVerdict = { ok: true }
const no = (reason: string): WriteVerdict => ({ ok: false, reason })
const check = (cond: boolean, reason: string): WriteVerdict => (cond ? OK : no(reason))

/** Edit rights on the stage of both the old and the new record, so moving a record between stages needs both. */
function onBothStages(a: Access, key: AccessKey, prevStage: Id | null | undefined, nextStage: Id | null | undefined, hasPrev: boolean, hasNext: boolean) {
  return (!hasPrev || a.canW(key, prevStage ?? null)) && (!hasNext || a.canW(key, nextStage ?? null))
}

export function canWriteConfig(a: Access, _which: ConfigName): WriteVerdict {
  return check(a.canW('admin'), 'Only festival admins change event settings and roles.')
}

export function canWrite(a: Access, req: WriteRequest, ctx: WriteContext): WriteVerdict {
  const { prev, next } = req
  const p = !!prev
  const n = !!next
  if (!p && !n) return no('Nothing to write.')
  if (n && next!.id !== req.id) return no('Record id does not match.')

  switch (req.col) {
    case 'stages': {
      if (!p || !n) return check(a.canW('admin'), 'Only festival admins add or remove stages.')
      return check(a.canW('admin') || a.canW('setup', req.id), 'Only the stage manager or a festival admin edits this stage.')
    }

    case 'stageteam':
      return check(a.canW('admin') || a.canW('setup', req.id), 'Only the stage manager or a festival admin changes the stage team.')

    case 'prefs':
      return check(!!a.me && req.id === a.me, 'You can only change your own settings.')

    case 'members':
      return check(a.canW('admin'), 'Only festival admins change who has access.')

    case 'requests': {
      if (req.id === a.me) return OK // asking for access, or withdrawing your own request
      const r = (prev ?? next) as Collections['requests']
      return check(a.canW('admin') || (!!r.stage && a.canW('setup', r.stage)), 'Only the stage manager or a festival admin handles access requests.')
    }

    case 'artists': {
      const pr = prev as Collections['artists'] | null, nx = next as Collections['artists'] | null
      return check(onBothStages(a, 'artists', pr?.stage, nx?.stage, p, n), 'No edit access to artists on this stage.')
    }

    case 'ros': {
      const pr = prev as Collections['ros'] | null, nx = next as Collections['ros'] | null
      return check(onBothStages(a, 'schedule', pr?.stage, nx?.stage, p, n), 'No edit access to this stage’s schedule.')
    }

    case 'clocks': {
      const pr = prev as Collections['clocks'] | null, nx = next as Collections['clocks'] | null
      return check(onBothStages(a, 'clocks', pr?.scope, nx?.scope, p, n), 'No edit access to these clocks.')
    }

    case 'people': {
      if (a.canW('personnel')) return OK
      // A stage manager may edit people on their stage, and may only add or remove their own stages.
      const before = new Set((prev as Collections['people'] | null)?.stages ?? [])
      const after = new Set((next as Collections['people'] | null)?.stages ?? [])
      const mine = (sids: Set<Id>) => [...sids].some(sid => a.canW('personnel', sid))
      if (p && !mine(before)) return no('This person is not on a stage you manage.')
      if (n && !mine(after)) return no('Personnel must stay on a stage you manage.')
      const changed = [...before].filter(s => !after.has(s)).concat([...after].filter(s => !before.has(s)))
      return check(changed.every(sid => a.canW('personnel', sid)), 'You can only change stages you manage.')
    }

    case 'msgs': {
      const pr = prev as Collections['msgs'] | null, nx = next as Collections['msgs'] | null
      if (!p) return check(nx!.from === a.me && a.canSendTo(nx!.to), 'You cannot send to this recipient.')
      if (!n) return check(pr!.from === a.me || a.canW('admin'), 'Only the sender or an admin deletes a message.')
      // Updates: only acknowledging, i.e. adding your own entry to acks.
      if (!a.me || !a.canSeeMsg(pr!)) return no('You cannot see this message.')
      const { acks: ackBefore, ...restBefore } = pr!
      const { acks: ackAfter, ...restAfter } = nx!
      const otherAcksSame = Object.keys({ ...ackBefore, ...ackAfter }).every(u => u === a.me || ackBefore?.[u] === ackAfter?.[u])
      return check(deepEqual(restBefore, restAfter) && otherAcksSame, 'Messages can’t be edited, only acknowledged.')
    }

    case 'risks': {
      const r = (next ?? prev) as Collections['risks']
      if (req.id !== r.artist) return no('A risk assessment’s id must be the artist id.')
      if (prev && next && (prev as Collections['risks']).artist !== r.artist) return no('A risk assessment can’t move to another artist.')
      return check(a.canW('risk', ctx.artistStage(r.artist) ?? null), 'No edit access to risk assessments on this stage.')
    }

    case 'locations': {
      // A stage's own load bay: that stage's schedule editors. Festival-wide places: festival schedule editors.
      const pr = prev as Collections['locations'] | null, nx = next as Collections['locations'] | null
      return check(onBothStages(a, 'schedule', pr?.stage, nx?.stage, p, n), 'No edit access to these locations.')
    }

    case 'lines':
    case 'plots': {
      const r = (next ?? prev) as { artist: Id }
      if (req.id !== r.artist) return no('This record’s id must be the artist id.')
      if (prev && next && (prev as { artist: Id }).artist !== r.artist) return no('It can’t move to another artist.')
      return check(a.canW('technical', ctx.artistStage(r.artist) ?? null), 'No edit access to technical details on this stage.')
    }

    case 'risers': {
      const r = (next ?? prev) as Collections['risers']
      if (req.id !== r.stage) return no('Riser stock’s id must be the stage id.')
      return check(a.canW('technical', r.stage), 'No edit access to this stage’s risers.')
    }

    case 'screens': {
      const pr = prev as Collections['screens'] | null, nx = next as Collections['screens'] | null
      return check(onBothStages(a, 'clocks', pr?.scope, nx?.scope, p, n), 'No edit access to these screens.')
    }

    case 'transfers': {
      const stageOf = (t: Collections['transfers'] | null) => (t?.artist ? ctx.artistStage(t.artist) : null)
      return check(onBothStages(a, 'transport', stageOf(prev as Collections['transfers'] | null), stageOf(next as Collections['transfers'] | null), p, n), 'No edit access to transport.')
    }

    case 'facilities': {
      const pr = prev as Collections['facilities'] | null, nx = next as Collections['facilities'] | null
      return check(onBothStages(a, 'facilities', pr?.stage, nx?.stage, p, n), 'No edit access to these facilities.')
    }

    case 'allocations': {
      const stageOf = (x: Collections['allocations'] | null) => (x ? ctx.facilityStage?.(x.facility) ?? null : null)
      return check(onBothStages(a, 'facilities', stageOf(prev as Collections['allocations'] | null), stageOf(next as Collections['allocations'] | null), p, n), 'No edit access to this facility’s bookings.')
    }

    case 'comms': {
      const pr = prev as Collections['comms'] | null, nx = next as Collections['comms'] | null
      return check(onBothStages(a, 'comms', pr?.stage, nx?.stage, p, n), 'No edit access to these comm channels.')
    }

    case 'files': {
      const stageOf = (f: Collections['files'] | null) => f?.stage ?? (f?.artist ? ctx.artistStage(f.artist) : null) ?? null
      return check(onBothStages(a, 'documents', stageOf(prev as Collections['files'] | null), stageOf(next as Collections['files'] | null), p, n), 'No edit access to these documents.')
    }

    case 'hotels':
    case 'bookings':
      return check(a.canW('accommodation'), 'No edit access to accommodation.')

    case 'riders': {
      const r = (next ?? prev) as Collections['riders']
      const pr = prev as Collections['riders'] | null
      if (pr && next && (pr.artist !== r.artist || pr.kind !== r.kind)) return no('A rider can’t move to another artist.')
      if (req.id !== `${r.artist}_${r.kind}`) return no('Rider id must be artist_kind.')
      const key: AccessKey = r.kind === 'tech' ? 'riders_tech' : 'riders_hosp'
      return check(a.canW(key, ctx.artistStage(r.artist) ?? null), 'No edit access to this rider.')
    }
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a).filter(k => (a as Record<string, unknown>)[k] !== undefined)
  const kb = Object.keys(b).filter(k => (b as Record<string, unknown>)[k] !== undefined)
  return ka.length === kb.length && ka.every(k => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
