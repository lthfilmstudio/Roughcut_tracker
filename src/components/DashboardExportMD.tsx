import { useState } from 'react'
import { secsToHMS } from '../lib/stats'
import type { EpisodeStats } from '../lib/stats'

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
  onClose: () => void
}

interface Options {
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

const DEFAULT_OPTS: Options = {
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
  showName, eps, totals, globalRoughcutPct, globalFinecutPct, globalAvgPageDur, onClose,
}: Props) {
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTS)
  const toggle = (k: keyof Options) => setOpts(o => ({ ...o, [k]: !o[k] }))

  const filename = `${showName}_全劇進度_${todayStr()}.md`

  function buildMD(): string {
    const lines: string[] = []
    lines.push(`# ${showName} 全劇進度`)
    lines.push('')

    if (opts.summary) {
      const totalSecs = totals.roughcutSecs + totals.finecutSecs
      lines.push('## 全劇合計')
      lines.push('')
      lines.push('| 項目 | 數值 |')
      lines.push('|------|------|')
      lines.push(`| 已初剪 | ${pctStr(globalRoughcutPct)}（${totals.roughcutScenes} / ${totals.validScenes} 場）|`)
      lines.push(`| 已精剪 | ${pctStr(globalFinecutPct)}（${totals.finecutScenes} / ${totals.validScenes} 場）|`)
      lines.push(`| 初剪時長 | ${secsToHMS(totals.roughcutSecs)} |`)
      lines.push(`| 精剪時長 | ${secsToHMS(totals.finecutSecs)} |`)
      lines.push(`| 總長度 | ${secsToHMS(totalSecs)} |`)
      lines.push(`| 總場次 | ${totals.totalScenes} |`)
      lines.push(`| 初剪頁數 | ${totals.roughcutPages.toFixed(1)} |`)
      lines.push(`| 頁均時長 | ${globalAvgPageDur} |`)
      lines.push('')
    }

    if (opts.table) {
      const allCols: { key: keyof Options; label: string; render: (ep: EpisodeView) => string; total: string }[] = [
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
      const cols = allCols.filter(c => opts[c.key])

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

  function handleDownload() {
    const blob = new Blob([buildMD()], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  const FIELD_OPTS: { key: keyof Options; label: string; indent?: boolean }[] = [
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

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>匯出 Markdown</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.body}>
          <p style={s.label}>選擇要匯出的內容：</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {FIELD_OPTS.map(f => (
              <label key={f.key} style={{ ...s.checkRow, paddingLeft: f.indent ? 24 : 0 }}>
                <input
                  type="checkbox"
                  checked={opts[f.key]}
                  onChange={() => toggle(f.key)}
                  disabled={f.indent && !opts.table}
                  style={{ accentColor: '#fff', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 13, color: (f.indent && !opts.table) ? '#444' : '#aaa' }}>
                  {f.label}
                </span>
              </label>
            ))}
          </div>

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
    width: 400, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid #2A2A2A',
  },
  title: { fontSize: 14, fontWeight: 600, color: '#fff' },
  closeBtn: { background: 'transparent', border: 'none', color: '#555', fontSize: 16 },
  body: { padding: '20px', overflowY: 'auto' },
  label: { fontSize: 12, color: '#666', margin: 0 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  filenameBox: {
    marginTop: 24, padding: '12px 14px', background: '#111',
    borderRadius: 6, border: '1px solid #2A2A2A',
  },
  filenameLabel: { display: 'block', fontSize: 11, color: '#555', marginBottom: 4 },
  filename: { fontSize: 12, color: '#aaa', fontFamily: 'monospace' },
  footer: { display: 'flex', justifyContent: 'space-between', marginTop: 20 },
  btn: { padding: '9px 20px', background: '#fff', color: '#000', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13 },
  ghostBtn: { padding: '9px 16px', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: 6, fontSize: 13 },
}
