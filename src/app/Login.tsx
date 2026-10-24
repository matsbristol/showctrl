import { useState, type FormEvent } from 'react'
import { startLogin, verifyLogin } from './backend'

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.')

/** Sign-in: your email, then the 6-digit code showctrl emails you. No passwords. */
export function Login() {
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
      if (sent) setNote('A new code is on its way, if the last one was more than a minute ago.')
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
      <img className="setup-logo" src="/logo.png" alt="showctrl" />
      <div className="panel">
        <h1>Sign in</h1>
        {!sent ? (
          <form className="stack" style={{ marginTop: '1rem', gap: '.75rem' }} onSubmit={e => void send(e)}>
            <p className="muted">We’ll email you a code. No password needed.</p>
            <label className="fld"><span>Email</span>
              <input type="email" autoComplete="email" autoFocus required value={email} placeholder="name@company.no" onChange={e => setEmail(e.target.value)} />
            </label>
            {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
            <div className="row"><button type="submit" className="btn primary" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Send code'}</button></div>
          </form>
        ) : (
          <form className="stack" style={{ marginTop: '1rem', gap: '.75rem' }} onSubmit={e => void verify(e)}>
            <p className="muted">If <b>{email.trim()}</b> has access to showctrl, a 6-digit code is on its way. It works for 10 minutes.</p>
            <label className="fld"><span>Code</span>
              <input className="login-code num" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} required value={code}
                placeholder="123456" onChange={e => setCode(e.target.value.replace(/[^\d ]/g, ''))} />
            </label>
            {devCode && <p className="small muted">Local development: the code is <b className="num">{devCode}</b>.</p>}
            {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
            {note && <p className="small muted" role="status">{note}</p>}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="submit" className="btn primary" disabled={busy || code.replace(/\D/g, '').length !== 6}>{busy ? 'Checking…' : 'Sign in'}</button>
              <button type="button" className="btn" disabled={busy} onClick={() => void send()}>Send a new code</button>
              <button type="button" className="linkish small" style={{ marginLeft: 'auto' }} onClick={() => { setSent(false); setCode(''); setErr(''); setNote('') }}>Use another email</button>
            </div>
            <p className="small muted">No email? Check spam. If it still doesn’t come, ask your organisation’s showctrl admin to add this address.</p>
          </form>
        )}
      </div>
    </div>
  )
}
