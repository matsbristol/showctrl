/*
 * Stage setup, for that stage's managers (and festival admins): details,
 * the template every new day sheet is built from, and who can use this
 * stage in showctrl. Managers are appointed by the festival admin; managers
 * add and remove their own crew.
 */
import { stageRoleOf } from '../access/access'
import { stageCrew, TEMPLATE_FIELDS, templateForForm } from '../domain/admin'
import { tapeHex } from '../domain/constants'
import { stageManagers } from '../domain/people'
import { useSnapshot } from '../data/hooks'
import { useAccess, useSession } from '../session/hooks'
import { Avatar } from '../shell/Avatar'
import { Icon } from '../shell/Icon'
import { personName } from '../shell/people'
import { colourVar } from '../shell/style'
import type { Id } from '../types/model'
import { useAdminActions } from './adminActions'
import { InviteLink } from './InviteLink'
import { Head } from './common'
import { useEvent } from './hooks'

export function StageSetup({ sid }: { sid: Id }) {
  const snap = useSnapshot()
  const access = useAccess()
  const act = useAdminActions()
  const session = useSession()
  const { T } = useEvent()
  const stage = snap.col.stages[sid]
  const tpl = templateForForm(stage.template)
  const managers = stageManagers(snap, sid)
  const crew = stageCrew(snap, sid)
  const name = (uid: string) => personName(snap, uid)
  // People asking to join this stage who aren't on it and have no festival role.
  const requests = Object.values(snap.col.requests).filter(r =>
    r.stage === sid && !stageRoleOf(snap, r.id, sid) && !(snap.col.members[r.id]?.role && snap.col.members[r.id].role !== 'none'))
  const stageWord = T.stage.toLowerCase()

  return (
    <>
      <Head
        title={`${T.stage} setup · ${stage.name}`}
        sub={`${T.stage} details, who can use this ${stageWord} in showctrl, and the template every new day sheet is built from.`}
        actions={<button type="button" className="btn" onClick={() => act.editStage(stage, access.perm('admin') >= 2)}><Icon name="edit" />Edit details</button>}
      />
      <div className="grid g2">
        <section className="panel">
          <div className="ph"><h3>Details</h3></div>
          <div className="pb">
            <dl className="kv">
              <dt>Location</dt><dd>{stage.location || '—'}</dd>
              <dt>Radio channel</dt><dd>{stage.radio || '—'}</dd>
              <dt>Capacity</dt><dd>{stage.capacity ? Number(stage.capacity).toLocaleString('en-GB') : '—'}</dd>
              <dt>Colour</dt><dd><span className="tape" style={colourVar(tapeHex(stage.tape))} /> {stage.tape}</dd>
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="ph">
            <h3>Day sheet template</h3>
            <div className="actions"><button type="button" className="btn sm" onClick={() => act.editTemplate(stage)}><Icon name="edit" />Edit</button></div>
          </div>
          <div className="pb">
            <dl className="kv">
              {TEMPLATE_FIELDS.map(([k, label]) => <div key={k} className="contents"><dt>{label.replace('Stage', T.stage)}</dt><dd className="num">{tpl[k]} min</dd></div>)}
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="ph">
            <h3>{T.stage} team in showctrl</h3>
            {session.mode === 'demo' && <div className="actions"><button type="button" className="btn sm primary" onClick={() => act.addDemoUser(sid, false)}><Icon name="plus" />Add</button></div>}
          </div>
          {session.live && (
            <div className="pb bordered stack small">
              <span>To add crew, send them this link. They sign in, ask to join, and appear here to add.</span>
              <InviteLink eventId={session.live.eventId} stage={sid} />
            </div>
          )}
          {requests.length > 0 && (
            <div className="pb bordered">
              <b>Asking to join</b>
              {requests.map(r => (
                <div key={r.id} className="row gap-t">
                  <Avatar uid={r.id} name={name(r.id)} />
                  <span>{name(r.id)}<span className="small muted"> · {r.note}</span></span>
                  <button type="button" className="btn sm go push" onClick={() => act.approve(sid, r.id)}>Add to team</button>
                </div>
              ))}
            </div>
          )}
          <ul className="list">
            {managers.map(u => (
              <li key={u}><Avatar uid={u} name={name(u)} /><span><b>{name(u)}</b><span className="small muted"> · {T.stage} manager (set by festival admin)</span></span></li>
            ))}
            {crew.map(u => (
              <li key={u}>
                <Avatar uid={u} name={name(u)} />
                <span><b>{name(u)}</b><span className="small muted"> · {T.stage} crew</span></span>
                <button type="button" className="btn sm danger push" onClick={() => act.setCrewMember(sid, u, false)} aria-label={`Remove ${name(u)} from the team`}>Remove</button>
              </li>
            ))}
            {!managers.length && !crew.length && <li className="muted">Nobody yet.</li>}
          </ul>
          <p className="small muted pad">
            {T.stage} crew can see this {stageWord}'s run sheet, {T.performers.toLowerCase()}, crew list and display, and send messages. Only {stageWord} managers change things.
          </p>
        </section>
      </div>
    </>
  )
}
