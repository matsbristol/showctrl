import { useCrew } from '../context/CrewContext'
import type { CrewMember } from '../context/CrewContext'

export default function CrewSection() {
  const { crew, updateCrewMember } = useCrew()

  const statusColors: Record<CrewMember['status'], string> = {
    'on-site': 'text-amber-600',
    ready: 'text-green-600',
    break: 'text-orange-600',
    'off-duty': 'text-gray-500',
    'not-arrived': 'text-red-600',
  }

  const statusBgColors: Record<CrewMember['status'], string> = {
    'on-site': 'bg-amber-50',
    ready: 'bg-green-50',
    break: 'bg-orange-50',
    'off-duty': 'bg-gray-50',
    'not-arrived': 'bg-red-50',
  }

  const cycleStatus = (member: CrewMember) => {
    const statuses: CrewMember['status'][] = ['not-arrived', 'on-site', 'ready', 'break', 'off-duty']
    const currentIndex = statuses.indexOf(member.status)
    const nextStatus = statuses[(currentIndex + 1) % statuses.length]
    updateCrewMember(member.id, { status: nextStatus })
  }

  const ready = crew.filter((c) => c.status === 'ready').length
  const onSite = crew.filter((c) => c.status === 'on-site').length
  const onBreak = crew.filter((c) => c.status === 'break').length

  return (
    <div className="sm-section crew-section">
      <h3>Crew Management</h3>
      <div className="crew-stats">
        <div className="crew-stat">
          <div className="crew-stat-value">{ready}</div>
          <div className="crew-stat-label">Ready</div>
        </div>
        <div className="crew-stat">
          <div className="crew-stat-value">{onSite}</div>
          <div className="crew-stat-label">On-Site</div>
        </div>
        <div className="crew-stat">
          <div className="crew-stat-value">{onBreak}</div>
          <div className="crew-stat-label">Break</div>
        </div>
      </div>
      <div className="crew-list">
        {crew.map((member) => (
          <div
            key={member.id}
            className={`crew-item ${statusBgColors[member.status]}`}
            onClick={() => cycleStatus(member)}
          >
            <div className="crew-info">
              <div className="crew-name">{member.name}</div>
              <div className={`crew-role ${statusColors[member.status]}`}>{member.role}</div>
            </div>
            <div className={`crew-status ${statusColors[member.status]}`}>
              {member.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
