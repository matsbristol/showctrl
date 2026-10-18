import type { ReactNode } from 'react'
import type { NavMeta } from '../nav'
import { useTerms } from '../session'

/** Stands in for a page until its porting step builds it. */
export function Placeholder({ meta, sub, children }: { meta: NavMeta; sub?: string; children?: ReactNode }) {
  const t = useTerms()
  return (
    <>
      <div className="head">
        <div>
          <h1>{meta.label(t)}</h1>
          <p>{sub ?? meta.about(t)}</p>
        </div>
      </div>
      {children}
      <div className="panel"><p className="empty">This page arrives in porting step {meta.step}.</p></div>
    </>
  )
}
