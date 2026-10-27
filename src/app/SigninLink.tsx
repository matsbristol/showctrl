import { useState } from 'react'
import { locale, tr } from '../i18n'
import { cancelSigninLink, makeSigninLink } from './backend'
import { FormDialog } from './ui/Dialog'

/**
 * Superadmins: a sign-in link for someone whose sign-in email doesn't arrive, to send by text
 * message or chat. It works every time for 30 days; a new link or Cancel stops the old one.
 */
export function SigninLinkDialog({ email, name, onClose }: { email: string; name: string; onClose: () => void }) {
  const [link, setLink] = useState<{ url: string; expiresAt: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const run = async (f: () => Promise<void>) => {
    setBusy(true)
    setErr('')
    setNote('')
    try { await f() } catch (e) { setErr(e instanceof Error ? tr(e.message) : tr('That didn’t work. Try again.')) } finally { setBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(link!.url); setNote(tr('Copied.')) } catch { setNote(tr('Select the link and copy it.')) }
  }
  return (
    <FormDialog title={tr('Sign-in link for {name}', { name })} saveLabel={tr('Close')} onClose={onClose} onSave={() => undefined}>
      <div className="fld full stack" style={{ gap: '.75rem' }}>
        <p className="small muted">{tr('For when the sign-in email doesn’t arrive. Send the link by text message or chat. It signs in as {email} every time it’s used, for 30 days. Anyone with the link can sign in as them, so send it only to them.', { email })}</p>
        {link ? (
          <>
            <input readOnly value={link.url} aria-label={tr('Sign-in link')} onFocus={e => e.target.select()} />
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn primary sm" onClick={() => void copy()}>{tr('Copy link')}</button>
              <button type="button" className="btn sm danger" disabled={busy} onClick={() => void run(async () => { await cancelSigninLink(email); setLink(null); setNote(tr('Cancelled. The link no longer works.')) })}>{tr('Cancel link')}</button>
              <span className="small muted" style={{ marginLeft: 'auto' }}>{tr('Works until {date}', { date: new Date(link.expiresAt).toLocaleDateString(locale(), { day: 'numeric', month: 'long' }) })}</span>
            </div>
          </>
        ) : (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn primary sm" disabled={busy} onClick={() => void run(async () => setLink(await makeSigninLink(email)))}>{tr('Make link')}</button>
            <button type="button" className="btn sm" disabled={busy} onClick={() => void run(async () => { await cancelSigninLink(email); setNote(tr('Cancelled. The link no longer works.')) })}>{tr('Cancel earlier link')}</button>
          </div>
        )}
        <p className="small muted">{tr('Making a new link stops the old one.')}</p>
        {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
        {note && <p className="small" role="status">{note}</p>}
      </div>
    </FormDialog>
  )
}
