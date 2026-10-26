// Accreditation levels: each event keeps its own list, highest first; new events start with ACCRED.

import { ACCRED } from '../types/constants'
import type { EventConfig } from '../types/model'

export function accredLevels(cfg: EventConfig | null | undefined): string[] {
  return cfg?.accred?.length ? cfg.accred : [...ACCRED]
}
