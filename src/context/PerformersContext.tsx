import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface Artist {
  id: string
  name: string
  notes?: string
}

interface PerformersContextType {
  artists: Artist[]
  addArtist: (name: string, notes?: string) => void
  removeArtist: (id: string) => void
  getArtistName: (id: string) => string | undefined
}

const PerformersContext = createContext<PerformersContextType | undefined>(undefined)

export function PerformersContextProvider({ children }: { children: ReactNode }) {
  const [artists, setArtists] = useState<Artist[]>(() => {
    const stored = localStorage.getItem('showctrl_artists')
    if (stored) return JSON.parse(stored)

    return [
      { id: 'artist-1', name: 'The Echoes' },
      { id: 'artist-2', name: 'Aurora' },
      { id: 'artist-3', name: 'Luna & The Starlight' },
      { id: 'artist-4', name: 'Electric Dreams' },
      { id: 'artist-5', name: 'Silent Echo' },
    ]
  })

  useEffect(() => {
    localStorage.setItem('showctrl_artists', JSON.stringify(artists))
  }, [artists])

  const addArtist = (name: string, notes?: string) => {
    const newArtist: Artist = {
      id: `artist-${Date.now()}`,
      name,
      notes,
    }
    setArtists((prev) => [...prev, newArtist])
  }

  const removeArtist = (id: string) => {
    setArtists((prev) => prev.filter((a) => a.id !== id))
  }

  const getArtistName = (id: string) => {
    return artists.find((a) => a.id === id)?.name
  }

  const value: PerformersContextType = {
    artists,
    addArtist,
    removeArtist,
    getArtistName,
  }

  return (
    <PerformersContext.Provider value={value}>
      {children}
    </PerformersContext.Provider>
  )
}

export function usePerformersContext() {
  const context = useContext(PerformersContext)
  if (!context) {
    throw new Error('usePerformersContext must be used within PerformersContextProvider')
  }
  return context
}
