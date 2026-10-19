/*
 * Live mode: the link that lets someone ask to join this event (and, with a
 * stage, that stage's team). Opening it signs them in and shows the "ask
 * for access" form; their request then waits for an admin or stage manager.
 */
import type { Id } from '../types/model'
import { useToast } from '../ui/hooks'

function inviteUrl(eventId: string, stage?: Id): string {
  const q = new URLSearchParams({ event: eventId, ...(stage ? { stage } : {}) })
  return `${location.origin}/?${q}`
}

export function InviteLink({ eventId, stage }: { eventId: string; stage?: Id }) {
  const toast = useToast()
  const url = inviteUrl(eventId, stage)
  const copy = () => navigator.clipboard?.writeText(url)
    .then(() => toast('Link copied.'))
    .catch(() => toast('Couldn’t copy. Select the link and copy it instead.'))
  return (
    <span className="invite">
      <code>{url}</code>
      <button type="button" className="btn sm" onClick={() => void copy()}>Copy link</button>
    </span>
  )
}
