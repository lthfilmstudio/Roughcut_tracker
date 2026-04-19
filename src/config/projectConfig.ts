export type ProjectType = 'series' | 'film'

export interface ProjectConfig {
  id: string
  name: string
  type: ProjectType
  passwordHash?: string
  sheetId: string
  episodeCount?: number
  episodePrefix?: string
  createdAt?: string
}

export const FILM_SCENE_TAB = 'Scenes'

export const CURRENT_PROJECT: ProjectConfig = {
  id: 'beicheng',
  name: '北城百畫帖',
  type: 'series',
  sheetId: '1J5LdXoTVzf2xWE6YsjZ7Y1Wk6xOWLwTLHBi2ohkTeus',
  episodeCount: 12,
  episodePrefix: 'ep',
}

export function getTabNames(p: ProjectConfig = CURRENT_PROJECT): string[] {
  if (p.type === 'series' && p.episodeCount && p.episodePrefix) {
    return Array.from({ length: p.episodeCount }, (_, i) =>
      `${p.episodePrefix}${String(i + 1).padStart(2, '0')}`
    )
  }
  if (p.type === 'film') {
    return [FILM_SCENE_TAB]
  }
  return []
}

export function projectTitle(p: ProjectConfig = CURRENT_PROJECT): string {
  return p.type === 'series' ? `劇集《${p.name}》` : `電影《${p.name}》`
}

export function hasSummaryTab(p: ProjectConfig = CURRENT_PROJECT): boolean {
  return p.type === 'series'
}
