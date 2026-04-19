import { useState } from 'react'

interface Props {
  onSubmit: (pwd: string) => boolean
  waiting?: boolean
}

export default function LoginScreen({ onSubmit, waiting }: Props) {
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = onSubmit(pwd)
    if (!ok) {
      setError('密碼錯誤，請重試')
      setPwd('')
    }
  }

  if (waiting) {
    return (
      <div style={s.wrapper}>
        <div style={s.card}>
          <p style={s.hint}>正在連結 Google 帳號⋯</p>
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <p style={s.label}>Roughcut Tracker</p>
        <h1 style={s.title}>輸入專案密碼</h1>
        <form onSubmit={handleSubmit} style={s.form}>
          <input
            type="password"
            value={pwd}
            onChange={(e) => { setPwd(e.target.value); setError('') }}
            placeholder="請輸入密碼"
            style={{ ...s.input, borderColor: error ? 'var(--color-missing)' : 'var(--border)' }}
            autoFocus
          />
          {error && <p style={s.error}>{error}</p>}
          <button type="submit" style={s.btn} disabled={!pwd}>
            進入
          </button>
        </form>
        <p style={s.hint}>忘記密碼？請聯絡剪輯指導</p>
      </div>
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
}
