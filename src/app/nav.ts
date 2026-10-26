import type { HqView, StageView } from '../shared/views'
import type { Id, Terms } from '../types/model'
import type { IconName } from './Icon'
import { tr } from '../i18n'

/** Side-nav groups, in order. The first and last have no heading. Shown through tr(). */
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
  overview: { label: () => tr('Overview'), icon: 'overview', group: 'start' },
  schedule: { label: () => tr('Running order'), icon: 'schedule', group: 'live' },
  screens: { label: () => tr('Screens'), icon: 'display', group: 'live' },
  clocks: { label: () => tr('Clocks'), icon: 'clocks', group: 'live' },
  messages: { label: () => tr('Messages'), icon: 'messages', group: 'live' },
  artists: { label: t => t.performers, icon: 'artists', group: 'production' },
  summary: { label: () => tr('Technical summary'), icon: 'summary', group: 'production' },
  lines: { label: () => tr('Input lists'), icon: 'lines', group: 'production' },
  plots: { label: () => tr('Stage plots'), icon: 'plot', group: 'production' },
  risers: { label: () => tr('Risers'), icon: 'riser', group: 'production' },
  risk: { label: () => tr('Risk'), icon: 'risk', group: 'production' },
  riders: { label: () => tr('Riders'), icon: 'riders', group: 'production' },
  trucks: { label: () => tr('Trucks'), icon: 'truck', group: 'logistics' },
  transport: { label: () => tr('Transport'), icon: 'car', group: 'logistics' },
  accommodation: { label: () => tr('Accommodation'), icon: 'accommodation', group: 'logistics' },
  facilities: { label: () => tr('Facilities'), icon: 'room', group: 'logistics' },
  personnel: { label: () => tr('People'), icon: 'personnel', group: 'team' },
  documents: { label: () => tr('Documents'), icon: 'file', group: 'team' },
  admin: { label: () => tr('Admin'), icon: 'admin', group: 'admin' },
}

export const STAGE_NAV: Record<StageView, NavMeta> = {
  today: { label: () => tr('Today'), icon: 'today', group: 'start' },
  runsheet: { label: () => tr('Run sheet'), icon: 'schedule', group: 'live' },
  display: { label: () => tr('Stage display'), icon: 'display', group: 'live' },
  screens: { label: () => tr('Screens'), icon: 'display', group: 'live' },
  clocks: { label: () => tr('Clocks'), icon: 'clocks', group: 'live' },
  messages: { label: () => tr('Messages'), icon: 'messages', group: 'live' },
  artists: { label: t => t.performers, icon: 'artists', group: 'production' },
  summary: { label: () => tr('Technical summary'), icon: 'summary', group: 'production' },
  lines: { label: () => tr('Input lists'), icon: 'lines', group: 'production' },
  plots: { label: () => tr('Stage plots'), icon: 'plot', group: 'production' },
  risers: { label: () => tr('Risers'), icon: 'riser', group: 'production' },
  risk: { label: () => tr('Risk'), icon: 'risk', group: 'production' },
  riders: { label: () => tr('Riders'), icon: 'riders', group: 'production' },
  trucks: { label: () => tr('Trucks'), icon: 'truck', group: 'logistics' },
  transport: { label: () => tr('Transport'), icon: 'car', group: 'logistics' },
  facilities: { label: () => tr('Facilities'), icon: 'room', group: 'logistics' },
  personnel: { label: () => tr('Crew & contacts'), icon: 'personnel', group: 'team' },
  documents: { label: () => tr('Documents'), icon: 'file', group: 'team' },
  setup: { label: () => tr('Stage setup'), icon: 'setup', group: 'admin' },
}

export const hqPath = (view: string, arg?: string) => `/hq/${view}${arg ? '/' + arg : ''}`
export const stagePath = (sid: Id, view: string, arg?: string) => `/s/${sid}/${view}${arg ? '/' + arg : ''}`
