import type { HqView, StageView } from '../shared/views'
import type { Id, Terms } from '../types/model'
import type { IconName } from './Icon'

export interface NavMeta {
  label: (t: Terms) => string
  icon: IconName
  /** Draw a divider above this item. */
  sep?: boolean
}

export const HQ_NAV: Record<HqView, NavMeta> = {
  overview: { label: () => 'Overview', icon: 'overview' },
  schedule: { label: () => 'Running order', icon: 'schedule' },
  artists: { label: t => t.performers, icon: 'artists' },
  risk: { label: () => 'Risk', icon: 'risk' },
  trucks: { label: () => 'Trucks', icon: 'truck' },
  personnel: { label: () => 'Personnel', icon: 'personnel' },
  clocks: { label: () => 'Clocks', icon: 'clocks' },
  messages: { label: () => 'Messages', icon: 'messages' },
  accommodation: { label: () => 'Accommodation', icon: 'accommodation' },
  riders: { label: () => 'Riders', icon: 'riders' },
  admin: { label: () => 'Admin', icon: 'admin', sep: true },
}

export const STAGE_NAV: Record<StageView, NavMeta> = {
  today: { label: () => 'Today', icon: 'today' },
  runsheet: { label: () => 'Run sheet', icon: 'schedule' },
  artists: { label: t => t.performers, icon: 'artists' },
  risk: { label: () => 'Risk', icon: 'risk' },
  trucks: { label: () => 'Trucks', icon: 'truck' },
  personnel: { label: () => 'Crew & contacts', icon: 'personnel' },
  clocks: { label: () => 'Clocks', icon: 'clocks' },
  messages: { label: () => 'Messages', icon: 'messages' },
  riders: { label: () => 'Riders', icon: 'riders' },
  display: { label: () => 'Stage display', icon: 'display', sep: true },
  setup: { label: () => 'Stage setup', icon: 'setup' },
}

export const hqPath = (view: string, arg?: string) => `/hq/${view}${arg ? '/' + arg : ''}`
export const stagePath = (sid: Id, view: string, arg?: string) => `/s/${sid}/${view}${arg ? '/' + arg : ''}`
