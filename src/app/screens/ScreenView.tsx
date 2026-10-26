// What a monitor shows: the blocks chosen for that screen, sized to be read from across a room.

import { useEffect, useRef } from 'react'
import { useCollection, useConfig } from '../../data/hooks'
import { eff, itemsFor, nowNext } from '../../lib/runsheet'
import { countdownState, festDay, fmtCountdown, fmtTime } from '../../lib/time'
import { truckMoves } from '../../lib/trucks'
import { visibleMsgs } from '../../shared/messages'
import { moduleOn } from '../../shared/modules'
import { personName } from '../../shared/people'
import { HOUR, MIN, TAPE } from '../../types/constants'
import type { Screen, Stage } from '../../types/model'
import { Icon } from '../Icon'
import { kindClass, kindIcon, kindLabel, kindLabelEn } from '../runsheet/helpers'
import { useAccess, useNow, useTz } from '../session'
import { tr } from '../../i18n'

function NowNextCard({ st }: { st: Stage }) {
  const ros = useCollection('ros')
  const tz = useTz()
  const t = useNow()
  const { cur, next } = nowNext(ros, st.id, t, tz)
  const line = (label: string, it: typeof cur, target: number | undefined) => (
    <div className="sv-slot">
      <span className="sv-lbl">{tr(label)}</span>
      {it ? (
        <>
          <span className="sv-ttl">{it.kind === 'show' || it.title.startsWith(kindLabelEn(it.kind)) || it.title.startsWith(kindLabel(it.kind)) ? it.title : `${kindLabel(it.kind)} · ${it.title}`}</span>
          {target != null && <span className={`sv-cd ${countdownState(target - t, it.kind === 'show' ? 10 : 5)}`}>{fmtCountdown(target - t)}</span>}
        </>
      ) : <span className="sv-ttl muted">—</span>}
    </div>
  )
  return (
    <section className="sv-card" style={{ ['--c' as string]: TAPE[st.tape] }}>
      <h3>{st.name}{(next?.delay || cur?.delay) ? <span className="sv-late">{tr('{n} min late', { n: Math.round(((next?.delay || cur?.delay) ?? 0) / MIN) })}</span> : null}</h3>
      {line('Now', cur, cur ? eff(cur).e : undefined)}
      {line('Next', next, next ? eff(next).s : undefined)}
    </section>
  )
}

/** The running order for the followed stages: what's done fades, the list keeps now in view. */
function Schedule({ stages }: { stages: Stage[] }) {
  const ros = useCollection('ros')
  const artists = useCollection('artists')
  const tz = useTz()
  const t = useNow(15_000)
  const box = useRef<HTMLOListElement>(null)
  const day = festDay(t, tz)
  const items = stages.flatMap(s => itemsFor(ros, s.id, tz, day)).filter(i => i.kind !== 'access').sort((a, b) => eff(a).s - eff(b).s)
  const firstOpen = items.findIndex(i => i.status !== 'done' && eff(i).e > t)
  const byId = Object.fromEntries(stages.map(s => [s.id, s]))

  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[data-first]')
    if (el && box.current) box.current.scrollTop = Math.max(0, el.offsetTop - box.current.offsetTop - 8)
  }, [firstOpen])

  return (
    <section className="sv-schedule">
      <h3>{tr('Running order')}</h3>
      <ol ref={box}>
        {items.map((i, k) => {
          const e = eff(i)
          const st = byId[i.stage]
          return (
            <li key={i.id} className={`${kindClass(i.kind)} ${i.status}`} {...(k === firstOpen ? { 'data-first': '' } : {})}>
              <span className="sv-time num">{fmtTime(e.s, tz)}</span>
              <span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} />
              <Icon name={kindIcon(i.kind)} />
              <span className="sv-what">{(i.artist && artists[i.artist]?.name) || i.title}<small>{kindLabel(i.kind)}{stages.length > 1 ? ` · ${st.name}` : ''}</small></span>
            </li>
          )
        })}
        {!items.length && <li className="muted">{tr('Nothing scheduled today.')}</li>}
      </ol>
    </section>
  )
}

function Messages() {
  const a = useAccess()
  const msgs = useCollection('msgs')
  const members = useCollection('members')
  const people = useCollection('people')
  const tz = useTz()
  const list = visibleMsgs(a, msgs).slice(0, 4)
  return (
    <section className="sv-msgs">
      <h3>{tr('Messages')}</h3>
      {list.map(m => (
        <p key={m.id} className={m.pri === 'urgent' ? 'urg' : ''}>
          <b className="num">{fmtTime(m.at, tz)}</b> <b>{personName(m.from, members, people)}</b> {m.text}
        </p>
      ))}
      {!list.length && <p className="muted">{tr('No messages.')}</p>}
    </section>
  )
}

function Trucks({ stages }: { stages: Stage[] }) {
  const ros = useCollection('ros')
  const artists = useCollection('artists')
  const locations = useCollection('locations')
  const tz = useTz()
  const t = useNow(30_000)
  const ids = new Set(stages.map(s => s.id))
  const due = truckMoves(ros, { from: t - 15 * MIN, to: t + 3 * HOUR }).filter(i => ids.has(i.stage) && i.status !== 'done').slice(0, 6)
  return (
    <section className="sv-trucks">
      <h3>{tr('Trucks due')}</h3>
      {due.map(i => (
        <p key={i.id} className={kindClass(i.kind)}>
          <b className="num">{fmtTime(eff(i).s, tz)}</b> <Icon name={kindIcon(i.kind)} /> {(i.artist && artists[i.artist]?.name) || i.title} · {i.trucks} → {i.dest ? locations[i.dest]?.name : '?'}
        </p>
      ))}
      {!due.length && <p className="muted">{tr('No trucks in the next three hours.')}</p>}
    </section>
  )
}

export function ScreenView({ screen }: { screen: Screen }) {
  const a = useAccess()
  const cfg = useConfig('event')
  const tz = useTz()
  const t = useNow()
  const visible = a.visibleStages()
  const stages = screen.stages.length ? visible.filter(s => screen.stages.includes(s.id)) : visible
  const has = (b: Screen['blocks'][number]) => screen.blocks.includes(b)
  const side = has('schedule')
  return (
    <div className={`screenview${side ? ' with-schedule' : ''}`}>
      <header className="sv-head">
        <span className="sv-name">{screen.name}</span>
        <span className="sv-event">{cfg?.name}</span>
        {has('clock') && <span className="sv-clock num">{fmtTime(t, tz, true)}</span>}
      </header>
      {side && <Schedule stages={stages} />}
      <div className="sv-main">
        {has('nownext') && <div className="sv-cards">{stages.map(s => <NowNextCard key={s.id} st={s} />)}</div>}
        {(has('messages') && moduleOn(cfg, 'messages')) || (has('trucks') && moduleOn(cfg, 'trucks')) ? (
          <div className="sv-bottom">
            {has('messages') && moduleOn(cfg, 'messages') && <Messages />}
            {has('trucks') && moduleOn(cfg, 'trucks') && <Trucks stages={stages} />}
          </div>
        ) : null}
      </div>
    </div>
  )
}
