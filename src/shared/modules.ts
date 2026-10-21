// Modules: the optional sections of showctrl. Each event switches them on or off in
// Admin → Modules. Core (overview, running order and run sheets, performers, stage setup,
// admin) is always on.
//
// When a module is off:
//  - its pages, side-nav entries and panels disappear (views.ts and the pages check moduleOn)
//  - its permission columns disappear from the roles matrix
//  - the server stops sending its collections and refuses writes to them (src/server/core.ts)
//  - its data is kept, and comes back when the module is switched on again
//
// Adding a module: add its id to MODULE_IDS (src/types/constants.ts), describe it below,
// build its pages and map them in views.ts. See "Modules" in CLAUDE.md.

import type { CollectionName, EventConfig, ModuleId, PermKey } from '../types/model'
import type { HqView, StageView } from './views'

export interface ModuleDef {
  id: ModuleId
  label: string
  /** One sentence for Admin → Modules. */
  description: string
  /** On for new events and for events that never chose. */
  defaultOn: boolean
  /** Permission keys that only mean something with this module. */
  perms: PermKey[]
  /** Collections only this module uses. Hidden and read-only on the server while it's off. */
  collections: CollectionName[]
  hqViews: HqView[]
  stageViews: StageView[]
}

export const MODULES: Record<ModuleId, ModuleDef> = {
  messages: {
    id: 'messages', label: 'Messages', defaultOn: true,
    description: 'Messages to everyone, a stage, a department or one person, with urgent alerts and acknowledgements.',
    perms: ['messages'], collections: ['msgs'], hqViews: ['messages'], stageViews: ['messages'],
  },
  clocks: {
    id: 'clocks', label: 'Clocks', defaultOn: true,
    description: 'Shared countdowns, timers and stage clocks, with wall mode for screens.',
    perms: ['clocks'], collections: ['clocks'], hqViews: ['clocks'], stageViews: ['clocks'],
  },
  display: {
    id: 'display', label: 'Stage display', defaultOn: true,
    description: 'A full-screen “now and next” countdown for stage monitors, following the run sheet.',
    perms: [], collections: [], hqViews: [], stageViews: ['display'],
  },
  personnel: {
    id: 'personnel', label: 'Personnel', defaultOn: true,
    description: 'The contact list for HQ and every stage team, with paste-in import from spreadsheets.',
    // People records stay available: they also provide names for app users.
    perms: ['personnel'], collections: [], hqViews: ['personnel'], stageViews: ['personnel'],
  },
  accommodation: {
    id: 'accommodation', label: 'Accommodation', defaultOn: true,
    description: 'Hotels, room blocks per night and the rooming list.',
    perms: ['accommodation'], collections: ['hotels', 'bookings'], hqViews: ['accommodation'], stageViews: [],
  },
  riders: {
    id: 'riders', label: 'Riders', defaultOn: true,
    description: 'Technical and hospitality riders, item by item, assigned to the departments that source them.',
    perms: ['riders_tech', 'riders_hosp'], collections: ['riders'], hqViews: ['riders'], stageViews: ['riders'],
  },
  risk: {
    id: 'risk', label: 'Risk assessment', defaultOn: true,
    description: 'A green, orange or red rating per performer, with risk factors and notes, shown wherever their show appears.',
    perms: ['risk'], collections: ['risks'], hqViews: ['risk'], stageViews: ['risk'],
  },
  trucks: {
    id: 'trucks', label: 'Trucks & docks', defaultOn: true,
    description: 'Truck counts on load in and load out, where to send each truck (load bay, staging area, truck park), and clash warnings.',
    perms: [], collections: ['locations'], hqViews: ['trucks'], stageViews: ['trucks'],
  },
}

export function moduleOn(cfg: Pick<EventConfig, 'modules'> | null | undefined, id: ModuleId): boolean {
  return cfg?.modules?.[id] ?? MODULES[id].defaultOn
}

/** The module a page belongs to, or null for core pages. */
export function moduleOfView(view: HqView | StageView, where: 'hq' | 'stage'): ModuleId | null {
  for (const m of Object.values(MODULES)) if ((where === 'hq' ? m.hqViews : m.stageViews).includes(view as never)) return m.id
  return null
}

/** The module that owns a collection, or null if it's core. */
export function moduleOfCollection(col: CollectionName): ModuleId | null {
  for (const m of Object.values(MODULES)) if (m.collections.includes(col)) return m.id
  return null
}

/** Whether a permission key belongs to a module that's switched off. */
export function permHidden(cfg: Pick<EventConfig, 'modules'> | null | undefined, key: PermKey): boolean {
  return Object.values(MODULES).some(m => m.perms.includes(key) && !moduleOn(cfg, m.id))
}
