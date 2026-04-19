import type { DataService } from './dataService'
import type { ProjectConfig, ProjectType } from '../config/projectConfig'
import type { SceneRow, SummaryRow } from '../types'
import type { EpisodeStats } from '../lib/stats'
import { secsToHMS, normalizeScene } from '../lib/stats'

const API_ROOT = 'https://sheets.googleapis.com/v4/spreadsheets'
const META_TAB = 'Projects'
const META_RANGE = `${META_TAB}!A2:H`

export class GoogleSheetsService implements DataService {
  private token: string
  private metaSheetId: string

  constructor(token: string, metaSheetId: string) {
    if (!metaSheetId) {
      throw new Error('VITE_META_SHEET_ID 未設定，請檢查部署環境變數')
    }
    this.token = token
    this.metaSheetId = metaSheetId
  }

  private base(sheetId: string): string {
    return `${API_ROOT}/${sheetId}`
  }

  private async apiGet<T>(sheetId: string, range: string): Promise<T> {
    const res = await fetch(
      `${this.base(sheetId)}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${this.token}` } },
    )
    if (!res.ok) {
      const tail = sheetId ? sheetId.slice(-6) : '(空值)'
      throw new Error(`Sheets API ${res.status} [sheetId=…${tail}, range=${range}]`)
    }
    return res.json()
  }

  private async apiPut(sheetId: string, range: string, values: string[][]) {
    const res = await fetch(
      `${this.base(sheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
      },
    )
    if (!res.ok) throw new Error(`Sheets API ${res.status}`)
    return res.json()
  }

  private async apiAppend(sheetId: string, range: string, values: string[][]) {
    const res = await fetch(
      `${this.base(sheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      },
    )
    if (!res.ok) throw new Error(`Sheets API ${res.status}`)
    return res.json()
  }

  private async getTabSheetId(sheetId: string, tabName: string): Promise<number> {
    const res = await fetch(
      `${this.base(sheetId)}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${this.token}` } },
    )
    if (!res.ok) throw new Error(`Sheets API ${res.status}`)
    const data = await res.json()
    const sheet = (data.sheets ?? []).find(
      (s: { properties: { title: string } }) => s.properties.title === tabName,
    )
    if (!sheet) throw new Error(`Sheet "${tabName}" not found`)
    return sheet.properties.sheetId as number
  }

  // ─── Project management ───────────────────────────────────────────

  async getProjects(): Promise<ProjectConfig[]> {
    const data = await this.apiGet<{ values?: string[][] }>(this.metaSheetId, META_RANGE)
    return (data.values ?? [])
      .filter(r => r[0] && r[1] && r[4])
      .map(r => ({
        id: r[0],
        name: r[1],
        type: (r[2] as ProjectType) ?? 'series',
        passwordHash: r[3] || undefined,
        sheetId: r[4],
        episodeCount: r[5] ? parseInt(r[5], 10) : undefined,
        episodePrefix: r[6] || undefined,
        createdAt: r[7] || undefined,
      }))
  }

  private projectToRow(p: ProjectConfig): string[] {
    return [
      p.id, p.name, p.type, p.passwordHash ?? '', p.sheetId,
      p.episodeCount ? String(p.episodeCount) : '',
      p.episodePrefix ?? '',
      p.createdAt ?? new Date().toISOString(),
    ]
  }

  async createProject(p: ProjectConfig): Promise<void> {
    await this.apiAppend(this.metaSheetId, `${META_TAB}!A:H`, [this.projectToRow(p)])
  }

  async updateProject(p: ProjectConfig): Promise<void> {
    const projects = await this.getProjects()
    const idx = projects.findIndex(x => x.id === p.id)
    if (idx < 0) throw new Error(`Project "${p.id}" not found`)
    const row = idx + 2
    await this.apiPut(this.metaSheetId, `${META_TAB}!A${row}:H${row}`, [this.projectToRow(p)])
  }

  async deleteProject(id: string): Promise<void> {
    const projects = await this.getProjects()
    const idx = projects.findIndex(x => x.id === id)
    if (idx < 0) throw new Error(`Project "${id}" not found`)
    const sheetId = await this.getTabSheetId(this.metaSheetId, META_TAB)
    const startIndex = idx + 1
    const res = await fetch(`${this.base(this.metaSheetId)}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + 1 },
          },
        }],
      }),
    })
    if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  }

  // ─── Scene CRUD ───────────────────────────────────────────────────

  private rowsToScenes(values: string[][]): SceneRow[] {
    return values
      .filter(r => r[0])
      .map(r => ({
        scene: r[0] ?? '',
        roughcutLength: r[1] ?? '',
        pages: r[2] ?? '',
        roughcutDate: r[3] ?? '',
        status: r[4] ?? '',
        missingShots: r[5] ?? '',
        notes: r[6] ?? '',
      }))
  }

  async fetchEpisode(project: ProjectConfig, ep: string): Promise<SceneRow[]> {
    const data = await this.apiGet<{ values?: string[][] }>(project.sheetId, `${ep}!A2:G`)
    return this.rowsToScenes(data.values ?? [])
  }

  async fetchEpisodesBatch(
    project: ProjectConfig,
    eps: string[],
  ): Promise<Record<string, SceneRow[]>> {
    if (!eps.length) return {}
    const params = eps.map(ep => `ranges=${encodeURIComponent(`${ep}!A2:G`)}`).join('&')
    const res = await fetch(
      `${this.base(project.sheetId)}/values:batchGet?${params}`,
      { headers: { Authorization: `Bearer ${this.token}` } },
    )
    if (!res.ok) throw new Error(`Sheets API ${res.status}`)
    const data: { valueRanges?: { values?: string[][] }[] } = await res.json()
    const out: Record<string, SceneRow[]> = {}
    ;(data.valueRanges ?? []).forEach((vr, i) => {
      out[eps[i]] = this.rowsToScenes(vr.values ?? [])
    })
    return out
  }

  async updateScene(
    project: ProjectConfig, ep: string, rowIndex: number, scene: SceneRow,
  ): Promise<void> {
    const n = normalizeScene(scene)
    const row = rowIndex + 2
    await this.apiPut(project.sheetId, `${ep}!A${row}:G${row}`, [[
      n.scene, n.roughcutLength, n.pages,
      n.roughcutDate, n.status, n.missingShots, n.notes,
    ]])
  }

  async appendScene(project: ProjectConfig, ep: string, scene: SceneRow): Promise<void> {
    const n = normalizeScene(scene)
    await this.apiAppend(project.sheetId, `${ep}!A:G`, [[
      n.scene, n.roughcutLength, n.pages,
      n.roughcutDate, n.status, n.missingShots, n.notes,
    ]])
  }

  async batchUpdateScenes(
    project: ProjectConfig,
    ep: string,
    updates: { rowIndex: number; scene: SceneRow }[],
  ): Promise<void> {
    if (!updates.length) return
    const data = updates.map(({ rowIndex, scene }) => {
      const n = normalizeScene(scene)
      return {
        range: `${ep}!A${rowIndex + 2}:G${rowIndex + 2}`,
        majorDimension: 'ROWS',
        values: [[
          n.scene, n.roughcutLength, n.pages,
          n.roughcutDate, n.status, n.missingShots, n.notes,
        ]],
      }
    })
    const res = await fetch(
      `${this.base(project.sheetId)}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
      },
    )
    if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  }

  async deleteScene(project: ProjectConfig, ep: string, rowIndex: number): Promise<void> {
    const sheetId = await this.getTabSheetId(project.sheetId, ep)
    const startIndex = rowIndex + 1
    const res = await fetch(`${this.base(project.sheetId)}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + 1 },
          },
        }],
      }),
    })
    if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  }

  async batchDeleteScenes(
    project: ProjectConfig, ep: string, rowIndices: number[],
  ): Promise<void> {
    if (!rowIndices.length) return
    const sheetId = await this.getTabSheetId(project.sheetId, ep)
    const sorted = [...rowIndices].sort((a, b) => b - a)
    const requests = sorted.map(rowIndex => {
      const startIndex = rowIndex + 1
      return {
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + 1 },
        },
      }
    })
    const res = await fetch(`${this.base(project.sheetId)}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    })
    if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  }

  // ─── Summary ──────────────────────────────────────────────────────

  async fetchSummary(project: ProjectConfig): Promise<SummaryRow[]> {
    const data = await this.apiGet<{ values?: string[][] }>(project.sheetId, 'Summary!A2:L')
    return (data.values ?? []).map(r => ({
      episode: r[0] ?? '',
      roughcutPct: parseFloat(r[1]) || 0,
      finecutPct: parseFloat(r[2]) || 0,
      roughcutDuration: r[3] ?? '',
      finecutDuration: r[4] ?? '',
      totalDuration: r[5] ?? '',
      roughcutScenes: parseInt(r[6]) || 0,
      finecutScenes: parseInt(r[7]) || 0,
      totalScenes: parseInt(r[8]) || 0,
      roughcutPages: parseInt(r[9]) || 0,
      finecutPages: parseInt(r[10]) || 0,
      avgPageDuration: r[11] ?? '',
    }))
  }

  private summaryRowFor(
    project: ProjectConfig, ep: string, stats: EpisodeStats,
  ): { row: number; values: string[] } | null {
    const num = parseInt(ep.replace(/\D/g, ''), 10)
    const max = project.episodeCount ?? 12
    if (!num || num < 1 || num > max) return null
    const totalSecs = stats.roughcutSecs + stats.finecutSecs
    const totalCutPages = stats.roughcutPages + stats.finecutPages
    const avgSecs = totalCutPages > 0 ? Math.round(totalSecs / totalCutPages) : 0
    return {
      row: num + 1,
      values: [
        ep,
        `${(stats.roughcutPct * 100).toFixed(2)}%`,
        `${(stats.finecutPct * 100).toFixed(2)}%`,
        stats.roughcutSecs > 0 ? secsToHMS(stats.roughcutSecs) : '',
        stats.finecutSecs > 0 ? secsToHMS(stats.finecutSecs) : '',
        totalSecs > 0 ? secsToHMS(totalSecs) : '',
        String(stats.roughcutScenes),
        String(stats.finecutScenes),
        String(stats.totalScenes),
        stats.roughcutPages.toFixed(1),
        stats.finecutPages.toFixed(1),
        avgSecs > 0 ? secsToHMS(avgSecs) : '',
      ],
    }
  }

  async updateSummaryRow(
    project: ProjectConfig, ep: string, stats: EpisodeStats,
  ): Promise<void> {
    const r = this.summaryRowFor(project, ep, stats)
    if (!r) return
    await this.apiPut(project.sheetId, `Summary!A${r.row}:L${r.row}`, [r.values])
  }

  async batchUpdateSummary(
    project: ProjectConfig,
    items: { ep: string; stats: EpisodeStats }[],
  ): Promise<void> {
    if (!items.length) return
    const data = items
      .map(({ ep, stats }) => {
        const r = this.summaryRowFor(project, ep, stats)
        return r ? {
          range: `Summary!A${r.row}:L${r.row}`,
          majorDimension: 'ROWS',
          values: [r.values],
        } : null
      })
      .filter((x): x is { range: string; majorDimension: string; values: string[][] } => x !== null)
    if (!data.length) return
    const res = await fetch(
      `${this.base(project.sheetId)}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
      },
    )
    if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  }
}
