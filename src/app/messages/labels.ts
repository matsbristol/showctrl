import { useCollection, useConfig } from '../../data/hooks'
import { personName } from '../../shared/people'
import type { Msg } from '../../types/model'
import { useAccess } from '../session'

/** "Everyone", a stage, a department or a person. */
export function useTargetLabel() {
  const stages = useCollection('stages')
  const members = useCollection('members')
  const people = useCollection('people')
  const cfg = useConfig('event')
  const { me } = useAccess()
  return (to: Msg['to'] | undefined) => {
    if (!to || to.t === 'all') return 'Everyone'
    if (to.t === 'dept') return cfg?.depts.find(d => d.id === to.id)?.name ?? '—'
    if (to.t === 'stage') return stages[to.id]?.name ?? 'Stage'
    return to.id === me ? 'you' : personName(to.id, members, people)
  }
}
