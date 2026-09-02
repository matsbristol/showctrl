import { useState } from 'react'
import { useRunOfShow, type TimelineItemType } from '../context/RunOfShowContext'

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

const ITEM_TYPES: TimelineItemType[] = ['cue', 'transition', 'performer-entry', 'technical', 'break']

interface TimelineItemFormProps {
  onClose: () => void
}

export default function TimelineItemForm({ onClose }: TimelineItemFormProps) {
  const { addTimelineItem } = useRunOfShow()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clockTime: '14:00', // HH:MM format
    durationMinutes: 5,
    department: 'stage-manager',
    performers: '',
    notes: '',
    type: 'cue' as TimelineItemType,
  })

  const convertClockTimeToTimestamp = (clockTime: string): number => {
    const [hours, minutes] = clockTime.split(':').map(Number)
    const today = new Date()
    today.setHours(hours, minutes, 0, 0)
    return today.getTime()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert('Please enter a name')
      return
    }

    if (!formData.clockTime) {
      alert('Please enter a start time')
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
      performers: formData.performers
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p),
      notes: formData.notes,
      type: formData.type,
    })

    setFormData({
      name: '',
      description: '',
      clockTime: '14:00',
      durationMinutes: 5,
      department: 'stage-manager',
      performers: '',
      notes: '',
      type: 'cue',
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

  return (
    <form className="timeline-item-form" onSubmit={handleSubmit}>
      <h3>Add Timeline Item</h3>

      <div className="form-row">
        <div className="form-group">
          <label>Item Name *</label>
          <input
            type="text"
            name="name"
            placeholder="e.g., Artist A Entrance"
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
          <label>Start Time (HH:MM)</label>
          <input
            type="time"
            name="clockTime"
            value={formData.clockTime}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Duration (minutes)</label>
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
          <label>Department</label>
          <select name="department" value={formData.department} onChange={handleChange}>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept.charAt(0).toUpperCase() + dept.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Performers</label>
          <input
            type="text"
            name="performers"
            placeholder="e.g., Artist A, Artist B"
            value={formData.performers}
            onChange={handleChange}
          />
        </div>
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
