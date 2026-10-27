// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { ToHq } from './ToHq'

afterEach(cleanup)

function Where() {
  const l = useLocation()
  return <p>{l.pathname}{l.hash}</p>
}

describe('sign-in links', () => {
  it('keep their token when the front page redirects to Festival HQ', () => {
    render(<MemoryRouter initialEntries={['/#signin=abc123']}><Routes><Route index element={<ToHq />} /><Route path="/hq" element={<Where />} /></Routes></MemoryRouter>)
    expect(screen.getByText('/hq#signin=abc123')).toBeTruthy()
  })
})
