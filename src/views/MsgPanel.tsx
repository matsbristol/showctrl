/*
 * Latest messages, for the HQ overview (everything you can see) or a
 * stage's Today page (everyone, that stage, and you).
 */
import { Link } from 'react-router-dom'
import { useNow } from '../clock/clock'
import { visibleMsgs } from '../domain/messages'
import { relTime } from '../domain/time'
import { useSnapshot } from '../data/hooks'
import { Avatar } from '../shell/Avatar'
import { ctxPath } from '../shell/nav'
import type { Id, Msg } from '../types/model'
import { useEvent } from './hooks'
import { useMessages, useMsgViewer } from './msgHooks'

const SHOWN = 5

function forStage(m: Msg, sid: Id, uid: Id | null) {
  const to = m.to
  return !to || to.t === 'all' || (to.t === 'stage' && to.id === sid) || (to.t === 'user' && to.id === uid)
}

export function MsgPanel({ sid }: { sid: Id | null }) {
  const snap = useSnapshot()
  const v = useMsgViewer()
  const msg = useMessages()
  const t = useNow(30_000)
  const { T } = useEvent()
  if (v.access.lv('messages', sid) < 1) return null
  const list = visibleMsgs(snap.col.msgs, v).filter(m => !sid || forStage(m, sid, v.uid)).slice(0, SHOWN)
  return (
    <section className="panel">
      <div className="ph">
        <h3>{sid ? `Messages for this ${T.stage.toLowerCase()}` : 'Latest messages'}</h3>
        <div className="actions"><Link className="btn sm" to={ctxPath(sid ?? 'hq', 'messages')}>Open</Link></div>
      </div>
      {list.length ? (
        <ul className="list">
          {list.map(m => (
            <li key={m.id}>
              <Avatar uid={m.from} name={msg.nameOf(m.from)} />
              <div className="stack">
                <span className="small muted">
                  <b className="ink">{msg.nameOf(m.from)}</b> → {msg.label(m.to)} · {relTime(m.at, t)}
                  {m.pri === 'urgent' && <> <span className="chip st">Urgent</span></>}
                </span>
                <span className="wrap">{m.text}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="empty">No messages yet.</p>}
    </section>
  )
}
