import { useState } from 'react'
import type { SceneRow } from '../types'
import type { EpisodeStats } from '../lib/stats'
import { secsToHMS } from '../lib/stats'

interface Props {
  episode: string
  scenes: SceneRow[]
  stats: EpisodeStats
  onClose: () => void
}

interface ExportOptions {
  summary: boolean
  scenes: boolean
  sceneNum: boolean
  roughcutLength: boolean
  pages: boolean
  date: boolean
  status: boolean
  missingShots: boolean
  notes: boolean
}

const DEFAULT_OPTIONS: ExportOptions = {
  summary: true,
  scenes: true,
  sceneNum: true,
  roughcutLength: true,
  pages: true,
  date: false,
  status: true,
  missingShots: false,
  notes: false,
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export default function ExportMD({ episode, scenes, stats, onClose }: Props) {
  const [opts, setOpts] = useState<ExportOptions>(DEFAULT_OPTIONS)
  const toggle = (k: keyof ExportOptions) => setOpts(o => ({ ...o, [k]: !o[k] }))

  const filename = `${episode}_進度統計_${todayStr()}.md`

  function buildMD(): string {
    const lines: string[] = []
    lines.push(`# ${episode.toUpperCase()} 初剪進度`)
    lines.push('')

    if (opts.summary) {
      const totalSecs = stats.roughcutSecs + stats.finecutSecs
      const combinedScenes = stats.roughcutScenes + stats.finecutScenes
      const combinedPct = stats.validScenes > 0 ? combinedScenes / stats.validScenes : 0
      lines.push('## 統計摘要')
      lines.push('')
      lines.push('| 項目 | 時長 | 場次 | 百分比 |')
      lines.push('|------|------|------|------|')
      lines.push(`| 已初剪 | ${secsToHMS(stats.roughcutSecs)} | ${stats.roughcutScenes} / ${stats.validScenes} | ${(stats.roughcutPct * 100).toFixed(1)}% |`)
      lines.push(`| 已精剪 | ${secsToHMS(stats.finecutSecs)} | ${stats.finecutScenes} / ${stats.validScenes} | ${(stats.finecutPct * 100).toFixed(1)}% |`)
      lines.push(`| 總計 | ${secsToHMS(totalSecs)} | ${combinedScenes} / ${stats.validScenes} | ${(combinedPct * 100).toFixed(1)}% |`)
      lines.push('')
      lines.push(`**總頁數：** ${stats.totalPages.toFixed(1)} 頁（${stats.validScenes} 場，不含整場刪除）`)
      lines.push('')
    }

    if (opts.scenes) {
      lines.push('## 場次詳細')
      lines.push('')
      const allCols: { key: keyof SceneRow | null; label: string; enabled: boolean }[] = [
        { key: 'scene', label: '場次', enabled: opts.sceneNum },
        { key: 'roughcutLength', label: '長度', enabled: opts.roughcutLength },
        { key: 'pages', label: '頁數', enabled: opts.pages },
        { key: 'roughcutDate', label: '日期', enabled: opts.date },
        { key: 'status', label: '狀態', enabled: opts.status },
        { key: 'missingShots', label: '缺鏡', enabled: opts.missingShots },
        { key: 'notes', label: '備註', enabled: opts.notes },
      ]
      const cols = allCols.filter(c => c.enabled)

      if (cols.length > 0) {
        lines.push(`| ${cols.map(c => c.label).join(' | ')} |`)
        lines.push(`| ${cols.map(() => '------').join(' | ')} |`)
        for (const scene of scenes) {
          const cells = cols.map(c => c.key ? (scene[c.key] || '—') : '').join(' | ')
          lines.push(`| ${cells} |`)
        }
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  function handleDownload() {
    const content = buildMD()
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  const FIELD_OPTIONS: { key: keyof ExportOptions; label: string; indent?: boolean }[] = [
    { key: 'summary', label: '統計摘要（完成度、時長）' },
    { key: 'scenes', label: '場次詳細表' },
    { key: 'sceneNum', label: '場次編號', indent: true },
    { key: 'roughcutLength', label: '長度', indent: true },
    { key: 'pages', label: '頁數', indent: true },
    { key: 'date', label: '初剪日期', indent: true },
    { key: 'status', label: '狀態', indent: true },
    { key: 'missingShots', label: '缺鏡', indent: true },
    { key: 'notes', label: '備註', indent: true },
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
            {FIELD_OPTIONS.map(f => (
              <label key={f.key} style={{ ...s.checkRow, paddingLeft: f.indent ? 24 : 0 }}>
                <input
                  type="checkbox"
                  checked={opts[f.key]}
                  onChange={() => toggle(f.key)}
                  disabled={f.indent && !opts.scenes}
                  style={{ accentColor: '#fff', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 13, color: (f.indent && !opts.scenes) ? '#444' : '#aaa' }}>
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
