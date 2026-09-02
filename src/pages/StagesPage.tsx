import { useState } from 'react'
import { useStages } from '../context/StagesContext'

export default function StagesPage() {
  const { stages, addStage, updateStage, removeStage } = useStages()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    capacity: 1000,
    setup: '',
    notes: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert('Please enter a stage name')
      return
    }

    if (editingId) {
      updateStage(editingId, formData)
      setEditingId(null)
    } else {
      addStage(formData)
    }

    setFormData({
      name: '',
      location: '',
      capacity: 1000,
      setup: '',
      notes: '',
    })
    setShowForm(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData({
      ...formData,
      [name]: type === 'number' ? parseInt(value) : value,
    })
  }

  const startEdit = (stage: typeof stages[0]) => {
    setEditingId(stage.id)
    setFormData({
      name: stage.name,
      location: stage.location,
      capacity: stage.capacity,
      setup: stage.setup,
      notes: stage.notes || '',
    })
    setShowForm(true)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFormData({
      name: '',
      location: '',
      capacity: 1000,
      setup: '',
      notes: '',
    })
    setShowForm(false)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Stages & Venues</h1>
          <p className="page-subtitle">Manage stages, setup, and capacity</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            cancelEdit()
            setShowForm(!showForm)
          }}
        >
          {showForm ? '✕ Cancel' : '+ Add Stage'}
        </button>
      </div>

      {showForm && (
        <div className="form-section">
          <form className="stage-form" onSubmit={handleSubmit}>
            <h3>{editingId ? 'Edit Stage' : 'Add New Stage'}</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Stage Name *</label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g., Main Stage"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  name="location"
                  placeholder="e.g., Center"
                  value={formData.location}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Capacity</label>
                <input
                  type="number"
                  name="capacity"
                  placeholder="Number of people"
                  value={formData.capacity}
                  onChange={handleChange}
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>Setup/Dimensions</label>
                <input
                  type="text"
                  name="setup"
                  placeholder="e.g., 40x20m"
                  value={formData.setup}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                placeholder="Special notes or requirements..."
                value={formData.notes}
                onChange={handleChange}
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Update Stage' : 'Add Stage'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="stages-grid">
        {stages.length === 0 ? (
          <div className="placeholder-content">
            <p>No stages configured yet. Click "Add Stage" to get started.</p>
          </div>
        ) : (
          stages.map((stage) => (
            <div key={stage.id} className="stage-card">
              <div className="stage-header">
                <h3>{stage.name}</h3>
                <div className="stage-actions">
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => startEdit(stage)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => removeStage(stage.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="stage-details">
                <div className="stage-detail">
                  <span className="label">Location:</span>
                  <span className="value">{stage.location}</span>
                </div>
                <div className="stage-detail">
                  <span className="label">Capacity:</span>
                  <span className="value">{stage.capacity.toLocaleString()} people</span>
                </div>
                <div className="stage-detail">
                  <span className="label">Setup:</span>
                  <span className="value">{stage.setup}</span>
                </div>
              </div>

              {stage.notes && (
                <div className="stage-notes">
                  <p>{stage.notes}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
