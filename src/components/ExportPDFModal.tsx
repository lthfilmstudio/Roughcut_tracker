import { useState } from 'react'

interface FieldDef {
  key: string
  label: string
}

interface Props {
  fieldDefs: FieldDef[]
  initialOpts: Record<string, boolean>
  onClose: () => void
  onConfirm: (opts: Record<string, boolean>) => void
}

export default function ExportPDFModal({ fieldDefs, initialOpts, onClose, onConfirm }: Props) {
  const [opts, setOpts] = useState<Record<string, boolean>>(initialOpts)
  const toggle = (k: string) => setOpts(o => ({ ...o, [k]: !o[k] }))
  const anyChecked = Object.values(opts).some(Boolean)

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>匯出 PDF</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.body}>
          <p style={s.label}>選擇要包含的欄位：</p>
          <div style={s.fieldList}>
            {fieldDefs.map(f => (
              <label key={f.key} style={s.checkRow}>
                <input
                  type="checkbox"
                  checked={!!opts[f.key]}
                  onChange={() => toggle(f.key)}
                  style={{ accentColor: '#fff', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 13, color: '#aaa' }}>{f.label}</span>
              </label>
            ))}
          </div>

          <div style={s.hint}>
            提示：請在列印設定中取消勾選「頁首和頁尾」以獲得最佳效果
          </div>

          <div style={s.footer}>
            <button style={s.ghostBtn} onClick={onClose}>取消</button>
            <button
              style={{ ...s.btn, opacity: anyChecked ? 1 : 0.4, cursor: anyChecked ? 'pointer' : 'not-allowed' }}
              onClick={() => anyChecked && onConfirm(opts)}
              disabled={!anyChecked}
            >
              開始列印
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
  fieldList: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  hint: {
    fontSize: 11, color: '#888', marginTop: 18, padding: '10px 12px',
    background: '#111', border: '1px solid #2A2A2A', borderRadius: 6,
    lineHeight: 1.5,
  },
  footer: { display: 'flex', justifyContent: 'space-between', marginTop: 20 },
  btn: { padding: '9px 20px', background: '#fff', color: '#000', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13 },
  ghostBtn: { padding: '9px 16px', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: 6, fontSize: 13 },
}
