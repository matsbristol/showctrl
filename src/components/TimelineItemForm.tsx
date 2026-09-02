import { useState } from 'react'
import { useRunOfShow, type TimelineItemType } from '../context/RunOfShowContext'
import { usePerformersContext } from '../context/PerformersContext'

const DEPARTMENTS = [
  'stage-manager',
  'tech-lead',
  'lighting',
  'sound',
  'video',
  'stagehands',
  'security',
  'talent-liaison',
]

const STAGES = ['main', 'secondary', 'vip-lounge', 'outdoor']

const ITEM_TYPES: TimelineItemType[] = ['transition', 'performer-entry', 'technical', 'break']

interface TimelineItemFormProps {
  onClose: () => void
}

export default function TimelineItemForm({ onClose }: TimelineItemFormProps) {
  const { addTimelineItem, currentRunOfShow } = useRunOfShow()
  const { artists } = usePerformersContext()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clockTime: '14:00',
    durationMinutes: 5,
    department: 'stage-manager',
    stage: 'main',
    performers: [] as string[],
    notes: '',
    type: 'performer-entry' as TimelineItemType,
  })
  const [error, setError] = useState('')

  const convertClockTimeToTimestamp = (clockTime: string): number => {
    const [hours, minutes] = clockTime.split(':').map(Number)
    const today = new Date()
    today.setHours(hours, minutes, 0, 0)
    return today.getTime()
  }

  const checkConflicts = (): string[] => {
    const conflicts: string[] = []
    const startMs = convertClockTimeToTimestamp(formData.clockTime)
    const endMs = startMs + formData.durationMinutes * 60 * 1000

    if (!currentRunOfShow) return conflicts

    currentRunOfShow.items.forEach((item) => {
      const itemEnd = item.startTime + item.duration

      // Check if times overlap
      const hasTimeOverlap = (startMs < itemEnd && endMs > item.startTime)

      if (hasTimeOverlap) {
        // Check for artist conflicts on same stage
        const conflictingArtists = formData.performers.filter((perfId) =>
          item.performers.includes(perfId)
        )

        if (conflictingArtists.length > 0 && item.stage === formData.stage) {
          conflictingArtists.forEach((perfId) => {
            const artistName = artists.find((a) => a.id === perfId)?.name || perfId
            conflicts.push(`${artistName} is already scheduled on ${formData.stage} stage at this time`)
          })
        }
      }
    })

    return conflicts
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Please enter a name')
      return
    }

    if (!formData.clockTime) {
      setError('Please enter a start time')
      return
    }

    const conflicts = checkConflicts()
    if (conflicts.length > 0) {
      setError(`Scheduling conflict: ${conflicts[0]}`)
      return
    }

    const startTimeMs = convertClockTimeToTimestamp(formData.clockTime)
    const durationMs = formData.durationMinutes * 60 * 1000

    addTimelineItem({
      name: formData.name,
      description: formData.description,
      startTime: startTimeMs,
      duration: durationMs,
      department: formData.department,
      stage: formData.stage,
      performers: formData.performers,
      notes: formData.notes,
      type: formData.type,
    })

    setFormData({
      name: '',
      description: '',
      clockTime: '14:00',
      durationMinutes: 5,
      department: 'stage-manager',
      stage: 'main',
      performers: [],
      notes: '',
      type: 'performer-entry',
    })

    onClose()
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    setFormData({
      ...formData,
      [name]: type === 'number' ? parseInt(value) : value,
    })
  }

  const handlePerformerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value)
    setFormData({
      ...formData,
      performers: selectedOptions,
    })
  }

  return (
    <form className="timeline-item-form" onSubmit={handleSubmit}>
      <h3>Add Timeline Item</h3>

      {error && <div className="form-error">{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label>Item Name *</label>
          <input
            type="text"
            name="name"
            placeholder="e.g., Aurora Performance"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select name="type" value={formData.type} onChange={handleChange}>
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Description</label>
        <input
          type="text"
          name="description"
          placeholder="Details about this item"
          value={formData.description}
          onChange={handleChange}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Start Time (HH:MM) *</label>
          <input
            type="time"
            name="clockTime"
            value={formData.clockTime}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Duration (minutes) *</label>
          <input
            type="number"
            name="durationMinutes"
            value={formData.durationMinutes}
            onChange={handleChange}
            min="1"
            step="1"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Stage *</label>
          <select name="stage" value={formData.stage} onChange={handleChange} required>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage.charAt(0).toUpperCase() + stage.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Department</label>
          <select name="department" value={formData.department} onChange={handleChange}>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept.charAt(0).toUpperCase() + dept.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Artists</label>
        <select
          multiple
          value={formData.performers}
          onChange={handlePerformerChange}
          className="form-select-multiple"
        >
          {artists.map((artist) => (
            <option key={artist.id} value={artist.id}>
              {artist.name}
            </option>
          ))}
        </select>
        <div className="form-help">Hold Ctrl/Cmd to select multiple artists</div>
      </div>

      <div className="form-group">
        <label>Notes</label>
        <textarea
          name="notes"
          placeholder="Additional notes or instructions"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          Add Item
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  )
}
