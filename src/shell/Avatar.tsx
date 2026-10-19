/* Round initials badge in a colour that stays the same for each person. */
import { initials, personColor } from './people'
import { colourVar } from './style'

export function Avatar({ uid, name }: { uid: string; name: string }) {
  return <span className="av" style={colourVar(personColor(uid))} aria-hidden="true">{initials(name)}</span>
}
