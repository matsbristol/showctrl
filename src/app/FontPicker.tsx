import { useEffect, useRef, useState } from 'react'
import { FONT_IDS, FONTS } from '../shared/fonts'
import { LANGS, type Lang, tr } from '../i18n'
import { fontVars, loadFont, setFont, useFont } from './font'
import { setLang, useLang } from './lang'

/** "Aa": choose the language and the typeface. Each typeface is shown in its own font, clock included. */
export function FontPicker({ className }: { className: string }) {
  const font = useFont()
  const lang = useLang()
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
      <button type="button" className={className} aria-expanded={open} aria-haspopup="listbox"  title={tr('Language and font')} aria-label={tr('Choose language and font')} onClick={() => setOpen(o => !o)}>Aa</button>
      {open && (
        <div className="fontpick-pop">
        <div className="langpick" role="group" aria-label={tr('Language')}>
          {(Object.keys(LANGS) as Lang[]).map(l => (
            <button key={l} type="button" aria-pressed={l === lang} onClick={() => { setLang(l); setOpen(false) }}>{LANGS[l]}</button>
          ))}
        </div>
        <ul className="fontpick-list" role="listbox" aria-label={tr('Font')}>
          {FONT_IDS.map(id => {
            const f = FONTS[id]
            return (
              <li key={id}>
                <button type="button" role="option" aria-selected={id === font} style={fontVars(f)} onClick={() => { setFont(id); setOpen(false) }}>
                  <span className="fp-name">{tr(f.label)}</span>
                  <span className="fp-clock">20:45:00</span>
                  <span className="fp-body">Iron Maiden · Scream · Ål æ ø å</span>
                  <span className="fp-note">{tr(f.note)}</span>
                </button>
              </li>
            )
          })}
        </ul>
        </div>
      )}
    </div>
  )
}
