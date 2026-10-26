// Invitation emails: whoever is given access to an event is told, with where to sign in.

import type { Env } from './env'
import { isDev } from './login'

export interface Invite { to: string; event: string; by: string; as: string; nb?: boolean }

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export async function sendInvite(env: Env, i: Invite): Promise<void> {
  if (!i.to.includes('@')) return // demo people have no address
  const site = env.PUBLIC_URL ?? 'https://showctrl.no'
  const w = i.nb
    ? { gave: 'har gitt deg tilgang til', on: 'på showctrl, som', subject: `Du er lagt til i ${i.event} på showctrl`, open: 'Åpne showctrl', how: (to: string) => `Logg inn med <b>${esc(to)}</b>. Du får en 6-sifret kode på e-post; det finnes ikke noe passord.`, plain: `Logg inn på ${site} med ${i.to}. Du får en 6-sifret kode på e-post; det finnes ikke noe passord.` }
    : { gave: 'gave you access to', on: 'on showctrl, as', subject: `You’ve been added to ${i.event} on showctrl`, open: 'Open showctrl', how: (to: string) => `Sign in with <b>${esc(to)}</b>. You’ll get a 6-digit code by email; there is no password.`, plain: `Sign in at ${site} with ${i.to}. You'll get a 6-digit code by email; there is no password.` }
  const text = `${i.by} ${w.gave} ${i.event} ${w.on} ${i.as}.\n\n${w.plain}\n`
  if (isDev(env) || !env.EMAIL) { console.log(JSON.stringify({ level: 'info', what: 'invite (not sent)', ...i })); return }
  try {
    await env.EMAIL.send({
      to: i.to,
      from: { email: env.LOGIN_FROM ?? 'login@showctrl.no', name: 'showctrl' },
      subject: w.subject,
      text,
      html: `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:10px;padding:32px">
<tr><td><img src="${site}/brand/logo-dark.png" alt="showctrl" height="28" style="display:block;height:28px;width:auto"></td></tr>
<tr><td style="padding-top:24px;font-size:16px;line-height:1.5"><b>${esc(i.by)}</b> ${w.gave} <b>${esc(i.event)}</b>, ${i.nb ? 'som' : 'as'} ${esc(i.as)}.</td></tr>
<tr><td style="padding:24px 0"><a href="${site}" style="display:inline-block;background:#2747C9;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px">${w.open}</a></td></tr>
<tr><td style="font-size:14px;color:#555;line-height:1.5">${w.how(i.to)}</td></tr>
</table></td></tr></table></body></html>`,
    })
    console.log(JSON.stringify({ level: 'info', what: 'invite sent', to: i.to, event: i.event }))
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', what: 'invite email', to: i.to, error: String(e) }))
  }
}
