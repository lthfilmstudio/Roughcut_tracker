import { secsToHMS } from '../lib/stats'
import type { EpisodeStats } from '../lib/stats'

interface Props {
  stats: EpisodeStats
}

export default function SummaryBar({ stats }: Props) {
  const totalSecs = stats.roughcutSecs + stats.finecutSecs
  const combinedCount = stats.roughcutScenes + stats.finecutScenes
  const combinedPct = stats.validScenes > 0 ? combinedCount / stats.validScenes : 0

  const cards = [
    {
      label: '已初剪',
      secs: stats.roughcutSecs,
      pct: stats.roughcutPct,
      count: stats.roughcutScenes,
      color: '#FFC107',
    },
    {
      label: '已精剪',
      secs: stats.finecutSecs,
      pct: stats.finecutPct,
      count: stats.finecutScenes,
      color: '#4CAF50',
    },
    {
      label: '總計',
      secs: totalSecs,
      pct: combinedPct,
      count: combinedCount,
      color: '#E5E5E5',
    },
  ]

  return (
    <div style={s.sticky} className="no-print">
      <div style={s.grid}>
        {cards.map(c => (
          <div key={c.label} style={s.card}>
            <p style={s.label}>{c.label}</p>
            <div style={s.row}>
              <p style={s.value}>{secsToHMS(c.secs)}</p>
              <div style={s.right}>
                <p style={s.pct}>{Math.round(c.pct * 100)}%</p>
                <div style={s.barRow}>
                  <div style={s.barTrack}>
                    <div style={{ ...s.barFill, width: `${Math.min(c.pct * 100, 100)}%`, background: c.color }} />
                  </div>
                  <span style={s.sub}>{c.count} / {stats.validScenes} 場</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div style={s.card}>
          <p style={s.label}>總頁數</p>
          <div style={s.row}>
            <p style={s.value}>
              {stats.totalPages.toFixed(1)}
              <span style={s.unit}>頁</span>
            </p>
            <div style={{ ...s.right, justifyContent: 'flex-end' }}>
              <span style={s.sub}>{stats.validScenes} 場（不含整場刪除）</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  sticky: {
    position: 'sticky', top: 0, zIndex: 10,
    background: 'var(--bg)',
    padding: '14px 40px',
    maxWidth: 1400, margin: '0 auto',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12,
    alignItems: 'stretch',
  },
  card: {
    background: '#1C1C1C', border: '1px solid #2A2A2A',
    borderRadius: 4, padding: '14px 18px',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  },
  label: { fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  value: { fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, whiteSpace: 'nowrap' },
  unit: { fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 4 },
  right: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, gap: 6, minWidth: 0 },
  pct: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 },
  barRow: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' },
  barTrack: { background: '#2A2A2A', borderRadius: 2, height: 4, flex: 1, minWidth: 0, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, transition: 'width 0.3s ease' },
  sub: { fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', lineHeight: 1 },
}
