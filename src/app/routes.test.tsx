import { renderToString } from 'react-dom/server'
import { MemoryRouter, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import { showctrlRoutes } from './routes'
import { ShowctrlRoot } from './ShowctrlRoot'

const T = Date.UTC(2026, 6, 10, 18)

function render(path: string, me: string) {
  const store = new LocalStore({ initial: () => buildSample(T), storageKey: null })
  const html = renderToString(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{showctrlRoutes(<ShowctrlRoot store={store} initialMe={me} />)}</Routes>
    </MemoryRouter>,
  )
  return html.replaceAll('<!-- -->', '').replaceAll('&#x27;', "'")
}

describe('showctrl routes', () => {
  it('shows HQ with every stage tab to an admin', () => {
    const html = render('/hq/overview', 'demo-admin')
    expect(html).toContain('Festival HQ')
    for (const name of ['Main Stage', 'Fjord Stage', 'The Tent', 'Harbour Club', 'Forest Stage']) expect(html).toContain(name)
    expect(html).toContain('<h1>Festival overview</h1>')
    expect(html).toContain('href="/hq/admin"')
  })

  it('shows a stage manager only their own stage, with Stage setup', () => {
    const html = render('/s/main/runsheet', 'demo-sm-main')
    expect(html).toContain('<h1>Run sheet · Main Stage</h1>')
    expect(html).toContain('href="/s/main/setup"')
    expect(html).not.toContain('Festival HQ</a>')
    expect(html).not.toContain('href="/s/fjord/today"')
  })

  it('blocks a stage manager from another stage and from HQ', () => {
    expect(render('/s/tent/today', 'demo-sm-main')).toContain("You don't have access to this stage.")
    expect(render('/hq/overview', 'demo-sm-main')).toContain('Your access does not include this page')
  })

  it('hides Stage setup from crew', () => {
    const html = render('/s/main/setup', 'demo-crew-main-3')
    expect(html).toContain('Your access does not include this page')
    expect(html).not.toContain('href="/s/main/setup"')
  })

  it('reports a missing stage and an unknown page', () => {
    expect(render('/s/nope/today', 'demo-admin')).toContain('This stage no longer exists.')
    expect(render('/hq/nope', 'demo-admin')).toContain('Your access does not include this page')
  })

  it('opens an artist page within the user’s access', () => {
    expect(render('/s/main/artists/a0', 'demo-sm-main')).toContain('<h1>The Velvet Arcs</h1>')
    expect(render('/hq/artists/a0', 'demo-sm-tent')).toContain('Your access does not include this page')
  })

  it('lists demo personas in the view-as switcher', () => {
    expect(render('/hq/overview', 'demo-admin')).toContain('Stage manager, Main Stage')
  })
})
