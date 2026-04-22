import type { SceneRow, SummaryRow } from '../types'
import type { EpisodeStats } from '../lib/stats'
import type { ProjectConfig } from '../config/projectConfig'

export interface CreateSheetResult {
  sheetId: string
  movedToFolder: boolean
  sheetUrl: string
}

export interface DataService {
  getProjects(): Promise<ProjectConfig[]>
  createProject(p: ProjectConfig): Promise<void>
  createProjectSheet(p: ProjectConfig): Promise<CreateSheetResult>
  updateProject(p: ProjectConfig): Promise<void>
  deleteProject(id: string): Promise<void>

  fetchEpisodesBatch(project: ProjectConfig, eps: string[]): Promise<Record<string, SceneRow[]>>
  fetchEpisode(project: ProjectConfig, ep: string): Promise<SceneRow[]>
  updateScene(project: ProjectConfig, ep: string, rowIndex: number, scene: SceneRow): Promise<void>
  appendScene(project: ProjectConfig, ep: string, scene: SceneRow): Promise<void>
  batchUpdateScenes(
    project: ProjectConfig,
    ep: string,
    updates: { rowIndex: number; scene: SceneRow }[],
  ): Promise<void>
  deleteScene(project: ProjectConfig, ep: string, rowIndex: number): Promise<void>
  batchDeleteScenes(project: ProjectConfig, ep: string, rowIndices: number[]): Promise<void>

  fetchSummary(project: ProjectConfig): Promise<SummaryRow[]>
  updateSummaryRow(project: ProjectConfig, ep: string, stats: EpisodeStats): Promise<void>
  batchUpdateSummary(
    project: ProjectConfig,
    items: { ep: string; stats: EpisodeStats }[],
  ): Promise<void>

  ensureMetaTab(project: ProjectConfig): Promise<void>
  fetchMeta(project: ProjectConfig): Promise<Record<string, string>>
  setMeta(project: ProjectConfig, key: string, value: string): Promise<void>
}
