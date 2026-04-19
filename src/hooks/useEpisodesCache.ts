import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchEpisodesBatch, batchUpdateScenes, batchUpdateSummary,
} from '../services/sheetsService'
import { normalizeScene, computeEpisodeStats } from '../lib/stats'
import { sortScenes, scenesOrderChanged } from '../lib/sceneSort'
import type { SceneRow } from '../types'

const EPISODES = Array.from({ length: 12 }, (_, i) => `ep${String(i + 1).padStart(2, '0')}`)

export type EpisodesMap = Record<string, SceneRow[]>

export interface EpisodesCache {
  scenes: EpisodesMap | null
  loading: boolean
  error: string
  reload: () => Promise<void>
  setEpisodeScenes: (ep: string, updater: (prev: SceneRow[]) => SceneRow[]) => SceneRow[]
}

export function useEpisodesCache(token: string | null): EpisodesCache {
  const [scenes, setScenes] = useState<EpisodesMap | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const loadedTokenRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const batch = await fetchEpisodesBatch(EPISODES, token)
      const normalized: EpisodesMap = {}
      const rewriteTargets: { ep: string; sorted: SceneRow[] }[] = []
      for (const ep of EPISODES) {
        const raw = batch[ep] ?? []
        const n = raw.map(normalizeScene)
        const sorted = sortScenes(n)
        normalized[ep] = sorted
        const orderChanged = scenesOrderChanged(n, sorted)
        const normalizedChanged = n.some((nn, i) => (
          nn.roughcutLength !== raw[i].roughcutLength || nn.roughcutDate !== raw[i].roughcutDate
        ))
        if (orderChanged || normalizedChanged) {
          rewriteTargets.push({ ep, sorted })
        }
      }
      setScenes(normalized)
      loadedTokenRef.current = token

      for (const { ep, sorted } of rewriteTargets) {
        const updates = sorted.map((scene, rowIndex) => ({ rowIndex, scene }))
        batchUpdateScenes(ep, updates, token).catch(() => {})
      }
      const items = EPISODES.map(ep => ({ ep, stats: computeEpisodeStats(normalized[ep]) }))
      batchUpdateSummary(items, token).catch(() => {})
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      setScenes(null)
      loadedTokenRef.current = null
      return
    }
    if (loadedTokenRef.current === token) return
    load()
  }, [token, load])

  const setEpisodeScenes = useCallback(
    (ep: string, updater: (prev: SceneRow[]) => SceneRow[]): SceneRow[] => {
      let next: SceneRow[] = []
      setScenes(prev => {
        const base = prev ?? {}
        next = updater(base[ep] ?? [])
        return { ...base, [ep]: next }
      })
      return next
    },
    [],
  )

  return { scenes, loading, error, reload: load, setEpisodeScenes }
}
