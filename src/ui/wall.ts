/*
 * Wall mode: hide the app chrome so a page fills a monitor (clocks wall,
 * stage display), and ask the browser for full screen. Escape, or leaving
 * the page, exits.
 */
import { useCallback, useEffect, useState } from 'react'

const CLASS = 'wallmode'

export function useWallMode(): { on: boolean; enter: () => void; exit: () => void } {
  const [on, setOn] = useState(false)

  const exit = useCallback(() => {
    setOn(false)
    try { if (document.fullscreenElement) void document.exitFullscreen() } catch { /* not supported */ }
  }, [])

  const enter = useCallback(() => {
    setOn(true)
    // Full screen can be refused (iframes, iOS); wall mode still works without it.
    try { void document.documentElement.requestFullscreen?.().catch(() => {}) } catch { /* not supported */ }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle(CLASS, on)
    if (!on) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exit() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove(CLASS)
    }
  }, [on, exit])

  return { on, enter, exit }
}
