import { describe, expect, it } from 'vitest'
import type { Member } from '../types/model'
import { nameFromEmail, personName } from './people'

const member = (id: string, name: string): Member => ({ id, name, role: 'admin', stages: {}, person: null, depts: [] })

describe('names', () => {
  it('turns an email into a readable stand-in until someone gives a name', () => {
    expect(nameFromEmail('mats.bristol@gmail.com')).toBe('Mats Bristol')
    expect(nameFromEmail('kari_vakt-2@example.no')).toBe('Kari Vakt')
    expect(nameFromEmail('morten@larkolluka.no')).toBe('Morten')
  })

  it('shows the given name, and never the bare email', () => {
    expect(personName('mats@larkolluka.no', { 'mats@larkolluka.no': member('mats@larkolluka.no', 'Mats O. Bristol') }, {})).toBe('Mats O. Bristol')
    expect(personName('mats@larkolluka.no', { 'mats@larkolluka.no': member('mats@larkolluka.no', 'mats@larkolluka.no') }, {})).toBe('Mats')
    expect(personName('trine@tonsofrock.no', {}, {})).toBe('Trine')
  })
})
