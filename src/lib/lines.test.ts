import { describe, expect, it } from 'vitest'
import { duplicateChannels, parseInputList, sortedInputs } from './lines'

describe('input lists', () => {
  it('reads a tab list from a spreadsheet, skipping the header', () => {
    const rows = parseInputList('Ch\tSource\tMic\tStand\n1\tKick in\tBeta 91\t-\n2\tKick out\tD6\tshort\n3\tSnare\tSM57\tclamp\t\n4\tAc gtr\tDI\t\t48V')
    expect(rows.map(r => [r.ch, r.name, r.mic])).toEqual([[1, 'Kick in', 'Beta 91'], [2, 'Kick out', 'D6'], [3, 'Snare', 'SM57'], [4, 'Ac gtr', 'DI']])
    expect(rows[3].phantom).toBe(true)
    expect(rows[1].stand).toBe('short')
  })

  it('reads "1. Kick" style lines and numbers lines without channels', () => {
    const rows = parseInputList('1. Kick  Beta 91\n2) Snare  SM57\nHi-hat  KM184  48v\nLead vox | SM58 | tall boom', 1)
    expect(rows.map(r => [r.ch, r.name])).toEqual([[1, 'Kick'], [2, 'Snare'], [3, 'Hi-hat'], [4, 'Lead vox']])
    expect(rows[2].phantom).toBe(true)
    expect(rows[3].stand).toBe('tall boom')
  })

  it('sorts by channel and finds duplicates', () => {
    const inputs = Object.fromEntries(parseInputList('3 Snare\n1 Kick\n3 Snare bottom').map(r => [r.id, r]))
    expect(sortedInputs({ inputs }).map(r => r.ch)).toEqual([1, 3, 3])
    expect([...duplicateChannels({ inputs })]).toEqual([3])
  })
})
