// Data model, matching public/showctrl.html and the "Data model" section of CLAUDE.md.
// Times are epoch milliseconds. Dates are YYYY-MM-DD strings in the event time zone.

import type {
  ACCRED, ARTIST_STATUS, BOOKING_STATUS, COLLECTIONS, DEFAULT_TPL, EVENT_TYPES, FACILITY_KINDS, KINDS, LEGACY_KINDS, LOCATION_KINDS, MODULE_IDS, PLOT_KINDS, RISER_SYSTEMS, RISK_LEVELS, SCREEN_BLOCKS, TRANSFER_STATUS,
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
export type ModuleId = (typeof MODULE_IDS)[number]
export type RiskLevel = keyof typeof RISK_LEVELS
export type ScreenBlock = keyof typeof SCREEN_BLOCKS
export type PlotKind = keyof typeof PLOT_KINDS
export type RiserSystem = keyof typeof RISER_SYSTEMS
/** A deck key such as '2x1' (metres), or a legacy '8x8' (feet). */
export type RiserSize = string
export type TransferStatus = (typeof TRANSFER_STATUS)[number]
export type FacilityKind = keyof typeof FACILITY_KINDS
export type LocationKind = keyof typeof LOCATION_KINDS
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
  /** Which optional modules are on. A missing entry uses the module's default (see src/shared/modules.ts). */
  modules: Partial<Record<ModuleId, boolean>>
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
  /** Trucks module: how many trucks come in or go out with this item. */
  trucks?: number | null
  /** Trucks module: where to send them on arrival (a `locations` id). */
  dest?: Id | null
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
  /** Position in the list. */
  order: number
}

/**
 * Id is `${artistId}_${kind}`. Items are keyed by item id (not an array), so two people
 * changing different items at the same time don't overwrite each other.
 */
export interface Rider extends BaseDoc {
  artist: Id
  kind: RiderKind
  items: Record<Id, RiderItem>
  updated: Ms
}

/** Risk assessment for one performer. Id is the artist id. */
export interface Risk extends BaseDoc {
  artist: Id
  level: RiskLevel
  /** Items from RISK_FACTORS, or free text. */
  factors: string[]
  notes?: string
  /** Who assessed it, and when. */
  by?: Id | null
  at?: Ms
}

/** A place trucks are sent to: a stage's load bay, or a festival-wide staging area or truck park. */
export interface Location extends BaseDoc {
  name: string
  kind: LocationKind
  /** Stage id, or null for festival-wide. */
  stage?: Id | null
  notes?: string
  /** How many trucks it holds at once. Used to warn about clashes. */
  capacity?: number | null
}

/** A named layout for one physical monitor: production office, FOH desk, a stage's side screen. */
export interface Screen extends BaseDoc {
  name: string
  /** Stage this screen belongs to, or null for HQ. */
  scope?: Id | null
  /** Stages it follows. Empty means every stage. */
  stages: Id[]
  blocks: ScreenBlock[]
  order?: number
}

export interface InputLine {
  id: Id
  ch: number
  /** What's on the channel: Kick in, Lead vox. */
  name: string
  mic?: string
  stand?: string
  phantom?: boolean
  /** Stagebox or subsnake input. */
  box?: string
  notes?: string
}

export interface OutputLine {
  id: Id
  n: number
  /** Who or what it feeds: Vox wedge, Drum fill, IEM 1. */
  name: string
  /** Wedge, IEM, sidefill, drum fill. */
  type?: string
  notes?: string
}

/** A performer's input list and monitor mixes. Id is the artist id. */
export interface Lines extends BaseDoc {
  artist: Id
  inputs: Record<Id, InputLine>
  outputs: Record<Id, OutputLine>
  notes?: string
  updated?: Ms
}

export interface PlotItem {
  id: Id
  kind: PlotKind
  label: string
  /** Position of the item's centre in metres: from the left edge as seen from FOH (x), and from the front edge (y). */
  x: number
  y: number
  w: number
  d: number
  /** Risers: which system (default Prolyte), the deck, and the height in centimetres. */
  system?: RiserSystem
  size?: RiserSize
  height?: number
  /** Risers: on wheels, so it can be built off stage and rolled on. */
  rolling?: boolean
  /** Rotation in degrees, clockwise as drawn on the plot. */
  rot?: number
}

/** A performer's stage plot. Id is the artist id. */
export interface Plot extends BaseDoc {
  artist: Id
  items: Record<Id, PlotItem>
  /** Usable stage size in metres. */
  width?: number
  depth?: number
  notes?: string
  updated?: Ms
}

/** One riser system's stock on a stage: decks per size, and the leg heights in centimetres. */
export interface RiserSystemStock {
  decks: Record<RiserSize, number>
  heights: number[]
}

/** A stage's riser stock, per system. Id is the stage id. */
export interface RiserStock extends BaseDoc {
  stage: Id
  systems?: Partial<Record<RiserSystem, Partial<RiserSystemStock>>>
  /** Before systems: one stock, read as Prolyte. */
  decks?: Record<RiserSize, number>
  heights?: number[]
  notes?: string
}

/** A pickup or drop-off: airport, hotel, site. */
export interface Transfer extends BaseDoc {
  artist?: Id | null
  /** For people who aren't performers. */
  guest?: string
  pax: number
  from: string
  to: string
  at: Ms
  vehicle?: string
  driver?: string
  phone?: string
  status: TransferStatus
  /** The run sheet arrival or departure it serves. */
  item?: Id | null
  notes?: string
}

/** A room or space: dressing room, production office, catering. */
export interface Facility extends BaseDoc {
  name: string
  kind: FacilityKind
  /** Stage it belongs to, or null for festival-wide. */
  stage?: Id | null
  capacity?: number | null
  notes?: string
}

/** Who has a facility and when. */
export interface Allocation extends BaseDoc {
  facility: Id
  artist?: Id | null
  /** For anyone who isn't a performer: Catering crew, Press. */
  label?: string
  from: Ms
  to: Ms
  notes?: string
}

/** A document: an uploaded file or a link. Scoped to the whole event, one stage, or one performer. */
export interface FileDoc extends BaseDoc {
  name: string
  category: string
  stage?: Id | null
  artist?: Id | null
  /** A link to somewhere else (shared drive, website). */
  url?: string
  /** An uploaded file: storage key (live) or a data URL (demo), with size and type. */
  blob?: { key: string; size: number; type: string }
  by?: Id | null
  at?: Ms
  notes?: string
}

/** Per-user state that must follow the user across devices. Keyed by user id; only that user writes it. */
export interface UserPrefs extends BaseDoc {
  /** When the user last opened Messages; drives the unread badge. */
  lastRead?: Ms
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
  prefs: UserPrefs
  risks: Risk
  locations: Location
  screens: Screen
  lines: Lines
  plots: Plot
  risers: RiserStock
  transfers: Transfer
  facilities: Facility
  allocations: Allocation
  files: FileDoc
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
