import { useState } from 'react'
import { useCollection, useConfig, useStore } from '../../data/hooks'
import { getLang, tr } from '../../i18n'
import { byOrder } from '../../lib/comms'
import { COMM_KINDS, TAPE } from '../../types/constants'
import type { CommChannel, Id, Stage } from '../../types/model'
import { CommForm } from '../comms/forms'
import { fileSlug, saveCsv, saveXlsx } from '../people/sheetFiles'
import { useAccess } from '../session'
import { Field, FormDialog } from '../ui/Dialog'

type Dialog = { type: 'comm'; comm: CommChannel | null } | { type: 'export' } | null

/** Radio channels, intercom rings and conference lines: festival-wide and per stage. */
export function CommsPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const store = useStore()
  const cfg = useConfig('event')
  const comms = useCollection('comms')
  const [dialog, setDialog] = useState<Dialog>(null)
  const dept = (id: Id) => cfg?.depts.find(d => d.id === id)?.name ?? ''
  const usedBy = (c: CommChannel) => (c.depts.length ? c.depts.map(dept).filter(Boolean).join(', ') : tr('Everyone'))

  // Festival-wide first, then each stage this person sees (only this one on a stage page).
  const stages = sid ? a.stagesSorted().filter(s => s.id === sid) : a.visibleStages()
  const groups: { stage: Stage | null; list: CommChannel[] }[] = [
    { stage: null, list: Object.values(comms).filter(c => !c.stage).sort(byOrder) },
    ...stages.map(s => ({ stage: s, list: Object.values(comms).filter(c => c.stage === s.id).sort(byOrder) })),
  ]
  const canAdd = a.canW('comms') || stages.some(s => a.canW('comms', s.id))
  const nextOrder = Object.keys(comms).length

  // Swaps a channel with its neighbour in the same group, then numbers the group 0, 1, 2…
  const move = async (list: CommChannel[], i: number, by: number) => {
    const next = [...list]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    await Promise.all(next.map((c, n) => (c.order === n ? null : store.update('comms', c.id, { order: n }))))
  }

  return (
    <>
      <div className="head">
        <div><h1>{tr('Comm channels')}</h1><p>{tr('Radio channels, intercom rings and phone lines, and who uses each one.')}</p></div>
        <div className="actions">
          {groups.some(g => g.list.length) && <button type="button" className="btn" onClick={() => setDialog({ type: 'export' })}>{tr('Export')}</button>}
          {canAdd && <button type="button" className="btn primary" onClick={() => setDialog({ type: 'comm', comm: null })}>{tr('+ Add channel')}</button>}
        </div>
      </div>
      <div className="stack" style={{ gap: '1rem' }}>
        {groups.map(({ stage, list }) => {
          const w = a.canW('comms', stage?.id ?? null)
          if (!list.length && !(w && stage)) return null
          return (
            <section key={stage?.id ?? 'all'} className="panel">
              <div className="ph">
                {stage && <span className="tape" style={{ ['--c' as string]: TAPE[stage.tape] }} />}
                <h3>{stage ? stage.name : tr('Whole festival')}</h3>
              </div>
              {list.length ? (
                <div className="tbl-wrap">
                  <table className="comms">
                    <thead><tr><th>{tr('Channel')}</th><th>{tr('Name')}</th><th>{tr('Type')}</th><th>{tr('Used by')}</th><th>{tr('Notes')}</th><th /></tr></thead>
                    <tbody>
                      {list.map((c, i) => (
                        <tr key={c.id}>
                          <td className="comm-ch num"><b>{c.channel}</b></td>
                          <td>{c.name}</td>
                          <td><span className="chip">{tr(COMM_KINDS[c.kind])}</span></td>
                          <td className="small">{usedBy(c)}</td>
                          <td className="small muted">{c.notes}</td>
                          <td className="row-actions">
                            {w && (
                              <span className="row" style={{ gap: '.35rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn sm" aria-label={tr('Move {name} up', { name: c.name })} disabled={i === 0} onClick={() => void move(list, i, -1)}>↑</button>
                                <button type="button" className="btn sm" aria-label={tr('Move {name} down', { name: c.name })} disabled={i === list.length - 1} onClick={() => void move(list, i, 1)}>↓</button>
                                <button type="button" className="btn sm" aria-label={tr('Edit {name}', { name: c.name })} onClick={() => setDialog({ type: 'comm', comm: c })}>{tr('Edit')}</button>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="empty">{tr('No channels yet.')}</p>}
            </section>
          )
        })}
      </div>
      {!canAdd && !groups.some(g => g.list.length) && <div className="panel"><p className="empty">{tr('No channels yet.')}</p></div>}

      {dialog?.type === 'comm' && <CommForm comm={dialog.comm} sid={sid} nextOrder={nextOrder} onClose={() => setDialog(null)} />}
      {dialog?.type === 'export' && (
        <CommsExport
          rows={[
            [tr('Belongs to'), tr('Name'), tr('Channel'), tr('Type'), tr('Used by'), tr('Notes')],
            ...groups.flatMap(g => g.list.map(c => [g.stage?.name ?? tr('Whole festival'), c.name, c.channel, tr(COMM_KINDS[c.kind]), usedBy(c), c.notes ?? ''])),
          ]}
          filename={`${fileSlug(cfg?.name ?? '')}-${sid ? fileSlug(stages[0]?.name ?? '') + '-' : ''}${getLang() === 'nb' ? 'sambandsliste' : 'comms'}`}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}

function CommsExport({ rows, filename, onClose }: { rows: string[][]; filename: string; onClose: () => void }) {
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  return (
    <FormDialog
      title={tr('Export comm channels')}
      saveLabel={tr('Download')}
      onClose={onClose}
      onSave={async () => {
        if (format === 'xlsx') await saveXlsx([{ name: tr('Comm channels'), rows }], `${filename}.xlsx`)
        else saveCsv(rows, `${filename}.csv`, getLang() === 'nb' ? ';' : ',')
      }}
    >
      <Field label={tr('Format')}>
        <select value={format} onChange={e => setFormat(e.target.value as 'xlsx' | 'csv')}>
          <option value="xlsx">{tr('Excel (.xlsx)')}</option>
          <option value="csv">{tr('CSV')}</option>
        </select>
      </Field>
    </FormDialog>
  )
}
