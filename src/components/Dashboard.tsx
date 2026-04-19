import { useEffect, useState } from 'react'
import {
  fetchSummary, fetchEpisodesBatch, initializeSummary, batchUpdateSummary,
} from '../services/sheetsService'
import { secsToHMS, normalizeScene, computeEpisodeStats } from '../lib/stats'
import type { EpisodeStats } from '../lib/stats'

interface Props {
  token: string
  onSelectEpisode: (ep: string) => void
  onLogout: () => void
}

interface EpisodeView {
  episode: string
  stats: EpisodeStats
}

export default function Dashboard({ token, onSelectEpisode, onLogout }: Props) {
  const [eps, setEps] = useState<EpisodeView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [initializing, setInitializing] = useState(false)
  const [hoveredEp, setHoveredEp] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const summary = await fetchSummary(token)
      const epIds = summary.map(s => s.episode.toLowerCase().replace(/\s+/g, ''))
      const batch = await fetchEpisodesBatch(epIds, token)
      const computed = summary.map((s, i) => {
        const scenes = (batch[epIds[i]] ?? []).map(normalizeScene)
        return { episode: s.episode, epId: epIds[i], stats: computeEpisodeStats(scenes) }
      })
      setEps(computed.map(c => ({ episode: c.episode, stats: c.stats })))
      batchUpdateSummary(
        computed.map(c => ({ ep: c.epId, stats: c.stats })),
        token,
      ).catch(() => {})
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [token])

  async function handleInit() {
    setInitializing(true)
    try {
      await initializeSummary(token)
      await loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setInitializing(false)
    }
  }

  // 全劇合計（按相同邏輯）
  const totals = eps.reduce(
    (acc, e) => ({
      totalScenes: acc.totalScenes + e.stats.totalScenes,
      validScenes: acc.validScenes + e.stats.validScenes,
      roughcutScenes: acc.roughcutScenes + e.stats.roughcutScenes,
      finecutScenes: acc.finecutScenes + e.stats.finecutScenes,
      roughcutSecs: acc.roughcutSecs + e.stats.roughcutSecs,
      finecutSecs: acc.finecutSecs + e.stats.finecutSecs,
      roughcutPages: acc.roughcutPages + e.stats.roughcutPages,
      finecutPages: acc.finecutPages + e.stats.finecutPages,
    }),
    { totalScenes: 0, validScenes: 0, roughcutScenes: 0, finecutScenes: 0, roughcutSecs: 0, finecutSecs: 0, roughcutPages: 0, finecutPages: 0 },
  )

  const globalRoughcutPct = totals.validScenes > 0 ? totals.roughcutScenes / totals.validScenes : 0
  const globalFinecutPct = totals.validScenes > 0 ? totals.finecutScenes / totals.validScenes : 0
  const totalCutPages = totals.roughcutPages + totals.finecutPages
  const totalCutSecs = totals.roughcutSecs + totals.finecutSecs
  const globalAvgPageDur = totalCutPages > 0 ? secsToHMS(Math.round(totalCutSecs / totalCutPages)) : '—'

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <span style={s.navTitle}>Roughcut Tracker</span>
          <span style={s.navSub}>劇集《北城百畫帖》</span>
        </div>
        <button style={s.logoutBtn} onClick={onLogout}>登出</button>
      </nav>

      <main style={s.main}>
        {loading && <p style={s.msg}>載入中⋯</p>}
        {error && <p style={{ ...s.msg, color: 'var(--color-missing)' }}>錯誤：{error}</p>}

        {!loading && !error && eps.length === 0 && (
          <div style={s.emptyState}>
            <p style={s.emptyText}>尚無資料</p>
            <button style={s.initBtn} onClick={handleInit} disabled={initializing}>
              {initializing ? '初始化中⋯' : '自動建立 ep01–ep12 資料列'}
            </button>
          </div>
        )}

        {!loading && !error && eps.length > 0 && (
          <>
            {/* 統計卡片 */}
            <div style={s.statGrid}>
              {[
                { label: '已初剪', secs: totals.roughcutSecs, pct: globalRoughcutPct, count: totals.roughcutScenes, color: '#FFC107' },
                { label: '已精剪', secs: totals.finecutSecs, pct: globalFinecutPct, count: totals.finecutScenes, color: '#4CAF50' },
                {
                  label: '總計',
                  secs: totals.roughcutSecs + totals.finecutSecs,
                  pct: totals.validScenes > 0 ? (totals.roughcutScenes + totals.finecutScenes) / totals.validScenes : 0,
                  count: totals.roughcutScenes + totals.finecutScenes,
                  color: '#E5E5E5',
                },
              ].map(c => (
                <div key={c.label} style={s.statCard}>
                  <p style={s.statLabel}>{c.label}</p>
                  <div style={s.statRow}>
                    <p style={s.statValue}>{secsToHMS(c.secs)}</p>
                    <div style={s.statRight}>
                      <p style={s.statPct}>{Math.round(c.pct * 100)}%</p>
                      <div style={s.statBarRow}>
                        <div style={s.barTrack}>
                          <div style={{ ...s.barFill, width: `${Math.min(c.pct * 100, 100)}%`, background: c.color }} />
                        </div>
                        <span style={s.statSubValue}>{c.count} / {totals.validScenes} 場</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 進度表格 */}
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['集數', '已初剪%', '已精剪%', '初剪時長', '精剪時長', '初剪場次', '精剪場次', '總場次', '初剪頁數', '頁均時長'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {eps.map((row, i) => {
                    const epId = row.episode.toLowerCase().replace(/\s+/g, '')
                    const st = row.stats
                    const roughPct = (st.roughcutPct * 100).toFixed(1)
                    const finePct = (st.finecutPct * 100).toFixed(1)
                    const epCutPages = st.roughcutPages + st.finecutPages
                    const epAvg = epCutPages > 0
                      ? secsToHMS(Math.round((st.roughcutSecs + st.finecutSecs) / epCutPages))
                      : '—'
                    const isHovered = hoveredEp === row.episode
                    const rowBg = hoveredRow === i ? '#1E1E1E' : (i % 2 === 0 ? 'var(--card-bg)' : '#161616')
                    return (
                      <tr
                        key={row.episode}
                        style={{ background: rowBg }}
                        onMouseEnter={() => setHoveredRow(i)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td
                          style={{ ...s.td, ...s.epLink, color: isHovered ? '#ccc' : 'var(--text-primary)', textDecorationColor: isHovered ? '#888' : 'transparent' }}
                          onClick={() => onSelectEpisode(epId)}
                          onMouseEnter={() => setHoveredEp(row.episode)}
                          onMouseLeave={() => setHoveredEp(null)}
                        >
                          {row.episode}
                        </td>
                        <td style={s.td}>{roughPct}%</td>
                        <td style={s.td}>{finePct}%</td>
                        <td style={s.td}>{st.roughcutSecs > 0 ? secsToHMS(st.roughcutSecs) : '—'}</td>
                        <td style={s.td}>{st.finecutSecs > 0 ? secsToHMS(st.finecutSecs) : '—'}</td>
                        <td style={s.td}>{st.roughcutScenes || '—'}</td>
                        <td style={s.td}>{st.finecutScenes || '—'}</td>
                        <td style={s.td}>{st.totalScenes || '—'}</td>
                        <td style={s.td}>{st.roughcutPages > 0 ? st.roughcutPages.toFixed(1) : '—'}</td>
                        <td style={s.td}>{epAvg}</td>
                      </tr>
                    )
                  })}
                  {/* 合計列 */}
                  <tr style={{ background: '#1C1C1C', borderTop: '1px solid #333' }}>
                    <td style={{ ...s.td, fontWeight: 700, color: 'var(--text-primary)' }}>全劇合計</td>
                    <td style={{ ...s.td, fontWeight: 600, color: 'var(--text-primary)' }}>{(globalRoughcutPct * 100).toFixed(1)}%</td>
                    <td style={{ ...s.td, fontWeight: 600, color: 'var(--text-primary)' }}>{(globalFinecutPct * 100).toFixed(1)}%</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{secsToHMS(totals.roughcutSecs)}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{secsToHMS(totals.finecutSecs)}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{totals.roughcutScenes || '—'}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{totals.finecutScenes || '—'}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{totals.totalScenes || '—'}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{totals.roughcutPages > 0 ? totals.roughcutPages.toFixed(1) : '—'}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{globalAvgPageDur}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 32px', borderBottom: '1px solid var(--border)',
  },
  navTitle: { fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: '1.4' },
  navSub: { fontSize: 11, color: '#666666', lineHeight: '1.4' },
  logoutBtn: {
    padding: '7px 16px', background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)', borderRadius: 6,
  },
  main: { padding: '24px 40px', maxWidth: 1400, margin: '0 auto' },
  msg: { color: 'var(--text-secondary)', textAlign: 'center', marginTop: 80 },
  emptyState: { textAlign: 'center', marginTop: 100 },
  emptyText: { color: 'var(--text-secondary)', marginBottom: 20 },
  initBtn: {
    padding: '12px 24px', background: 'var(--text-primary)', color: 'var(--bg)',
    border: 'none', borderRadius: 8, fontWeight: 600,
  },
  statGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 20,
    alignItems: 'stretch',
  },
  statCard: {
    background: '#1C1C1C', border: '1px solid #2A2A2A',
    borderRadius: 4, padding: '14px 18px',
    display: 'flex', flexDirection: 'column',
  },
  statLabel: { fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 },
  statRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  statValue: { fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, whiteSpace: 'nowrap' },
  statRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, gap: 6, minWidth: 0 },
  statPct: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 },
  statBarRow: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' },
  statSubValue: { fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', lineHeight: 1 },
  barTrack: { background: '#2A2A2A', borderRadius: 2, height: 4, flex: 1, minWidth: 0, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, transition: 'width 0.3s ease' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 16px', color: 'var(--text-secondary)',
    borderBottom: '1px solid #2A2A2A', fontWeight: 500, whiteSpace: 'nowrap',
    fontSize: 12,
  },
  td: {
    padding: '12px 16px', color: 'var(--text-secondary)',
    borderBottom: '1px solid #1a1a1a', whiteSpace: 'nowrap',
  },
  epLink: {
    fontWeight: 600, cursor: 'pointer', textDecoration: 'underline',
  },
}
