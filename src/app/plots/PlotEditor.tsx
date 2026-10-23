// A stage plot, to scale, seen from FOH (audience at the bottom). Items are dragged into place;
// a move is saved when the drag ends, one item at a time, so two people can work on one plot.

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useCollection, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { riserText } from '../../lib/summary'
import { PLOT_KINDS, RISER_SIZES } from '../../types/constants'
import type { Artist, Id, PlotItem, PlotKind, RiserSize } from '../../types/model'
import { useAccess } from '../session'
import { useServerTime } from '../time'

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
  const plot = plots[artist.id]
  const w = a.canW('technical', artist.stage)
  const W = plot?.width ?? DEFAULT_W
  const D = plot?.depth ?? DEFAULT_D
  const items = Object.values(plot?.items ?? {})
  const [sel, setSel] = useState<Id | null>(null)
  const [drag, setDrag] = useState<{ id: Id; dx: number; dy: number; x: number; y: number } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const selected = sel ? plot?.items[sel] : undefined

  // Place the item editor next to the selected item: right of it, else left, else underneath
  // (narrow screens), kept inside the plot area. Positioned directly, so it follows every change.
  const place = () => {
    const el = pop.current, box = wrap.current, m = svg.current?.getScreenCTM()
    if (!el || !box || !m || !selected) return
    const { hw, hd } = halfExtent(selected)
    const pt = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(m)
    const cx = selected.x, cy = D - selected.y
    const right = pt(cx + hw, cy), left = pt(cx - hw, cy), below = pt(cx, cy + hd)
    const b = box.getBoundingClientRect()
    const pw = el.offsetWidth, ph = el.offsetHeight, gap = 14
    let x: number, y: number, side: string
    if (right.x + gap + pw <= b.right - 8) { x = right.x + gap - b.left; y = right.y - b.top - ph / 2; side = 'right' }
    else if (left.x - gap - pw >= b.left + 8) { x = left.x - gap - pw - b.left; y = left.y - b.top - ph / 2; side = 'left' }
    else { x = below.x - b.left - pw / 2; y = below.y - b.top + gap; side = 'below' }
    el.style.left = `${Math.max(8, Math.min(x, b.width - pw - 8))}px`
    el.style.top = `${Math.max(8, Math.min(y, b.height - ph - 8))}px`
    el.dataset.side = side
  }
  useLayoutEffect(place)
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null) }
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

  const add = async (kind: PlotKind) => {
    await ensure()
    const k = PLOT_KINDS[kind]
    const id = rid()
    const size: RiserSize | undefined = kind === 'riser' ? '8x8' : undefined
    const item: PlotItem = {
      id, kind, label: k.label, x: round(W / 2), y: round(D / 2),
      w: size ? RISER_SIZES[size].w : k.w, d: size ? RISER_SIZES[size].d : k.d,
      ...(size ? { size, height: 40, rolling: false } : {}),
    }
    await store.update('plots', artist.id, { items: { [id]: item }, updated: now() })
    setSel(id)
  }

  const down = (e: RPointerEvent, it: PlotItem) => {
    setSel(it.id)
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
    if (it && (it.x !== drag.x || it.y !== drag.y)) void patch(drag.id, { x: drag.x, y: drag.y })
    setDrag(null)
  }

  // Draw risers first so instruments sit on top of them, and the item being moved or selected last, on top of everything.
  const layer = (i: PlotItem) => (i.id === drag?.id || i.id === sel ? 2 : i.kind === 'riser' ? 0 : 1)
  const ordered = [...items].sort((x, y) => layer(x) - layer(y))

  return (
    <div className="stack" style={{ gap: '1rem', minWidth: 0 }}>
      {w && (
        <div className="plot-palette no-print" role="toolbar" aria-label="Add to plot">
          {(Object.keys(PLOT_KINDS) as PlotKind[]).map(k => (
            <button key={k} type="button" className={`btn sm pk-${k}`} onClick={() => void add(k)}>+ {PLOT_KINDS[k].label}</button>
          ))}
        </div>
      )}
      <div className="plot-wrap" ref={wrap}>
        <svg ref={svg} className="plot" viewBox={`-0.5 -0.5 ${W + 1} ${D + 1.6}`} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
          role="img" aria-label={`Stage plot for ${artist.name}, ${W} by ${D} metres`}>
          <rect x={0} y={0} width={W} height={D} className="plot-stage" onPointerDown={() => setSel(null)} />
          {Array.from({ length: W - 1 }, (_, i) => <line key={`v${i}`} x1={i + 1} y1={0} x2={i + 1} y2={D} className="plot-grid" />)}
          {Array.from({ length: D - 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i + 1} x2={W} y2={i + 1} className="plot-grid" />)}
          <text x={W / 2} y={D + 0.75} className="plot-front">FRONT OF STAGE · AUDIENCE</text>
          <text x={0.15} y={D + 0.75} className="plot-side">L</text>
          <text x={W - 0.15} y={D + 0.75} className="plot-side" textAnchor="end">R</text>
          {ordered.map(it => {
            const x = drag?.id === it.id ? drag.x : it.x
            const y = drag?.id === it.id ? drag.y : it.y
            const round = it.kind === 'vocal' || it.kind === 'mic' || it.kind === 'person'
            const { hd } = halfExtent(it)
            return (
              <g key={it.id} className={`plot-item pk-${it.kind}${sel === it.id ? ' sel' : ''}${w ? ' movable' : ''}`}
                transform={`translate(${x} ${D - y})`} onPointerDown={e => down(e, it)} tabIndex={0} aria-label={it.label}
                onKeyDown={e => { if (w && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); void rotate(it, e.shiftKey ? -90 : 90) } }}>
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
          {ordered.filter(it => it.kind === 'riser').map(it => {
            const x = drag?.id === it.id ? drag.x : it.x
            const y = drag?.id === it.id ? drag.y : it.y
            return (
              <g key={`lbl-${it.id}`} transform={`translate(${x} ${D - y})`} className="plot-riser-label">
                <text y={halfExtent(it).hd + 0.26} className="plot-label">{it.label}</text>
                <text y={halfExtent(it).hd + 0.5} className="plot-sub">{it.size} · {it.height} cm{it.rolling ? ' · rolling' : ''}</text>
              </g>
            )
          })}
        </svg>
        {selected && !drag && (
          <div ref={pop} className="plot-pop no-print" role="dialog" aria-label={`Edit ${selected.label}`}>
            <div className="pp-head">
              <b>{selected.label}</b>
              <button type="button" className="pp-close" aria-label="Close" onClick={() => setSel(null)}>×</button>
            </div>
            <p className="small muted">{PLOT_KINDS[selected.kind].label} · {selected.x} m from left, {selected.y} m from the front{selected.rot ? ` · turned ${selected.rot}°` : ''}</p>
            {w && (
              <>
                <div className="pp-grid">
                  <label className="fld pp-full"><span>Label</span><input defaultValue={selected.label} key={`l${selected.id}`} onBlur={e => void patch(selected.id, { label: e.target.value || PLOT_KINDS[selected.kind].label })} /></label>
                  {selected.kind === 'riser' ? (
                    <>
                      <label className="fld"><span>Deck</span>
                        <select value={selected.size} onChange={e => { const sz = e.target.value as RiserSize; void patch(selected.id, { size: sz, w: RISER_SIZES[sz].w, d: RISER_SIZES[sz].d }) }}>
                          {(Object.keys(RISER_SIZES) as RiserSize[]).map(sz => <option key={sz} value={sz}>{sz} ft</option>)}
                        </select>
                      </label>
                      <label className="fld"><span>Height (cm)</span><input type="number" min={0} step={10} defaultValue={selected.height} key={`h${selected.id}`} onBlur={e => void patch(selected.id, { height: Number(e.target.value) || 0 })} /></label>
                      <label className="row small pp-full"><input type="checkbox" checked={!!selected.rolling} onChange={e => void patch(selected.id, { rolling: e.target.checked })} /> Rolling</label>
                    </>
                  ) : (
                    <>
                      <label className="fld"><span>Width (m)</span><input type="number" min={0.1} step={0.1} defaultValue={selected.w} key={`w${selected.id}`} onBlur={e => void patch(selected.id, { w: Number(e.target.value) || selected.w })} /></label>
                      <label className="fld"><span>Depth (m)</span><input type="number" min={0.1} step={0.1} defaultValue={selected.d} key={`d${selected.id}`} onBlur={e => void patch(selected.id, { d: Number(e.target.value) || selected.d })} /></label>
                    </>
                  )}
                  <label className="fld"><span>Rotation</span>
                    <select value={selected.rot ?? 0} onChange={e => void patch(selected.id, { rot: Number(e.target.value) })}>
                      {ANGLES.map(a => <option key={a} value={a}>{a}°</option>)}
                      {!ANGLES.includes(selected.rot ?? 0) && <option value={selected.rot}>{selected.rot}°</option>}
                    </select>
                  </label>
                  <button type="button" className="btn" style={{ alignSelf: 'flex-end' }} title="Shortcut: R (Shift+R turns the other way)" onClick={() => void rotate(selected, 90)}>Rotate 90°</button>
                </div>
                <div className="pp-actions">
                  <button type="button" className="btn sm danger" onClick={() => { void store.update('plots', artist.id, { items: { [selected.id]: undefined } }); setSel(null) }}>Remove</button>
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
              <label className="row">Stage width (m) <input className="inline-sel" type="number" min={4} max={40} defaultValue={W} key={`W${W}`} style={{ width: '4.5rem' }} onBlur={async e => { await ensure(); void store.update('plots', artist.id, { width: Math.max(4, Number(e.target.value) || W) }) }} /></label>
              <label className="row">Depth (m) <input className="inline-sel" type="number" min={3} max={30} defaultValue={D} key={`D${D}`} style={{ width: '4.5rem' }} onBlur={async e => { await ensure(); void store.update('plots', artist.id, { depth: Math.max(3, Number(e.target.value) || D) }) }} /></label>
            </>
          ) : <span>{W} × {D} m</span>}
          <span className="muted" style={{ marginLeft: 'auto' }}>{items.length} items{riserText(plot) ? ` · risers: ${riserText(plot)}` : ''}</span>
        </div>
      </section>
    </div>
  )
}
