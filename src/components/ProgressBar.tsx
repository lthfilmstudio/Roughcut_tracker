interface Props {
  value: number
  color?: string
}

export default function ProgressBar({ value, color = '#4ade80' }: Props) {
  const pct = Math.min(Math.max(value * 100, 0), 100)
  return (
    <div style={{ background: '#2a2a2a', borderRadius: 4, height: 6, width: '100%' }}>
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 4,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  )
}
