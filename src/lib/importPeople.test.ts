import { describe, expect, it } from 'vitest'
import { parseCrewList } from './importPeople'

describe('parseCrewList', () => {
  it('reads comma, tab and semicolon lists, finding phone and email anywhere', () => {
    const ps = parseCrewList([
      'Kari Nordmann, Stagehand, +47 900 00 000, kari@example.com',
      'Ola Hansen\tRigger\tRig AS\t+47 911 11 111',
      'Siv Berg; siv@example.com; Runner',
      '',
      '   ',
    ].join('\n'), { dept: 'stage', stage: 'main' })
    expect(ps).toHaveLength(3)
    expect(ps[0]).toMatchObject({ name: 'Kari Nordmann', title: 'Stagehand', phone: '+47 900 00 000', email: 'kari@example.com', dept: 'stage', stages: ['main'], accred: 'Stage' })
    expect(ps[1]).toMatchObject({ name: 'Ola Hansen', title: 'Rigger', company: 'Rig AS', phone: '+47 911 11 111' })
    expect(ps[2]).toMatchObject({ name: 'Siv Berg', title: 'Runner', email: 'siv@example.com', phone: '' })
  })

  it('leaves HQ people without stage or accreditation', () => {
    const [p] = parseCrewList('Anne Lie')
    expect(p).toMatchObject({ name: 'Anne Lie', stages: [], dept: null, lead: false })
    expect(p.accred).toBeUndefined()
  })
})
