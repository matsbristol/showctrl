import { useEffect, useRef, useState } from 'react'
import { FONT_IDS, FONTS } from '../shared/fonts'
import { fontVars, loadFont, setFont, useFont } from './font'

/** "Aa": choose the typeface. Each choice is shown in its own font, clock included. */
export function FontPicker({ className }: { className: string }) {
  const font = useFont()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    FONT_IDS.forEach(loadFont)
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [open])
  return (
    <div className="fontpick" ref={box}>
      <button type="button" className={className} aria-expanded={open} aria-haspopup="listbox" title="Font" aria-label="Choose font" onClick={() => setOpen(o => !o)}>Aa</button>
      {open && (
        <ul className="fontpick-list" role="listbox" aria-label="Font">
          {FONT_IDS.map(id => {
            const f = FONTS[id]
            return (
              <li key={id}>
                <button type="button" role="option" aria-selected={id === font} style={fontVars(f)} onClick={() => { setFont(id); setOpen(false) }}>
                  <span className="fp-name">{f.label}</span>
                  <span className="fp-clock">20:45:00</span>
                  <span className="fp-body">Iron Maiden · Scream · Ål æ ø å</span>
                  <span className="fp-note">{f.note}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
