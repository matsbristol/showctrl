import { createContext, useContext } from 'react'

/** Wall mode hides the chrome so clocks or the stage display fill the screen. */
export interface Wall { on: boolean; enter: () => void; exit: () => void }

export const WallContext = createContext<Wall>({ on: false, enter: () => {}, exit: () => {} })

export function useWall(): Wall {
  return useContext(WallContext)
}
