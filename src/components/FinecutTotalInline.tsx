import { useEffect, useRef, useState } from 'react'
import { formatRoughcutLength, parseSecs, secsToHMS } from '../lib/stats'

interface Props {
  value: string
  onSave: (next: string) => Promise<void> | void
  label?: string
  fontSize?: number
}

export default function FinecutTotalInline({ value, onSave, label = '精剪總長', fontSize = 20 }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const displaySecs = parseSecs(value)
  const display = displaySecs > 0 ? secsToHMS(displaySecs) : (value || '—')

  async function commit() {
    if (saving) return
    const cleaned = draft.trim() ? formatRoughcutLength(draft) : ''
    if (cleaned === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(cleaned)
      setEditing(false)
    } catch {
      // stay in editing so user can retry
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setEditing(false)
    setDraft('')
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
        <input
          ref={inputRef}
          inputMode="numeric"
          placeholder="輸入數字即可"
          value={draft}
          disabled={saving}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            else if (e.key === 'Escape') cancel()
          }}
          onBlur={commit}
          style={{
            background: '#0f0f0f',
            border: '1px solid #4CAF50',
            borderRadius: 4,
            padding: '4px 8px',
            color: 'var(--text-primary)',
            fontSize,
            fontWeight: 700,
            lineHeight: 1,
            width: 150,
            fontFamily: 'inherit',
          }}
        />
        <span style={{ fontSize: 10, color: '#666' }}>打 4523 → 0:45:23</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
      <button
        onClick={() => { setDraft(value); setEditing(true) }}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          color: 'var(--text-primary)',
          fontSize,
          fontWeight: 700,
          lineHeight: 1,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'inherit',
        }}
        title="點擊編輯"
      >
        <span>{display}</span>
        <span style={{ fontSize: 12, color: '#666' }}>✏️</span>
      </button>
    </div>
  )
}
