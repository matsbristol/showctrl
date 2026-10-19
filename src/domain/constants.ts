import type {
  Accred, ArtistStatus, BookingStatus, CollectionName, DaySheetTemplate, Dept, EventType,
  ItemKind, Level, PermKey, RiderItemStatus, RoleDef, Roles, StageRole, TapeColor, Terms, Track,
} from '../types/model'

export const MIN = 60_000
export const HOUR = 3_600_000

/** Spike-tape colours for stages and departments. */
export const TAPE: Record<TapeColor, string> = {
  red: '#D93A3A', blue: '#2F6FE0', yellow: '#E3B000', green: '#2E9E57', orange: '#EE7A1F',
  purple: '#8A4FD3', pink: '#DB4E95', teal: '#16999A', brown: '#8B5E3C', grey: '#6B7586', white: '#D9DEE6',
}
export const tapeHex = (t?: string) => TAPE[t as TapeColor] ?? TAPE.grey

/** Festival-wide permission keys, in display order. */
export const PERM_KEYS: [PermKey, string][] = [
  ['show', 'Festival overview'], ['schedule', 'Running order'], ['artists', 'Artists'],
  ['personnel', 'Personnel'], ['clocks', 'Clocks'], ['messages', 'Messages'],
  ['accommodation', 'Accommodation'], ['riders_tech', 'Technical riders'],
  ['riders_hosp', 'Hospitality riders'], ['admin', 'Admin'],
]

/** Builds a perms map from a digit string in PERM_KEYS order, e.g. '1121112220'. */
const mkPerms = (s: string) =>
  Object.fromEntries(PERM_KEYS.map(([k], i) => [k, Number(s[i]) as Level])) as Record<PermKey, Level>

export const DEFAULT_ROLES: Roles = {
  admin:   { label: 'Festival admin',       perms: mkPerms('2222222222'), contacts: true, locked: true },
  pm:      { label: 'Production manager',   perms: mkPerms('2222222221'), contacts: true },
  liaison: { label: 'Artist liaison',       perms: mkPerms('1121112220'), contacts: true },
  hosp:    { label: 'Hospitality',          perms: mkPerms('1111121020'), contacts: false },
  tech:    { label: 'Technical production', perms: mkPerms('1111221200'), contacts: false },
  site:    { label: 'Site & security',      perms: mkPerms('1111120000'), contacts: false },
  none:    { label: 'Stage access only',    perms: mkPerms('0000000000'), contacts: false, locked: true },
}
export const NO_ROLE: RoleDef = DEFAULT_ROLES.none

/** Stage-only key: may open Stage setup and add crew. */
export type StagePermKey = PermKey | 'setup'

export const STAGE_ROLES: Record<StageRole, string> = { manager: 'Stage manager', crew: 'Stage crew' }

/** What a stage role adds, for that stage only. */
export const STAGE_LV: Record<StageRole, Partial<Record<StagePermKey, Level>>> = {
  manager: { show: 1, schedule: 2, artists: 2, personnel: 2, clocks: 2, messages: 2, riders_tech: 2, riders_hosp: 2, accommodation: 1, setup: 2 },
  crew: { show: 1, schedule: 1, artists: 1, personnel: 1, clocks: 1, messages: 2, riders_tech: 1 },
}

export const LEVELS = ['No access', 'View', 'Edit'] as const

export const ACCRED: Accred[] = ['AAA', 'Production', 'Stage', 'Backstage', 'Artist', 'Site', 'Day pass']

export const EVENT_TYPES: Record<EventType, { label: string; terms: Terms }> = {
  festival:   { label: 'Music festival',        terms: { performer: 'Artist', performers: 'Artists', stage: 'Stage', stages: 'Stages' } },
  concert:    { label: 'Concert / tour date',   terms: { performer: 'Artist', performers: 'Artists', stage: 'Stage', stages: 'Stages' } },
  conference: { label: 'Conference',            terms: { performer: 'Speaker', performers: 'Speakers', stage: 'Room', stages: 'Rooms' } },
  theatre:    { label: 'Theatre / performance', terms: { performer: 'Company', performers: 'Companies', stage: 'Stage', stages: 'Stages' } },
  corporate:  { label: 'Corporate event',       terms: { performer: 'Presenter', performers: 'Presenters', stage: 'Room', stages: 'Rooms' } },
  sport:      { label: 'Sports event',          terms: { performer: 'Team', performers: 'Teams', stage: 'Arena', stages: 'Arenas' } },
}

export const TIME_ZONES = [
  'Europe/Oslo', 'Europe/Stockholm', 'Europe/Copenhagen', 'Europe/London', 'Europe/Berlin', 'Europe/Madrid',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney', 'UTC',
]

/** Run sheet item kinds. The track decides which timeline lane an item sits in. */
export const KINDS: Record<ItemKind, { label: string; track: Track }> = {
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
  set: { label: 'Show', track: 'stage' },
  break: { label: 'Break', track: 'stage' },
}

export const TRACKS: Record<Track, string> = { stage: 'On stage', dock: 'Dock & backstage' }

export const DEFAULT_TPL: DaySheetTemplate = {
  arrival: -240, getin: -180, loadin: -120, loadinDur: 45, access: -45,
  changeover: 30, loadoutAfter: 15, loadoutDur: 45, departure: 150, soundcheckDur: 45,
}

export const ARTIST_STATUS: ArtistStatus[] = ['confirmed', 'travelling', 'arrived', 'backstage', 'ready', 'on stage', 'done', 'cancelled']
export const BOOKING_STATUS: BookingStatus[] = ['requested', 'held', 'confirmed', 'checked in', 'checked out', 'cancelled']
export const RIDER_STATUS: RiderItemStatus[] = ['requested', 'agreed', 'sourced', 'declined']
export const CONTACT_ROLES = [
  'Tour manager', 'Production manager', 'FOH engineer', 'Monitor engineer', 'Lighting designer',
  'Backline tech', 'Driver', 'Management', 'Agent', 'Other',
]

export const COLLECTIONS: CollectionName[] = [
  'clocks', 'stages', 'artists', 'ros', 'msgs', 'hotels', 'bookings', 'riders', 'members', 'requests', 'people', 'stageteam',
]

export function defaultDepts(): Dept[] {
  const d: [string, string, TapeColor][] = [
    ['prod', 'Production', 'blue'], ['stage', 'Stage', 'red'], ['audio', 'Audio', 'yellow'],
    ['light', 'Lighting', 'purple'], ['video', 'Video', 'teal'], ['backline', 'Backline', 'orange'],
    ['al', 'Artist liaison', 'pink'], ['hosp', 'Hospitality', 'green'], ['transport', 'Transport', 'brown'],
    ['security', 'Security', 'grey'], ['site', 'Site', 'white'],
  ]
  return d.map(([id, name, tape]) => ({ id, name, tape }))
}
