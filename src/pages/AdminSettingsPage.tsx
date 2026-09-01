import { useState } from 'react'
import { useSettings } from '../context/SettingsContext'

export default function AdminSettingsPage() {
  const { ntpServers, primaryNtpServer, addNtpServer, removeNtpServer, setPrimaryNtpServer } = useSettings()
  const [newServer, setNewServer] = useState('')
  const [message, setMessage] = useState('')

  const handleAddServer = () => {
    if (newServer.trim()) {
      addNtpServer(newServer)
      setNewServer('')
      setMessage('NTP server added')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleRemoveServer = (server: string) => {
    removeNtpServer(server)
    setMessage('NTP server removed')
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Admin Settings</h1>
          <p className="page-subtitle">Configure system and operational settings</p>
        </div>
      </div>

      <div className="settings-section">
        <h2>NTP Configuration</h2>
        <p className="section-description">
          Configure NTP (Network Time Protocol) servers for clock synchronization. The master clock will attempt to sync with these servers to ensure accurate timing across all devices.
        </p>

        <div className="settings-card">
          <h3>Primary NTP Server</h3>
          <div className="primary-server-display">
            <div className="server-info">
              <span className="server-name">{primaryNtpServer}</span>
              <span className="server-status">🟢 Active</span>
            </div>
          </div>
          <p className="setting-hint">This is the primary source for time synchronization.</p>
        </div>

        <div className="settings-card">
          <h3>All NTP Servers</h3>
          <p className="setting-hint">Fallback servers will be used if the primary server is unavailable.</p>

          <div className="servers-list">
            {ntpServers.map((server) => (
              <div key={server} className="server-item">
                <div className="server-info">
                  <input
                    type="radio"
                    name="primary-server"
                    value={server}
                    checked={primaryNtpServer === server}
                    onChange={() => setPrimaryNtpServer(server)}
                  />
                  <span className="server-name">{server}</span>
                </div>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => handleRemoveServer(server)}
                  disabled={ntpServers.length === 1}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-card">
          <h3>Add NTP Server</h3>
          <div className="add-server-form">
            <input
              type="text"
              placeholder="e.g., pool.ntp.org or time.nist.gov"
              value={newServer}
              onChange={(e) => setNewServer(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddServer()}
              className="input-field"
            />
            <button className="btn btn-primary" onClick={handleAddServer}>
              Add Server
            </button>
          </div>
          {message && <p className="setting-message">{message}</p>}
        </div>

        <div className="settings-info">
          <h4>ℹ️ Clock Sync Status</h4>
          <p>The master clock automatically syncs with configured NTP servers. Drift information is displayed on the Master Clock dashboard.</p>
          <ul>
            <li><strong>Healthy:</strong> Drift &lt; ±1 second</li>
            <li><strong>Warning:</strong> Drift ±1-5 seconds</li>
            <li><strong>Critical:</strong> Drift &gt; ±5 seconds</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
