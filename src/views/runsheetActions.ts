/*
 * Everything you can do to a run sheet, as one hook: add / edit items,
 * delays, "On stage" and "Done" (with the offer to shift the rest of the
 * day), back to planned times, and generating a day sheet.
 * Callers decide who sees the buttons (canW('schedule', stage)).
 */
import { now } from '../clock/clock'
import { HOUR, KINDS, MIN, TRACKS } from '../domain/constants'
import { buildDaySheet, eff, goLive, itemsForArtist, markDone, resetDelays, rid, shiftFrom, showsFor, type ShiftOffer } from '../domain/runsheet'
import { festDay, fmtTime, fromLocal } from '../domain/time'
import { applyChanges } from '../data/apply'
import { useSnapshot, useStore } from '../data/hooks'
import { sortStages } from '../access/access'
import { useAccess } from '../session/hooks'
import type { Artist, DayKey, Id, ItemKind, RosItem } from '../types/model'
import { useForm, useToast } from '../ui/hooks'
import { useEvent } from './hooks'

export function useRunsheetActions() {
  const store = useStore()
  const snap = useSnapshot()
  const access = useAccess()
  const openForm = useForm()
  const toast = useToast()
  const { tz, T } = useEvent()

  const offer = (o?: ShiftOffer) => {
    if (o) toast(o.message, { label: o.label, run: () => applyChanges(store, o.changes) })
  }
  const stageName = (sid: Id) => snap.col.stages[sid]?.name ?? ''

  /** Add (no id) or edit an item. `day` is the day being viewed, for a new item's default time. */
  function editItem(item: Partial<RosItem>, day: DayKey, defaultStage?: Id) {
    const stages = sortStages(Object.values(snap.col.stages)).filter(s => access.canW('schedule', s.id))
    const sid = item.stage ?? defaultStage ?? stages[0]?.id
    const start = item.start ?? fromLocal(`${day}T18:00`, tz)!
    const artists = Object.values(snap.col.artists).filter(a => a.stage === sid).sort((a, b) => a.name.localeCompare(b.name))
    openForm({
      title: item.id ? 'Edit run sheet item' : 'Add to run sheet',
      fields: [
        { k: 'kind', label: 'Activity', type: 'select', options: Object.entries(KINDS).filter(([k]) => k !== 'set' && k !== 'break').map(([k, v]) => [k, `${v.label} (${TRACKS[v.track].toLowerCase()})`]) },
        { k: 'artist', label: T.performer, type: 'select', options: [['', 'None'], ...artists.map(a => [a.id, a.name] as [string, string])] },
        { k: 'title', label: `Title (empty uses the ${T.performer.toLowerCase()} name)`, full: true },
        { k: 'start', label: 'Planned start', type: 'datetime' },
        { k: 'end', label: 'Planned end', type: 'datetime' },
        { k: 'stage', label: T.stage, type: 'select', options: stages.map(s => [s.id, s.name]) },
        { k: 'notes', label: 'Notes', type: 'textarea', full: true, placeholder: 'e.g. Dock 2, two trucks, forklift needed' },
      ],
      values: {
        kind: item.kind ?? 'show', artist: item.artist ?? '', title: item.title ?? '', notes: item.notes ?? '',
        stage: sid ?? '', start, end: item.end ?? start + HOUR,
      },
      onSave: async v => {
        const kind = v.kind as ItemKind
        const s = v.start as number | null
        const e = v.end as number | null
        if (s == null || e == null) return 'Set a start and an end.'
        if (e < s) return 'The end must be after the start.'
        const artist = (v.artist as string) || undefined
        const title = (v.title as string).trim() || (artist && snap.col.artists[artist]?.name) || KINDS[kind].label
        await store.set('ros', item.id ?? rid(), {
          title, kind, stage: v.stage as string, start: s, end: e, artist, notes: (v.notes as string) || '',
          // Keep live/done state and any delay when editing.
          status: item.status ?? 'pending', delay: item.delay ?? 0, delayNote: item.delayNote ?? '',
          ...(item.actual ? { actual: item.actual } : {}), ...(item.actualEnd ? { actualEnd: item.actualEnd } : {}),
        })
      },
      onDelete: item.id ? () => store.delete('ros', item.id!) : undefined,
    })
  }

  /** "Delay": push this item and everything after it, optionally leaving the dock alone. */
  function delay(item: RosItem) {
    openForm({
      title: `Delay from ${KINDS[item.kind].label.toLowerCase()}: ${item.title}`,
      fields: [
        { k: 'min', label: 'Minutes (negative pulls earlier)', type: 'number' },
        { k: 'note', label: 'Reason', placeholder: 'e.g. Late arrival, power issue, weather' },
        { k: 'dock', label: 'Also move', type: 'checks', full: true, options: [['yes', 'Dock and backstage items (load in, load out, departures)']] },
      ],
      values: { min: '5', note: '', dock: ['yes'] },
      saveLabel: 'Apply delay',
      onSave: async v => {
        const m = Math.round(Number(v.min))
        if (!m) return 'Enter a number of minutes.'
        await applyChanges(store, shiftFrom(snap.col.ros, item, m * MIN, { note: (v.note as string) || undefined, dockToo: (v.dock as string[]).length > 0, tz }))
        toast(`Everything on ${stageName(item.stage)} from ${fmtTime(eff(item).s, false, tz)} moved ${m > 0 ? '+' : ''}${m} min.`)
      },
    })
  }

  async function start(item: RosItem) {
    const { changes, offer: o } = goLive(snap.col.ros, item, now(), tz)
    await applyChanges(store, changes)
    offer(o)
  }

  async function finish(item: RosItem) {
    const { changes, offer: o } = markDone(snap.col.ros, item, now(), tz)
    await applyChanges(store, changes)
    offer(o)
  }

  /** "Back on planned times" for a stage's day, asking first. */
  function resetDay(sid: Id, day: DayKey) {
    openForm({
      title: 'Back on planned times?',
      fields: [{ k: 'info', type: 'note', full: true, text: `Removes every delay on ${stageName(sid)} this day. Live and finished items keep their state.` }],
      values: {},
      saveLabel: 'Remove delays',
      onSave: () => applyChanges(store, resetDelays(snap.col.ros, sid, day, tz)),
    })
  }

  /**
   * Generate a day sheet from the stage's template. With `artist` it is for
   * that artist; otherwise the form asks which of the stage's artists.
   */
  function daySheet(sid: Id, day: DayKey, artist?: Artist) {
    const stage = snap.col.stages[sid]
    if (!stage) return
    const artists = Object.values(snap.col.artists).filter(a => a.stage === sid && a.status !== 'cancelled').sort((a, b) => a.name.localeCompare(b.name))
    if (!artist && !artists.length) {
      toast(`Add a ${T.performer.toLowerCase()} to ${stage.name} first.`)
      return
    }
    const first = artist ?? artists[0]
    const existing = showsFor(snap.col.ros, first.id)[0]
    openForm({
      title: artist ? `Day sheet · ${artist.name}` : 'Generate a day sheet',
      fields: [
        ...(artist ? [] : [{ k: 'artist', label: T.performer, type: 'select' as const, full: true, options: artists.map(a => [a.id, a.name] as [string, string]) }]),
        { k: 'start', label: 'On stage', type: 'datetime' },
        { k: 'len', label: 'Show length (minutes)', type: 'number' },
        { k: 'sc', label: 'Soundcheck (optional)', type: 'datetime' },
        { k: 'replace', label: 'Replace', type: 'checks', full: true, options: [['yes', `Replace this ${T.performer.toLowerCase()}'s existing items that day`]] },
        { k: 'info', type: 'note', full: true, text: `Uses ${stage.name}'s template: arrival, get in, load in, ${T.stage.toLowerCase()} access, changeover, show, load out and departure. You can adjust each item afterwards.` },
      ],
      values: {
        artist: first.id,
        start: existing?.start ?? fromLocal(`${day}T20:00`, tz),
        len: String(existing ? Math.round((existing.end - existing.start) / MIN) : 60),
        sc: null,
        replace: existing ? ['yes'] : [],
      },
      saveLabel: 'Create day sheet',
      onSave: async v => {
        const a = artist ?? snap.col.artists[v.artist as string]
        const s = v.start as number | null
        const len = Number(v.len)
        if (!a) return `Pick a ${T.performer.toLowerCase()}.`
        if (s == null || !len) return 'Set the on-stage time and show length.'
        const items = buildDaySheet(stage, a, s, s + len * MIN, (v.sc as number | null) || null)
        if ((v.replace as string[]).length) {
          for (const x of itemsForArtist(snap.col.ros, a.id).filter(x => festDay(x.start, tz) === festDay(s, tz))) await store.delete('ros', x.id)
        }
        await store.setMany('ros', items)
        toast(`Day sheet created for ${a.name}: ${items.length} items.`)
      },
    })
  }

  return { editItem, delay, start, finish, resetDay, daySheet }
}
