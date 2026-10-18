// Turns a pasted crew list (from a spreadsheet, email or chat) into personnel records.
// One person per line. Columns split on tab, semicolon or comma.
// The first column is the name; a phone number and an email are recognised anywhere;
// the remaining columns are job title, then company.

import type { Id, Person } from '../types/model'
import { rid } from './id'

const PHONE = /^\+?[\d\s()-]{6,}$/
const EMAIL = /@/

export function parseCrewList(text: string, opts: { dept?: Id | null; stage?: Id | null } = {}): Person[] {
  return text
    .split('\n')
    .map(l => l.split(/\t|;|,(?=\s*\S)/).map(x => x.trim()))
    .filter(r => r[0])
    .map(r => {
      const phone = r.slice(1).find(x => PHONE.test(x)) ?? ''
      const email = r.slice(1).find(x => EMAIL.test(x)) ?? ''
      const rest = r.slice(1).filter(x => x && x !== phone && x !== email)
      return {
        id: rid(), name: r[0], title: rest[0] ?? '', company: rest[1] ?? '', phone, email,
        dept: opts.dept || null, stages: opts.stage ? [opts.stage] : [],
        ...(opts.stage ? { accred: 'Stage' as const } : {}), lead: false, notes: '',
      }
    })
}
