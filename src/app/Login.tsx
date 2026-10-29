import { useEffect, useRef, useState, type FormEvent } from 'react'
import { autoSignInWithLink, signInWithLink, startLogin, verifyLogin, type SignInLink } from './backend'
import { LANGS, tr, type Lang } from '../i18n'
import { setLang, useLang } from './lang'
import { BrandLogo } from './BrandLogo'

/** English / Norsk, small, under the sign-in box. */
function LangSwitch() {
  const lang = useLang()
  return (
    <div className="langpick langpick-inline langpick-login" role="group" aria-label={tr('Language')}>
      {(Object.keys(LANGS) as Lang[]).map(l => <button key={l} type="button" aria-pressed={l === lang} onClick={() => setLang(l)}>{LANGS[l]}</button>)}
    </div>
  )
}

function Brand() {
  return <div className="brand"><BrandLogo /></div>
}

const errText = (e: unknown) => (e instanceof Error ? e.message : tr('Something went wrong. Try again.'))

/** Sign-in: your email, then the 6-digit code showctrl emails you. No passwords. */
export function Login() {
  useLang() // redraw in the new language; what's typed stays
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')

  const send = async (ev?: FormEvent) => {
    ev?.preventDefault()
    setBusy(true)
    setErr('')
    setNote('')
    try {
      const r = await startLogin(email.trim())
      setDevCode(r.devCode)
      if (sent) setNote(tr('A new code is on its way, if the last one was more than a minute ago.'))
      setSent(true)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (ev: FormEvent) => {
    ev.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await verifyLogin(email.trim(), code)
      location.reload()
    } catch (e) {
      setErr(errText(e))
      setBusy(false)
    }
  }

  return (
    <div className="setup login">
      <Brand />
      <div className="panel">
        <h1>{tr('Sign in')}</h1>
        {!sent ? (
          <form className="stack" style={{ marginTop: '1rem', gap: '.75rem' }} onSubmit={e => void send(e)}>
            <p className="muted">{tr('We’ll email you a code. No password needed.')}</p>
            <label className="fld"><span>{tr('Email')}</span>
              <input type="email" autoComplete="email" autoFocus required value={email} placeholder={tr('name@company.no')} onChange={e => setEmail(e.target.value)} />
            </label>
            {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
            <div className="row"><button type="submit" className="btn primary" disabled={busy || !email.trim()}>{busy ? tr('Sending…') : tr('Send code')}</button></div>
          </form>
        ) : (
          <form className="stack" style={{ marginTop: '1rem', gap: '.75rem' }} onSubmit={e => void verify(e)}>
            <p className="muted">{tr('If')} <b>{email.trim()}</b> {tr('has access to showctrl, an email is on its way. Press the link in it, or type the 6-digit code here. Both work for 10 minutes.')}</p>
            <label className="fld"><span>{tr('Code')}</span>
              <input className="login-code num" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} required value={code}
                placeholder="123456" onChange={e => setCode(e.target.value.replace(/[^\d ]/g, ''))} />
            </label>
            {devCode && <p className="small muted">{tr('Local development: the code is')} <b className="num">{devCode}</b>.</p>}
            {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
            {note && <p className="small muted" role="status">{note}</p>}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="submit" className="btn primary" disabled={busy || code.replace(/\D/g, '').length !== 6}>{busy ? tr('Checking…') : tr('Sign in')}</button>
              <button type="button" className="btn" disabled={busy} onClick={() => void send()}>{tr('Send a new code')}</button>
              <button type="button" className="linkish small" style={{ marginLeft: 'auto' }} onClick={() => { setSent(false); setCode(''); setErr(''); setNote('') }}>{tr('Use another email')}</button>
            </div>
            <p className="small muted">{tr('No email? Check spam. If it still doesn’t come, ask your organisation’s showctrl admin to add this address.')}</p>
          </form>
        )}
      </div>
      <LangSwitch />
    </div>
  )
}

/** Opened from a sign-in link (from the sign-in email or a superadmin): one press signs in. */
export function LinkSignIn({ link }: { link: SignInLink }) {
  useLang() // redraw in the new language
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // The email's link signs in by itself in the browser that asked for the code; elsewhere it asks.
  const [checking, setChecking] = useState(link.kind === 'email')
  const tried = useRef(false)
  const leave = () => { history.replaceState(null, '', location.pathname + location.search); location.reload() }
  useEffect(() => {
    if (link.kind !== 'email' || tried.current) return
    tried.current = true
    autoSignInWithLink(link).then(r => { if ('ok' in r) leave(); else setChecking(false) }, () => setChecking(false))
  }, [link])
  if (checking) {
    return (
      <div className="setup login">
        <Brand />
        <div className="panel"><p className="muted" role="status">{tr('Signing in…')}</p></div>
      </div>
    )
  }
  const go = async () => {
    setBusy(true)
    setErr('')
    try {
      await signInWithLink(link)
      leave()
    } catch (e) {
      setErr(errText(e))
      setBusy(false)
    }
  }
  return (
    <div className="setup login">
      <Brand />
      <div className="panel">
        <h1>{tr('Sign in')}</h1>
        <div className="stack" style={{ marginTop: '1rem', gap: '.75rem' }}>
          <p className="muted">{link.kind === 'email' ? tr('Press Sign in to finish signing in to showctrl.') : tr('This link signs you in to showctrl. Keep it to yourself: anyone with it can sign in as you.')}</p>
          {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{tr(err)}</p>}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn primary" autoFocus disabled={busy} onClick={() => void go()}>{busy ? tr('Signing in…') : tr('Sign in')}</button>
            <button type="button" className="linkish small" style={{ marginLeft: 'auto' }} onClick={leave}>{tr('Sign in with email instead')}</button>
          </div>
        </div>
      </div>
      <LangSwitch />
    </div>
  )
}
