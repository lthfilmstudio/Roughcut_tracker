import { useState } from 'react'
import { secsToHMS } from '../lib/stats'
import type { EpisodeStats } from '../lib/stats'
import type { SceneRow } from '../types'

interface EpisodeView {
  episode: string
  stats: EpisodeStats
}

interface Totals {
  totalScenes: number
  validScenes: number
  roughcutScenes: number
  finecutScenes: number
  roughcutSecs: number
  finecutSecs: number
  roughcutPages: number
  finecutPages: number
}

interface Props {
  showName: string
  eps: EpisodeView[]
  totals: Totals
  globalRoughcutPct: number
  globalFinecutPct: number
  globalAvgPageDur: string
  scenesMap: Record<string, SceneRow[]>
  onClose: () => void
}

interface SummaryOptions {
  summary: boolean
  table: boolean
  episode: boolean
  roughPct: boolean
  finePct: boolean
  roughSecs: boolean
  fineSecs: boolean
  roughScenes: boolean
  fineScenes: boolean
  totalScenes: boolean
  roughPages: boolean
  avgPage: boolean
}

interface SceneOptions {
  sceneNum: boolean
  roughcutLength: boolean
  pages: boolean
  date: boolean
  status: boolean
  missingShots: boolean
  notes: boolean
}

const DEFAULT_SUMMARY: SummaryOptions = {
  summary: true,
  table: true,
  episode: true,
  roughPct: true,
  finePct: true,
  roughSecs: true,
  fineSecs: true,
  roughScenes: true,
  fineScenes: true,
  totalScenes: true,
  roughPages: true,
  avgPage: true,
}

const DEFAULT_SCENES: SceneOptions = {
  sceneNum: true,
  roughcutLength: true,
  pages: true,
  date: false,
  status: true,
  missingShots: false,
  notes: true,
}

type Mode = 'summary' | 'allScenes'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function pctStr(p: number) {
  return `${(p * 100).toFixed(1)}%`
}

function epAvgStr(secs: number, pages: number): string {
  if (pages <= 0) return '—'
  return secsToHMS(Math.round(secs / pages))
}

export default function DashboardExportMD({
  showName, eps, totals, globalRoughcutPct, globalFinecutPct, globalAvgPageDur,
  scenesMap, onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>('summary')
  const [summaryOpts, setSummaryOpts] = useState<SummaryOptions>(DEFAULT_SUMMARY)
  const [sceneOpts, setSceneOpts] = useState<SceneOptions>(DEFAULT_SCENES)
  const toggleSummary = (k: keyof SummaryOptions) => setSummaryOpts(o => ({ ...o, [k]: !o[k] }))
  const toggleScene = (k: keyof SceneOptions) => setSceneOpts(o => ({ ...o, [k]: !o[k] }))

  const filename = mode === 'summary'
    ? `${showName}_全劇進度_${todayStr()}.md`
    : `${showName}_全劇場次_${todayStr()}.md`

  function buildSummaryMD(): string {
    const lines: string[] = []
    lines.push(`# ${showName} 全劇進度`)
    lines.push('')

    if (summaryOpts.summary) {
      const totalSecs = totals.roughcutSecs + totals.finecutSecs
      const combinedScenes = totals.roughcutScenes + totals.finecutScenes
      const combinedPct = totals.validScenes > 0 ? combinedScenes / totals.validScenes : 0
      lines.push('## 全劇合計')
      lines.push('')
      lines.push('| 項目 | 時長 | 場次 | 百分比 |')
      lines.push('|------|------|------|------|')
      lines.push(`| 已初剪 | ${secsToHMS(totals.roughcutSecs)} | ${totals.roughcutScenes} / ${totals.validScenes} | ${pctStr(globalRoughcutPct)} |`)
      lines.push(`| 已精剪 | ${secsToHMS(totals.finecutSecs)} | ${totals.finecutScenes} / ${totals.validScenes} | ${pctStr(globalFinecutPct)} |`)
      lines.push(`| 總計 | ${secsToHMS(totalSecs)} | ${combinedScenes} / ${totals.validScenes} | ${pctStr(combinedPct)} |`)
      lines.push('')
      lines.push(`**初剪頁數：** ${totals.roughcutPages.toFixed(1)} 頁　・　頁均時長 ${globalAvgPageDur}`)
      lines.push('')
    }

    if (summaryOpts.table) {
      const allCols: { key: keyof SummaryOptions; label: string; render: (ep: EpisodeView) => string; total: string }[] = [
        { key: 'episode', label: '集數', render: ep => ep.episode, total: '全劇合計' },
        { key: 'roughPct', label: '已初剪%', render: ep => pctStr(ep.stats.roughcutPct), total: pctStr(globalRoughcutPct) },
        { key: 'finePct', label: '已精剪%', render: ep => pctStr(ep.stats.finecutPct), total: pctStr(globalFinecutPct) },
        { key: 'roughSecs', label: '初剪時長', render: ep => ep.stats.roughcutSecs > 0 ? secsToHMS(ep.stats.roughcutSecs) : '—', total: secsToHMS(totals.roughcutSecs) },
        { key: 'fineSecs', label: '精剪時長', render: ep => ep.stats.finecutSecs > 0 ? secsToHMS(ep.stats.finecutSecs) : '—', total: secsToHMS(totals.finecutSecs) },
        { key: 'roughScenes', label: '初剪場次', render: ep => String(ep.stats.roughcutScenes || '—'), total: String(totals.roughcutScenes || '—') },
        { key: 'fineScenes', label: '精剪場次', render: ep => String(ep.stats.finecutScenes || '—'), total: String(totals.finecutScenes || '—') },
        { key: 'totalScenes', label: '總場次', render: ep => String(ep.stats.totalScenes || '—'), total: String(totals.totalScenes || '—') },
        { key: 'roughPages', label: '初剪頁數', render: ep => ep.stats.roughcutPages > 0 ? ep.stats.roughcutPages.toFixed(1) : '—', total: totals.roughcutPages > 0 ? totals.roughcutPages.toFixed(1) : '—' },
        { key: 'avgPage', label: '頁均時長', render: ep => epAvgStr(ep.stats.roughcutSecs + ep.stats.finecutSecs, ep.stats.roughcutPages + ep.stats.finecutPages), total: globalAvgPageDur },
      ]
      const cols = allCols.filter(c => summaryOpts[c.key])

      if (cols.length > 0) {
        lines.push('## 各集明細')
        lines.push('')
        lines.push(`| ${cols.map(c => c.label).join(' | ')} |`)
        lines.push(`| ${cols.map(() => '------').join(' | ')} |`)
        for (const ep of eps) {
          lines.push(`| ${cols.map(c => c.render(ep)).join(' | ')} |`)
        }
        lines.push(`| ${cols.map(c => `**${c.total}**`).join(' | ')} |`)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  function buildAllScenesMD(): string {
    const lines: string[] = []
    lines.push(`# ${showName} 全劇完整場次表`)
    lines.push('')

    const allCols: { key: keyof SceneRow; label: string; enabled: boolean }[] = [
      { key: 'scene', label: '場次', enabled: sceneOpts.sceneNum },
      { key: 'roughcutLength', label: '長度', enabled: sceneOpts.roughcutLength },
      { key: 'pages', label: '頁數', enabled: sceneOpts.pages },
      { key: 'roughcutDate', label: '日期', enabled: sceneOpts.date },
      { key: 'status', label: '狀態', enabled: sceneOpts.status },
      { key: 'missingShots', label: '缺鏡', enabled: sceneOpts.missingShots },
      { key: 'notes', label: '備註', enabled: sceneOpts.notes },
    ]
    const cols = allCols.filter(c => c.enabled)
    if (cols.length === 0) return lines.join('\n')

    for (const ep of eps) {
      const scenes = scenesMap[ep.episode] ?? []
      lines.push(`## ${ep.episode}`)
      lines.push('')
      if (scenes.length === 0) {
        lines.push('_（此集尚無場次資料）_')
        lines.push('')
        continue
      }
      lines.push(`| ${cols.map(c => c.label).join(' | ')} |`)
      lines.push(`| ${cols.map(() => '------').join(' | ')} |`)
      for (const scene of scenes) {
        const cells = cols.map(c => (scene[c.key] || '—')).join(' | ')
        lines.push(`| ${cells} |`)
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  function handleDownload() {
    const content = mode === 'summary' ? buildSummaryMD() : buildAllScenesMD()
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  const SUMMARY_FIELDS: { key: keyof SummaryOptions; label: string; indent?: boolean }[] = [
    { key: 'summary', label: '統計摘要（全劇合計）' },
    { key: 'table', label: '各集明細表' },
    { key: 'episode', label: '集數', indent: true },
    { key: 'roughPct', label: '已初剪%', indent: true },
    { key: 'finePct', label: '已精剪%', indent: true },
    { key: 'roughSecs', label: '初剪時長', indent: true },
    { key: 'fineSecs', label: '精剪時長', indent: true },
    { key: 'roughScenes', label: '初剪場次', indent: true },
    { key: 'fineScenes', label: '精剪場次', indent: true },
    { key: 'totalScenes', label: '總場次', indent: true },
    { key: 'roughPages', label: '初剪頁數', indent: true },
    { key: 'avgPage', label: '頁均時長', indent: true },
  ]

  const SCENE_FIELDS: { key: keyof SceneOptions; label: string }[] = [
    { key: 'sceneNum', label: '場次編號' },
    { key: 'roughcutLength', label: '長度' },
    { key: 'pages', label: '頁數' },
    { key: 'date', label: '日期' },
    { key: 'status', label: '狀態' },
    { key: 'missingShots', label: '缺鏡' },
    { key: 'notes', label: '備註' },
  ]

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>匯出 Markdown</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.body}>
          <p style={s.label}>選擇匯出類型：</p>
          <div style={s.modeRow}>
            <button
              style={{ ...s.modeBtn, ...(mode === 'summary' ? s.modeBtnActive : {}) }}
              onClick={() => setMode('summary')}
            >
              全劇進度摘要
            </button>
            <button
              style={{ ...s.modeBtn, ...(mode === 'allScenes' ? s.modeBtnActive : {}) }}
              onClick={() => setMode('allScenes')}
            >
              全劇完整場次表
            </button>
          </div>

          {mode === 'summary' ? (
            <>
              <p style={{ ...s.label, marginTop: 16 }}>選擇要匯出的內容：</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {SUMMARY_FIELDS.map(f => (
                  <label key={f.key} style={{ ...s.checkRow, paddingLeft: f.indent ? 24 : 0 }}>
                    <input
                      type="checkbox"
                      checked={summaryOpts[f.key]}
                      onChange={() => toggleSummary(f.key)}
                      disabled={f.indent && !summaryOpts.table}
                      style={{ accentColor: '#fff', width: 14, height: 14 }}
                    />
                    <span style={{ fontSize: 13, color: (f.indent && !summaryOpts.table) ? '#444' : '#aaa' }}>
                      {f.label}
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <p style={{ ...s.label, marginTop: 16 }}>選擇要包含的欄位：</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {SCENE_FIELDS.map(f => (
                  <label key={f.key} style={s.checkRow}>
                    <input
                      type="checkbox"
                      checked={sceneOpts[f.key]}
                      onChange={() => toggleScene(f.key)}
                      style={{ accentColor: '#fff', width: 14, height: 14 }}
                    />
                    <span style={{ fontSize: 13, color: '#aaa' }}>{f.label}</span>
                  </label>
                ))}
              </div>
              <div style={s.hint}>每集一個區塊，含該集所有場次明細</div>
            </>
          )}

          <div style={s.filenameBox}>
            <span style={s.filenameLabel}>預覽檔名</span>
            <span style={s.filename}>{filename}</span>
          </div>

          <div style={s.footer}>
            <button style={s.ghostBtn} onClick={onClose}>取消</button>
            <button style={s.btn} onClick={handleDownload}>下載 .md</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8,
    width: 420, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid #2A2A2A',
  },
  title: { fontSize: 14, fontWeight: 600, color: '#fff' },
  closeBtn: { background: 'transparent', border: 'none', color: '#555', fontSize: 16 },
  body: { padding: '20px', overflowY: 'auto' },
  label: { fontSize: 12, color: '#666', margin: 0 },
  hint: { fontSize: 11, color: '#555', marginTop: 12 },
  modeRow: { display: 'flex', gap: 8, marginTop: 10 },
  modeBtn: {
    flex: 1, padding: '8px 12px', background: 'transparent', color: '#888',
    border: '1px solid #333', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  },
  modeBtnActive: {
    background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid #666',
  },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  filenameBox: {
    marginTop: 20, padding: '12px 14px', background: '#111',
    borderRadius: 6, border: '1px solid #2A2A2A',
  },
  filenameLabel: { display: 'block', fontSize: 11, color: '#555', marginBottom: 4 },
  filename: { fontSize: 12, color: '#aaa', fontFamily: 'monospace' },
  footer: { display: 'flex', justifyContent: 'space-between', marginTop: 20 },
  btn: { padding: '9px 20px', background: '#fff', color: '#000', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13 },
  ghostBtn: { padding: '9px 16px', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: 6, fontSize: 13 },
}
