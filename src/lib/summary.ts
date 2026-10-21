// Technical summary: one row per show, with everything production asks about that act.
// Used by the summary page and its CSV export, so both always agree.

import { KINDS } from '../types/constants'
import type { Artist, Id, Lines, Location, Ms, Plot, Risk, RiskLevel, RosItem, RosKind, Stage, TimeZone } from '../types/model'
import { eff } from './runsheet'
import { festDay, fmtTime } from './time'

export interface SummaryTime { kind: RosKind; start: Ms; end: Ms; delayed: boolean }

export interface SummaryRow {
  show: RosItem
  artist: Artist
  stage: Stage | undefined
  day: string
  /** Key times of that act's day (same show day), in order. */
  times: SummaryTime[]
  party: number | null
  vehicles: string
  loadIn: { trucks: number; dest: string } | null
  loadOut: { trucks: number; dest: string } | null
  contact: { name: string; role: string; phone?: string } | null
  inputs: number
  outputs: number
  risers: string
  risk: RiskLevel | null
}

/** Kinds worth showing in the summary's schedule column. */
const KEY_KINDS: RosKind[] = ['arrival', 'getin', 'loadin', 'access', 'soundcheck', 'linecheck', 'changeover', 'show', 'loadout', 'departure']

export interface SummaryInput {
  ros: Readonly<Record<Id, RosItem>>
  artists: Readonly<Record<Id, Artist>>
  stages: Readonly<Record<Id, Stage>>
  lines: Readonly<Record<Id, Lines>>
  plots: Readonly<Record<Id, Plot>>
  risks: Readonly<Record<Id, Risk>>
  locations: Readonly<Record<Id, Location>>
  tz: TimeZone
  /** Whether contact details may be shown for this act. */
  contacts: (a: Artist) => boolean
}

export function riserText(plot: Plot | undefined): string {
  const r = Object.values(plot?.items ?? {}).filter(i => i.kind === 'riser')
  if (!r.length) return ''
  const by = new Map<string, number>()
  for (const i of r) { const k = `${i.size ?? '?'}${i.height ? ` @ ${i.height} cm` : ''}${i.rolling ? ' rolling' : ''}`; by.set(k, (by.get(k) ?? 0) + 1) }
  return [...by].map(([k, n]) => `${n} × ${k}`).join(', ')
}

export function buildSummary(x: SummaryInput, filter: { day?: string; stage?: Id | null; q?: string } = {}): SummaryRow[] {
  const items = Object.values(x.ros)
  return items
    .filter(i => i.kind === 'show' && i.artist && x.artists[i.artist])
    .filter(i => (!filter.stage || i.stage === filter.stage) && (!filter.day || festDay(i.start, x.tz) === filter.day))
    .filter(i => !filter.q || x.artists[i.artist!].name.toLowerCase().includes(filter.q.toLowerCase()))
    .sort((a, b) => eff(a).s - eff(b).s)
    .map(show => {
      const artist = x.artists[show.artist!]
      const day = festDay(show.start, x.tz)
      const mine = items.filter(i => i.artist === artist.id && festDay(i.start, x.tz) === day).sort((a, b) => eff(a).s - eff(b).s)
      const load = (k: 'loadin' | 'loadout') => {
        const it = mine.find(i => i.kind === k && (i.trucks ?? 0) > 0)
        return it ? { trucks: it.trucks!, dest: it.dest ? x.locations[it.dest]?.name ?? '' : '' } : null
      }
      const c = x.contacts(artist) ? artist.contacts?.[0] : undefined
      const ln = x.lines[artist.id]
      return {
        show, artist, stage: x.stages[show.stage], day,
        times: mine.filter(i => KEY_KINDS.includes(i.kind as RosKind)).map(i => ({ kind: i.kind as RosKind, start: eff(i).s, end: eff(i).e, delayed: !!i.delay })),
        party: artist.party ?? null,
        vehicles: artist.vehicles ?? '',
        loadIn: load('loadin'),
        loadOut: load('loadout'),
        contact: c ? { name: c.name, role: c.role, phone: c.phone } : null,
        inputs: Object.keys(ln?.inputs ?? {}).length,
        outputs: Object.keys(ln?.outputs ?? {}).length,
        risers: riserText(x.plots[artist.id]),
        risk: x.risks[artist.id]?.level ?? null,
      }
    })
}

/** RFC 4180 CSV: quotes when needed, CRLF line ends, so it opens cleanly in Excel and Numbers. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map(r => r.map(cell).join(',')).join('\r\n')
}

export function summaryCsv(rows: SummaryRow[], tz: TimeZone): string {
  const t = (r: SummaryRow, k: RosKind) => {
    const x = r.times.find(i => i.kind === k)
    return x ? (x.end - x.start >= 5 * 60_000 ? `${fmtTime(x.start, tz)}-${fmtTime(x.end, tz)}` : fmtTime(x.start, tz)) : ''
  }
  const head = ['Act', 'Stage', 'Day', ...KEY_KINDS.map(k => KINDS[k].label), 'Party', 'Vehicles', 'Load in trucks', 'Load in to', 'Load out trucks', 'Load out from', 'Main contact', 'Role', 'Phone', 'Inputs', 'Outputs', 'Risers', 'Risk']
  return toCsv([
    head,
    ...rows.map(r => [
      r.artist.name, r.stage?.name, r.day, ...KEY_KINDS.map(k => t(r, k)), r.party, r.vehicles,
      r.loadIn?.trucks, r.loadIn?.dest, r.loadOut?.trucks, r.loadOut?.dest,
      r.contact?.name, r.contact?.role, r.contact?.phone, r.inputs || '', r.outputs || '', r.risers, r.risk ?? '',
    ]),
  ])
}
