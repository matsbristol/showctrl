import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { buildSample } from '../data/sample'
import type { Person } from '../types/model'
import { accredLevels } from './accred'
import { EXPORT_FIELDS, findHeader, guessColumns, parseCsv, peopleRows, planSheet, sampleSheets, toCsv, type SheetContext } from './peopleSheet'

const sample = buildSample(Date.parse('2026-06-12T10:00:00Z'))
const ctx = (over: Partial<SheetContext> = {}): SheetContext => ({
  people: sample.col.people, depts: sample.cfg!.depts, stages: Object.values(sample.col.stages), accred: accredLevels(sample.cfg),
  defaults: { dept: null, stage: null }, onlyStage: null, update: true, ...over,
})
const HEADERS = { name: 'Name', title: 'Job title', company: 'Company / supplier', dept: 'Department', stages: 'Works on', phone: 'Phone', email: 'Email', accred: 'Accreditation', lead: 'Key contact', notes: 'Notes' }

describe('people spreadsheets', () => {
  it('recognises English and Norwegian headers in any order', () => {
    expect(guessColumns(['E-post', 'Fornavn', 'Etternavn', 'Mobil', 'Avdeling', 'Ukjent'])).toEqual(['email', 'first', 'last', 'phone', 'dept', ''])
    expect(guessColumns(['Full name', 'Job Title', 'Phone number', 'Email address', 'Accreditation'])).toEqual(['name', 'title', 'phone', 'email', 'accred'])
    expect(findHeader([['Crew list 2026'], [], ['Navn', 'Telefon', 'E-post'], ['Kari', '900', 'k@x.no']])).toBe(2)
  })

  it('adds new people, updates matches by email, and leaves out rows without a name', () => {
    const ex = Object.values(sample.col.people)[0]
    const rows = [
      ['Kari Nordmann', 'Rigger', 'audio', 'Fjord Stage, The Tent', '+47 900 00 000', 'kari@x.no', 'aaa', 'ja'],
      [ex.name, 'Head of everything', '', '', ex.phone ?? '', ex.email!.toUpperCase(), '', ''],
      ['', 'No name', '', '', '', '', '', ''],
      ['Kari Nordmann', 'Duplicate', '', '', '', 'kari@x.no', '', ''],
      ['Ola Ukjent', '', 'Catering', '', '', '', 'Gold', ''],
    ]
    const cols = guessColumns(['Name', 'Title', 'Department', 'Stages', 'Phone', 'Email', 'Accreditation', 'Lead'])
    const plan = planSheet(rows, cols, ctx())
    expect(plan.add.map(p => p.name)).toEqual(['Kari Nordmann', 'Ola Ukjent'])
    const kari = plan.add[0]
    expect(kari).toMatchObject({ title: 'Rigger', stages: ['fjord', 'tent'], accred: 'AAA', lead: true, phone: '+47 900 00 000' })
    expect(kari.dept).toBe('audio')
    expect(plan.update).toEqual([{ id: ex.id, name: ex.name, patch: { title: 'Head of everything' } }])
    expect(plan.skipped).toEqual(['3'])
    expect(plan.newDepts).toEqual(['Catering'])
    expect(plan.unknownAccred).toEqual(['Gold'])

    // Not updating: the match counts as unchanged.
    expect(planSheet(rows, cols, ctx({ update: false })).update).toEqual([])
  })

  it('puts a stage manager’s import on their stage, and leaves other stages’ people alone', () => {
    const other = Object.values(sample.col.people).find(p => p.email && !p.stages.includes('club'))!
    const plan = planSheet([['New One', 'n@x.no'], [other.name, other.email!]], ['name', 'email'], ctx({ onlyStage: 'club', defaults: { dept: null, stage: 'club' } }))
    expect(plan.add[0].stages).toEqual(['club'])
    expect(plan.update).toEqual([])
    expect(plan.skipped).toEqual(['2'])
  })

  it('reads its own export back unchanged, through CSV and through Excel', () => {
    const list = Object.values(sample.col.people) as Person[]
    const rows = peopleRows(list, { depts: sample.cfg!.depts, stages: sample.col.stages, headers: HEADERS, yes: 'Yes', hq: 'HQ' })
    expect(rows[0]).toEqual(EXPORT_FIELDS.map(f => HEADERS[f]))

    const fromCsv = parseCsv(toCsv(rows, ';'))
    const cols = guessColumns(fromCsv[0])
    expect(cols).toEqual([...EXPORT_FIELDS])
    const p1 = planSheet(fromCsv.slice(1), cols, ctx())
    expect(p1.add).toEqual([])
    expect(p1.update).toEqual([])
    expect(p1.unchanged).toBe(list.length)

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'People')
    const back = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' })
    const xrows = XLSX.utils.sheet_to_json<string[]>(back.Sheets.People, { header: 1, raw: false, defval: '' })
    const p2 = planSheet(xrows.slice(1), guessColumns(xrows[0]), ctx())
    expect([p2.add.length, p2.update.length, p2.unchanged]).toEqual([0, 0, list.length])
  })

  it('makes a sample sheet that imports cleanly, with this event’s own values', () => {
    const stages = Object.values(sample.col.stages).sort((x, y) => x.order - y.order)
    const ex = { title: 'Rigger', company: '', notes: '' }
    const s = sampleSheets({ depts: sample.cfg!.depts, stages, accred: accredLevels(sample.cfg), headers: HEADERS, yes: 'Yes', hq: 'HQ', examples: [ex, ex, ex], severalNote: 'Several: separate with commas' })
    expect(s.people[0]).toEqual(EXPORT_FIELDS.map(f => HEADERS[f]))
    const plan = planSheet(s.people.slice(1), guessColumns(s.people[0]), ctx({ people: {} }))
    expect(plan.add.map(p => [p.name, p.stages, !!p.dept, !!p.accred])).toEqual([
      ['Kari Nordmann', ['main'], true, true], ['Ola Hansen', ['main', 'fjord'], true, true], ['Ingrid Berg', [], true, true],
    ])
    expect([plan.newDepts, plan.unknownAccred, plan.skipped]).toEqual([[], [], []])
    expect(s.values[0]).toEqual(['Department', 'Works on', 'Accreditation', 'Key contact'])
    expect(s.values.map(r => r[1])).toContain('Fjord Stage')
  })

  it('parses quoted CSV fields and escapes formulas on the way out', () => {
    expect(parseCsv('﻿Name;Notes\r\n"Hansen; Ola";"Says ""hi""\non two lines"\r\n')).toEqual([['Name', 'Notes'], ['Hansen; Ola', 'Says "hi"\non two lines']])
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
    expect(toCsv([['=HYPERLINK("x")', '+47 900 00 000']])).toBe('"\'=HYPERLINK(""x"")",+47 900 00 000\r\n')
  })
})
