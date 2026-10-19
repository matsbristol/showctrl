import type { CSSProperties } from 'react'

/** Sets the `--c` colour variable that tapes, tabs and status dots read in shell.css. */
export const colourVar = (c: string) => ({ '--c': c }) as CSSProperties

/** Festival HQ's colour, wherever HQ needs a tape. */
export const HQ_COLOUR = '#3E63FF'
