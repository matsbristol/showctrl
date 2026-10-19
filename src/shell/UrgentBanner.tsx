/*
 * Red banner under the stage tabs while an urgent message for you is
 * unacknowledged. Shows the newest, as in the prototype, plus how many
 * others are waiting; acknowledging one brings up the next.
 */
import { fmtTime } from '../domain/time'
import { useEvent } from '../views/hooks'
import { useMessages, usePendingUrgent } from '../views/msgHooks'

export function UrgentBanner() {
  const pending = usePendingUrgent()
  const msg = useMessages()
  const { tz } = useEvent()
  const u = pending[0]
  if (!u) return null
  return (
    <div className="urgent" role="alert">
      <b>Urgent · {msg.nameOf(u.from)} → {msg.label(u.to)}</b>
      <span className="msg">{u.text}</span>
      <span className="small">{fmtTime(u.at, false, tz)}{pending.length > 1 && ` · ${pending.length - 1} more`}</span>
      <button type="button" onClick={() => msg.ack(u)}>Acknowledge</button>
    </div>
  )
}
