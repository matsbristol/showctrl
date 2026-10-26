// A stage plot, to scale, seen from FOH (audience at the bottom). Items are dragged into place;
// a move is saved when the drag ends, one item at a time, so two people can work on one plot.
// Clicking or dragging only selects an item. Its editor opens from the Edit button beside it,
// a double-click, or Enter, so arranging the stage doesn't keep popping it up.

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useCollection, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { deckSize, DEFAULT_SYSTEM, legLabel, sizeLabel, sizesOf, stockOf, SYSTEMS, systemOf } from '../../lib/risers'
import { riserText } from '../../lib/summary'
import { PLOT_KINDS, RISER_LEGS, RISER_SYSTEMS } from '../../types/constants'
import type { Artist, Id, PlotItem, PlotKind, RiserSize, RiserSystem } from '../../types/model'
import { useAccess } from '../session'
import { useServerTime } from '../time'
import { tr } from '../../i18n'

const DEFAULT_W = 14
const DEFAULT_D = 9
const round = (n: number) => Math.round(n * 10) / 10
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

/** Half the width and depth of the box around an item once rotated, for placing its label. */
function halfExtent(it: Pick<PlotItem, 'w' | 'd' | 'rot'>) {
  const r = ((it.rot ?? 0) * Math.PI) / 180
  const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r))
  return { hw: (it.w / 2) * c + (it.d / 2) * s, hd: (it.w / 2) * s + (it.d / 2) * c }
}

export function PlotEditor({ artist }: { artist: Artist }) {
  const a = useAccess()
  const store = useStore()
  const now = useServerTime()
  const plots = useCollection('plots')
  const risers = useCollection('risers')
  const plot = plots[artist.id]
  const w = a.canW('technical', artist.stage)
  const W = plot?.width ?? DEFAULT_W
  const D = plot?.depth ?? DEFAULT_D
  const items = Object.values(plot?.items ?? {})
  const [sel, setSel] = useState<Id | null>(null)
  const [editing, setEditing] = useState(false)
  const [drag, setDrag] = useState<{ id: Id; dx: number; dy: number; x: number; y: number } | null>(null)
  // Where items were dropped, until the save comes back. Live, that takes a round trip to the
  // server; without this the item would flash back to its old place in between.
  const [moved, setMoved] = useState<Record<Id, { x: number; y: number }>>({})
  const posOf = (it: PlotItem) => (drag?.id === it.id ? { x: drag.x, y: drag.y } : moved[it.id] ?? { x: it.x, y: it.y })
  const svg = useRef<SVGSVGElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLButtonElement>(null)
  const selected = sel ? plot?.items[sel] : undefined
  const select = (id: Id | null, edit = false) => { setSel(id); setEditing(!!id && edit) }

  // Place the editor next to the selected item (right, else left, else underneath on narrow
  // screens), and the Edit button just above it; both kept inside the plot area. Positioned
  // directly, so they follow every change.
  const place = () => {
    const box = wrap.current, m = svg.current?.getScreenCTM()
    if (!box || !m || !selected) return
    const { hw, hd } = halfExtent(selected)
    const pt = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(m)
    const at = posOf(selected)
    const cx = at.x, cy = D - at.y
    const b = box.getBoundingClientRect()
    const put = (el: HTMLElement, x: number, y: number) => {
      el.style.left = `${Math.max(8, Math.min(x, b.width - el.offsetWidth - 8))}px`
      el.style.top = `${Math.max(8, Math.min(y, b.height - el.offsetHeight - 8))}px`
    }
    const el = pop.current
    if (el) {
      const right = pt(cx + hw, cy), left = pt(cx - hw, cy), below = pt(cx, cy + hd)
      const pw = el.offsetWidth, ph = el.offsetHeight, gap = 14
      if (right.x + gap + pw <= b.right - 8) { put(el, right.x + gap - b.left, right.y - b.top - ph / 2); el.dataset.side = 'right' }
      else if (left.x - gap - pw >= b.left + 8) { put(el, left.x - gap - pw - b.left, left.y - b.top - ph / 2); el.dataset.side = 'left' }
      else { put(el, below.x - b.left - pw / 2, below.y - b.top + gap); el.dataset.side = 'below' }
    }
    const btn = pill.current
    if (btn) {
      const top = pt(cx, cy - hd)
      put(btn, top.x - b.left - btn.offsetWidth / 2, top.y - b.top - btn.offsetHeight - 6)
    }
  }
  useLayoutEffect(place)
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (editing) setEditing(false); else setSel(null) } }
    window.addEventListener('resize', place)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('keydown', onKey) }
  })

  const toStage = (e: { clientX: number; clientY: number }) => {
    const m = svg.current?.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: D - p.y } // y counts from the front edge
  }

  const ensure = async () => {
    if (!plot) await store.set('plots', artist.id, { artist: artist.id, items: {}, width: W, depth: D, notes: '', updated: now() })
  }
  const patch = (id: Id, p: Partial<PlotItem>) => store.update('plots', artist.id, { items: { [id]: p }, updated: now() })

  const rotate = (it: PlotItem, by: number) => patch(it.id, { rot: (((it.rot ?? 0) + by) % 360 + 360) % 360 })

  // New risers use the system this stage stocks most of.
  const stageSystem = (): RiserSystem => {
    const count = (sys: RiserSystem) => Object.values(stockOf(risers[artist.stage], sys).decks).reduce((n, x) => n + x, 0)
    return [...SYSTEMS].sort((x, y) => count(y) - count(x))[0] ?? DEFAULT_SYSTEM
  }
  const setDeck = (it: PlotItem, sys: RiserSystem, size: RiserSize) => {
    const dim = deckSize(sys, size)
    void patch(it.id, { system: sys, size, ...(dim ? { w: dim.w, d: dim.d } : {}) })
  }

  const add = async (kind: PlotKind) => {
    await ensure()
    const k = PLOT_KINDS[kind]
    const id = rid()
    const system = kind === 'riser' ? stageSystem() : undefined
    const dim = system ? deckSize(system, '2x1') : undefined
    const item: PlotItem = {
      id, kind, label: tr(k.label), x: round(W / 2), y: round(D / 2),
      w: dim?.w ?? k.w, d: dim?.d ?? k.d,
      ...(system ? { system, size: '2x1', height: 40, rolling: false } : {}),
    }
    await store.update('plots', artist.id, { items: { [id]: item }, updated: now() })
    select(id, true)
  }

  const down = (e: RPointerEvent, it: PlotItem) => {
    // Selecting another item, or moving one, closes the editor; it opens again from Edit.
    if (it.id !== sel || w) select(it.id, false)
    if (!w) return
    const p = toStage(e)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setDrag({ id: it.id, dx: p.x - it.x, dy: p.y - it.y, x: it.x, y: it.y })
  }
  const move = (e: RPointerEvent) => {
    if (!drag) return
    const p = toStage(e)
    setDrag({ ...drag, x: Math.min(W, Math.max(0, round(p.x - drag.dx))), y: Math.min(D, Math.max(0, round(p.y - drag.dy))) })
  }
  const up = () => {
    if (!drag) return
    const it = plot?.items[drag.id]
    if (it && (it.x !== drag.x || it.y !== drag.y)) {
      const { id, x, y } = drag
      const settle = () => setMoved(m => { const { [id]: _, ...rest } = m; return rest })
      setMoved(m => ({ ...m, [id]: { x, y } }))
      // Saved: the store has the new place now. Refused: it snaps back to where it was.
      patch(id, { x, y }).then(settle, settle)
    }
    setDrag(null)
  }

  // Draw risers first so instruments sit on top of them, and the item being moved or selected last, on top of everything.
  const layer = (i: PlotItem) => (i.id === drag?.id || i.id === sel ? 2 : i.kind === 'riser' ? 0 : 1)
  const ordered = [...items].sort((x, y) => layer(x) - layer(y))

  return (
    <div className="stack" style={{ gap: '1rem', minWidth: 0 }}>
      {w && (
        <div className="plot-palette no-print" role="toolbar" aria-label={tr('Add to plot')}>
          {(Object.keys(PLOT_KINDS) as PlotKind[]).map(k => (
            <button key={k} type="button" className={`btn sm pk-${k}`} onClick={() => void add(k)}>+ {tr(PLOT_KINDS[k].label)}</button>
          ))}
        </div>
      )}
      <div className="plot-wrap" ref={wrap}>
        <svg ref={svg} className="plot" viewBox={`-0.5 -0.5 ${W + 1} ${D + 1.6}`} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
          role="img" aria-label={tr('Stage plot for {name}, {w} by {d} metres', { name: artist.name, w: W, d: D })}>
          <rect x={0} y={0} width={W} height={D} className="plot-stage" onPointerDown={() => select(null)} />
          {Array.from({ length: W - 1 }, (_, i) => <line key={`v${i}`} x1={i + 1} y1={0} x2={i + 1} y2={D} className="plot-grid" />)}
          {Array.from({ length: D - 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i + 1} x2={W} y2={i + 1} className="plot-grid" />)}
          <text x={W / 2} y={D + 0.75} className="plot-front">{tr('FRONT OF STAGE · AUDIENCE')}</text>
          <text x={0.15} y={D + 0.75} className="plot-side">{tr('L')}</text>
          <text x={W - 0.15} y={D + 0.75} className="plot-side" textAnchor="end">{tr('R')}</text>
          {ordered.map(it => {
            const { x, y } = posOf(it)
            const round = it.kind === 'vocal' || it.kind === 'mic' || it.kind === 'person'
            const { hd } = halfExtent(it)
            return (
              <g key={it.id} className={`plot-item pk-${it.kind}${sel === it.id ? ' sel' : ''}${w ? ' movable' : ''}`}
                transform={`translate(${x} ${D - y})`} onPointerDown={e => down(e, it)} onDoubleClick={() => select(it.id, true)} tabIndex={0} aria-label={it.label}
                onFocus={() => { if (sel !== it.id) select(it.id) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); select(it.id, true) }
                  else if (w && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); void rotate(it, e.shiftKey ? -90 : 90) }
                }}>
                <g transform={it.rot ? `rotate(${it.rot})` : undefined}>
                  {round
                    ? <ellipse rx={it.w / 2} ry={it.d / 2} />
                    : <rect x={-it.w / 2} y={-it.d / 2} width={it.w} height={it.d} rx={0.06} />}
                  {/* A notch on the front edge, so you can see which way an item faces. */}
                  {!round && it.kind !== 'power' && it.kind !== 'di' && <line x1={-Math.min(it.w, 0.6) / 2} x2={Math.min(it.w, 0.6) / 2} y1={it.d / 2 - 0.05} y2={it.d / 2 - 0.05} className="plot-front-edge" />}
                </g>
                {/* Labels stay upright. Small items are labelled underneath; riser labels are drawn last, on top. */}
                {it.kind !== 'riser' && <text y={Math.min(it.w, it.d) < 0.6 ? hd + 0.24 : 0.02} className="plot-label">{it.label}</text>}
              </g>
            )
          })}
          {/* Decks with the same name form one riser (a 2 × 2 m drum riser is two 2 × 1 m decks): one label, under the front-most deck. */}
          {[...ordered.filter(it => it.kind === 'riser').reduce((m, it) => {
            const k = `${it.label}|${systemOf(it)}|${it.size}|${it.height}|${!!it.telescopic}|${!!it.rolling}`
            return m.set(k, [...(m.get(k) ?? []), it])
          }, new Map<string, PlotItem[]>()).values()].map(decks => {
            const pos = posOf
            const front = decks.reduce((f, it) => (pos(it).y < pos(f).y ? it : f))
            const { x, y } = pos(front)
            return (
              <g key={`lbl-${front.id}`} transform={`translate(${x} ${D - y})`} className="plot-riser-label">
                <text y={halfExtent(front).hd + 0.26} className="plot-label">{front.label}</text>
                <text y={halfExtent(front).hd + 0.5} className="plot-sub">{decks.length > 1 ? `${decks.length} × ` : ''}{RISER_SYSTEMS[systemOf(front)].label} {front.size ? sizeLabel(front.size) : ''} · {legLabel(front)}{front.rolling ? ` · ${tr('rolling')}` : ''}</text>
              </g>
            )
          })}
        </svg>
        {selected && !drag && !editing && (
          <button ref={pill} type="button" className="plot-edit-pill no-print" title={tr('Edit (or double-click the item, or press Enter)')} onClick={() => setEditing(true)}>
            {tr('Edit {label}', { label: selected.label })}
          </button>
        )}
        {selected && !drag && editing && (
          <div ref={pop} className="plot-pop no-print" role="dialog" aria-label={tr('Edit {label}', { label: selected.label })}>
            <div className="pp-head">
              <b>{selected.label}</b>
              <button type="button" className="pp-close" aria-label={tr('Close')} onClick={() => setEditing(false)}>×</button>
            </div>
            <p className="small muted">{tr(PLOT_KINDS[selected.kind].label)} · {tr('{x} m from left, {y} m from the front', { x: posOf(selected).x, y: posOf(selected).y })}{selected.rot ? ` · ${tr('turned {deg}°', { deg: selected.rot })}` : ''}</p>
            {w && (
              <>
                <div className="pp-grid">
                  <label className="fld pp-full"><span>{tr('Label')}</span><input defaultValue={selected.label} key={`l${selected.id}`} onBlur={e => void patch(selected.id, { label: e.target.value || tr(PLOT_KINDS[selected.kind].label) })} /></label>
                  {selected.kind === 'riser' ? (
                    <>
                      <label className="fld"><span>{tr('System')}</span>
                        <select value={systemOf(selected)} onChange={e => { const sys = e.target.value as RiserSystem; setDeck(selected, sys, sizesOf(sys).includes(selected.size ?? '') ? selected.size! : '2x1') }}>
                          {SYSTEMS.map(sys => <option key={sys} value={sys}>{RISER_SYSTEMS[sys].label}</option>)}
                        </select>
                      </label>
                      <label className="fld"><span>{tr('Deck')}</span>
                        <select value={selected.size} onChange={e => setDeck(selected, systemOf(selected), e.target.value)}>
                          {sizesOf(systemOf(selected)).map(sz => <option key={sz} value={sz}>{sizeLabel(sz)}</option>)}
                          {selected.size && !sizesOf(systemOf(selected)).includes(selected.size) && <option value={selected.size}>{sizeLabel(selected.size)}</option>}
                        </select>
                      </label>
                      <label className="fld"><span>{tr('Legs')}</span>
                        <select value={selected.telescopic ? 'telescopic' : String(selected.height ?? '')}
                          onChange={e => void patch(selected.id, e.target.value === 'telescopic' ? { telescopic: true } : { telescopic: false, height: Number(e.target.value) })}>
                          {[...new Set([...RISER_LEGS, ...(selected.height && !selected.telescopic ? [selected.height] : [])])].sort((x, y) => x - y).map(h => <option key={h} value={h}>{h} cm</option>)}
                          <option value="telescopic">{tr('Telescopic')}</option>
                        </select>
                      </label>
                      {selected.telescopic && <label className="fld"><span>{tr('Height (cm)')}</span><input type="number" min={0} step={5} defaultValue={selected.height} key={`h${selected.id}`} onBlur={e => void patch(selected.id, { height: Number(e.target.value) || 0 })} /></label>}
                      <label className="row small pp-full"><input type="checkbox" checked={!!selected.rolling} onChange={e => void patch(selected.id, { rolling: e.target.checked })} /> {tr('Rolling')}</label>
                    </>
                  ) : (
                    <>
                      <label className="fld"><span>{tr('Width (m)')}</span><input type="number" min={0.1} step={0.1} defaultValue={selected.w} key={`w${selected.id}`} onBlur={e => void patch(selected.id, { w: Number(e.target.value) || selected.w })} /></label>
                      <label className="fld"><span>{tr('Depth (m)')}</span><input type="number" min={0.1} step={0.1} defaultValue={selected.d} key={`d${selected.id}`} onBlur={e => void patch(selected.id, { d: Number(e.target.value) || selected.d })} /></label>
                    </>
                  )}
                  <label className="fld"><span>{tr('Rotation')}</span>
                    <select value={selected.rot ?? 0} onChange={e => void patch(selected.id, { rot: Number(e.target.value) })}>
                      {ANGLES.map(a => <option key={a} value={a}>{a}°</option>)}
                      {!ANGLES.includes(selected.rot ?? 0) && <option value={selected.rot}>{selected.rot}°</option>}
                    </select>
                  </label>
                  <button type="button" className="btn" style={{ alignSelf: 'flex-end' }} title={tr('Shortcut: R (Shift+R turns the other way)')} onClick={() => void rotate(selected, 90)}>{tr('Rotate 90°')}</button>
                </div>
                <div className="pp-actions">
                  <button type="button" className="btn sm danger" onClick={() => { void store.update('plots', artist.id, { items: { [selected.id]: undefined } }); select(null) }}>{tr('Remove')}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <section className="panel">
        <div className="pb row small">
          {w ? (
            <>
              <label className="row">{tr('Stage width (m)')} <input className="inline-sel" type="number" min={4} max={40} defaultValue={W} key={`W${W}`} style={{ width: '4.5rem' }} onBlur={async e => { await ensure(); void store.update('plots', artist.id, { width: Math.max(4, Number(e.target.value) || W) }) }} /></label>
              <label className="row">{tr('Depth (m)')} <input className="inline-sel" type="number" min={3} max={30} defaultValue={D} key={`D${D}`} style={{ width: '4.5rem' }} onBlur={async e => { await ensure(); void store.update('plots', artist.id, { depth: Math.max(3, Number(e.target.value) || D) }) }} /></label>
            </>
          ) : <span>{W} × {D} m</span>}
          <span className="muted" style={{ marginLeft: 'auto' }}>{tr('{n} items', { n: items.length })}{riserText(plot) ? ` · ${tr('risers: {list}', { list: riserText(plot) })}` : ''}</span>
        </div>
      </section>
    </div>
  )
}
