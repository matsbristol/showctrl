import { useRiserPlanning } from '../context/RiserPlanningContext'

export default function RiserPlanningSection() {
  const { risers, getRiserCapacityUsage } = useRiserPlanning()

  const getZones = () => {
    const zones = new Set(risers.map((r) => r.zone))
    return Array.from(zones)
  }

  const zones = getZones()

  return (
    <div className="sm-section riser-section">
      <h3>Riser Planning</h3>
      <div className="riser-zones">
        {zones.map((zone) => {
          const zoneRisers = risers.filter((r) => r.zone === zone)
          return (
            <div key={zone} className="riser-zone">
              <div className="zone-name">{zone}</div>
              <div className="zone-risers">
                {zoneRisers.map((riser) => {
                  const usage = getRiserCapacityUsage(riser.id)
                  const isAtCapacity = usage.percent >= 100
                  const isNearCapacity = usage.percent >= 75

                  return (
                    <div key={riser.id} className="riser-item">
                      <div className="riser-header">
                        <div className="riser-name">{riser.name}</div>
                        <div className={`riser-capacity ${isAtCapacity ? 'at-capacity' : isNearCapacity ? 'near-capacity' : ''}`}>
                          {usage.used}/{usage.capacity}
                        </div>
                      </div>
                      <div className="riser-bar">
                        <div
                          className="riser-bar-fill"
                          style={{ width: `${usage.percent}%` }}
                        />
                      </div>
                      {riser.assignedPerformers.length > 0 && (
                        <div className="riser-performers">
                          {riser.assignedPerformers.map((perf) => (
                            <span key={perf} className="performer-tag">{perf}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
