// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

afterEach(cleanup)
beforeAll(() => { globalThis.fetch = (async () => { throw new Error('offline') }) as unknown as typeof fetch })

function mount(path: string) {
  const store = new LocalStore({ initial: () => buildSample(Date.now()), storageKey: null })
  render(<MemoryRouter initialEntries={[path]}><Routes>{showctrlRoutes(<ShowctrlRoot store={store} initialMe="demo-admin" />)}</Routes></MemoryRouter>)
  return store
}

describe('People: Excel and CSV', () => {
  it('imports a CSV file, with new departments added', async () => {
    const store = mount('/hq/personnel')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import file' })) })
    const csv = 'Navn;Tittel;Avdeling;Mobil;E-post\nKari Nordmann;Rigger;Rigging;+47 900 00 000;kari@x.no\nOla Hansen;Runner;Audio;;\n'
    const file = new File([csv], 'crew.csv', { type: 'text/csv' })
    await act(async () => { fireEvent.change(screen.getByLabelText('Excel or CSV file'), { target: { files: [file] } }) })
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(screen.getByText('2 new · 0 to update · 0 already up to date')).toBeTruthy()
    expect(screen.getByText('New departments to add: Rigging')).toBeTruthy()

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import 2 people' })) })
    const people = Object.values(store.peek('people'))
    const kari = people.find(p => p.email === 'kari@x.no')!
    expect(kari).toMatchObject({ name: 'Kari Nordmann', title: 'Rigger', phone: '+47 900 00 000' })
    expect(store.peekConfig('event')!.depts.find(d => d.id === kari.dept)?.name).toBe('Rigging')
    expect(people.find(p => p.name === 'Ola Hansen')?.dept).toBe('audio')
  })

  it('downloads the list as CSV', async () => {
    mount('/hq/personnel')
    const blobs: Blob[] = []
    URL.createObjectURL = vi.fn((b: Blob) => { blobs.push(b); return 'blob:x' })
    URL.revokeObjectURL = vi.fn()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Export' })) })
    await act(async () => { fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'csv' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Download' })) })
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(blobs).toHaveLength(1)
    const text = await blobs[0].text()
    expect(text.split('\r\n')[0]).toBe('﻿Name,Job title,Company / supplier,Department,Works on,Phone,Email,Accreditation,Key contact,Notes,showctrl.no access')
  })
})
