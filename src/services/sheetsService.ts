import { SHEETS_CONFIG } from '../config/sheets'
import type { SummaryRow, SceneRow } from '../types'
import { secsToHMS, normalizeScene } from '../lib/stats'
import type { EpisodeStats } from '../lib/stats'

const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}`

async function apiGet<T>(range: string, token: string): Promise<T> {
  const res = await fetch(
    `${BASE}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  return res.json()
}

async function apiPut(range: string, values: string[][], token: string) {
  const res = await fetch(
    `${BASE}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
    },
  )
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  return res.json()
}

async function apiAppend(range: string, values: string[][], token: string) {
  const res = await fetch(
    `${BASE}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    },
  )
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  return res.json()
}

async function getSheetId(ep: string, token: string): Promise<number> {
  const res = await fetch(
    `${BASE}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  const data = await res.json()
  const sheet = (data.sheets ?? []).find(
    (s: { properties: { title: string } }) => s.properties.title === ep,
  )
  if (!sheet) throw new Error(`Sheet "${ep}" not found`)
  return sheet.properties.sheetId as number
}

export async function fetchSummary(token: string): Promise<SummaryRow[]> {
  const data = await apiGet<{ values?: string[][] }>('Summary!A2:L', token)
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

export async function initializeSummary(token: string) {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const ep = `ep${String(i + 1).padStart(2, '0')}`
    return [ep, '0', '0', '', '', '', '0', '0', '0', '0', '0', '']
  })
  await apiPut('Summary!A2:L13', rows, token)
}

function rowsToScenes(values: string[][]): SceneRow[] {
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

export async function fetchEpisode(ep: string, token: string): Promise<SceneRow[]> {
  const data = await apiGet<{ values?: string[][] }>(`${ep}!A2:G`, token)
  return rowsToScenes(data.values ?? [])
}

export async function fetchEpisodesBatch(eps: string[], token: string): Promise<Record<string, SceneRow[]>> {
  if (!eps.length) return {}
  const params = eps.map(ep => `ranges=${encodeURIComponent(`${ep}!A2:G`)}`).join('&')
  const res = await fetch(
    `${BASE}/values:batchGet?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  const data: { valueRanges?: { values?: string[][] }[] } = await res.json()
  const out: Record<string, SceneRow[]> = {}
  ;(data.valueRanges ?? []).forEach((vr, i) => {
    out[eps[i]] = rowsToScenes(vr.values ?? [])
  })
  return out
}

export async function updateScene(ep: string, rowIndex: number, scene: SceneRow, token: string) {
  const n = normalizeScene(scene)
  const row = rowIndex + 2
  await apiPut(`${ep}!A${row}:G${row}`, [[
    n.scene, n.roughcutLength, n.pages,
    n.roughcutDate, n.status, n.missingShots, n.notes,
  ]], token)
}

export async function appendScene(ep: string, scene: SceneRow, token: string) {
  const n = normalizeScene(scene)
  await apiAppend(`${ep}!A:G`, [[
    n.scene, n.roughcutLength, n.pages,
    n.roughcutDate, n.status, n.missingShots, n.notes,
  ]], token)
}

export async function batchUpdateScenes(
  ep: string,
  updates: { rowIndex: number; scene: SceneRow }[],
  token: string,
) {
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
    `${BASE}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    },
  )
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  return res.json()
}

function summaryRowFor(ep: string, stats: EpisodeStats): { row: number; values: string[] } | null {
  const num = parseInt(ep.replace(/\D/g, ''), 10)
  if (!num || num < 1 || num > 12) return null
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

export async function updateSummaryRow(ep: string, stats: EpisodeStats, token: string) {
  const r = summaryRowFor(ep, stats)
  if (!r) return
  await apiPut(`Summary!A${r.row}:L${r.row}`, [r.values], token)
}

export async function batchUpdateSummary(
  items: { ep: string; stats: EpisodeStats }[],
  token: string,
) {
  if (!items.length) return
  const data = items
    .map(({ ep, stats }) => {
      const r = summaryRowFor(ep, stats)
      return r ? {
        range: `Summary!A${r.row}:L${r.row}`,
        majorDimension: 'ROWS',
        values: [r.values],
      } : null
    })
    .filter((x): x is { range: string; majorDimension: string; values: string[][] } => x !== null)
  if (!data.length) return
  const res = await fetch(
    `${BASE}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    },
  )
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  return res.json()
}

export async function deleteScene(ep: string, rowIndex: number, token: string) {
  const sheetId = await getSheetId(ep, token)
  const startIndex = rowIndex + 1
  const res = await fetch(`${BASE}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + 1 },
        },
      }],
    }),
  })
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  return res.json()
}

export async function batchDeleteScenes(ep: string, rowIndices: number[], token: string) {
  if (!rowIndices.length) return
  const sheetId = await getSheetId(ep, token)
  const sorted = [...rowIndices].sort((a, b) => b - a)
  const requests = sorted.map(rowIndex => {
    const startIndex = rowIndex + 1
    return {
      deleteDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + 1 },
      },
    }
  })
  const res = await fetch(`${BASE}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  })
  if (!res.ok) throw new Error(`Sheets API ${res.status}`)
  return res.json()
}
