import type { SceneRow } from '../types'

export function compareSceneKeys(a: string, b: string): number {
  const ma = a.match(/^(\d+)(.*)$/)
  const mb = b.match(/^(\d+)(.*)$/)
  const na = ma ? parseInt(ma[1], 10) : Number.POSITIVE_INFINITY
  const nb = mb ? parseInt(mb[1], 10) : Number.POSITIVE_INFINITY
  if (na !== nb) return na - nb
  const sa = ma ? ma[2] : a
  const sb = mb ? mb[2] : b
  return sa.localeCompare(sb, undefined, { sensitivity: 'base' })
}

export function sortScenes(scenes: SceneRow[]): SceneRow[] {
  return [...scenes].sort((a, b) => compareSceneKeys(a.scene, b.scene))
}

export function scenesOrderChanged(a: SceneRow[], b: SceneRow[]): boolean {
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) {
    if (a[i].scene !== b[i].scene) return true
  }
  return false
}
