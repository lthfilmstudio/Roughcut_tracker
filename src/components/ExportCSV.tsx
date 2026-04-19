import { useState } from 'react'
import type { SceneRow } from '../types'

interface Props {
  episode: string
  scenes: SceneRow[]
  onClose: () => void
}

interface ExportOptions {
  sceneNum: boolean
  roughcutLength: boolean
  pages: boolean
  date: boolean
  status: boolean
  missingShots: boolean
  notes: boolean
}

const DEFAULT_OPTIONS: ExportOptions = {
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

function csvEscape(v: string): string {
  const s = v ?? ''
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export default function ExportCSV({ episode, scenes, onClose }: Props) {
  const [opts, setOpts] = useState<ExportOptions>(DEFAULT_OPTIONS)
  const toggle = (k: keyof ExportOptions) => setOpts(o => ({ ...o, [k]: !o[k] }))

  const filename = `${episode}_場次資料_${todayStr()}.csv`

  function buildCSV(): string {
    const allCols: { key: keyof SceneRow; label: string; enabled: boolean }[] = [
      { key: 'scene', label: '場次編號', enabled: opts.sceneNum },
      { key: 'roughcutLength', label: '長度', enabled: opts.roughcutLength },
      { key: 'pages', label: '頁數', enabled: opts.pages },
      { key: 'roughcutDate', label: '初剪日期', enabled: opts.date },
      { key: 'status', label: '狀態', enabled: opts.status },
      { key: 'missingShots', label: '缺鏡', enabled: opts.missingShots },
      { key: 'notes', label: '備註', enabled: opts.notes },
    ]
    const cols = allCols.filter(c => c.enabled)
    if (cols.length === 0) return ''

    const lines: string[] = []
    lines.push(cols.map(c => csvEscape(c.label)).join(','))
    for (const scene of scenes) {
      lines.push(cols.map(c => csvEscape(scene[c.key] ?? '')).join(','))
    }
    return lines.join('\r\n')
  }

  function handleDownload() {
    const content = buildCSV()
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  const FIELD_OPTIONS: { key: keyof ExportOptions; label: string }[] = [
    { key: 'sceneNum', label: '場次編號' },
    { key: 'roughcutLength', label: '長度' },
    { key: 'pages', label: '頁數' },
    { key: 'date', label: '初剪日期' },
    { key: 'status', label: '狀態' },
    { key: 'missingShots', label: '缺鏡' },
    { key: 'notes', label: '備註' },
  ]

  const anyChecked = FIELD_OPTIONS.some(f => opts[f.key])

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>匯出 CSV</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.body}>
          <p style={s.label}>選擇要包含的欄位：</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {FIELD_OPTIONS.map(f => (
              <label key={f.key} style={s.checkRow}>
                <input
                  type="checkbox"
                  checked={opts[f.key]}
                  onChange={() => toggle(f.key)}
                  style={{ accentColor: '#fff', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 13, color: '#aaa' }}>{f.label}</span>
              </label>
            ))}
          </div>

          <div style={s.filenameBox}>
            <span style={s.filenameLabel}>預覽檔名</span>
            <span style={s.filename}>{filename}</span>
          </div>

          <div style={s.footer}>
            <button style={s.ghostBtn} onClick={onClose}>取消</button>
            <button
              style={{ ...s.btn, opacity: anyChecked ? 1 : 0.4, cursor: anyChecked ? 'pointer' : 'not-allowed' }}
              onClick={handleDownload}
              disabled={!anyChecked}
            >
              下載 .csv
            </button>
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
