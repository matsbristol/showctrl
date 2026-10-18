import { useEffect, useRef, useState } from 'react'
import { useCollection, useConfig } from '../../data/hooks'
import { fmtTime, relTime } from '../../lib/time'
import { inChannel, messageChannels, parseTarget, visibleMsgs } from '../../shared/messages'
import { initials, personColor, personName } from '../../shared/people'
import { TAPE } from '../../types/constants'
import type { Id } from '../../types/model'
import { useLastRead, useMarkRead, useMessageActions, useMyUrgent } from '../messages/hooks'
import { useTargetLabel } from '../messages/labels'
import { useAccess, useNow, useTz } from '../session'

/** Channels on the left; compose and the message list on the right. Opening the page marks everything read. */
export function MessagesPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const cfg = useConfig('event')
  const msgs = useCollection('msgs')
  const members = useCollection('members')
  const people = useCollection('people')
  const tz = useTz()
  const now = useNow(30_000)
  const label = useTargetLabel()
  const urgent = useMyUrgent()
  const { send, ack, remove } = useMessageActions()

  const chans = messageChannels(a, a.stagesSorted(), cfg?.depts ?? [])
  const [chanState, setChan] = useState(sid ? `stage:${sid}` : 'inbox')
  const ch = chans.some(c => c.id === chanState) ? chanState : 'inbox'
  const list = visibleMsgs(a, msgs).filter(m => inChannel(m, ch))

  // Mark read on open, and again when a message newer than the last read time arrives while the page is open.
  const markRead = useMarkRead()
  const lastRead = useLastRead(a.me)
  const newest = list[0]?.at ?? 0
  const opened = useRef(false)
  useEffect(() => {
    if (!opened.current || newest > lastRead) { opened.current = true; void markRead(a.me) }
  }, [a.me, newest, lastRead, markRead])

  const sendStages = a.stagesSorted().filter(s => a.canW('messages', s.id))
  const others = Object.keys(members).filter(u => u !== a.me).sort((x, y) => personName(x, members, people).localeCompare(personName(y, members, people)))
  const canSend = a.canSendMsgs() || sendStages.length > 0
  const defaultTo = ch.startsWith('stage:') || ch.startsWith('dept:') ? ch : sid ? `stage:${sid}` : a.canSendTo({ t: 'all' }) ? 'all' : sendStages[0] ? `stage:${sendStages[0].id}` : `dept:${cfg?.depts[0]?.id ?? ''}`
  const [to, setTo] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [urg, setUrg] = useState(false)
  const target = to ?? defaultTo
  const name = (u: Id) => personName(u, members, people)

  const submit = async () => {
    const tx = text.trim()
    if (!tx) return
    await send(parseTarget(target), tx, urg ? 'urgent' : 'normal')
    setText('')
    setUrg(false)
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Messages</h1>
          <p>Send to everyone, a stage team, a department or one person. Urgent messages flash on the screens of everyone they’re for until each person acknowledges.</p>
        </div>
      </div>
      <div className="msgs">
        <nav className="panel chan" aria-label="Channels">
          {chans.map(c => (
            <button key={c.id} type="button" aria-pressed={c.id === ch} onClick={() => setChan(c.id)}>
              {c.tape && <span className="tape" style={{ ['--c' as string]: TAPE[c.tape] }} />}
              {c.label}
              {c.id === 'urgent' && urgent.length > 0 && <span className="badge">{urgent.length}</span>}
            </button>
          ))}
        </nav>
        <section className="panel">
          {canSend && (
            <form className="compose" onSubmit={e => { e.preventDefault(); void submit() }}>
              <label className="fld">
                <span>Message</span>
                <textarea value={text} placeholder="Type a message…" maxLength={1200} onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit() } }} />
              </label>
              <div className="row">
                <label className="row small">
                  <span className="muted">To</span>
                  <select value={target} onChange={e => setTo(e.target.value)} aria-label="To">
                    {a.canSendTo({ t: 'all' }) && <option value="all">Everyone</option>}
                    {sendStages.length > 0 && (
                      <optgroup label="Stage teams">{sendStages.map(s => <option key={s.id} value={`stage:${s.id}`}>{s.name}</option>)}</optgroup>
                    )}
                    {a.canSendMsgs() && (
                      <optgroup label="Departments">{cfg?.depts.map(d => <option key={d.id} value={`dept:${d.id}`}>{d.name}</option>)}</optgroup>
                    )}
                    {a.canSendMsgs() && others.length > 0 && (
                      <optgroup label="People">{others.map(u => <option key={u} value={`user:${u}`}>{name(u)}</option>)}</optgroup>
                    )}
                  </select>
                </label>
                <label className="row small"><input type="checkbox" checked={urg} onChange={e => setUrg(e.target.checked)} /> Urgent</label>
                <button className="btn primary" style={{ marginLeft: 'auto' }} type="submit" disabled={!text.trim()}>Send</button>
              </div>
            </form>
          )}
          {list.length ? list.map(m => {
            const acks = Object.keys(m.acks ?? {})
            const forMe = m.from !== a.me && !m.acks?.[a.me ?? '']
            return (
              <article key={m.id} className={`m${m.pri === 'urgent' ? ' urg' : ''}`}>
                <span className="av" style={{ ['--c' as string]: personColor(m.from) }}>{initials(name(m.from))}</span>
                <div className="meta">
                  <b>{name(m.from)}</b><span>→ {label(m.to)}</span><span>{fmtTime(m.at, tz)} · {relTime(m.at, now)}</span>
                  {m.pri === 'urgent' && <span className="chip st">Urgent</span>}
                </div>
                <div className="txt">{m.text}</div>
                <div className="ack">
                  {acks.length
                    ? `Seen by ${acks.slice(0, 4).map(name).join(', ')}${acks.length > 4 ? ` +${acks.length - 4}` : ''}`
                    : m.pri === 'urgent' ? 'Not acknowledged yet' : ''}
                  {forMe && <button type="button" className="btn sm" onClick={() => void ack(m.id)}>{m.pri === 'urgent' ? 'Acknowledge' : 'Mark seen'}</button>}
                  {(m.from === a.me || a.canW('admin')) && (
                    <button type="button" className="btn sm danger" onClick={() => { if (confirm('Delete this message for everyone?')) void remove(m.id) }}>Delete</button>
                  )}
                </div>
              </article>
            )
          }) : <p className="empty">No messages here yet.</p>}
        </section>
      </div>
    </>
  )
}
