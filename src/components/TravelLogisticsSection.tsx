import { useTravel } from '../context/TravelContext'
import type { TravelEntry } from '../context/TravelContext'

export default function TravelLogisticsSection() {
  const { travelEntries, getTravelByStatus, getArrivalCountdown, updateTravelEntry } = useTravel()

  const statusColors: Record<TravelEntry['status'], string> = {
    'not-traveled': 'text-red-600',
    'in-transit': 'text-blue-600',
    arrived: 'text-green-600',
    departed: 'text-gray-500',
  }

  const statusBgColors: Record<TravelEntry['status'], string> = {
    'not-traveled': 'bg-red-50',
    'in-transit': 'bg-blue-50',
    arrived: 'bg-green-50',
    departed: 'bg-gray-50',
  }

  const inTransit = getTravelByStatus('in-transit')
  const notTraveled = getTravelByStatus('not-traveled')
  const arrived = getTravelByStatus('arrived')

  return (
    <div className="sm-section travel-section">
      <h3>Travel Logistics</h3>
      <div className="travel-stats">
        <div className="travel-stat">
          <div className="travel-stat-value">{arrived.length}</div>
          <div className="travel-stat-label">Arrived</div>
        </div>
        <div className="travel-stat">
          <div className="travel-stat-value">{inTransit.length}</div>
          <div className="travel-stat-label">In Transit</div>
        </div>
        <div className="travel-stat">
          <div className="travel-stat-value">{notTraveled.length}</div>
          <div className="travel-stat-label">Pending</div>
        </div>
      </div>
      <div className="travel-list">
        {notTraveled.length > 0 && (
          <>
            <div className="travel-section-label">Not Traveled</div>
            {notTraveled.map((entry) => (
              <div
                key={entry.id}
                className={`travel-item ${statusBgColors[entry.status]}`}
                onClick={() => updateTravelEntry(entry.id, { status: 'in-transit' })}
              >
                <div className="travel-name">{entry.personName}</div>
                <div className={`travel-status ${statusColors[entry.status]}`}>
                  {entry.status}
                </div>
              </div>
            ))}
          </>
        )}
        {inTransit.length > 0 && (
          <>
            <div className="travel-section-label">In Transit</div>
            {inTransit.map((entry) => (
              <div
                key={entry.id}
                className={`travel-item ${statusBgColors[entry.status]}`}
                onClick={() => updateTravelEntry(entry.id, { status: 'arrived', actualArrival: Date.now() })}
              >
                <div className="travel-info">
                  <div className="travel-name">{entry.personName}</div>
                  {entry.scheduledArrival && (
                    <div className="travel-countdown">
                      ETA: {getArrivalCountdown(entry.scheduledArrival)}
                    </div>
                  )}
                </div>
                <div className={`travel-status ${statusColors[entry.status]}`}>
                  {entry.status}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
