// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { accredLevels } from '../lib/accred'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(cleanup)
beforeAll(() => { globalThis.fetch = (async () => { throw new Error('offline') }) as unknown as typeof fetch })

function mount(path: string) {
  const store = new LocalStore({ initial: () => buildSample(Date.now()), storageKey: null })
  render(<MemoryRouter initialEntries={[path]}><Routes>{showctrlRoutes(<ShowctrlRoot store={store} initialMe="demo-admin" />)}</Routes></MemoryRouter>)
  return store
}
const levels = (store: LocalStore) => accredLevels(store.peekConfig('event'))

describe('accreditation levels', () => {
  it('adds, renames (for everyone who has it), reorders and removes levels', async () => {
    const store = mount('/hq/admin?tab=accred')
    const stagePeople = Object.values(store.peek('people')).filter(p => p.accred === 'Stage').length
    expect(stagePeople).toBeGreaterThan(0)

    await act(async () => { fireEvent.change(screen.getByLabelText('New accreditation level'), { target: { value: 'Crew catering' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '+ Add level' })) })
    expect(levels(store).at(-1)).toBe('Crew catering')

    const input = screen.getByLabelText('Rename Stage')
    await act(async () => { fireEvent.change(input, { target: { value: 'Stage crew' } }); fireEvent.blur(input) })
    expect(levels(store)).toContain('Stage crew')
    expect(levels(store)).not.toContain('Stage')
    expect(Object.values(store.peek('people')).filter(p => p.accred === 'Stage crew')).toHaveLength(stagePeople)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Move Crew catering up' })) })
    expect(levels(store).slice(-2)).toEqual(['Crew catering', 'Day pass'])

    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[levels(store).indexOf('Crew catering')]) })
    expect(levels(store)).not.toContain('Crew catering')
  })
})
