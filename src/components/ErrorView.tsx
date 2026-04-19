interface Props {
  error: string
}

export default function ErrorView({ error }: Props) {
  const is403 = /\b403\b/.test(error)

  if (is403) {
    return (
      <div style={s.wrap}>
        <p style={s.msg}>暫時無法連接 Google Sheets，請稍等 1-2 分鐘後重新整理頁面</p>
        <button style={s.btn} onClick={() => window.location.reload()}>重新整理</button>
      </div>
    )
  }

  return <p style={s.plain}>錯誤：{error}</p>
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    marginTop: 80, padding: '0 20px',
  },
  msg: { color: 'var(--text-secondary)', textAlign: 'center', margin: 0, fontSize: 14 },
  btn: {
    padding: '9px 20px', background: 'var(--text-primary)', color: 'var(--bg)',
    border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  plain: { color: 'var(--color-missing)', textAlign: 'center', marginTop: 80 },
}
