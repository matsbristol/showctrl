/*
 * Clock wall. In HQ: festival-wide clocks plus every visible stage's own.
 * In a stage: festival-wide clocks plus that stage's. All use server time.
 */
import { now, useNow } from '../clock/clock'
import { CLOCK_KINDS, clocksFor, clockValue, timerPatch, type TimerOp } from '../domain/clocks'
import { HOUR, MIN, tapeHex, TIME_ZONES } from '../domain/constants'
import { rid } from '../domain/runsheet'
import { fmtTime } from '../domain/time'
import { sortStages } from '../access/access'
import { useSnapshot, useStore } from '../data/hooks'
import type { DocInput } from '../data/store'
import { useAccess } from '../session/hooks'
import { Icon } from '../shell/Icon'
import { HQ_COLOUR, colourVar } from '../shell/style'
import type { Clock, ClockKind, Id } from '../types/model'
import { useForm } from '../ui/hooks'
import { useWallMode } from '../ui/wall'
import { Head } from './common'
import { useEvent } from './hooks'

function Tile({ c, canEdit, onEdit }: { c: Clock; canEdit: boolean; onEdit: () => void }) {
  const snap = useSnapshot()
  const store = useStore()
  const { tz } = useEvent()
  const t = useNow(250)
  const v = clockValue(c, t, { ros: snap.col.ros, stages: snap.col.stages, tz })
  const label = c.label || CLOCK_KINDS[c.kind]
  // The top stripe: the followed stage, else the owning stage, else HQ.
  const colour = c.kind === 'stage' ? tapeHex(snap.col.stages[c.stage]?.tape) : c.scope ? tapeHex(snap.col.stages[c.scope]?.tape) : HQ_COLOUR
  const timer = (op: TimerOp) => c.kind === 'timer' && store.update('clocks', c.id, timerPatch(c, op, now()))

  return (
    <article className="tile" style={colourVar(colour)}>
      <div className="lab">{label}<span>{c.scope ? snap.col.stages[c.scope]?.name : 'Festival'}</span></div>
      <div className={`val ${v.state ?? ''}`} aria-label={`${label}: ${v.text}`}>{v.text}</div>
      <div className="sub">{v.sub}</div>
      {canEdit && c.kind === 'timer' && (
        <div className="ctl">
          {c.runningSince
            ? <button type="button" onClick={() => timer('pause')}>Pause</button>
            : <button type="button" onClick={() => timer('start')}>{c.accum ? 'Resume' : 'Start'}</button>}
          <button type="button" onClick={() => timer('reset')}>Reset</button>
          {c.duration ? <button type="button" onClick={() => timer('plus')}>+1 min</button> : null}
        </div>
      )}
      {canEdit && <button type="button" className="edit" onClick={onEdit} aria-label={`Edit ${label}`}><Icon name="edit" /></button>}
    </article>
  )
}

function useClockForm(sid: Id | null) {
  const snap = useSnapshot()
  const store = useStore()
  const access = useAccess()
  const openForm = useForm()
  const { tz, T } = useEvent()

  return (c?: Clock) => {
    const editable = sortStages(Object.values(snap.col.stages)).filter(s => access.canW('clocks', s.id))
    const base: Partial<Clock> = c ?? (sid ? { kind: 'stage', stage: sid, scope: sid, warn: 5 } as Partial<Clock> : { kind: 'countdown', warn: 5 } as Partial<Clock>)
    const field = <K extends string>(k: K) => (base as Record<string, unknown>)[k]
    openForm({
      title: c ? 'Edit clock' : 'Add clock',
      fields: [
        { k: 'label', label: 'Name', full: true, placeholder: 'e.g. Curfew, Changeover, Artist home time' },
        { k: 'kind', label: 'Type', type: 'select', options: Object.entries(CLOCK_KINDS).map(([k, l]) => [k, l.replace('stage', T.stage.toLowerCase())]) },
        // Festival-wide clocks need festival-wide clocks edit; otherwise only stages you can edit.
        { k: 'scope', label: 'Belongs to', type: 'select', options: [...(access.perm('clocks') >= 2 ? [['', 'Whole festival'] as [string, string]] : []), ...editable.map(s => [s.id, s.name] as [string, string])] },
        { k: 'target', label: 'Counts down to', type: 'datetime', show: v => v.kind === 'countdown' },
        { k: 'tz', label: 'Time zone', type: 'select', options: TIME_ZONES.map(z => [z, z]), show: v => v.kind === 'tod' },
        { k: 'stage', label: 'Follows', type: 'select', options: sortStages(Object.values(snap.col.stages)).map(s => [s.id, s.name]), show: v => v.kind === 'stage' },
        { k: 'durationMin', label: 'Length in minutes (empty counts up)', type: 'number', show: v => v.kind === 'timer' },
        { k: 'warn', label: 'Warn when under (minutes)', type: 'number', show: v => v.kind !== 'tod' },
        { k: 'order', label: 'Position', type: 'number' },
      ],
      values: {
        label: base.label ?? '',
        kind: base.kind ?? 'countdown',
        scope: base.scope ?? (access.perm('clocks') >= 2 ? '' : editable[0]?.id ?? ''),
        target: (field('target') as number | undefined) ?? now() + HOUR,
        tz: (field('tz') as string | undefined) ?? tz,
        stage: (field('stage') as string | undefined) ?? sid ?? editable[0]?.id ?? '',
        durationMin: field('duration') ? String((field('duration') as number) / MIN) : '',
        warn: base.warn == null ? '' : String(base.warn),
        order: String(base.order ?? 0),
      },
      onSave: async v => {
        const kind = v.kind as ClockKind
        const common = {
          label: (v.label as string).trim(),
          scope: (v.scope as string) || null,
          warn: v.warn === '' ? undefined : Number(v.warn),
          order: v.order === '' ? 0 : Number(v.order),
        }
        let doc: DocInput<'clocks'>
        if (kind === 'countdown') {
          if (v.target == null) return 'Pick the time to count down to.'
          doc = { ...common, kind, target: v.target as number }
        } else if (kind === 'tod') {
          doc = { ...common, kind, tz: v.tz as string }
        } else if (kind === 'stage') {
          if (!v.stage) return `Pick a ${T.stage.toLowerCase()} to follow.`
          doc = { ...common, kind, stage: v.stage as string }
        } else {
          // Keep a running timer running when it is edited.
          const prev = c?.kind === 'timer' ? c : undefined
          doc = { ...common, kind, duration: v.durationMin ? Number(v.durationMin) * MIN : undefined, accum: prev?.accum ?? 0, runningSince: prev?.runningSince ?? null }
        }
        await store.set('clocks', c?.id ?? rid(), doc)
      },
      onDelete: c ? () => store.delete('clocks', c.id) : undefined,
    })
  }
}

export function Clocks({ sid }: { sid: Id | null }) {
  const snap = useSnapshot()
  const access = useAccess()
  const { tz, cfg } = useEvent()
  const t = useNow(250)
  const wall = useWallMode()
  const openClock = useClockForm(sid)
  const clocks = clocksFor(snap.col.clocks, sid, access.canSeeStage)
  const canAdd = access.canW('clocks', sid)
  // A stage's own clocks are editable by its managers; festival ones need festival-wide edit.
  const canEditClock = (c: Clock) => access.canW('clocks', c.scope ?? null) || (!!sid && c.scope === sid && canAdd)

  return (
    <>
      <Head
        title="Clocks"
        sub={sid ? `Festival-wide clocks plus ${snap.col.stages[sid]?.name}'s own. Everyone sees the same time, corrected to the server.` : 'Shared by every department, corrected to server time. Stage clocks live in each stage.'}
        actions={<>
          {canAdd && <button type="button" className="btn" onClick={() => openClock()}><Icon name="plus" />Add clock</button>}
          <button type="button" className="btn primary" onClick={wall.enter}><Icon name="wall" />Wall mode</button>
        </>}
      />
      {wall.on && (
        <div className="wallclock">
          <span className="t">{fmtTime(t, true, tz)}</span>
          <span className="e">{sid ? snap.col.stages[sid]?.name : cfg?.name}</span>
        </div>
      )}
      {clocks.length
        ? <div className="wall">{clocks.map(c => <Tile key={c.id} c={c} canEdit={canEditClock(c)} onEdit={() => openClock(c)} />)}</div>
        : <div className="panel"><p className="empty">No clocks yet.</p></div>}
      {wall.on && <button type="button" className="btn exitwall" onClick={wall.exit}>Exit full screen</button>}
    </>
  )
}
