import { useHospitality } from '../context/HospitalityContext'
import type { HospitalityEntry } from '../context/HospitalityContext'

export default function HospitalitySection() {
  const { hospitality, updateHospitalityEntry, getMissingAccommodations, getSpecialRequirements } = useHospitality()

  const mealStatusColors: Record<HospitalityEntry['mealStatus'], string> = {
    pending: 'text-amber-600',
    served: 'text-blue-600',
    completed: 'text-green-600',
  }

  const pending = hospitality.filter((h) => h.mealStatus === 'pending')
  const missingAccom = getMissingAccommodations()
  const requirements = getSpecialRequirements()

  const cycleMealStatus = (entry: HospitalityEntry) => {
    const statuses: HospitalityEntry['mealStatus'][] = ['pending', 'served', 'completed']
    const currentIndex = statuses.indexOf(entry.mealStatus)
    const nextStatus = statuses[(currentIndex + 1) % statuses.length]
    updateHospitalityEntry(entry.id, { mealStatus: nextStatus })
  }

  return (
    <div className="sm-section hospitality-section">
      <h3>Hospitality</h3>
      <div className="hospitality-alerts">
        {missingAccom.length > 0 && (
          <div className="alert alert-warning">
            <span className="alert-icon">!</span>
            <span>{missingAccom.length} missing accommodations</span>
          </div>
        )}
        {pending.length > 0 && (
          <div className="alert alert-info">
            <span className="alert-icon">•</span>
            <span>{pending.length} pending meals</span>
          </div>
        )}
      </div>
      {requirements.length > 0 && (
        <div className="special-requirements">
          <div className="sr-label">Special Requirements:</div>
          <div className="sr-list">
            {requirements.map(({ requirement, count }) => (
              <span key={requirement} className="sr-tag">
                {requirement} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="hospitality-list">
        {hospitality.map((entry) => (
          <div
            key={entry.id}
            className="hospitality-item"
            onClick={() => cycleMealStatus(entry)}
          >
            <div className="hospitality-info">
              <div className="hospitality-name">{entry.personName}</div>
              <div className="hospitality-status">
                <span className={`meal-status ${mealStatusColors[entry.mealStatus]}`}>
                  {entry.mealStatus}
                </span>
                {!entry.accommodationConfirmed && (
                  <span className="accom-status">Accom TBD</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
