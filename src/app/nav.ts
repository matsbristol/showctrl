import type { HqView, StageView } from '../shared/views'
import type { Id, Terms } from '../types/model'
import type { IconName } from './Icon'

/** Side-nav groups, in order. The first and last have no heading. */
export const NAV_GROUPS = {
  start: '',
  live: 'Live',
  production: 'Production',
  logistics: 'Logistics',
  team: 'Team',
  admin: '',
} as const
export type NavGroup = keyof typeof NAV_GROUPS

export interface NavMeta {
  label: (t: Terms) => string
  icon: IconName
  group: NavGroup
}

export const HQ_NAV: Record<HqView, NavMeta> = {
  overview: { label: () => 'Overview', icon: 'overview', group: 'start' },
  schedule: { label: () => 'Running order', icon: 'schedule', group: 'live' },
  screens: { label: () => 'Screens', icon: 'display', group: 'live' },
  clocks: { label: () => 'Clocks', icon: 'clocks', group: 'live' },
  messages: { label: () => 'Messages', icon: 'messages', group: 'live' },
  artists: { label: t => t.performers, icon: 'artists', group: 'production' },
  summary: { label: () => 'Technical summary', icon: 'summary', group: 'production' },
  lines: { label: () => 'Input lists', icon: 'lines', group: 'production' },
  plots: { label: () => 'Stage plots', icon: 'plot', group: 'production' },
  risers: { label: () => 'Risers', icon: 'riser', group: 'production' },
  risk: { label: () => 'Risk', icon: 'risk', group: 'production' },
  riders: { label: () => 'Riders', icon: 'riders', group: 'production' },
  trucks: { label: () => 'Trucks', icon: 'truck', group: 'logistics' },
  transport: { label: () => 'Transport', icon: 'car', group: 'logistics' },
  accommodation: { label: () => 'Accommodation', icon: 'accommodation', group: 'logistics' },
  facilities: { label: () => 'Facilities', icon: 'room', group: 'logistics' },
  personnel: { label: () => 'Personnel', icon: 'personnel', group: 'team' },
  documents: { label: () => 'Documents', icon: 'file', group: 'team' },
  admin: { label: () => 'Admin', icon: 'admin', group: 'admin' },
}

export const STAGE_NAV: Record<StageView, NavMeta> = {
  today: { label: () => 'Today', icon: 'today', group: 'start' },
  runsheet: { label: () => 'Run sheet', icon: 'schedule', group: 'live' },
  display: { label: () => 'Stage display', icon: 'display', group: 'live' },
  screens: { label: () => 'Screens', icon: 'display', group: 'live' },
  clocks: { label: () => 'Clocks', icon: 'clocks', group: 'live' },
  messages: { label: () => 'Messages', icon: 'messages', group: 'live' },
  artists: { label: t => t.performers, icon: 'artists', group: 'production' },
  summary: { label: () => 'Technical summary', icon: 'summary', group: 'production' },
  lines: { label: () => 'Input lists', icon: 'lines', group: 'production' },
  plots: { label: () => 'Stage plots', icon: 'plot', group: 'production' },
  risers: { label: () => 'Risers', icon: 'riser', group: 'production' },
  risk: { label: () => 'Risk', icon: 'risk', group: 'production' },
  riders: { label: () => 'Riders', icon: 'riders', group: 'production' },
  trucks: { label: () => 'Trucks', icon: 'truck', group: 'logistics' },
  transport: { label: () => 'Transport', icon: 'car', group: 'logistics' },
  facilities: { label: () => 'Facilities', icon: 'room', group: 'logistics' },
  personnel: { label: () => 'Crew & contacts', icon: 'personnel', group: 'team' },
  documents: { label: () => 'Documents', icon: 'file', group: 'team' },
  setup: { label: () => 'Stage setup', icon: 'setup', group: 'admin' },
}

export const hqPath = (view: string, arg?: string) => `/hq/${view}${arg ? '/' + arg : ''}`
export const stagePath = (sid: Id, view: string, arg?: string) => `/s/${sid}/${view}${arg ? '/' + arg : ''}`
