import type { HqView, StageView } from '../shared/views'
import type { Id, Terms } from '../types/model'
import type { IconName } from './Icon'

export interface NavMeta {
  label: (t: Terms) => string
  icon: IconName
  /** Draw a divider above this item. */
  sep?: boolean
  /** What the page is for, shown until the page is built. */
  about: (t: Terms) => string
  /** Porting step that builds the page. */
  step: number
}

export const HQ_NAV: Record<HqView, NavMeta> = {
  overview: { label: () => 'Overview', icon: 'overview', step: 5, about: t => `Now and next on every ${t.stage.toLowerCase()}, arrivals and departures, and today's check-ins.` },
  schedule: { label: () => 'Running order', icon: 'schedule', step: 5, about: t => `The running order across all ${t.stages.toLowerCase()}, as lanes on a timeline.` },
  artists: { label: t => t.performers, icon: 'artists', step: 6, about: t => `Every ${t.performer.toLowerCase()}, their status, contacts and day sheets.` },
  personnel: { label: () => 'Personnel', icon: 'personnel', step: 6, about: () => 'The contact list for HQ and every stage team.' },
  clocks: { label: () => 'Clocks', icon: 'clocks', step: 5, about: () => 'Shared clocks, countdowns and timers, corrected to server time.' },
  messages: { label: () => 'Messages', icon: 'messages', step: 7, about: () => 'Messages to everyone, a stage, a department or one person, with urgent alerts.' },
  accommodation: { label: () => 'Accommodation', icon: 'accommodation', step: 8, about: () => 'Hotels, room blocks and bookings.' },
  riders: { label: () => 'Riders', icon: 'riders', step: 8, about: () => 'Technical and hospitality riders, item by item.' },
  admin: { label: () => 'Admin', icon: 'admin', sep: true, step: 4, about: () => 'Event settings, departments, roles and who has access.' },
}

export const STAGE_NAV: Record<StageView, NavMeta> = {
  today: { label: () => 'Today', icon: 'today', step: 5, about: () => 'Now, next and the rest of today on this stage.' },
  runsheet: { label: () => 'Run sheet', icon: 'schedule', step: 5, about: () => 'Every item from arrival to departure, with delays and actual times.' },
  artists: { label: t => t.performers, icon: 'artists', step: 6, about: t => `${t.performers} on this ${t.stage.toLowerCase()} and their day sheets.` },
  personnel: { label: () => 'Crew & contacts', icon: 'personnel', step: 6, about: () => 'The stage team and key contacts.' },
  clocks: { label: () => 'Clocks', icon: 'clocks', step: 5, about: () => 'Festival-wide clocks plus this stage’s own.' },
  messages: { label: () => 'Messages', icon: 'messages', step: 7, about: () => 'Messages for this stage.' },
  riders: { label: () => 'Riders', icon: 'riders', step: 8, about: () => 'Riders for this stage’s acts.' },
  display: { label: () => 'Stage display', icon: 'display', sep: true, step: 5, about: () => 'Full-screen now and next for the stage monitor.' },
  setup: { label: () => 'Stage setup', icon: 'setup', step: 6, about: () => 'Stage details, the stage team and the day sheet template.' },
}

export const hqPath = (view: string, arg?: string) => `/hq/${view}${arg ? '/' + arg : ''}`
export const stagePath = (sid: Id, view: string, arg?: string) => `/s/${sid}/${view}${arg ? '/' + arg : ''}`
