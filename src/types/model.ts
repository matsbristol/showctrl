/*
 * showctrl data model, ported from public/showctrl.html (schema 2).
 *
 * All records live in collections keyed by id. Times are epoch milliseconds;
 * dates are `YYYY-MM-DD` strings in the event time zone.
 */

export type Id = string
/** Epoch milliseconds. */
export type Ms = number
/** `YYYY-MM-DD` in the event time zone. */
export type DayKey = string
/** IANA time zone, e.g. `Europe/Oslo`. */
export type TimeZone = string

export type TapeColor =
  | 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
  | 'pink' | 'teal' | 'brown' | 'grey' | 'white'

/* ---------------- config ---------------- */

export type EventType = 'festival' | 'concert' | 'conference' | 'theatre' | 'corporate' | 'sport'

/** UI vocabulary, so a conference shows "Speakers / Rooms" instead of "Artists / Stages". */
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

export type ModuleId = 'accommodation' | 'riders'

/** `config/event` */
export interface EventConfig {
  schema: 2
  name: string
  type: EventType
  tz: TimeZone
  start: DayKey
  end: DayKey
  visitors?: number
  terms: Terms
  modules: Partial<Record<ModuleId, boolean>>
  depts: Dept[]
}

export type PermKey =
  | 'show' | 'schedule' | 'artists' | 'personnel' | 'clocks' | 'messages'
  | 'accommodation' | 'riders_tech' | 'riders_hosp' | 'admin'

/** 0 none, 1 view, 2 edit */
export type Level = 0 | 1 | 2

export interface RoleDef {
  label: string
  perms: Record<PermKey, Level>
  /** May see artist contact details. */
  contacts: boolean
  /** Built-in role that cannot be edited or deleted. */
  locked?: boolean
}

/** Festival role key → definition. Keys include `admin` and `none`. */
export type Roles = Record<string, RoleDef>

/** `config/roles` */
export interface RolesConfig {
  roles: Roles
}

/* ---------------- stages and artists ---------------- */

/** Day sheet offsets in minutes, relative to show start or end. */
export interface DaySheetTemplate {
  arrival: number
  getin: number
  loadin: number
  loadinDur: number
  access: number
  changeover: number
  loadoutAfter: number
  loadoutDur: number
  departure: number
  soundcheckDur: number
}

export interface Stage {
  id: Id
  name: string
  tape: TapeColor
  order: number
  location?: string
  radio?: string
  capacity?: number
  template?: Partial<DaySheetTemplate>
}

export type ArtistStatus =
  | 'confirmed' | 'travelling' | 'arrived' | 'backstage'
  | 'ready' | 'on stage' | 'done' | 'cancelled'

export interface ArtistContact {
  id: Id
  role: string
  name: string
  phone?: string
  email?: string
  note?: string
}

export interface Artist {
  id: Id
  name: string
  stage?: Id
  status: ArtistStatus
  genre?: string
  party?: number
  /** Home time zone. */
  home?: TimeZone
  vehicles?: string
  notes?: string
  contacts: ArtistContact[]
}

/* ---------------- run sheet ---------------- */

export type ItemKind =
  | 'arrival' | 'getin' | 'loadin' | 'access' | 'soundcheck' | 'linecheck'
  | 'changeover' | 'show' | 'loadout' | 'departure' | 'doors' | 'curfew'
  | 'meeting' | 'other'
  /** Legacy kinds from schema 1 data; treated as show and an on-stage break. */
  | 'set' | 'break'

export type Track = 'stage' | 'dock'

export type ItemStatus = 'pending' | 'live' | 'done'

/** `ros`: one run sheet item. */
export interface RosItem {
  id: Id
  stage: Id
  artist?: Id
  kind: ItemKind
  title: string
  start: Ms
  /** Equal to `start` for a point in time (doors, curfew, stage access). */
  end: Ms
  status: ItemStatus
  /** Added to both start and end. */
  delay: Ms
  delayNote?: string
  notes?: string
  /** When it actually went live / finished. */
  actual?: Ms
  actualEnd?: Ms
}

/* ---------------- people and access ---------------- */

export type Accred = 'AAA' | 'Production' | 'Stage' | 'Backstage' | 'Artist' | 'Site' | 'Day pass'

/** `people`: the personnel / contact list. Separate from app users. */
export interface Person {
  id: Id
  name: string
  title?: string
  company?: string
  dept?: Id
  /** Stage ids; empty means HQ. */
  stages: Id[]
  phone?: string
  email?: string
  accred?: Accred
  /** Key contact. */
  lead?: boolean
  notes?: string
}

export type StageRole = 'manager' | 'crew'

/** `members`: app users, keyed by user id. */
export interface Member {
  id: Id
  /** Display name (demo mode; live mode gets names from the user profile). */
  name?: string
  /** Festival role key in `config/roles`. */
  role: string
  /** Stages this user manages. Crew is stored in `stageteam` instead. */
  stages: Record<Id, 'manager'>
  /** Linked `people` id. */
  person?: Id | null
  depts: Id[]
}

/** `stageteam`: one doc per stage, id = stage id. Written by that stage's managers. */
export interface StageTeam {
  id: Id
  crew: Record<Id, true>
}

/** `requests`: keyed by user id. A person without access asks to join. */
export interface JoinRequest {
  id: Id
  at: Ms
  note: string
  stage?: Id
  /** Live mode: who is asking, since they have no member record yet. */
  name?: string
  email?: string
}

/* ---------------- clocks ---------------- */

interface ClockBase {
  id: Id
  label: string
  /** Stage id, or null / absent for festival-wide. */
  scope?: Id | null
  /** Warn this many minutes before zero. */
  warn?: number
  order?: number
}

export interface TimeOfDayClock extends ClockBase {
  kind: 'tod'
  tz?: TimeZone
}

export interface CountdownClock extends ClockBase {
  kind: 'countdown'
  target: Ms
}

export interface TimerClock extends ClockBase {
  kind: 'timer'
  /** Counts down from this if set, otherwise counts up. */
  duration?: Ms
  accum: Ms
  runningSince: Ms | null
}

export interface StageClock extends ClockBase {
  kind: 'stage'
  stage: Id
}

export type Clock = TimeOfDayClock | CountdownClock | TimerClock | StageClock
export type ClockKind = Clock['kind']

/* ---------------- messages ---------------- */

export type MsgTarget =
  | { t: 'all' }
  | { t: 'stage' | 'dept' | 'user'; id: Id }

export interface Msg {
  id: Id
  /** User id. */
  from: Id
  to: MsgTarget
  text: string
  pri: 'normal' | 'urgent'
  at: Ms
  /** User id → when they acknowledged. */
  acks: Record<Id, Ms>
}

/* ---------------- accommodation ---------------- */

export interface Hotel {
  id: Id
  name: string
  address?: string
  contact?: string
  phone?: string
  /** Rooms held per night. */
  block?: number
  notes?: string
}

export type BookingStatus = 'requested' | 'held' | 'confirmed' | 'checked in' | 'checked out' | 'cancelled'

export interface Booking {
  id: Id
  /** Either an artist, or a named guest. */
  artist?: Id
  guest?: string
  guestRole?: string
  hotel: Id
  checkIn: DayKey
  checkOut: DayKey
  rooms: number
  roomType?: string
  status: BookingStatus
  conf?: string
  notes?: string
}

/* ---------------- riders ---------------- */

export type RiderKind = 'tech' | 'hosp'
export type RiderItemStatus = 'requested' | 'agreed' | 'sourced' | 'declined'

export interface RiderItem {
  id: Id
  text: string
  dept?: Id
  status: RiderItemStatus
}

/** `riders`: id = `${artistId}_${kind}`. */
export interface Rider {
  id: Id
  artist: Id
  kind: RiderKind
  items: RiderItem[]
  updated: Ms
}

/* ---------------- collections ---------------- */

/** Collection name → document type. */
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
  requests: JoinRequest
  people: Person
  stageteam: StageTeam
}

export type CollectionName = keyof Collections

export type CollectionMap = { [K in CollectionName]: Record<Id, Collections[K]> }

/** Everything the client holds in memory. */
export interface Snapshot {
  cfg: EventConfig | null
  roles: Roles
  col: CollectionMap
}
