import { useEffect, useState, type ReactNode } from 'react'
import { SYNC_INTERVAL, measureOffset } from '../lib/clockSync'
import { TimeContext, type TimeSync } from './time'

/** Measures the offset to server time now and every 10 minutes. */
export function TimeProvider({ url = '/time', children }: { url?: string; children: ReactNode }) {
  const [sync, setSync] = useState<TimeSync>({ offset: 0, state: 'device' })
  useEffect(() => {
    let alive = true
    const run = () => measureOffset(url).then(r => { if (alive) setSync(r) })
    run()
    const id = setInterval(run, SYNC_INTERVAL)
    return () => { alive = false; clearInterval(id) }
  }, [url])
  return <TimeContext.Provider value={sync}>{children}</TimeContext.Provider>
}
