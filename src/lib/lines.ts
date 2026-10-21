// Input lists: reading pasted channel lists and keeping channels in order.

import type { Id, InputLine, Lines, OutputLine } from '../types/model'
import { rid } from './id'

const PHANTOM = /^(\+?48\s*v?|phantom|p48)$/i

/**
 * A channel list pasted from a spreadsheet, PDF or email → input lines.
 * Columns split on tabs, semicolons, " | " or two or more spaces. A leading number is the
 * channel; then name, mic, stand, and anything else goes to notes. "48V" anywhere sets phantom.
 */
export function parseInputList(text: string, startCh = 1): InputLine[] {
  let next = startCh
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => !/^(ch|channel|#)\b/i.test(l)) // a header row
    .map(l => {
      const cols = l.split(/\t|;|\s\|\s|\s{2,}/).map(c => c.trim()).filter(Boolean)
      let ch = next
      const m = /^(\d{1,3})[.)]?$/.exec(cols[0] ?? '')
      if (m) { ch = Number(m[1]); cols.shift() }
      else {
        const inline = /^(\d{1,3})[.)]?\s+(.+)$/.exec(cols[0] ?? '')
        if (inline) { ch = Number(inline[1]); cols[0] = inline[2] }
      }
      next = ch + 1
      const phantom = cols.some(c => PHANTOM.test(c))
      const rest = cols.filter(c => !PHANTOM.test(c))
      return { id: rid(), ch, name: rest[0] ?? `Ch ${ch}`, mic: rest[1] ?? '', stand: rest[2] ?? '', phantom, notes: rest.slice(3).join(' · ') }
    })
}

export function sortedInputs(l: Pick<Lines, 'inputs'> | null | undefined): InputLine[] {
  return Object.values(l?.inputs ?? {}).sort((a, b) => a.ch - b.ch || a.name.localeCompare(b.name))
}

export function sortedOutputs(l: Pick<Lines, 'outputs'> | null | undefined): OutputLine[] {
  return Object.values(l?.outputs ?? {}).sort((a, b) => a.n - b.n)
}

/** Channel numbers used more than once. */
export function duplicateChannels(l: Pick<Lines, 'inputs'> | null | undefined): Set<number> {
  const seen = new Map<number, number>()
  for (const i of Object.values(l?.inputs ?? {})) seen.set(i.ch, (seen.get(i.ch) ?? 0) + 1)
  return new Set([...seen].filter(([, n]) => n > 1).map(([c]) => c))
}

export const byId = <T extends { id: Id }>(list: T[]): Record<Id, T> => Object.fromEntries(list.map(x => [x.id, x]))
