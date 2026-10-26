import { useCollection, useConfig } from '../../data/hooks'
import { moduleOn } from '../../shared/modules'
import { fmtTime } from '../../lib/time'
import { personName } from '../../shared/people'
import { useTz } from '../session'
import { useMessageActions, useMyUrgent } from './hooks'
import { useTargetLabel } from './labels'
import { tr } from '../../i18n'

/** A red bar under the stage tabs until the user acknowledges each urgent message meant for them. */
export function UrgentBanner() {
  const urgent = useMyUrgent()
  const members = useCollection('members')
  const people = useCollection('people')
  const tz = useTz()
  const label = useTargetLabel()
  const { ack } = useMessageActions()
  const cfg = useConfig('event')
  const u = urgent[0]
  if (!u || !moduleOn(cfg, 'messages')) return null
  return (
    <div className="urgent" role="alert">
      <b>{tr('Urgent')} · {personName(u.from, members, people)} → {label(u.to)}</b>
      <span className="msg">{u.text}</span>
      <span className="small">{fmtTime(u.at, tz)}{urgent.length > 1 ? ` · ${tr('{n} more', { n: urgent.length - 1 })}` : ''}</span>
      <button type="button" onClick={() => void ack(u.id)}>{tr('Acknowledge')}</button>
    </div>
  )
}
