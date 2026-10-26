import { useConfig, useDoc } from '../../data/hooks'
import { moduleOn } from '../../shared/modules'
import { RISK_LEVELS } from '../../types/constants'
import type { Id, RiskLevel } from '../../types/model'
import { tr } from '../../i18n'

/** The rating as a coloured chip. `dot` shows only the colour (with a tooltip), for tight spots. */
export function RiskBadge({ level, dot }: { level: RiskLevel | null; dot?: boolean }) {
  if (!level) return dot ? null : <span className="chip risk-none">{tr('Not assessed')}</span>
  const l = RISK_LEVELS[level]
  if (dot) return <span className={`riskdot risk-${level}`} title={tr('Risk: {level} — {hint}', { level: tr(l.label), hint: tr(l.hint) })} aria-label={tr('Risk {level}', { level: tr(l.label) })} />
  return <span className={`chip risk-${level}`} title={tr(l.hint)}>{tr(l.label)}</span>
}

/**
 * A performer's rating, wherever their show appears. Shows nothing when the module is off
 * or the user may not see risk on that stage (the server doesn't send it then).
 */
export function ArtistRisk({ artistId, dot }: { artistId: Id | null | undefined; dot?: boolean }) {
  const cfg = useConfig('event')
  const risk = useDoc('risks', artistId)
  if (!artistId || !moduleOn(cfg, 'risk') || !risk) return null
  return <RiskBadge level={risk.level} dot={dot} />
}
