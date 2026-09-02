import { useRunOfShow } from '../context/RunOfShowContext'
import { usePerformersContext } from '../context/PerformersContext'
import { useHospitality } from '../context/HospitalityContext'
import { useTravel } from '../context/TravelContext'
import { useCrew } from '../context/CrewContext'
import { useRiserPlanning } from '../context/RiserPlanningContext'

export default function OperationsDashboard() {
  const { currentRunOfShow } = useRunOfShow()
  const { getArtistName } = usePerformersContext()
  const { hospitality } = useHospitality()
  const { travelEntries } = useTravel()
  const { crew } = useCrew()
  const { risers } = useRiserPlanning()

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  if (!currentRunOfShow) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Operations Dashboard</h1>
          <p className="page-subtitle">Unified view of all event data</p>
        </div>
        <div className="placeholder-content">
          <p>No run-of-show loaded. Create one first to view the operations dashboard.</p>
        </div>
      </div>
    )
  }

  const performerItems = currentRunOfShow.items.filter((item) => item.performers.length > 0)

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Operations Dashboard</h1>
          <p className="page-subtitle">Unified artist & stage operations for {currentRunOfShow.name}</p>
        </div>
      </div>

      {performerItems.length === 0 ? (
        <div className="placeholder-content">
          <p>No artists scheduled in timeline. Add artists to timeline items to see operations dashboard.</p>
        </div>
      ) : (
        <div className="operations-view">
          {performerItems.map((item) =>
            item.performers.map((artistId) => {
              const artistName = getArtistName(artistId)
              const artistHospitality = hospitality.find((h) => h.personName === artistName)
              const artistTravel = travelEntries.find((t) => t.personName === artistName)
              const riserForStage = risers.find((r) => r.zone === item.stage && r.assignedPerformers.includes(artistName || ''))
              const stageCrews = crew.filter((c) => c.department === 'stage')

              return (
                <div key={`${item.id}-${artistId}`} className="operation-card">
                  <div className="operation-header">
                    <div className="operation-artist">
                      <h3>{artistName}</h3>
                      <span className="stage-badge">{item.stage}</span>
                    </div>
                    <div className="operation-time">
                      <span className="time-display">{formatTime(item.startTime)}</span>
                      <span className="type-badge">{item.type}</span>
                    </div>
                  </div>

                  <div className="operation-performance">
                    <div className="section-title">Performance</div>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="label">Event:</span>
                        <span className="value">{item.name}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">Duration:</span>
                        <span className="value">{Math.floor(item.duration / 1000 / 60)} min</span>
                      </div>
                      <div className="info-item">
                        <span className="label">Department:</span>
                        <span className="value">{item.department}</span>
                      </div>
                    </div>
                  </div>

                  {artistHospitality && (
                    <div className="operation-hospitality">
                      <div className="section-title">Hospitality</div>
                      <div className="info-grid">
                        <div className="info-item">
                          <span className="label">Meals:</span>
                          <span className={`value status-${artistHospitality.mealStatus}`}>
                            {artistHospitality.mealStatus}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="label">Accommodation:</span>
                          <span className={`value ${artistHospitality.accommodationConfirmed ? 'confirmed' : 'pending'}`}>
                            {artistHospitality.accommodationConfirmed ? 'Confirmed' : 'Pending'}
                          </span>
                        </div>
                        {artistHospitality.specialRequirements.length > 0 && (
                          <div className="info-item full-width">
                            <span className="label">Dietary:</span>
                            <div className="tags">
                              {artistHospitality.specialRequirements.map((req) => (
                                <span key={req} className="tag">
                                  {req}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {artistTravel && (
                    <div className="operation-travel">
                      <div className="section-title">Travel & Arrival</div>
                      <div className="info-grid">
                        <div className="info-item">
                          <span className="label">Status:</span>
                          <span className={`value status-${artistTravel.status}`}>
                            {artistTravel.status}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="label">Transport:</span>
                          <span className="value">{artistTravel.transportType}</span>
                        </div>
                        {artistTravel.accommodation && (
                          <div className="info-item">
                            <span className="label">Accommodation:</span>
                            <span className="value">{artistTravel.accommodation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {riserForStage && (
                    <div className="operation-stage">
                      <div className="section-title">Stage Setup</div>
                      <div className="info-grid">
                        <div className="info-item">
                          <span className="label">Riser:</span>
                          <span className="value">{riserForStage.name}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Capacity Used:</span>
                          <span className="value">
                            {riserForStage.assignedPerformers.length}/{riserForStage.capacity}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {stageCrews.length > 0 && (
                    <div className="operation-crew">
                      <div className="section-title">Assigned Crew</div>
                      <div className="crew-tags">
                        {stageCrews.slice(0, 3).map((c) => (
                          <span key={c.id} className={`crew-tag ${c.status}`}>
                            {c.name}
                          </span>
                        ))}
                        {stageCrews.length > 3 && (
                          <span className="crew-tag more">+{stageCrews.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
