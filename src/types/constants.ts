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
  { key: 'personnel', label: 'Personnel' },
  { key: 'clocks', label: 'Clocks' },
  { key: 'messages', label: 'Messages' },
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'riders_tech', label: 'Technical riders' },
  { key: 'riders_hosp', label: 'Hospitality riders' },
  { key: 'admin', label: 'Admin' },
] as const

export const LEVELS = ['No access', 'View', 'Edit'] as const

/** Builds a perms map from a digit string in PERM_KEYS order, e.g. '2222222221'. */
function mkPerms(s: string): Record<PermKey, PermLevel> {
  return Object.fromEntries(PERM_KEYS.map(({ key }, i) => [key, Number(s[i]) as PermLevel])) as Record<PermKey, PermLevel>
}

export const DEFAULT_ROLES: Record<string, RoleDef> = {
  admin: { label: 'Festival admin', perms: mkPerms('2222222222'), contacts: true, locked: true },
  pm: { label: 'Production manager', perms: mkPerms('2222222221'), contacts: true },
  liaison: { label: 'Artist liaison', perms: mkPerms('1121112220'), contacts: true },
  hosp: { label: 'Hospitality', perms: mkPerms('1111121020'), contacts: false },
  tech: { label: 'Technical production', perms: mkPerms('1111221200'), contacts: false },
  site: { label: 'Site & security', perms: mkPerms('1111120000'), contacts: false },
  none: { label: 'Stage access only', perms: mkPerms('0000000000'), contacts: false, locked: true },
}

export const STAGE_ROLES = { manager: 'Stage manager', crew: 'Stage crew' } as const

/** What a stage-level role adds, for that stage only. `setup` opens Stage setup. */
export const STAGE_LV: Record<keyof typeof STAGE_ROLES, Partial<Record<PermKey | 'setup', PermLevel>>> = {
  manager: { show: 1, schedule: 2, artists: 2, personnel: 2, clocks: 2, messages: 2, riders_tech: 2, riders_hosp: 2, accommodation: 1, setup: 2 },
  crew: { show: 1, schedule: 1, artists: 1, personnel: 1, clocks: 1, messages: 2, riders_tech: 1 },
}

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

/** Optional sections an event can switch on or off. Defined in src/shared/modules.ts. */
export const MODULE_IDS = ['messages', 'clocks', 'display', 'personnel', 'accommodation', 'riders'] as const

/** Every record collection. `config/event` and `config/roles` are stored separately. */
export const COLLECTIONS = [
  'clocks', 'stages', 'artists', 'ros', 'msgs', 'hotels', 'bookings', 'riders', 'members', 'requests', 'people', 'stageteam', 'prefs',
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
