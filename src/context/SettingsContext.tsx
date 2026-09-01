import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

interface SettingsContextType {
  ntpServers: string[]
  addNtpServer: (server: string) => void
  removeNtpServer: (server: string) => void
  updateNtpServers: (servers: string[]) => void
  primaryNtpServer: string
  setPrimaryNtpServer: (server: string) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

const DEFAULT_NTP_SERVERS = [
  'pool.ntp.org',
  'time.nist.gov',
  'time.cloudflare.com',
]

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [ntpServers, setNtpServers] = useState<string[]>(() => {
    const stored = localStorage.getItem('showctrl_ntp_servers')
    return stored ? JSON.parse(stored) : DEFAULT_NTP_SERVERS
  })

  const [primaryNtpServer, setPrimaryNtpServerState] = useState<string>(() => {
    const stored = localStorage.getItem('showctrl_primary_ntp')
    return stored || DEFAULT_NTP_SERVERS[0]
  })

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('showctrl_ntp_servers', JSON.stringify(ntpServers))
  }, [ntpServers])

  useEffect(() => {
    localStorage.setItem('showctrl_primary_ntp', primaryNtpServer)
  }, [primaryNtpServer])

  const addNtpServer = (server: string) => {
    if (!ntpServers.includes(server) && server.trim()) {
      setNtpServers([...ntpServers, server.trim()])
    }
  }

  const removeNtpServer = (server: string) => {
    setNtpServers(ntpServers.filter((s) => s !== server))
    if (primaryNtpServer === server && ntpServers.length > 1) {
      setPrimaryNtpServerState(ntpServers[0])
    }
  }

  const updateNtpServers = (servers: string[]) => {
    setNtpServers(servers.filter((s) => s.trim()))
  }

  const setPrimaryNtpServer = (server: string) => {
    if (ntpServers.includes(server)) {
      setPrimaryNtpServerState(server)
    }
  }

  const value: SettingsContextType = {
    ntpServers,
    addNtpServer,
    removeNtpServer,
    updateNtpServers,
    primaryNtpServer,
    setPrimaryNtpServer,
  }

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}
