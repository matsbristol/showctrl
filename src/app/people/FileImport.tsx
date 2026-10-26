import { useMemo, useState } from 'react'
import { useCollection, useConfig, useStore } from '../../data/hooks'
import { getLang, tr } from '../../i18n'
import { accredLevels } from '../../lib/accred'
import { rid } from '../../lib/id'
import { EXPORT_FIELDS, findHeader, guessColumns, PERSON_FIELDS, peopleRows, planSheet, sampleSheets, type PersonField } from '../../lib/peopleSheet'
import { TAPE } from '../../types/constants'
import type { Dept, Id, Person, TapeColor } from '../../types/model'
import { useAccess, useTerms } from '../session'
import { Field, FormDialog } from '../ui/Dialog'
import { useToast } from '../ui/toast'
import { fileSlug, readSheetFile, saveCsv, saveXlsx, SHEET_ACCEPT, type SheetFile } from './sheetFiles'

function useFieldLabels(): Record<PersonField, string> {
  const t = useTerms()
  return {
    name: tr('Name'), first: tr('First name'), last: tr('Last name'), title: tr('Job title'), company: tr('Company / supplier'),
    dept: tr('Department'), stages: tr('Works on ({stages})', { stages: t.stages.toLowerCase() }), phone: tr('Phone'), email: tr('Email'),
    accred: tr('Accreditation'), lead: tr('Key contact'), notes: tr('Notes'),
  }
}

/** Column headers for export and the sample sheet: the field labels, in the current language. */
const exportHeaders = (labels: Record<PersonField, string>) =>
  Object.fromEntries(EXPORT_FIELDS.map(f => [f, f === 'stages' ? labels.stages.replace(/\s*\(.*\)$/, '') : labels[f]])) as Record<(typeof EXPORT_FIELDS)[number], string>

const peopleFile = (event: string, stage: string | undefined, what: string) =>
  `${fileSlug(event)}-${stage ? fileSlug(stage) + '-' : ''}${what}`

/** Import people from an Excel or CSV file. The header row decides which column is what; you can change it. */
export function FileImportForm({ sid, onClose }: { sid: Id | null; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const cfg = useConfig('event')!
  const people = useCollection('people')
  const toast = useToast()
  const labels = useFieldLabels()
  const t = useTerms()
  const festivalWide = a.canW('personnel')
  const stageOpts = a.stagesSorted().filter(s => a.canW('personnel', s.id))
  const [file, setFile] = useState<{ name: string; sheet: SheetFile } | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [columns, setColumns] = useState<(PersonField | '')[]>([])
  const [dept, setDept] = useState('')
  const [stage, setStage] = useState(sid ?? (festivalWide ? '' : stageOpts[0]?.id ?? ''))
  const [update, setUpdate] = useState(true)
  const [err, setErr] = useState('')

  const all = useMemo(() => (file && sheetName ? file.sheet.rows(sheetName) : []), [file, sheetName])
  const head = findHeader(all)
  const header = all[head] ?? []
  const body = all.slice(head + 1)
  const onlyStage = festivalWide && !sid ? null : stage || null
  const ctx = { people, depts: cfg.depts, stages: a.stagesSorted(), accred: accredLevels(cfg), defaults: { dept: dept || null, stage: stage || null }, onlyStage, update }
  const plan = file ? planSheet(body, columns, ctx) : null
  const hasName = columns.includes('name') || columns.includes('first') || columns.includes('last')

  const pick = (s: SheetFile, name: string) => {
    const rows = s.rows(name)
    setSheetName(name)
    setColumns(guessColumns(rows[findHeader(rows)] ?? []))
  }
  const open = async (f: File | undefined) => {
    setErr('')
    if (!f) return
    try {
      const s = await readSheetFile(f)
      const first = s.names.find(n => s.rows(n).length > 1) ?? s.names[0]
      if (!first) throw new Error()
      setFile({ name: f.name, sheet: s })
      pick(s, first)
    } catch {
      setFile(null)
      setErr(tr('Couldn’t read that file. Use Excel (.xlsx, .xls), OpenDocument (.ods) or CSV.'))
    }
  }

  const sample = async (format: 'xlsx' | 'csv') => {
    const yes = tr('Yes'), hq = sid ? '' : 'HQ'
    const { people: rows, values } = sampleSheets({
      depts: cfg.depts, stages: sid ? a.stagesSorted().filter(s => s.id === sid) : a.stagesSorted(), accred: accredLevels(cfg), headers: exportHeaders(labels), yes, hq,
      examples: [
        { title: tr('Stagehand'), company: '', notes: tr('Example: replace with your own people') },
        { title: tr('Rigger'), company: tr('Rigging company'), notes: '' },
        { title: tr('Production coordinator'), company: '', notes: tr('Vegetarian') },
      ],
      severalNote: tr('Several: separate with commas'),
    })
    const name = peopleFile(cfg.name, sid ? a.stagesSorted().find(s => s.id === sid)?.name : undefined, getLang() === 'nb' ? 'personer-mal' : 'people-sample')
    if (format === 'xlsx') await saveXlsx([{ name: tr('People'), rows }, { name: tr('Valid values'), rows: values }], `${name}.xlsx`)
    else saveCsv(rows, `${name}.csv`, getLang() === 'nb' ? ';' : ',')
  }

  const total = plan ? plan.add.length + plan.update.length : 0
  return (
    <FormDialog
      title={tr('Import people from a file')}
      saveLabel={total ? (total === 1 ? tr('Import 1 person') : tr('Import {n} people', { n: total })) : tr('Import')}
      onClose={onClose}
      onSave={async () => {
        if (!plan) return tr('Choose a file first.')
        if (!hasName) return tr('Choose which column holds the name.')
        if (!total) return tr('Nothing to import: everyone in the file is already up to date.')
        // New departments: admins add them to the event; others leave the department empty.
        const ids = new Map<string, Id>()
        if (plan.newDepts.length && a.canW('admin')) {
          const free = (Object.keys(TAPE) as TapeColor[]).filter(c => !cfg.depts.some(d => d.tape === c))
          const added: Dept[] = plan.newDepts.map(name => ({ id: rid(), name, tape: free.shift() ?? 'grey' }))
          added.forEach(d => ids.set(d.name.toLowerCase().replace(/[\s_]+/g, ' ').trim(), d.id))
          await store.setConfig('event', { ...cfg, depts: [...cfg.depts, ...added] })
        }
        const final = ids.size ? planSheet(body, columns, ctx, ids) : plan
        if (final.add.length) await store.setMany('people', final.add)
        for (const u of final.update) await store.update('people', u.id, u.patch)
        toast(tr('Imported: {added} new, {updated} updated.', { added: final.add.length, updated: final.update.length }))
      }}
    >
      <Field label={tr('Excel or CSV file')} full>
        <input type="file" accept={SHEET_ACCEPT} onChange={e => void open(e.target.files?.[0])} />
      </Field>
      {err && <p className="fld full small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
      {!file && (
        <div className="fld full small">
          <p className="muted">{tr('The first row names the columns, in English or Norwegian, in any order. Start from the sample sheet: it has the right columns, three example people to replace, and a second sheet with this event’s departments, {stages} and accreditation levels.', { stages: t.stages.toLowerCase() })}</p>
          <div className="row" style={{ marginTop: '.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn sm" onClick={() => void sample('xlsx')}>{tr('Download sample sheet (Excel)')}</button>
            <button type="button" className="btn sm" onClick={() => void sample('csv')}>{tr('CSV')}</button>
          </div>
        </div>
      )}

      {file && (
        <>
          {file.sheet.names.length > 1 && (
            <Field label={tr('Sheet')} full>
              <select value={sheetName} onChange={e => pick(file.sheet, e.target.value)}>
                {file.sheet.names.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          )}
          <div className="fld full">
            <span>{tr('Columns')}</span>
            <div className="sheet-map">
              {header.map((h, c) => (
                <label key={c} className="sheet-col">
                  <span className="stack" style={{ minWidth: 0 }}>
                    <b>{String(h || tr('Column {n}', { n: c + 1 }))}</b>
                    <span className="small muted ellipsis">{body.find(r => r[c])?.[c] ?? ''}</span>
                  </span>
                  <select value={columns[c] ?? ''} aria-label={tr('Column {n}', { n: c + 1 })}
                    onChange={e => setColumns(cs => header.map((_, i) => (i === c ? e.target.value as PersonField | '' : cs[i] === e.target.value ? '' : cs[i] ?? '')))}>
                    <option value="">{tr('Leave out')}</option>
                    {PERSON_FIELDS.map(f => <option key={f} value={f}>{labels[f]}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <Field label={tr('Department, when the file has none')}>
            <select value={dept} onChange={e => setDept(e.target.value)}>
              <option value="">—</option>
              {cfg.depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label={festivalWide && !sid ? tr('Works on, when the file doesn’t say') : tr('Works on')}>
            <select value={stage} onChange={e => setStage(e.target.value)}>
              {festivalWide && !sid && <option value="">{tr('HQ / no stage')}</option>}
              {stageOpts.filter(s => !sid || s.id === sid).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={tr('People already on the list')} full>
            <div className="checks"><label><input type="checkbox" checked={update} onChange={e => setUpdate(e.target.checked)} />{tr('Update them with the file’s details (matched by email, then name)')}</label></div>
          </Field>
          {plan && (
            <div className="fld full small">
              <p><b>{tr('{added} new · {updated} to update · {same} already up to date', { added: plan.add.length, updated: plan.update.length, same: plan.unchanged })}</b></p>
              {plan.skipped.length > 0 && <p className="muted">{tr('Left out (no name, or not on your stage): rows {rows}', { rows: plan.skipped.map(r => Number(r) + head + 1).join(', ') })}</p>}
              {plan.newDepts.length > 0 && (
                <p className="muted">{a.canW('admin')
                  ? tr('New departments to add: {names}', { names: plan.newDepts.join(', ') })
                  : tr('Not departments in this event, left empty: {names}', { names: plan.newDepts.join(', ') })}</p>
              )}
              {plan.unknownAccred.length > 0 && <p style={{ color: 'var(--standby)' }}>{tr('Not accreditation levels in this event, left empty: {names}', { names: plan.unknownAccred.join(', ') })}</p>}
              {plan.add.length > 0 && <p className="muted">{tr('First new person:')} <b>{plan.add[0].name}</b>{[plan.add[0].title, plan.add[0].phone, plan.add[0].email].filter(Boolean).map(x => ` · ${x}`).join('')}</p>}
            </div>
          )}
        </>
      )}
    </FormDialog>
  )
}

/** Download the list as Excel or CSV. Opens the file in whatever the person uses for spreadsheets. */
export function ExportForm({ list, all, sid, signIn, onClose }: { list: Person[]; all: Person[]; sid: Id | null; signIn?: (p: Person) => string; onClose: () => void }) {
  const cfg = useConfig('event')!
  const stages = useCollection('stages')
  const labels = useFieldLabels()
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [which, setWhich] = useState<'shown' | 'all'>('shown')
  const filtered = list.length !== all.length
  return (
    <FormDialog
      title={tr('Export people')}
      saveLabel={tr('Download')}
      onClose={onClose}
      onSave={async () => {
        const people = which === 'all' ? all : list
        if (!people.length) return tr('Nobody to export.')
        const rows = peopleRows(people, { depts: cfg.depts, stages, headers: exportHeaders(labels), yes: tr('Yes'), hq: sid ? '' : 'HQ' }, signIn && { header: tr('showctrl.no access'), value: signIn })
        const name = peopleFile(cfg.name, sid ? stages[sid]?.name : undefined, getLang() === 'nb' ? 'personer' : 'people')
        if (format === 'xlsx') await saveXlsx([{ name: tr('People'), rows }], `${name}.xlsx`)
        else saveCsv(rows, `${name}.csv`, getLang() === 'nb' ? ';' : ',')
      }}
    >
      <Field label={tr('Format')}>
        <select value={format} onChange={e => setFormat(e.target.value as 'xlsx' | 'csv')}>
          <option value="xlsx">{tr('Excel (.xlsx)')}</option>
          <option value="csv">{tr('CSV')}</option>
        </select>
      </Field>
      <Field label={tr('Who')} hidden={!filtered}>
        <select value={which} onChange={e => setWhich(e.target.value as 'shown' | 'all')}>
          <option value="shown">{tr('As filtered now ({n})', { n: list.length })}</option>
          <option value="all">{tr('Everyone ({n})', { n: all.length })}</option>
        </select>
      </Field>
      <p className="fld full small muted">{tr('The file holds phone numbers and emails. Share it only with people who need it, and delete it after the event.')}</p>
    </FormDialog>
  )
}
