// What Claude returns when it reads pasted text for Admin → Import. The Worker asks for exactly
// this shape (structured output) and checks it again before sending it on; the client turns it
// into a plan of new and updated records (src/lib/importPlan.ts).
//
// Every field is required and "unknown" is null, so the model never has to guess.

import * as z from 'zod/v4'
import { KINDS } from '../types/constants'

const str = z.string()
const opt = z.string().nullable()
/** YYYY-MM-DD: the calendar date the time happens on. */
const date = z.string()
/** HH:MM, 24-hour, in the event's time zone. */
const time = z.string()

export const ImportSchema = z.object({
  stages: z.array(z.object({ name: str, location: opt, radio: opt })),
  artists: z.array(z.object({
    name: str,
    stage: opt,
    genre: opt,
    party: z.number().nullable(),
    notes: opt,
    contacts: z.array(z.object({ role: str, name: str, phone: opt, email: opt })),
    shows: z.array(z.object({ date, start: time, end: time.nullable(), soundcheck: time.nullable() })),
  })),
  items: z.array(z.object({
    stage: opt,
    artist: opt,
    kind: z.enum(Object.keys(KINDS) as [keyof typeof KINDS, ...(keyof typeof KINDS)[]]),
    title: str,
    date,
    start: time,
    end: time.nullable(),
  })),
  people: z.array(z.object({
    name: str, title: opt, company: opt, dept: opt, phone: opt, email: opt, accred: opt, stages: z.array(str),
  })),
  hotels: z.array(z.object({ name: str, address: opt, phone: opt, contact: opt })),
  bookings: z.array(z.object({
    hotel: str, artist: opt, guest: opt, checkIn: date, checkOut: date, rooms: z.number(),
  })),
  leftover: str,
})

export type ImportResult = z.infer<typeof ImportSchema>

/** What the event already has, so the model can match names and dates. */
export interface ImportContext {
  name: string
  type: string
  tz: string
  start?: string
  end?: string
  stages: string[]
  artists: string[]
  depts: string[]
  accred: string[]
  hotels: string[]
}

