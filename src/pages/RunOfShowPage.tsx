import { useState } from 'react'
import { useRunOfShow, type TimelineItem } from '../context/RunOfShowContext'
import TimelineItemForm from '../components/TimelineItemForm'
import TimelineList from '../components/TimelineList'

export default function RunOfShowPage() {
  const { currentRunOfShow, createRunOfShow } = useRunOfShow()
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<TimelineItem | undefined>()
  const [rosName, setRosName] = useState('')
  const [isCreating, setIsCreating] = useState(!currentRunOfShow)

  const handleCreateRunOfShow = () => {
    if (rosName.trim()) {
      createRunOfShow('event-1', rosName)
      setRosName('')
      setIsCreating(false)
    }
  }

  if (isCreating) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1>Create Run-of-Show</h1>
            <p className="page-subtitle">Start planning your show timeline</p>
          </div>
        </div>

        <div className="create-ros-card">
          <h2>New Run-of-Show</h2>
          <div className="form-group">
            <label>Show Name</label>
            <input
              type="text"
              placeholder="e.g., Summer Festival 2026 - Main Stage"
              value={rosName}
              onChange={(e) => setRosName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateRunOfShow()}
            />
          </div>
          <button className="btn btn-primary" onClick={handleCreateRunOfShow}>
            Create Run-of-Show
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Run-of-Show</h1>
          <p className="page-subtitle">{currentRunOfShow?.name}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingItem(undefined)
            setShowForm(!showForm)
          }}
        >
          {showForm ? '✕ Cancel' : '+ Add Item'}
        </button>
      </div>

      {showForm && (
        <div className="form-section">
          <TimelineItemForm
            item={editingItem}
            onClose={() => {
              setShowForm(false)
              setEditingItem(undefined)
            }}
          />
        </div>
      )}

      {currentRunOfShow && currentRunOfShow.items.length > 0 ? (
        <TimelineList
          items={currentRunOfShow.items}
          onEdit={(item) => {
            setEditingItem(item)
            setShowForm(true)
          }}
        />
      ) : (
        <div className="placeholder-content">
          <p>No timeline items yet. Click "+ Add Item" to get started.</p>
        </div>
      )}
    </div>
  )
}
