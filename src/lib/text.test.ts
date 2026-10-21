import { describe, expect, it } from 'vitest'
import { kindClass, kindIcon } from '../app/runsheet/helpers'
import { KINDS } from '../types/constants'
import { aOrAn } from './text'

describe('wording', () => {
  it('picks a or an for the event’s vocabulary', () => {
    expect(aOrAn('artist')).toBe('an artist')
    expect(aOrAn('arena')).toBe('an arena')
    expect(aOrAn('stage')).toBe('a stage')
    expect(aOrAn('speaker')).toBe('a speaker')
  })
})

describe('run sheet kinds', () => {
  it('gives every kind its own icon and colour class, and maps legacy kinds', () => {
    const icons = Object.keys(KINDS).map(kindIcon)
    expect(new Set(icons).size).toBe(Object.keys(KINDS).length)
    expect(kindIcon('set')).toBe('show')
    expect(kindClass('break')).toBe('k-other')
  })
})
