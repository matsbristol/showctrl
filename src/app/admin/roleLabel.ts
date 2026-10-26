import { tr } from '../../i18n'
import { DEFAULT_ROLES } from '../../types/constants'

/** A role's name in the interface language: built-in roles are translated, custom ones stay as typed. */
export const roleLabel = (r: { label: string }): string =>
  Object.values(DEFAULT_ROLES).some(d => d.label === r.label) ? tr(r.label) : r.label
