import { useState, useEffect } from 'react'
import { useRunOfShow, type TimelineItem, type TimelineItemType } from '../context/RunOfShowContext'
import { usePerformersContext } from '../context/PerformersContext'
import { useStages } from '../context/StagesContext'

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

const ITEM_TYPES: TimelineItemType[] = ['transition', 'performer-entry', 'technical', 'break']

interface TimelineItemFormProps {
  item?: TimelineItem
  onClose: () => void
}

export default function TimelineItemForm({ item, onClose }: TimelineItemFormProps) {
  const { addTimelineItem, updateTimelineItem, currentRunOfShow } = useRunOfShow()
  const { artists } = usePerformersContext()
  const { stages } = useStages()
  const defaultStageId = stages.length > 0 ? stages[0].id : 'main'

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clockTime: '14:00',
    endClockTime: '',
    departments: [] as string[],
    stage: defaultStageId,
    performers: [] as string[],
    notes: '',
    type: 'performer-entry' as TimelineItemType,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (item) {
      const startDate = new Date(item.startTime)
      const startHours = startDate.getHours().toString().padStart(2, '0')
      const startMinutes = startDate.getMinutes().toString().padStart(2, '0')
      const clockTime = `${startHours}:${startMinutes}`

      let endClockTime = ''
      if (item.endTime) {
        const endDate = new Date(item.endTime)
        const endHours = endDate.getHours().toString().padStart(2, '0')
        const endMinutes = endDate.getMinutes().toString().padStart(2, '0')
        endClockTime = `${endHours}:${endMinutes}`
      }

      setFormData({
        name: item.name,
        description: item.description || '',
        clockTime,
        endClockTime,
        departments: item.departments,
        stage: item.stage,
        performers: item.performers,
        notes: item.notes || '',
        type: item.type,
      })
    }
  }, [item])

  const convertClockTimeToTimestamp = (clockTime: string): number => {
    const [hours, minutes] = clockTime.split(':').map(Number)
    const today = new Date()
    today.setHours(hours, minutes, 0, 0)
    return today.getTime()
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
    let endTimeMs: number | undefined
    if (formData.endClockTime) {
      endTimeMs = convertClockTimeToTimestamp(formData.endClockTime)
    }

    if (item) {
      updateTimelineItem(item.id, {
        name: formData.name,
        description: formData.description,
        startTime: startTimeMs,
        endTime: endTimeMs,
        departments: formData.departments,
        stage: formData.stage,
        performers: formData.performers,
        notes: formData.notes,
        type: formData.type,
      })
    } else {
      addTimelineItem({
        name: formData.name,
        description: formData.description,
        startTime: startTimeMs,
        endTime: endTimeMs,
        departments: formData.departments,
        stage: formData.stage,
        performers: formData.performers,
        notes: formData.notes,
        type: formData.type,
      })
    }

    setFormData({
      name: '',
      description: '',
      clockTime: '14:00',
      endClockTime: '',
      departments: [],
      stage: defaultStageId,
      performers: [],
      notes: '',
      type: 'performer-entry',
    })

    onClose()
  }

  const checkConflicts = (): string[] => {
    const conflicts: string[] = []
    const startMs = convertClockTimeToTimestamp(formData.clockTime)
    const endMs = formData.endClockTime ? convertClockTimeToTimestamp(formData.endClockTime) : startMs

    if (!currentRunOfShow) return conflicts

    currentRunOfShow.items.forEach((existingItem) => {
      // Skip self if editing
      if (item && existingItem.id === item.id) return

      const itemEnd = existingItem.endTime || existingItem.startTime
      const hasTimeOverlap = (startMs < itemEnd && endMs > existingItem.startTime)

      if (hasTimeOverlap) {
        const conflictingArtists = formData.performers.filter((perfId) =>
          existingItem.performers.includes(perfId)
        )

        if (conflictingArtists.length > 0 && existingItem.stage === formData.stage) {
          conflictingArtists.forEach((perfId) => {
            const artistName = artists.find((a) => a.id === perfId)?.name || perfId
            conflicts.push(`${artistName} is already scheduled on ${formData.stage} stage at this time`)
          })
        }
      }
    })

    return conflicts
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

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value)
    setFormData({
      ...formData,
      departments: selectedOptions,
    })
  }

  return (
    <form className="timeline-item-form" onSubmit={handleSubmit}>
      <h3>{item ? 'Edit Timeline Item' : 'Add Timeline Item'}</h3>

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
          <label>End Time (HH:MM) - Optional</label>
          <input
            type="time"
            name="endClockTime"
            value={formData.endClockTime}
            onChange={handleChange}
            placeholder="Leave blank if no end time"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Stage *</label>
          <select name="stage" value={formData.stage} onChange={handleChange} required>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Departments</label>
        <select
          multiple
          value={formData.departments}
          onChange={handleDepartmentChange}
          className="form-select-multiple"
        >
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept.charAt(0).toUpperCase() + dept.slice(1).replace('-', ' ')}
            </option>
          ))}
        </select>
        <div className="form-help">Hold Ctrl/Cmd to select multiple departments</div>
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
          {item ? 'Update Item' : 'Add Item'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  )
}
