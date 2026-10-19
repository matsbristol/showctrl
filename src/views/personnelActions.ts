/* Adding and editing personnel, one at a time or as a pasted list. */
import { sortStages } from '../access/access'
import { ACCRED } from '../domain/constants'
import { parseCrewList } from '../domain/people'
import { rid } from '../domain/runsheet'
import { useSnapshot, useStore } from '../data/hooks'
import { useAccess } from '../session/hooks'
import type { Accred, Id, Person } from '../types/model'
import { useForm, useToast } from '../ui/hooks'

export function usePersonnelActions(sid: Id | null) {
  const store = useStore()
  const snap = useSnapshot()
  const access = useAccess()
  const openForm = useForm()
  const toast = useToast()
  const depts = snap.cfg?.depts ?? []
  const deptOptions: [string, string][] = [['', '—'], ...depts.map(d => [d.id, d.name] as [string, string])]

  function editPerson(p?: Person) {
    // You can tick only stages you can edit; any others the person is on are kept.
    const stageOpts = sortStages(Object.values(snap.col.stages))
      .filter(s => access.canW('personnel', s.id) || (p?.stages ?? []).includes(s.id))
      .map(s => [s.id, s.name] as [string, string])
    openForm({
      title: p ? `Edit ${p.name}` : 'Add person',
      fields: [
        { k: 'name', label: 'Name' },
        { k: 'title', label: 'Job title', placeholder: 'e.g. Stage manager, Backline tech' },
        { k: 'phone', label: 'Phone' },
        { k: 'email', label: 'Email' },
        { k: 'company', label: 'Company / supplier' },
        { k: 'dept', label: 'Department', type: 'select', options: deptOptions },
        { k: 'accred', label: 'Accreditation', type: 'select', options: [['', 'None'], ...ACCRED.map(a => [a, a] as [string, string])] },
        { k: 'lead', label: 'Key contact', type: 'checks', options: [['yes', 'Show as a key contact']] },
        { k: 'stages', label: 'Works on', type: 'checks', full: true, options: stageOpts },
        { k: 'notes', label: 'Notes', type: 'textarea', full: true, placeholder: 'Shifts, radio call sign, dietary needs…' },
      ],
      values: {
        name: p?.name ?? '', title: p?.title ?? '', phone: p?.phone ?? '', email: p?.email ?? '',
        company: p?.company ?? '', dept: p?.dept ?? '', accred: p?.accred ?? (sid ? 'Stage' : ''),
        lead: p?.lead ? ['yes'] : [], stages: p?.stages ?? (sid ? [sid] : []), notes: p?.notes ?? '',
      },
      onSave: async v => {
        const name = (v.name as string).trim()
        if (!name) return 'Enter a name.'
        const keep = (p?.stages ?? []).filter(s => !stageOpts.some(([id]) => id === s))
        await store.set('people', p?.id ?? rid(), {
          name, title: v.title as string, phone: v.phone as string, email: v.email as string, company: v.company as string,
          dept: (v.dept as string) || undefined, accred: ((v.accred as string) || undefined) as Accred | undefined,
          lead: (v.lead as string[]).length > 0, stages: [...keep, ...(v.stages as string[])], notes: v.notes as string,
        })
      },
      onDelete: p ? () => store.delete('people', p.id) : undefined,
    })
  }

  /** Paste a list from a spreadsheet: one person per line. */
  function importList() {
    const stages = sortStages(Object.values(snap.col.stages)).filter(s => access.canW('personnel', s.id))
    openForm({
      title: 'Paste a crew list',
      fields: [
        { k: 'text', label: 'One person per line: name, job title, phone, email', type: 'textarea', full: true, placeholder: 'Kari Nordmann, Stagehand, +47 900 00 000, kari@example.com\nOla Hansen\tRigger\t+47 911 11 111' },
        { k: 'dept', label: 'Department', type: 'select', options: deptOptions },
        // From a stage, people go on that stage; from HQ they can also be HQ staff.
        { k: 'stage', label: 'Works on', type: 'select', options: [...(sid ? [] : [['', 'HQ / no stage'] as [string, string]]), ...stages.map(s => [s.id, s.name] as [string, string])] },
      ],
      values: { text: '', dept: '', stage: sid ?? '' },
      saveLabel: 'Add people',
      onSave: async v => {
        const rows = parseCrewList(v.text as string)
        if (!rows.length) return 'Paste at least one line.'
        const stage = v.stage as string
        const people: Person[] = rows.map(r => ({
          id: rid(), ...r, dept: (v.dept as string) || undefined, stages: stage ? [stage] : [],
          accred: stage ? 'Stage' : undefined, lead: false, notes: '',
        }))
        await store.setMany('people', people)
        toast(`Added ${people.length} ${people.length === 1 ? 'person' : 'people'}.`)
      },
    })
  }

  return { editPerson, importList }
}
