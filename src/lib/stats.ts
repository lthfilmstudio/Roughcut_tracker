import type { SceneRow } from '../types'

export function parseSecs(d: string): number {
  if (!d) return 0
  const p = d.split(':').map(Number)
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return 0
}

export function secsToHMS(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function formatRoughcutLength(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const padded = digits.padStart(6, '0').slice(-6)
  const h = parseInt(padded.slice(0, 2), 10)
  return `${h}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`
}

export function formatDate(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split(/[\/\-]/)
    return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`
  }

  const thisYear = new Date().getFullYear()

  if (/^\d+$/.test(trimmed)) {
    if (trimmed.length === 8) {
      return `${trimmed.slice(0, 4)}/${trimmed.slice(4, 6)}/${trimmed.slice(6, 8)}`
    }
    if (trimmed.length === 4) {
      return `${thisYear}/${trimmed.slice(0, 2)}/${trimmed.slice(2, 4)}`
    }
    if (trimmed.length === 3) {
      return `${thisYear}/${trimmed.slice(0, 1).padStart(2, '0')}/${trimmed.slice(1, 3)}`
    }
    return trimmed
  }

  const parts = trimmed.split(/[\/\-]/)

  if (parts.length === 2) {
    return `${thisYear}/${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`
  }

  if (parts.length === 3) {
    const a = parseInt(parts[0]), b = parseInt(parts[1]), c = parseInt(parts[2])
    if (a > 31) {
      return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`
    }
    if (a > 12) {
      return `${2000 + a}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`
    }
    if (c <= 99 && b <= 31) {
      return `${2000 + c}/${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`
    }
    return trimmed
  }

  return trimmed
}

export function normalizeScene(row: SceneRow): SceneRow {
  return {
    ...row,
    roughcutLength: row.roughcutLength ? formatRoughcutLength(row.roughcutLength) : '',
    roughcutDate: row.roughcutDate ? formatDate(row.roughcutDate) : '',
  }
}

export interface EpisodeStats {
  totalScenes: number     // 全部場次（含整場刪除）
  validScenes: number     // 排除整場刪除的場次
  deletedScenes: number   // 整場刪除的場次
  roughcutScenes: number  // 狀態 = 已初剪
  finecutScenes: number   // 狀態 = 已精剪
  roughcutPct: number     // 0–1
  finecutPct: number      // 0–1
  roughcutSecs: number    // 已初剪場次的時長加總
  finecutSecs: number     // 已精剪場次的時長加總
  totalSecs: number       // 初剪 + 精剪
  roughcutPages: number   // 已初剪場次的頁數加總
  finecutPages: number    // 已精剪場次的頁數加總
}

export function computeEpisodeStats(scenes: SceneRow[]): EpisodeStats {
  const valid = scenes.filter(r => r.status !== '整場刪除')
  const rough = scenes.filter(r => r.status === '已初剪')
  const fine = scenes.filter(r => r.status === '已精剪')

  const roughcutSecs = rough.reduce((a, r) => a + parseSecs(r.roughcutLength), 0)
  const finecutSecs = fine.reduce((a, r) => a + parseSecs(r.roughcutLength), 0)
  const roughcutPages = rough.reduce((a, r) => a + (parseFloat(r.pages) || 0), 0)
  const finecutPages = fine.reduce((a, r) => a + (parseFloat(r.pages) || 0), 0)

  return {
    totalScenes: scenes.length,
    validScenes: valid.length,
    deletedScenes: scenes.length - valid.length,
    roughcutScenes: rough.length,
    finecutScenes: fine.length,
    roughcutPct: valid.length > 0 ? rough.length / valid.length : 0,
    finecutPct: valid.length > 0 ? fine.length / valid.length : 0,
    roughcutSecs,
    finecutSecs,
    totalSecs: roughcutSecs + finecutSecs,
    roughcutPages,
    finecutPages,
  }
}
