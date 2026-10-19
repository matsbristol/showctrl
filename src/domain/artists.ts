/* Artist lookups and edits that don't depend on the UI. */
import type { Artist, ArtistContact, Id, Ms, RosItem } from '../types/model'
import { eff, itemsForArtist } from './runsheet'

export const sortArtists = (artists: Iterable<Artist>) => [...artists].sort((a, b) => a.name.localeCompare(b.name))

/**
 * Artists for a list: one stage's, or (in HQ, `sid` null) every artist on a
 * stage the viewer can see, plus any not yet given a stage. Optional
 * case-insensitive name search.
 */
export function artistsFor(artists: Record<Id, Artist>, sid: Id | null, canSeeStage: (sid: Id) => boolean, q = ''): Artist[] {
  const needle = q.trim().toLowerCase()
  return sortArtists(Object.values(artists)).filter(a =>
    (sid ? a.stage === sid : !a.stage || canSeeStage(a.stage)) &&
    (!needle || a.name.toLowerCase().includes(needle)))
}

/** The artist's next unfinished item that hasn't ended yet. */
export function nextActivity(ros: Record<Id, RosItem>, aid: Id, t: Ms): RosItem | undefined {
  return itemsForArtist(ros, aid).find(i => i.status !== 'done' && eff(i).e > t)
}

/** Adds a contact, or replaces the one with the same id. */
export function upsertContact(list: ArtistContact[], c: ArtistContact): ArtistContact[] {
  const i = list.findIndex(x => x.id === c.id)
  return i >= 0 ? list.map((x, j) => (j === i ? c : x)) : [...list, c]
}

export const removeContact = (list: ArtistContact[], id: Id) => list.filter(x => x.id !== id)
