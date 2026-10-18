// Data model, matching public/showctrl.html and the "Data model" section of CLAUDE.md.
// Times are epoch milliseconds. Dates are YYYY-MM-DD strings in the event time zone.

import type {
  ACCRED, ARTIST_STATUS, BOOKING_STATUS, COLLECTIONS, DEFAULT_TPL, EVENT_TYPES, KINDS, LEGACY_KINDS,
  MSG_PRIORITY, PERM_KEYS, RIDER_KINDS, RIDER_STATUS, ROS_STATUS, STAGE_ROLES, TAPE, TRACKS,
} from './constants'

export type Id = string
/** Epoch milliseconds. */
export type Ms = number
/** YYYY-MM-DD in the event time zone. */
export type DayKey = string
/** IANA time zone, e.g. Europe/Oslo. */
export type TimeZone = string

export type TapeColor = keyof typeof TAPE
export type EventType = keyof typeof EVENT_TYPES
export type PermKey = (typeof PERM_KEYS)[number]['key']
export type PermLevel = 0 | 1 | 2
export type StageRole = keyof typeof STAGE_ROLES
export type Accred = (typeof ACCRED)[number]
export type Track = keyof typeof TRACKS
export type RosKind = keyof typeof KINDS
export type LegacyRosKind = keyof typeof LEGACY_KINDS
export type RosStatus = (typeof ROS_STATUS)[number]
export type ArtistStatus = (typeof ARTIST_STATUS)[number]
export type BookingStatus = (typeof BOOKING_STATUS)[number]
export type RiderStatus = (typeof RIDER_STATUS)[number]
export type RiderKind = (typeof RIDER_KINDS)[number]
export type MsgPriority = (typeof MSG_PRIORITY)[number]
export type DayTemplate = { [K in keyof typeof DEFAULT_TPL]: number }

/** Omit that keeps union members apart, so Omit<Clock, 'id'> still knows each kind's fields. */
export type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** Every record carries its id, which is also its key in the collection. */
export interface BaseDoc {
  id: Id
}

/* ---------- config ---------- */

export interface Terms {
  performer: string
  performers: string
  stage: string
  stages: string
}

export interface Dept {
  id: Id
  name: string
  tape: TapeColor
}

/** `config/event` */
export interface EventConfig {
  schema: 2
  name: string
  type: EventType
  tz: TimeZone
  start: DayKey
  end: DayKey
  visitors?: number | null
  terms: Terms
  /** A module is on unless set to false. */
  modules: { accommodation?: boolean; riders?: boolean }
  depts: Dept[]
}

export interface RoleDef {
  label: string
  perms: Record<PermKey, PermLevel>
  /** Can see artist contact details. */
  contacts: boolean
  /** Cannot be edited or deleted (admin, none). */
  locked?: boolean
}

/** `config/roles`. Keys are role ids: admin, pm, liaison, hosp, tech, site, none, or custom `r…` ids. */
export interface RolesConfig {
  roles: Record<string, RoleDef>
}

/* ---------- collections ---------- */

export interface Stage extends BaseDoc {
  name: string
  tape: TapeColor
  order: number
  location?: string
  /** Radio channel. */
  radio?: string
  capacity?: number | null
  /** Day sheet offsets; missing keys fall back to DEFAULT_TPL. */
  template?: Partial<DayTemplate>
}

export interface ArtistContact {
  id: Id
  /** Usually one of CONTACT_ROLES, but free text is allowed. */
  role: string
  name: string
  phone?: string
  email?: string
  note?: string
}

export interface Artist extends BaseDoc {
  name: string
  stage: Id
  status: ArtistStatus
  genre?: string
  /** Travelling party, in people. */
  party?: number | null
  /** Home time zone. Empty string means not set. */
  home?: TimeZone | ''
  vehicles?: string
  notes?: string
  contacts: ArtistContact[]
}

/** A run sheet item. `delay` is added to both start and end. */
export interface RosItem extends BaseDoc {
  stage: Id
  artist?: Id | null
  kind: RosKind | LegacyRosKind
  title: string
  start: Ms
  /** Equal to start for a point in time (stage access, doors, curfew). */
  end: Ms
  status: RosStatus
  delay: number
  delayNote?: string
  notes?: string
  /** When the item actually went live. */
  actual?: Ms
  /** When the item was actually marked done. */
  actualEnd?: Ms
}

/** A personnel record. Separate from app users (members). */
export interface Person extends BaseDoc {
  name: string
  title?: string
  company?: string
  dept?: Id | null
  /** Stage ids. Empty means HQ. */
  stages: Id[]
  phone?: string
  email?: string
  accred?: Accred
  /** Key contact. */
  lead: boolean
  notes?: string
}

/** An app user, keyed by user id. */
export interface Member extends BaseDoc {
  /** Festival role key in RolesConfig.roles. */
  role: string
  /** Stage manager appointments. */
  stages: Record<Id, 'manager'>
  /** Linked personnel record. */
  person?: Id | null
  depts: Id[]
  /** Fallback display name when no person is linked. */
  name?: string
}

/** One doc per stage, keyed by stage id. Written by that stage's managers. */
export interface StageTeam extends BaseDoc {
  crew: Record<Id, true>
}

/** A person without access asking to join. Keyed by user id. */
export interface AccessRequest extends BaseDoc {
  at: Ms
  note: string
  stage?: Id | null
}

interface ClockBase extends BaseDoc {
  label: string
  /** Stage id, or null for festival-wide. */
  scope?: Id | null
  order?: number
  /** Warn when under this many minutes. */
  warn?: number | null
  /** Department colour for festival-wide clocks. */
  dept?: Id | null
}

export interface TodClock extends ClockBase {
  kind: 'tod'
  tz?: TimeZone
}

export interface CountdownClock extends ClockBase {
  kind: 'countdown'
  target: Ms
}

export interface TimerClock extends ClockBase {
  kind: 'timer'
  /** Length in ms. Null counts up. */
  duration?: number | null
  /** Elapsed ms from earlier runs. */
  accum: number
  /** Set while running. */
  runningSince: Ms | null
}

export interface StageClock extends ClockBase {
  kind: 'stage'
  /** The stage whose now and next it follows. */
  stage: Id
}

export type Clock = TodClock | CountdownClock | TimerClock | StageClock
export type ClockKind = Clock['kind']

export type MsgTarget =
  | { t: 'all' }
  | { t: 'stage'; id: Id }
  | { t: 'dept'; id: Id }
  | { t: 'user'; id: Id }

export interface Msg extends BaseDoc {
  /** Sender user id. */
  from: Id
  to: MsgTarget
  text: string
  pri: MsgPriority
  at: Ms
  /** User id → when they acknowledged. */
  acks: Record<Id, Ms>
}

export interface Hotel extends BaseDoc {
  name: string
  address?: string
  contact?: string
  phone?: string
  /** Rooms held per night. */
  block: number
  notes?: string
}

/** A room booking, either for an artist or for a named guest. */
export interface Booking extends BaseDoc {
  artist?: Id | null
  guest?: string
  /** e.g. Crew, Press, VIP */
  guestRole?: string
  hotel: Id
  checkIn: DayKey
  checkOut: DayKey
  rooms: number
  roomType?: string
  status: BookingStatus
  /** Confirmation reference. */
  conf?: string
  notes?: string
}

export interface RiderItem {
  id: Id
  text: string
  dept?: Id | null
  status: RiderStatus
}

/** Id is `${artistId}_${kind}`. */
export interface Rider extends BaseDoc {
  artist: Id
  kind: RiderKind
  items: RiderItem[]
  updated: Ms
}

/** Collection name → record type. Drives every data layer call. */
export interface Collections {
  clocks: Clock
  stages: Stage
  artists: Artist
  ros: RosItem
  msgs: Msg
  hotels: Hotel
  bookings: Booking
  riders: Rider
  members: Member
  requests: AccessRequest
  people: Person
  stageteam: StageTeam
}

export type CollectionName = keyof Collections

export interface ConfigDocs {
  event: EventConfig
  roles: RolesConfig
}

export type ConfigName = keyof ConfigDocs

// Compile-time check that COLLECTIONS lists exactly the keys of Collections.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T
export type CollectionsListIsComplete = Assert<Exact<(typeof COLLECTIONS)[number], CollectionName>>
