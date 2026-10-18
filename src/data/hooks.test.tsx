import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataProvider } from './DataProvider'
import { useCollection, useConfig, useDoc } from './hooks'
import { LocalStore } from './localStore'
import { buildSample } from './sample'

function Probe() {
  const stages = useCollection('stages')
  const main = useDoc('stages', 'main')
  const missing = useDoc('stages', 'nope')
  const event = useConfig('event')
  return <p>{Object.keys(stages).length}|{main?.name}|{String(missing)}|{event?.name}</p>
}

describe('data hooks', () => {
  it('read from the provided store', () => {
    const store = new LocalStore({ initial: () => buildSample(Date.UTC(2026, 6, 10, 18)), storageKey: null })
    const html = renderToString(<DataProvider store={store}><Probe /></DataProvider>)
    expect(html.replaceAll('<!-- -->', '')).toContain('5|Main Stage|null|Nordlys Open Air 2026')
  })

  it('throw outside a provider', () => {
    expect(() => renderToString(<Probe />)).toThrow('useStore must be used inside <DataProvider>')
  })
})
