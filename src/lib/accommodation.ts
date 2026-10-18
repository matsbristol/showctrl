// Accommodation helpers, ported from the prototype's Accommodation view.

import type { Booking, DayKey, Id } from '../types/model'
import { addDays } from './time'

/** Every night from `a` up to (not including) `b`, max 60. */
export function nightsBetween(a: DayKey, b: DayKey): DayKey[] {
  const out: DayKey[] = []
  for (let k = a, i = 0; i < 60 && k < b; i++, k = addDays(k, 1)) out.push(k)
  return out
}

/** Whether a booking covers the night of `night`. */
export const coversNight = (b: Pick<Booking, 'checkIn' | 'checkOut'>, night: DayKey) => b.checkIn <= night && b.checkOut > night

/** Rooms booked at a hotel on a night, ignoring cancelled bookings. */
export function roomsUsed(bookings: Booking[], hotelId: Id, night: DayKey): number {
  return bookings
    .filter(b => b.hotel === hotelId && b.status !== 'cancelled' && coversNight(b, night))
    .reduce((s, b) => s + (Number(b.rooms) || 1), 0)
}

/** The nights to show: the event days plus one either side. */
export function eventNights(days: DayKey[], today: DayKey): DayKey[] {
  const first = days[0] ?? today
  const last = days[days.length - 1] ?? today
  return nightsBetween(addDays(first, -1), addDays(last, 1))
}
