/*
 * Smoke tests: render the real shell to HTML for different people and check
 * what they see. No browser needed; effects (timers, clock sync) don't run.
 */
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '../data/DataProvider'
import { LocalStore, emptySnapshot } from '../data/localStore'
import { buildSample } from '../data/sample'
import { SessionProvider } from '../session/SessionProvider'
import { FormProvider } from '../ui/FormProvider'
import { ToastProvider } from '../ui/ToastProvider'
import { AppRoutes } from './AppRoutes'

const sample = buildSample(Date.now())

function render(path: string, uid: string, store = new LocalStore({ storage: null, seed: () => sample })) {
  return renderToString(
    <DataProvider store={store}>
      <SessionProvider initialUser={uid}>
        <ToastProvider>
          <FormProvider>
            <MemoryRouter initialEntries={[path]}>
              <AppRoutes />
            </MemoryRouter>
          </FormProvider>
        </ToastProvider>
      </SessionProvider>
    </DataProvider>,
  )
}

/** Just the stage tabs (the "view as" list also names stages). */
const tabs = (html: string) => text(html.match(/<nav class="ctxbar".*?<\/nav>/)![0])

/** Visible text, without tags or React's comment markers. */
const text = (html: string) => html.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')

describe('shell', () => {
  it('shows the admin Festival HQ, every stage tab and the HQ sections', () => {
    const html = render('/hq/overview', 'demo-admin')
    const t = text(html)
    expect(t).toContain('Nordlys Open Air 2026')
    // HQ first, then every stage in running order.
    expect(tabs(html).replace(/\s+/g, ' ').trim()).toBe('Festival HQ Main Stage Fjord Stage The Tent Harbour Club Forest Stage')
    expect(t).toContain('Accommodation')
    expect(t).toContain('Admin')
    expect(t).toContain('Festival overview')
  })

  it('shows placeholders with the access level for sections not ported yet', () => {
    expect(text(render('/hq/admin', 'demo-admin'))).toContain('You can edit this')
    // The production manager can view admin but not change it.
    expect(text(render('/hq/admin', 'demo-pm'))).toContain('You can view this')
  })

  it('shows a stage manager only their stage, marked SM, with stage setup', () => {
    const html = render('/s/main/today', 'demo-sm-main')
    const t = text(html)
    expect(tabs(html).trim()).toBe('Main Stage SM')
    expect(t).toContain('Stage setup')
    expect(t).toContain('Coming up')
  })

  it('gives a stage manager the run sheet controls', () => {
    const t = text(render('/s/main/runsheet', 'demo-sm-main'))
    expect(t).toContain('Run sheet · Main Stage')
    expect(t).toContain('Add item')
    expect(t).toContain('Delay')
  })

  it('shows crew a view-only run sheet without setup', () => {
    const t = text(render('/s/main/runsheet', 'demo-crew-main-3'))
    expect(t).toContain('Run sheet · Main Stage')
    expect(t).not.toContain('Add item')
    expect(t).not.toContain('Delay')
    expect(t).not.toContain('Stage setup')
  })

  it('refuses another stage by URL', () => {
    expect(text(render('/s/tent/today', 'demo-sm-main'))).toContain("You don't have access to this stage.")
  })

  it('refuses HQ to stage-only people', () => {
    expect(text(render('/hq/overview', 'demo-crew-main-3'))).toContain('Your access does not include this page')
  })

  it('offers the sample festival when there is no event', () => {
    const store = new LocalStore({ storage: null, seed: emptySnapshot })
    expect(text(render('/hq/overview', 'demo-admin', store))).toContain('Load the sample festival')
  })

  it('renders an artist page inside its stage', () => {
    const a = Object.values(sample.col.artists).find(x => x.stage === 'main')!
    const html = render(`/s/main/artist/${a.id}`, 'demo-sm-main')
    expect(text(html)).toContain(a.name)
    // The artists section stays highlighted on an artist's page.
    expect(html).toMatch(/aria-current="page"[^>]*>.*?Artists/)
  })
})
