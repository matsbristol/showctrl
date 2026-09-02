import { useState } from 'react'
import { useHospitality } from '../context/HospitalityContext'
import { usePerformersContext } from '../context/PerformersContext'
import { useRunOfShow } from '../context/RunOfShowContext'
import { useTravel } from '../context/TravelContext'

export default function HospitalityPage() {
  const { hospitality, updateHospitalityEntry, addHospitalityEntry } = useHospitality()
  const { artists } = usePerformersContext()
  const { currentRunOfShow } = useRunOfShow()
  const { travelEntries } = useTravel()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    personName: '',
    role: 'performer' as const,
    mealStatus: 'pending' as const,
    accommodationConfirmed: false,
    specialRequirements: [] as string[],
    notes: '',
  })

  const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'gluten-free', 'kosher', 'halal', 'nut-allergy', 'dairy-free']

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.personName.trim()) {
      alert('Please enter a name')
      return
    }

    addHospitalityEntry({
      personName: formData.personName,
      role: formData.role,
      mealStatus: formData.mealStatus,
      accommodationConfirmed: formData.accommodationConfirmed,
      specialRequirements: formData.specialRequirements,
      notes: formData.notes,
    })

    setFormData({
      personName: '',
      role: 'performer',
      mealStatus: 'pending',
      accommodationConfirmed: false,
      specialRequirements: [],
      notes: '',
    })
    setShowForm(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData({
        ...formData,
        [name]: checked,
      })
    } else {
      setFormData({
        ...formData,
        [name]: value,
      })
    }
  }

  const handleDietaryChange = (dietary: string) => {
    setFormData({
      ...formData,
      specialRequirements: formData.specialRequirements.includes(dietary)
        ? formData.specialRequirements.filter((d) => d !== dietary)
        : [...formData.specialRequirements, dietary],
    })
  }

  const getScheduleForPerson = (personName: string) => {
    if (!currentRunOfShow) return null
    const timelineItem = currentRunOfShow.items.find((item) =>
      item.performers.some((perfId) => {
        const artist = artists.find((a) => a.id === perfId)
        return artist?.name === personName
      })
    )
    return timelineItem
  }

  const getTravelStatusForPerson = (personName: string) => {
    return travelEntries.find((t) => t.personName === personName)
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Hospitality Management</h1>
          <p className="page-subtitle">Meals, accommodations, and special requirements</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Entry'}
        </button>
      </div>

      {showForm && (
        <div className="form-section">
          <form className="hospitality-form" onSubmit={handleSubmit}>
            <h3>Add Hospitality Entry</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  name="personName"
                  placeholder="Artist or crew member name"
                  value={formData.personName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select name="role" value={formData.role} onChange={handleChange}>
                  <option value="performer">Performer</option>
                  <option value="crew">Crew</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Dietary & Special Requirements</label>
              <div className="dietary-options">
                {DIETARY_OPTIONS.map((dietary) => (
                  <label key={dietary} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.specialRequirements.includes(dietary)}
                      onChange={() => handleDietaryChange(dietary)}
                    />
                    <span>{dietary.charAt(0).toUpperCase() + dietary.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Meal Status</label>
                <select name="mealStatus" value={formData.mealStatus} onChange={handleChange}>
                  <option value="pending">Pending</option>
                  <option value="served">Served</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="accommodationConfirmed"
                    checked={formData.accommodationConfirmed}
                    onChange={handleChange}
                  />
                  <span>Accommodation Confirmed</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                placeholder="Special notes or instructions..."
                value={formData.notes}
                onChange={handleChange}
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Add Entry
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="hospitality-entries">
        {hospitality.length === 0 ? (
          <div className="placeholder-content">
            <p>No hospitality entries yet. Click "Add Entry" to get started.</p>
          </div>
        ) : (
          hospitality.map((entry) => {
            const schedule = getScheduleForPerson(entry.personName)
            const travel = getTravelStatusForPerson(entry.personName)

            return (
              <div key={entry.id} className="hospitality-entry-card">
                <div className="entry-header">
                  <div className="entry-name-section">
                    <h3>{entry.personName}</h3>
                    <div className="entry-role-badge">{entry.role}</div>
                  </div>
                  <div className="entry-status-section">
                    <div className="status-indicator">
                      <span className={`meal-badge ${entry.mealStatus}`}>{entry.mealStatus}</span>
                      {!entry.accommodationConfirmed && (
                        <span className="accom-badge">Accom Needed</span>
                      )}
                    </div>
                  </div>
                </div>

                {entry.specialRequirements.length > 0 && (
                  <div className="dietary-requirements">
                    <strong>Dietary:</strong>
                    <div className="requirement-tags">
                      {entry.specialRequirements.map((req) => (
                        <span key={req} className="requirement-tag">
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {schedule && (
                  <div className="performance-info">
                    <div className="info-row">
                      <span className="label">Performance:</span>
                      <span className="value">{schedule.name}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Stage:</span>
                      <span className="value">{schedule.stage}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Time:</span>
                      <span className="value">{formatTime(schedule.startTime)}</span>
                    </div>
                  </div>
                )}

                {travel && (
                  <div className="travel-info">
                    <div className="info-row">
                      <span className="label">Travel Status:</span>
                      <span className={`value status-${travel.status}`}>{travel.status}</span>
                    </div>
                    {travel.accommodation && (
                      <div className="info-row">
                        <span className="label">Accommodation:</span>
                        <span className="value">{travel.accommodation}</span>
                      </div>
                    )}
                  </div>
                )}

                {entry.notes && (
                  <div className="entry-notes">
                    <strong>Notes:</strong>
                    <p>{entry.notes}</p>
                  </div>
                )}

                <div className="entry-actions">
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => updateHospitalityEntry(entry.id, {
                      accommodationConfirmed: !entry.accommodationConfirmed
                    })}
                  >
                    {entry.accommodationConfirmed ? 'Unconfirm' : 'Confirm'} Accommodation
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
