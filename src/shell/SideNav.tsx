/*
 * Sections of the current workspace. A side column on desktop; under 860 px
 * it becomes a bottom bar (see shell.css).
 */
import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { tapeHex, termsOf } from '../domain/constants'
import { useSnapshot } from '../data/hooks'
import { useAccess } from '../session/hooks'
import { Icon } from './Icon'
import { ctxPath, hqNav, stageNav, type Ctx } from './nav'
import { colourVar, HQ_COLOUR } from './style'

export function SideNav({ ctx }: { ctx: Ctx }) {
  const snap = useSnapshot()
  const access = useAccess()
  const { pathname } = useLocation()
  const T = termsOf(snap.cfg)
  const stage = ctx === 'hq' ? null : snap.col.stages[ctx]
  const items = ctx === 'hq' ? hqNav(access, T) : stage ? stageNav(access, ctx, T) : []
  // Highlight the section you're in. An artist's own page belongs under the artists section.
  const isCurrent = (view: string) => {
    const to = ctxPath(ctx, view)
    return pathname === to || pathname.startsWith(to + '/') || (view === 'artists' && pathname.includes('/artist/'))
  }

  return (
    <nav className="side" aria-label="Sections">
      {(ctx === 'hq' || stage) && (
        <div className="ctxhead">
          <span className="tape" style={colourVar(stage ? tapeHex(stage.tape) : HQ_COLOUR)} />
          {stage ? stage.name : 'Festival HQ'}
        </div>
      )}
      {items.map(n => (
        <Fragment key={n.view}>
          {n.sep && <div className="sep" />}
          <Link to={ctxPath(ctx, n.view)} aria-current={isCurrent(n.view) ? 'page' : undefined}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </Link>
        </Fragment>
      ))}
    </nav>
  )
}
