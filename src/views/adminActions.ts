/*
 * Admin and stage setup actions. Callers decide who sees each button:
 *   festival settings, roles, access, stages: perm('admin') >= 2
 *   a stage's details, template and crew:    canW('setup', stage) or admin
 */
import { useNavigate } from 'react-router-dom'
import { sortStages } from '../access/access'
import { now } from '../clock/clock'
import { accessChanges, addRole, blankEvent, removeAccessChanges, removeDept, removeRole, setCrew, setManager, setRoleContacts, setRolePerm, TEMPLATE_FIELDS, templateForForm, templateFromForm, upsertDept, withType } from '../domain/admin'
import { EVENT_TYPES, TAPE, TIME_ZONES } from '../domain/constants'
import { peopleFor } from '../domain/people'
import { rid } from '../domain/runsheet'
import { dayKey } from '../domain/time'
import { buildSample } from '../data/sample'
import { useSnapshot, useStore } from '../data/hooks'
import { emptySnapshot, LocalStore } from '../data/localStore'
import { useSession } from '../session/hooks'
import { personName } from '../shell/people'
import type { Dept, EventType, Id, Level, ModuleId, PermKey, Stage, TapeColor } from '../types/model'
import { useForm, useToast } from '../ui/hooks'
import { useEvent } from './hooks'

const TAPE_OPTIONS = Object.keys(TAPE).map(t => [t, t] as [string, string])

export function useAdminActions() {
  const store = useStore()
  const snap = useSnapshot()
  const openForm = useForm()
  const toast = useToast()
  const navigate = useNavigate()
  const session = useSession()
  const { T, tz, cfg } = useEvent()
  const stages = () => sortStages(Object.values(snap.col.stages))
  const nameOf = (uid: Id) => personName(snap, uid, session.viewer.uid)

  /* ---------------- stages ---------------- */

  /** Add or edit a stage. Only festival admins may delete one, and only once it's empty. */
  function editStage(s?: Stage, canDelete = false) {
    const artists = s ? Object.values(snap.col.artists).filter(a => a.stage === s.id).length : 0
    const items = s ? Object.values(snap.col.ros).filter(i => i.stage === s.id).length : 0
    const empty = !artists && !items
    openForm({
      title: s ? `Edit ${s.name}` : `Add ${T.stage.toLowerCase()}`,
      fields: [
        { k: 'name', label: 'Name', full: true },
        { k: 'tape', label: 'Colour', type: 'select', options: TAPE_OPTIONS },
        { k: 'order', label: 'Order', type: 'number' },
        { k: 'location', label: 'Location on site', placeholder: 'e.g. North field, gate C' },
        { k: 'radio', label: 'Radio channel' },
        { k: 'capacity', label: 'Capacity', type: 'number' },
        // Deleting a stage with content would leave artists and items pointing nowhere.
        ...(s && canDelete && !empty ? [{ k: 'note', type: 'note' as const, full: true, text: `To delete ${s.name}, first move or delete its ${artists} ${T.performers.toLowerCase()} and ${items} run sheet items.` }] : []),
      ],
      values: {
        name: s?.name ?? '', tape: s?.tape ?? 'blue', order: String(s?.order ?? Object.keys(snap.col.stages).length),
        location: s?.location ?? '', radio: s?.radio ?? '', capacity: s?.capacity ? String(s.capacity) : '',
      },
      onSave: async v => {
        const name = (v.name as string).trim()
        if (!name) return 'Enter a name.'
        await store.set('stages', s?.id ?? rid(), {
          ...s, name, tape: v.tape as TapeColor, order: Number(v.order) || 0,
          location: v.location as string, radio: v.radio as string, capacity: Number(v.capacity) || undefined,
        })
      },
      onDelete: s && canDelete && empty ? async () => {
        // Its managers and crew lose that stage too.
        for (const [uid, m] of Object.entries(snap.col.members)) if (m.stages?.[s.id]) await store.set('members', uid, setManager(m, s.id, false))
        await store.delete('stageteam', s.id)
        await store.delete('stages', s.id)
      } : undefined,
    })
  }

  function editTemplate(s: Stage) {
    const form = templateForForm(s.template)
    openForm({
      title: `Day sheet template · ${s.name}`,
      fields: [
        ...TEMPLATE_FIELDS.map(([k, label]) => ({ k, label: label.replace('Stage', T.stage), type: 'number' as const })),
        { k: 'note', type: 'note', full: true, text: 'Changes apply to day sheets generated from now on. Existing run sheet items keep their times.' },
      ],
      values: Object.fromEntries(Object.entries(form).map(([k, n]) => [k, String(n)])),
      onSave: async v => { await store.update('stages', s.id, { template: templateFromForm(v) }) },
    })
  }

  /* ---------------- stage team ---------------- */

  const setCrewMember = (sid: Id, uid: Id, on: boolean) => store.set('stageteam', sid, setCrew(snap.col.stageteam[sid], sid, uid, on))

  async function removeManager(uid: Id, sid: Id) {
    await store.set('members', uid, setManager(snap.col.members[uid], sid, false))
  }

  /** Approve a request to join a stage: add them as crew and clear the request. */
  async function approve(sid: Id, uid: Id) {
    await setCrewMember(sid, uid, true)
    if (snap.col.requests[uid]) await store.delete('requests', uid)
  }

  /**
   * Demo mode stand-in for "pick someone from your organisation": creates a
   * demo person, optionally linked to their personnel entry. With real
   * sign-in this becomes a search of the organisation's users.
   */
  function addDemoUser(sid: Id, asManager: boolean) {
    const s = snap.col.stages[sid]
    openForm({
      title: asManager ? `Appoint ${T.stage.toLowerCase()} manager · ${s?.name}` : `Add to ${s?.name} team`,
      fields: [
        { k: 'person', label: 'Personnel entry', type: 'select', full: true, options: [['', '— Someone not in the list —'], ...peopleFor(snap.col.people, sid).map(p => [p.id, `${p.name}${p.title ? ' · ' + p.title : ''}`] as [string, string])] },
        { k: 'name', label: 'Name', full: true, show: v => !v.person },
      ],
      values: { person: '', name: '' },
      saveLabel: asManager ? 'Appoint' : 'Add to team',
      onSave: async v => {
        const p = v.person ? snap.col.people[v.person as string] : undefined
        const name = (v.name as string).trim() || p?.name
        if (!name) return 'Pick a personnel entry or enter a name.'
        const uid = 'demo-' + rid()
        await store.set('members', uid, { name, role: 'none', person: p?.id ?? null, depts: p?.dept ? [p.dept] : [], stages: asManager ? { [sid]: 'manager' } : {} })
        if (!asManager) await setCrewMember(sid, uid, true)
        toast(`${name} ${asManager ? `now manages ${s?.name}` : `joined the ${s?.name} team`}.`)
      },
    })
  }

  /* ---------------- people with access ---------------- */

  /** Set someone's festival role, stages, departments and personnel link. `uid` absent = new demo person. */
  function editAccess(uid?: Id) {
    const id = uid ?? 'demo-' + rid()
    const isNew = !uid
    const m = snap.col.members[id]
    const request = snap.col.requests[id]
    const stageOpts = stages().map(s => [s.id, s.name] as [string, string])
    openForm({
      title: isNew ? 'Give someone access' : `Access · ${nameOf(id)}`,
      fields: [
        ...(session.mode === 'demo' ? [{ k: 'name', label: 'Name', full: true }] : []),
        { k: 'role', label: 'Festival role', type: 'select', options: Object.entries(snap.roles).map(([k, r]) => [k, r.label] as [string, string]) },
        { k: 'person', label: 'Personnel entry', type: 'select', options: [['', '— Not linked —'], ...Object.values(snap.col.people).sort((a, b) => a.name.localeCompare(b.name)).map(p => [p.id, `${p.name}${p.title ? ' · ' + p.title : ''}`] as [string, string])] },
        { k: 'mgr', label: `${T.stage} manager for`, type: 'checks', full: true, options: stageOpts },
        { k: 'crew', label: `${T.stage} crew on`, type: 'checks', full: true, options: stageOpts },
        { k: 'depts', label: 'Departments (for department messages)', type: 'checks', full: true, options: (cfg?.depts ?? []).map(d => [d.id, d.name] as [string, string]) },
      ],
      values: {
        name: m?.name ?? '', role: m?.role ?? 'none', person: m?.person ?? '', depts: m?.depts ?? [],
        mgr: Object.keys(m?.stages ?? {}).filter(s => m!.stages[s] === 'manager'),
        // A request to join a stage pre-ticks that stage's crew box.
        crew: stages().filter(s => snap.col.stageteam[s.id]?.crew?.[id]).map(s => s.id).concat(request?.stage && !m?.role ? [request.stage] : []),
      },
      onSave: async v => {
        if (session.mode === 'demo' && isNew && !(v.name as string).trim()) return 'Enter a name.'
        const ch = accessChanges(snap, id, {
          role: v.role as string, person: (v.person as string) || undefined, depts: v.depts as string[],
          managerOf: v.mgr as string[], crewOn: v.crew as string[], name: (v.name as string).trim() || undefined,
        })
        await store.set('members', id, ch.member)
        for (const t of ch.teams) await store.set('stageteam', t.id, t)
        if (ch.clearRequest) await store.delete('requests', id)
      },
      // You can't remove your own access (you'd lock yourself out mid-edit).
      onDelete: m && id !== session.viewer.uid ? async () => {
        for (const t of removeAccessChanges(snap, id)) await store.set('stageteam', t.id, t)
        await store.delete('members', id)
      } : undefined,
    })
  }

  const decline = (uid: Id) => store.delete('requests', uid)

  /* ---------------- roles ---------------- */

  const setPerm = (key: string, k: PermKey, level: Level) => store.setRoles(setRolePerm(snap.roles, key, k, level))
  const setContacts = (key: string, on: boolean) => store.setRoles(setRoleContacts(snap.roles, key, on))

  function newRole() {
    openForm({
      title: 'Add role',
      fields: [
        { k: 'label', label: 'Role name', full: true, placeholder: 'e.g. Medical coordinator' },
        { k: 'copy', label: 'Start from', type: 'select', options: Object.entries(snap.roles).map(([k, r]) => [k, r.label] as [string, string]) },
      ],
      values: { label: '', copy: 'site' },
      onSave: async v => {
        const label = (v.label as string).trim()
        if (!label) return 'Enter a name.'
        await store.setRoles(addRole(snap.roles, label, v.copy as string).roles)
      },
    })
  }

  async function deleteRole(key: string) {
    const out = removeRole(snap, snap.roles, key)
    if (typeof out === 'string') toast(out)
    else await store.setRoles(out)
  }

  /* ---------------- event, modules, departments ---------------- */

  function editEvent() {
    if (!cfg) return
    openForm({
      title: 'Edit event',
      fields: [
        { k: 'name', label: 'Event name', full: true },
        { k: 'type', label: 'Event type', type: 'select', options: Object.entries(EVENT_TYPES).map(([k, t]) => [k, t.label] as [string, string]) },
        { k: 'tz', label: 'Time zone', type: 'select', options: TIME_ZONES.map(z => [z, z] as [string, string]) },
        { k: 'start', label: 'First day', type: 'date' },
        { k: 'end', label: 'Last day', type: 'date' },
        { k: 'visitors', label: 'Expected visitors', type: 'number' },
        { k: 'note', type: 'note', full: true, text: 'The event type sets the vocabulary: a conference shows Speakers and Rooms instead of Artists and Stages.' },
      ],
      values: { name: cfg.name, type: cfg.type, tz: cfg.tz, start: cfg.start, end: cfg.end, visitors: cfg.visitors ? String(cfg.visitors) : '' },
      onSave: async v => {
        if (!v.start || !v.end) return 'Set the first and last day.'
        if ((v.end as string) < (v.start as string)) return 'The last day must be after the first day.'
        await store.setEvent({
          ...withType(cfg, v.type as EventType),
          name: (v.name as string).trim() || 'Untitled event', tz: v.tz as string,
          start: v.start as string, end: v.end as string, visitors: Number(v.visitors) || undefined,
        })
      },
    })
  }

  const setModule = (id: ModuleId, on: boolean) => cfg && store.setEvent({ ...cfg, modules: { ...cfg.modules, [id]: on } })

  function editDept(d?: Dept) {
    if (!cfg) return
    openForm({
      title: d ? 'Edit department' : 'Add department',
      fields: [
        { k: 'name', label: 'Name', full: true },
        { k: 'tape', label: 'Spike tape colour', type: 'select', options: TAPE_OPTIONS },
      ],
      values: { name: d?.name ?? '', tape: d?.tape ?? 'grey' },
      onSave: async v => {
        const name = (v.name as string).trim()
        if (!name) return 'Enter a name.'
        await store.setEvent({ ...cfg, depts: upsertDept(cfg.depts, { id: d?.id, name, tape: v.tape as TapeColor }) })
      },
      onDelete: d ? () => store.setEvent({ ...cfg, depts: removeDept(cfg.depts, d.id) }) : undefined,
    })
  }

  /* ---------------- demo data ---------------- */

  /** Demo only: replace everything with a fresh sample festival, or a blank event. */
  function resetDemo(blank = false) {
    if (!(store instanceof LocalStore)) return
    openForm({
      title: blank ? 'Start a blank event?' : 'Reload the sample festival?',
      fields: [{ k: 'note', type: 'note', full: true, text: blank
        ? 'Removes everything in this browser and starts an empty event. You stay as the festival admin.'
        : 'Replaces everything in this browser with a fresh sample festival, built around the current time.' }],
      values: {},
      saveLabel: blank ? 'Start blank' : 'Reload',
      onSave: () => {
        if (blank) {
          // Keep one admin, so there is still someone to set the event up.
          const empty = emptySnapshot()
          empty.cfg = blankEvent(dayKey(now(), tz), tz)
          empty.col.members['demo-admin'] = { id: 'demo-admin', name: 'Festival admin', role: 'admin', stages: {}, depts: [], person: null }
          store.reset(empty)
        } else {
          store.reset(buildSample(now()))
        }
        session.setDemoUser('demo-admin')
        navigate(blank ? '/hq/admin' : '/hq/overview')
      },
    })
  }

  return {
    editStage, editTemplate, setCrewMember, removeManager, approve, addDemoUser,
    editAccess, decline, setPerm, setContacts, newRole, deleteRole,
    editEvent, setModule, editDept, resetDemo,
  }
}
