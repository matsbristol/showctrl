import { useEffect, useState, type ReactNode } from 'react'
import { SYNC_INTERVAL, measureOffset } from '../lib/clockSync'
import { TimeContext, setTickOffset, type TimeSync } from './time'

/** Measures the offset to server time now, every 10 minutes, and when the tab wakes up or the network returns. */
export function TimeProvider({ url = '/time', children }: { url?: string; children: ReactNode }) {
  const [sync, setSync] = useState<TimeSync>({ offset: 0, state: 'device' })
  useEffect(() => {
    let alive = true
    let last = 0
    const run = () => {
      last = Date.now()
      return measureOffset(url).then(r => { if (alive) { setTickOffset(r.offset); setSync(r) } })
    }
    // A sleeping laptop or phone drifts and misses timers, so check again on wake, at most every 30 s.
    const wake = () => { if (document.visibilityState === 'visible' && Date.now() - last > 30_000) void run() }
    void run()
    const id = setInterval(run, SYNC_INTERVAL)
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
    }
  }, [url])
  return <TimeContext.Provider value={sync}>{children}</TimeContext.Provider>
}
