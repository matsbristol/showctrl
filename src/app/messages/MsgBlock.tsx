import { Link } from 'react-router-dom'
import { useCollection, useConfig } from '../../data/hooks'
import { moduleOn } from '../../shared/modules'
import { relTime } from '../../lib/time'
import { initials, personColor, personName } from '../../shared/people'
import type { Id } from '../../types/model'
import { useAccess, useNow } from '../session'
import { useTargetLabel } from './labels'

/** The latest five messages for HQ or a stage. The full Messages page arrives in step 7. */
export function MsgBlock({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const msgs = useCollection('msgs')
  const members = useCollection('members')
  const people = useCollection('people')
  const now = useNow(30_000)
  const label = useTargetLabel()
  const cfg = useConfig('event')
  if (!moduleOn(cfg, 'messages') || a.lv('messages', sid) < 1) return null
  const list = Object.values(msgs)
    .filter(m => a.canSeeMsg(m))
    .filter(m => !sid || m.to?.t === 'all' || (m.to?.t === 'stage' && m.to.id === sid) || (m.to?.t === 'user' && m.to.id === a.me))
    .sort((x, y) => y.at - x.at)
    .slice(0, 5)
  return (
    <section className="panel">
      <div className="ph">
        <h3>{sid ? 'Messages for this stage' : 'Latest messages'}</h3>
        <div className="actions"><Link className="btn sm" to={sid ? `/s/${sid}/messages` : '/hq/messages'}>Open</Link></div>
      </div>
      {list.length ? (
        <ul className="list">
          {list.map(m => {
            const name = personName(m.from, members, people)
            return (
              <li key={m.id}>
                <span className="av" style={{ ['--c' as string]: personColor(m.from) }}>{initials(name)}</span>
                <div className="stack" style={{ minWidth: 0 }}>
                  <span className="small muted">
                    <b style={{ color: 'var(--ink)' }}>{name}</b> → {label(m.to)} · {relTime(m.at, now)}
                    {m.pri === 'urgent' && <> <span className="chip st">Urgent</span></>}
                  </span>
                  <span style={{ overflowWrap: 'anywhere' }}>{m.text}</span>
                </div>
              </li>
            )
          })}
        </ul>
      ) : <p className="empty">No messages yet.</p>}
    </section>
  )
}
