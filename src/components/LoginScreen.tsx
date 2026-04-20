import { useState, useEffect } from 'react'
import HelpModal from './HelpModal'

interface Props {
  onSubmit: (pwd: string) => void
  waiting?: boolean
  waitingLabel?: string
  error?: string
  title?: string
  sublabel?: string
  hint?: string
}

export default function LoginScreen({
  onSubmit, waiting, waitingLabel, error,
  title = '輸入專案密碼',
  sublabel = 'Roughcut Tracker',
  hint = '忘記密碼？請聯絡剪輯指導',
}: Props) {
  const [pwd, setPwd] = useState('')
  const [localError, setLocalError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (error) {
      setLocalError(error)
      setPwd('')
    }
  }, [error])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    onSubmit(pwd)
  }

  if (waiting) {
    return (
      <div style={s.wrapper}>
        <div style={s.card}>
          <p style={s.hint}>{waitingLabel ?? '正在連結 Google 帳號⋯'}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <p style={s.label}>{sublabel}</p>
        <h1 style={s.title}>{title}</h1>
        <form onSubmit={handleSubmit} style={s.form}>
          <input
            type="password"
            value={pwd}
            onChange={(e) => { setPwd(e.target.value); setLocalError('') }}
            placeholder="請輸入密碼"
            style={{ ...s.input, borderColor: localError ? 'var(--color-missing)' : 'var(--border)' }}
            autoFocus
          />
          {localError && <p style={s.error}>{localError}</p>}
          <button type="submit" style={s.btn} disabled={!pwd}>
            進入
          </button>
        </form>
        <p style={s.hint}>{hint}</p>
        <button type="button" style={s.helpLink} onClick={() => setHelpOpen(true)}>
          使用說明
        </button>
      </div>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'var(--bg)',
  },
  card: {
    width: 360, padding: '40px 40px 32px', background: 'var(--card-bg)',
    borderRadius: 12, border: '1px solid var(--border)',
  },
  label: {
    fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12,
    letterSpacing: '0.08em', textTransform: 'uppercase',
  },
  title: { fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 28 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: {
    background: '#111', border: '1px solid', borderRadius: 8,
    color: 'var(--text-primary)', padding: '12px 14px', outline: 'none', width: '100%',
  },
  error: { fontSize: 13, color: 'var(--color-missing)', margin: 0 },
  btn: {
    padding: 12, background: 'var(--text-primary)', color: 'var(--bg)',
    border: 'none', borderRadius: 8, fontWeight: 600, marginTop: 4,
  },
  hint: { fontSize: 12, color: '#444', marginTop: 20, textAlign: 'center' },
  helpLink: {
    display: 'block', margin: '12px auto 0', background: 'transparent',
    border: 'none', color: 'var(--text-secondary)', fontSize: 12,
    textDecoration: 'underline', cursor: 'pointer', padding: 4,
  },
}
