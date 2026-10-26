// Norwegian (bokmål), split by area so each part sits with its screens' wording.
// Later parts win if two parts translate the same English text; they should agree anyway.
import admin from './admin'
import common from './common'
import live from './live'
import logistics from './logistics'
import production from './production'
import shell from './shell'

export const NB: Record<string, string> = { ...shell, ...live, ...production, ...admin, ...logistics, ...common }
