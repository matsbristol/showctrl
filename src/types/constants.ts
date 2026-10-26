// Constants ported from public/showctrl.html. The literal types in model.ts are
// derived from these, so a value and its type cannot drift apart.

import type { Dept, PermKey, PermLevel, RoleDef, Terms } from './model'

export const SCHEMA_VERSION = 2
export const MIN = 60_000
export const HOUR = 3_600_000
/** A show day runs until 06:00 the next morning. */
export const FEST_DAY_OFFSET = 6 * HOUR
export const DEFAULT_TZ = 'Europe/Oslo'

/** Spike-tape colours used for stages and departments. */
export const TAPE = {
  red: '#D93A3A',
  blue: '#2F6FE0',
  yellow: '#E3B000',
  green: '#2E9E57',
  orange: '#EE7A1F',
  purple: '#8A4FD3',
  pink: '#DB4E95',
  teal: '#16999A',
  brown: '#8B5E3C',
  grey: '#6B7586',
  white: '#D9DEE6',
} as const

/** Festival-wide permission keys, in display order. */
export const PERM_KEYS = [
  { key: 'show', label: 'Festival overview' },
  { key: 'schedule', label: 'Running order' },
  { key: 'artists', label: 'Artists' },
  { key: 'technical', label: 'Technical' },
  { key: 'risk', label: 'Risk assessment' },
  { key: 'personnel', label: 'Personnel' },
  { key: 'clocks', label: 'Clocks & screens' },
  { key: 'messages', label: 'Messages' },
  { key: 'transport', label: 'Transport' },
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'facilities', label: 'Facilities' },
  { key: 'riders_tech', label: 'Technical riders' },
  { key: 'riders_hosp', label: 'Hospitality riders' },
  { key: 'documents', label: 'Documents' },
  { key: 'admin', label: 'Admin' },
] as const

export const LEVELS = ['No access', 'View', 'Edit'] as const

/** A role's levels: anything not listed is 0 (no access). */
function perms(levels: Partial<Record<PermKey, PermLevel>>, all?: PermLevel): Record<PermKey, PermLevel> {
  return Object.fromEntries(PERM_KEYS.map(({ key }) => [key, levels[key] ?? all ?? 0])) as Record<PermKey, PermLevel>
}

export const DEFAULT_ROLES: Record<string, RoleDef> = {
  admin: { label: 'Festival admin', perms: perms({}, 2), contacts: true, locked: true },
  pm: { label: 'Production manager', perms: perms({ admin: 1 }, 2), contacts: true },
  liaison: {
    label: 'Artist liaison', contacts: true,
    perms: perms({ show: 1, schedule: 1, artists: 2, technical: 1, risk: 1, personnel: 1, clocks: 1, messages: 1, transport: 2, accommodation: 2, facilities: 2, riders_tech: 2, riders_hosp: 2, documents: 1 }),
  },
  hosp: {
    label: 'Hospitality', contacts: false,
    perms: perms({ show: 1, schedule: 1, artists: 1, risk: 1, personnel: 1, clocks: 1, messages: 2, transport: 2, accommodation: 1, facilities: 2, riders_hosp: 2, documents: 1 }),
  },
  tech: {
    label: 'Technical production', contacts: false,
    perms: perms({ show: 1, schedule: 1, artists: 1, technical: 2, risk: 1, personnel: 1, clocks: 2, messages: 2, accommodation: 1, facilities: 1, riders_tech: 2, documents: 1 }),
  },
  site: {
    label: 'Site & security', contacts: false,
    perms: perms({ show: 1, schedule: 1, artists: 1, technical: 1, risk: 2, personnel: 1, clocks: 1, messages: 2, transport: 1, facilities: 2, documents: 1 }),
  },
  none: { label: 'Stage access only', perms: perms({}), contacts: false, locked: true },
}

export const STAGE_ROLES = { manager: 'Stage manager', crew: 'Stage crew' } as const

/** What a stage-level role adds, for that stage only. `setup` opens Stage setup. */
export const STAGE_LV: Record<keyof typeof STAGE_ROLES, Partial<Record<PermKey | 'setup', PermLevel>>> = {
  manager: {
    show: 1, schedule: 2, artists: 2, technical: 2, risk: 2, personnel: 2, clocks: 2, messages: 2, transport: 1,
    accommodation: 1, facilities: 1, riders_tech: 2, riders_hosp: 2, documents: 2, setup: 2,
  },
  crew: { show: 1, schedule: 1, artists: 1, technical: 1, risk: 1, personnel: 1, clocks: 1, messages: 2, facilities: 1, riders_tech: 1, documents: 1 },
}

/** Accreditation levels an event starts with. Each event can change its list (config/event.accred). */
export const ACCRED = ['AAA', 'Production', 'Stage', 'Backstage', 'Artist', 'Site', 'Day pass'] as const

const MUSIC_TERMS: Terms = { performer: 'Artist', performers: 'Artists', stage: 'Stage', stages: 'Stages' }

/** Event types and the vocabulary each one uses in the UI. */
export const EVENT_TYPES = {
  festival: { label: 'Music festival', terms: MUSIC_TERMS },
  concert: { label: 'Concert / tour date', terms: MUSIC_TERMS },
  conference: { label: 'Conference', terms: { performer: 'Speaker', performers: 'Speakers', stage: 'Room', stages: 'Rooms' } },
  theatre: { label: 'Theatre / performance', terms: { performer: 'Company', performers: 'Companies', stage: 'Stage', stages: 'Stages' } },
  corporate: { label: 'Corporate event', terms: { performer: 'Presenter', performers: 'Presenters', stage: 'Room', stages: 'Rooms' } },
  sport: { label: 'Sports event', terms: { performer: 'Team', performers: 'Teams', stage: 'Arena', stages: 'Arenas' } },
} as const satisfies Record<string, { label: string; terms: Terms }>

export const TZS = [
  'Europe/Oslo', 'Europe/Stockholm', 'Europe/Copenhagen', 'Europe/London', 'Europe/Berlin', 'Europe/Madrid',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney', 'UTC',
] as const

export const TRACKS = { stage: 'On stage', dock: 'Dock & backstage' } as const

/** Run sheet item kinds. The track decides which timeline lane an item sits in. */
export const KINDS = {
  arrival: { label: 'Arrival', track: 'dock' },
  getin: { label: 'Get in', track: 'dock' },
  loadin: { label: 'Load in', track: 'dock' },
  access: { label: 'Stage access', track: 'stage' },
  soundcheck: { label: 'Soundcheck', track: 'stage' },
  linecheck: { label: 'Line check', track: 'stage' },
  changeover: { label: 'Changeover', track: 'stage' },
  show: { label: 'Show', track: 'stage' },
  loadout: { label: 'Load out', track: 'dock' },
  departure: { label: 'Departure', track: 'dock' },
  doors: { label: 'Doors', track: 'stage' },
  curfew: { label: 'Curfew', track: 'stage' },
  meeting: { label: 'Meeting', track: 'dock' },
  other: { label: 'Other', track: 'stage' },
} as const satisfies Record<string, { label: string; track: keyof typeof TRACKS }>

/** Kinds older prototype data may still hold. Readable, but not offered for new items. */
export const LEGACY_KINDS = {
  set: { label: 'Show', track: 'stage' },
  break: { label: 'Break', track: 'stage' },
} as const satisfies Record<string, { label: string; track: keyof typeof TRACKS }>

/** Day sheet template, in minutes relative to show start (negative) or show end. */
export const DEFAULT_TPL = {
  arrival: -240,
  getin: -180,
  loadin: -120,
  loadinDur: 45,
  access: -45,
  changeover: 30,
  loadoutAfter: 15,
  loadoutDur: 45,
  departure: 150,
  soundcheckDur: 45,
} as const

export const TPL_FIELDS = [
  ['arrival', 'Arrival (min before show)'],
  ['getin', 'Get in (min before show)'],
  ['loadin', 'Load in starts (min before show)'],
  ['loadinDur', 'Load in length (min)'],
  ['access', 'Stage access (min before show)'],
  ['changeover', 'Changeover length (min)'],
  ['loadoutAfter', 'Load out starts (min after show)'],
  ['loadoutDur', 'Load out length (min)'],
  ['departure', 'Departure (min after show)'],
  ['soundcheckDur', 'Soundcheck length (min)'],
] as const

export const ARTIST_STATUS = ['confirmed', 'travelling', 'arrived', 'backstage', 'ready', 'on stage', 'done', 'cancelled'] as const
export const ROS_STATUS = ['pending', 'live', 'done'] as const
export const BOOKING_STATUS = ['requested', 'held', 'confirmed', 'checked in', 'checked out', 'cancelled'] as const
export const RIDER_STATUS = ['requested', 'agreed', 'sourced', 'declined'] as const
export const RIDER_KINDS = ['tech', 'hosp'] as const
export const MSG_PRIORITY = ['normal', 'urgent'] as const

export const CONTACT_ROLES = [
  'Tour manager', 'Production manager', 'FOH engineer', 'Monitor engineer', 'Lighting designer',
  'Backline tech', 'Driver', 'Management', 'Agent', 'Other',
] as const

export const CLOCK_KINDS = {
  tod: 'Time of day',
  countdown: 'Countdown to a time',
  timer: 'Timer (start/stop)',
  stage: 'Follows a stage',
} as const

/** Risk assessment levels, mildest first. */
export const RISK_LEVELS = {
  green: { label: 'Green', hint: 'Normal show, standard measures' },
  orange: { label: 'Orange', hint: 'Elevated: extra measures or attention needed' },
  red: { label: 'Red', hint: 'High: special plan, briefing and staffing required' },
} as const

/** Common reasons a show gets a higher rating. Free-text notes cover the rest. */
export const RISK_FACTORS = [
  'Crowd surge / moshing', 'Crowd surfing / stage diving', 'Pyrotechnics', 'Lasers / special effects',
  'Expected capacity crowd', 'High-profile artist / security threat', 'Young audience', 'Alcohol / drugs expected',
  'Artist invites crowd on stage', 'Weather exposure',
] as const

/** Places trucks are sent to. */
export const LOCATION_KINDS = {
  loadbay: 'Load bay',
  staging: 'Staging area',
  truckpark: 'Truck park',
  dock: 'Dock / ramp',
  other: 'Other',
} as const

/** Run sheet kinds that move vehicles in or out. */
export const TRUCK_KINDS = ['arrival', 'getin', 'loadin', 'loadout', 'departure'] as const

/** Building blocks of a screen, in the order they're laid out. */
export const SCREEN_BLOCKS = {
  clock: 'Big clock',
  nownext: 'Now and next per stage',
  schedule: 'Running order',
  messages: 'Latest messages',
  trucks: 'Trucks due',
} as const

/** Stage plot items. Sizes are metres (width × depth) for a sensible default footprint. */
export const PLOT_KINDS = {
  drums: { label: 'Drum kit', w: 2.4, d: 2.4 },
  riser: { label: 'Riser', w: 2.4, d: 2.4 },
  amp: { label: 'Amp / cab', w: 0.8, d: 0.5 },
  keys: { label: 'Keys', w: 1.4, d: 0.6 },
  vocal: { label: 'Vocal mic', w: 0.5, d: 0.5 },
  mic: { label: 'Instrument mic', w: 0.4, d: 0.4 },
  monitor: { label: 'Wedge', w: 0.7, d: 0.5 },
  di: { label: 'DI', w: 0.3, d: 0.3 },
  power: { label: 'Power drop', w: 0.3, d: 0.3 },
  person: { label: 'Musician', w: 0.7, d: 0.7 },
  other: { label: 'Other', w: 1, d: 1 },
} as const

/**
 * The riser systems festivals stock, each with its own decks and legs, so they're counted
 * separately. Deck keys are width × depth in metres; w/d place them on the stage plot.
 */
export const RISER_SYSTEMS = {
  prolyte: {
    label: 'Prolyte',
    sizes: { '2x1': { w: 2, d: 1 }, '1x1': { w: 1, d: 1 }, '2x0.5': { w: 2, d: 0.5 }, '1x0.5': { w: 1, d: 0.5 } },
  },
  nivtec: {
    label: 'Nivtec',
    sizes: { '2x1': { w: 2, d: 1 }, '1x1': { w: 1, d: 1 }, '2x0.5': { w: 2, d: 0.5 }, '1x0.5': { w: 1, d: 0.5 } },
  },
} as const

/** Fixed riser legs, in centimetres. Telescopic legs (any height) are stocked separately. */
export const RISER_LEGS = [20, 40, 60, 80, 100] as const

/** US 8 ft decks from older plots. Still read (and counted as Prolyte), no longer offered. */
export const LEGACY_RISER_SIZES: Record<string, { w: number; d: number }> = {
  '8x8': { w: 2.44, d: 2.44 },
  '8x4': { w: 2.44, d: 1.22 },
  '6x8': { w: 1.83, d: 2.44 },
  '4x4': { w: 1.22, d: 1.22 },
}

export const TRANSFER_STATUS = ['planned', 'confirmed', 'en route', 'done', 'cancelled'] as const

export const FACILITY_KINDS = {
  dressing: 'Dressing room',
  production: 'Production office',
  catering: 'Catering',
  green: 'Green room',
  storage: 'Storage',
  meeting: 'Meeting room',
  other: 'Other',
} as const

export const FILE_CATEGORIES = ['Site plan', 'Safety', 'Technical', 'Contract', 'Schedule', 'Rider', 'Other'] as const

/** Optional sections an event can switch on or off. Defined in src/shared/modules.ts. */
export const MODULE_IDS = [
  'messages', 'clocks', 'screens', 'display', 'personnel', 'accommodation', 'riders', 'risk', 'trucks',
  'summary', 'lines', 'plots', 'risers', 'transport', 'facilities', 'documents',
] as const

/** Every record collection. `config/event` and `config/roles` are stored separately. */
export const COLLECTIONS = [
  'clocks', 'stages', 'artists', 'ros', 'msgs', 'hotels', 'bookings', 'riders', 'members', 'requests', 'people', 'stageteam', 'prefs', 'risks', 'locations',
  'screens', 'lines', 'plots', 'risers', 'transfers', 'facilities', 'allocations', 'files',
] as const

export function defaultDepts(): Dept[] {
  return [
    { id: 'prod', name: 'Production', tape: 'blue' },
    { id: 'stage', name: 'Stage', tape: 'red' },
    { id: 'audio', name: 'Audio', tape: 'yellow' },
    { id: 'light', name: 'Lighting', tape: 'purple' },
    { id: 'video', name: 'Video', tape: 'teal' },
    { id: 'backline', name: 'Backline', tape: 'orange' },
    { id: 'al', name: 'Artist liaison', tape: 'pink' },
    { id: 'hosp', name: 'Hospitality', tape: 'green' },
    { id: 'transport', name: 'Transport', tape: 'brown' },
    { id: 'security', name: 'Security', tape: 'grey' },
    { id: 'site', name: 'Site', tape: 'white' },
  ]
}

/** Admin → Import (paste text, Claude sorts it). Built but dormant: off hides the tab and refuses the endpoint. */
export const PASTE_IMPORT_ON = false

/** Longest text one Admin → Import reads (about 10,000 words). */
export const IMPORT_MAX_CHARS = 60_000
