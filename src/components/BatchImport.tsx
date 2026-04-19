import { useState } from 'react'
import type { SceneRow } from '../types'

const EMPTY_SCENE: SceneRow = {
  scene: '', roughcutLength: '', pages: '', roughcutDate: '', status: '', missingShots: '', notes: '',
}

interface Props {
  episode: string
  existingScenes: SceneRow[]
  onClose: () => void
  onImport: (scenes: SceneRow[]) => Promise<void>
}

export default function BatchImport({ episode, existingScenes, onClose, onImport }: Props) {
  const [start, setStart] = useState(1)
  const [end, setEnd] = useState(45)
  const [importing, setImporting] = useState(false)
  const [doneCount, setDoneCount] = useState<number | null>(null)

  const existingNums = new Set(existingScenes.map(s => s.scene))
  const range = end >= start ? end - start + 1 : 0
  const toCreate = Array.from({ length: range }, (_, i) => String(start + i))
    .filter(n => !existingNums.has(n))
  const skipCount = range - toCreate.length

  async function handleConfirm() {
    if (!toCreate.length) return
    setImporting(true)
    try {
      const scenes: SceneRow[] = toCreate.map(n => ({ ...EMPTY_SCENE, scene: n }))
      await onImport(scenes)
      setDoneCount(scenes.length)
      setTimeout(onClose, 1200)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>自動產生場次</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.body}>
          {doneCount !== null ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>✓</p>
              <p style={{ fontSize: 15, color: '#fff', fontWeight: 600 }}>已成功建立 {doneCount} 個場次</p>
            </div>
          ) : (<>
          <p style={s.subtitle}>{episode} — 批次建立空白場次</p>

          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>起始場次</label>
              <input
                type="number" min={1} style={s.input}
                value={start}
                onChange={e => setStart(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <span style={s.dash}>—</span>
            <div style={s.field}>
              <label style={s.label}>結束場次</label>
              <input
                type="number" min={1} style={s.input}
                value={end}
                onChange={e => setEnd(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>

          <div style={s.preview}>
            {range > 0 ? (
              <>
                <p style={s.previewText}>
                  將自動建立第 <strong style={{ color: '#fff' }}>{start}</strong> 場到第{' '}
                  <strong style={{ color: '#fff' }}>{end}</strong> 場，共{' '}
                  <strong style={{ color: '#fff' }}>{toCreate.length}</strong> 個場次
                </p>
                {skipCount > 0 && (
                  <p style={s.skipText}>（已跳過 {skipCount} 個已存在的場次）</p>
                )}
              </>
            ) : (
              <p style={{ ...s.previewText, color: '#FF9800' }}>結束場次必須大於等於起始場次</p>
            )}
          </div>

          <p style={s.warning}>已存在的場次編號將略過，不會重複建立</p>

          <div style={s.footer}>
            <button style={s.ghostBtn} onClick={onClose}>取消</button>
            <button
              style={{ ...s.btn, opacity: toCreate.length > 0 && !importing ? 1 : 0.4 }}
              onClick={handleConfirm}
              disabled={!toCreate.length || importing}
            >
              {importing ? '建立中⋯' : '確認建立'}
            </button>
          </div>
          </>)}
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
    width: 420,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid #2A2A2A',
  },
  title: { fontSize: 14, fontWeight: 600, color: '#fff' },
  closeBtn: { background: 'transparent', border: 'none', color: '#555', fontSize: 16, cursor: 'pointer' },
  body: { padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 },
  subtitle: { fontSize: 13, color: '#666', margin: 0 },
  fields: { display: 'flex', alignItems: 'flex-end', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  label: { fontSize: 12, color: '#888' },
  dash: { fontSize: 16, color: '#555', paddingBottom: 10 },
  input: {
    background: '#111', border: '1px solid #333', borderRadius: 6,
    color: '#fff', padding: '8px 12px', fontSize: 15, width: '100%',
    textAlign: 'center' as const,
  },
  preview: {
    background: '#111', border: '1px solid #2A2A2A', borderRadius: 6,
    padding: '14px 16px',
  },
  previewText: { fontSize: 13, color: '#888', margin: 0 },
  skipText: { fontSize: 12, color: '#FF9800', margin: '6px 0 0' },
  warning: { fontSize: 12, color: '#555', margin: 0 },
  footer: { display: 'flex', justifyContent: 'space-between' },
  btn: { padding: '9px 20px', background: '#fff', color: '#000', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  ghostBtn: { padding: '9px 16px', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: 6, fontSize: 13, cursor: 'pointer' },
}
