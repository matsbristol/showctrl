import { Link } from 'react-router-dom'
import { useCollection, useStore } from '../data/hooks'
import { useAccess, useTerms } from './session'

/**
 * Admins of a new event: the four steps to get it running, each ticked off as it's done.
 * Disappears when all are done, or when hidden (per person, kept in their prefs).
 */
export function SetupChecklist() {
  const a = useAccess()
  const t = useTerms()
  const store = useStore()
  const stages = useCollection('stages')
  const members = useCollection('members')
  const stageteam = useCollection('stageteam')
  const ros = useCollection('ros')
  const prefs = useCollection('prefs')
  if (!a.canW('admin') || !a.me || prefs[a.me]?.setupHidden) return null

  const list = Object.values(stages)
  const first = a.stagesSorted()[0]
  const managed = (sid: string) => Object.values(members).some(m => m.stages?.[sid] === 'manager')
  const team = Object.values(members).filter(m => m.role !== 'admin').length + Object.values(stageteam).reduce((n, s) => n + Object.keys(s.crew ?? {}).length, 0)
  const steps = [
    { done: list.length > 0, title: `Add your ${t.stages.toLowerCase()}`, how: `Each gets its own run sheet, crew and clock.`, to: '/hq/admin?tab=stages', go: `Add ${t.stages.toLowerCase()}` },
    { done: list.length > 0 && list.every(s => managed(s.id)), title: `Appoint a stage manager for each ${t.stage.toLowerCase()}`, how: 'They run their stage and add their own crew.', to: '/hq/admin?tab=stages', go: 'Appoint' },
    { done: Object.values(ros).some(i => i.kind === 'show'), title: `Add ${t.performers.toLowerCase()} with their times`, how: `On a ${t.stage.toLowerCase()}’s run sheet, “Add ${t.performer.toLowerCase()} with day sheet” fills in their whole day.`, to: first ? `/s/${first.id}/runsheet` : '/hq/admin?tab=stages', go: 'Open run sheet' },
    { done: team > 0, title: 'Give your team access', how: 'They get an email with how to sign in.', to: '/hq/personnel', go: 'Open People' },
  ]
  const left = steps.filter(s => !s.done).length
  if (!left) return null
  return (
    <section className="panel setup-list no-print" aria-label="Get this event ready">
      <div className="ph">
        <h3>Get this event ready</h3>
        <span className="small muted">{steps.length - left} of {steps.length} done</span>
        <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => void store.set('prefs', a.me!, { ...prefs[a.me!], setupHidden: true })}>Hide</button>
      </div>
      <ol>
        {steps.map(s => (
          <li key={s.title} className={s.done ? 'done' : undefined}>
            <span className="tick" aria-label={s.done ? 'Done' : 'To do'}>{s.done ? '✓' : ''}</span>
            <span className="stack"><b>{s.title}</b><span className="small muted">{s.how}</span></span>
            {!s.done && <Link className="btn sm" to={s.to}>{s.go}</Link>}
          </li>
        ))}
      </ol>
    </section>
  )
}
