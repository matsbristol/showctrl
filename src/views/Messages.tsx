/*
 * Messages: channels on the left, compose and the conversation on the
 * right. Urgent messages also flash in a red banner on every screen of the
 * people they're for, until each one acknowledges (see UrgentBanner).
 */
import { useEffect, useState, type KeyboardEvent } from 'react'
import { now, useNow } from '../clock/clock'
import { tapeHex } from '../domain/constants'
import { channels, inChannel, parseTarget, visibleMsgs, type ChannelId } from '../domain/messages'
import { fmtTime, relTime } from '../domain/time'
import { sortStages } from '../access/access'
import { useSnapshot } from '../data/hooks'
import { markRead } from '../session/lastRead'
import { Avatar } from '../shell/Avatar'
import { colourVar } from '../shell/style'
import type { Id, Msg } from '../types/model'
import { Head } from './common'
import { useEvent } from './hooks'
import { useMessages, useMsgViewer, usePendingUrgent } from './msgHooks'

const MAX_LEN = 1200
/** Names listed under a message before "+N". */
const SEEN_NAMES = 4

function Compose({ sid, channel }: { sid: Id | null; channel: ChannelId }) {
  const snap = useSnapshot()
  const { access, uid } = useMsgViewer()
  const msg = useMessages()
  const [text, setText] = useState('')
  const [urgent, setUrgent] = useState(false)
  const sendStages = sortStages(Object.values(snap.col.stages)).filter(s => access.canW('messages', s.id))
  const people = Object.keys(snap.col.members).filter(u => u !== uid).sort((a, b) => msg.nameOf(a).localeCompare(msg.nameOf(b)))
  // Default "To": the open stage or department channel, else this stage, else everyone.
  const [kind] = channel.split(':')
  const defaultTo = kind === 'stage' || kind === 'dept' ? channel : sid ? `stage:${sid}` : 'all'
  // A pick is remembered only for the channel it was made in; switching
  // channel brings back that channel's default.
  const [pick, setPick] = useState<{ forDefault: string; to: string } | null>(null)
  const to = pick?.forDefault === defaultTo ? pick.to : defaultTo
  const setTo = (v: string) => setPick({ forDefault: defaultTo, to: v })

  const send = async () => {
    const body = text.trim()
    if (!body) return
    await msg.send(parseTarget(to), body, urgent)
    setText('')
    setUrgent(false)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() }
  }

  return (
    <div className="compose">
      <div className="fld">
        <label htmlFor="mtext">Message</label>
        <textarea id="mtext" placeholder="Type a message… (Ctrl or ⌘ + Enter sends)" maxLength={MAX_LEN} value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey} />
      </div>
      <div className="row">
        <label className="row small">
          <span className="muted">To</span>
          <select value={to} onChange={e => setTo(e.target.value)} aria-label="Send to">
            {/* Messaging everyone needs festival-wide messages edit. */}
            {access.perm('messages') >= 2 && <option value="all">Everyone</option>}
            {sendStages.length > 0 && <optgroup label="Stage teams">{sendStages.map(s => <option key={s.id} value={`stage:${s.id}`}>{s.name}</option>)}</optgroup>}
            <optgroup label="Departments">{(snap.cfg?.depts ?? []).map(d => <option key={d.id} value={`dept:${d.id}`}>{d.name}</option>)}</optgroup>
            {people.length > 0 && <optgroup label="People">{people.map(p => <option key={p} value={`user:${p}`}>{msg.nameOf(p)}</option>)}</optgroup>}
          </select>
        </label>
        <label className="row small"><input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} /> Urgent</label>
        <button type="button" className="btn primary push" onClick={send} disabled={!text.trim()}>Send</button>
      </div>
    </div>
  )
}

export function MessageItem({ m }: { m: Msg }) {
  const { uid } = useMsgViewer()
  const msg = useMessages()
  const { tz } = useEvent()
  const t = useNow(30_000)
  const [confirm, setConfirm] = useState(false)
  const acks = Object.keys(m.acks ?? {})
  const forMe = m.from !== uid && !(uid && m.acks?.[uid])
  const seen = acks.length
    ? `Seen by ${acks.slice(0, SEEN_NAMES).map(msg.nameOf).join(', ')}${acks.length > SEEN_NAMES ? ` +${acks.length - SEEN_NAMES}` : ''}`
    : m.pri === 'urgent' ? 'Not acknowledged yet' : ''
  return (
    <article className={`m ${m.pri === 'urgent' ? 'urg' : ''}`}>
      <Avatar uid={m.from} name={msg.nameOf(m.from)} />
      <div className="meta">
        <b>{msg.nameOf(m.from)}</b>
        <span>→ {msg.label(m.to)}</span>
        <span>{fmtTime(m.at, false, tz)} · {relTime(m.at, t)}</span>
        {m.pri === 'urgent' && <span className="chip st">Urgent</span>}
      </div>
      <div className="txt">{m.text}</div>
      <div className="ack">
        {seen}
        {forMe && <button type="button" className="btn sm" onClick={() => msg.ack(m)}>{m.pri === 'urgent' ? 'Acknowledge' : 'Mark seen'}</button>}
        {msg.canDelete(m) && (
          <button type="button" className="btn sm danger" onClick={() => (confirm ? msg.remove(m) : setConfirm(true))}>
            {confirm ? 'Delete for everyone?' : 'Delete'}
          </button>
        )}
      </div>
    </article>
  )
}

export function Messages({ sid }: { sid: Id | null }) {
  const snap = useSnapshot()
  const v = useMsgViewer()
  const urgent = usePendingUrgent()
  const chans = channels(snap, v.access)
  const [picked, setPicked] = useState<ChannelId>(sid ? `stage:${sid}` : 'inbox')
  const ch = chans.some(c => c.id === picked) ? picked : 'inbox'
  const list = visibleMsgs(snap.col.msgs, v).filter(m => inChannel(m, ch))
  // Anyone who can send on this stage, any of their stages, or festival-wide.
  const canSend = v.access.canW('messages', sid) || v.access.myStages().some(s => v.access.canW('messages', s.id)) || v.access.canW('messages')

  // Opening Messages (and new messages arriving while it's open) counts as read.
  useEffect(() => { markRead(v.uid, now()) }, [v.uid, snap.col.msgs])

  return (
    <>
      <Head title="Messages" sub="Send to everyone, a stage team, a department or one person. Urgent messages flash on the screens of everyone they're for until each person acknowledges." />
      <div className="msgs">
        <nav className="panel chan" aria-label="Channels">
          {chans.map(c => (
            <button key={c.id} type="button" aria-pressed={c.id === ch} onClick={() => setPicked(c.id)}>
              {c.tape && <span className="tape" style={colourVar(tapeHex(c.tape))} />}
              {c.label}
              {c.id === 'urgent' && urgent.length > 0 && <span className="badge">{urgent.length}</span>}
            </button>
          ))}
        </nav>
        <section className="panel">
          {canSend && <Compose sid={sid} channel={ch} />}
          {list.length ? list.map(m => <MessageItem key={m.id} m={m} />) : <p className="empty">No messages here yet.</p>}
        </section>
      </div>
    </>
  )
}
