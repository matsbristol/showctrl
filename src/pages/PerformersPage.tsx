import { useState } from 'react'
import { usePerformersContext } from '../context/PerformersContext'

export default function PerformersPage() {
  const { artists, addArtist, removeArtist } = usePerformersContext()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    notes: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert('Please enter a name')
      return
    }

    addArtist(formData.name, formData.notes)
    setFormData({ name: '', notes: '' })
    setShowForm(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Artists & Performers</h1>
          <p className="page-subtitle">Manage all performers for your production</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✕ Cancel' : '+ Add Artist'}
        </button>
      </div>

      {showForm && (
        <div className="form-section">
          <form className="performer-form" onSubmit={handleSubmit}>
            <h3>Add New Artist</h3>

            <div className="form-group">
              <label>Artist Name *</label>
              <input
                type="text"
                name="name"
                placeholder="e.g., Aurora"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                placeholder="Special requirements, genres, notes..."
                value={formData.notes}
                onChange={handleChange}
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Add Artist
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="performers-grid">
        {artists.length === 0 ? (
          <div className="placeholder-content">
            <p>No artists added yet. Click "Add Artist" to get started.</p>
          </div>
        ) : (
          artists.map((artist) => (
            <div key={artist.id} className="performer-card">
              <div className="performer-header">
                <h3>{artist.name}</h3>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => removeArtist(artist.id)}
                >
                  Remove
                </button>
              </div>
              {artist.notes && <p className="performer-notes">{artist.notes}</p>}
              <div className="performer-meta">
                <span className="performer-id">{artist.id}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
