import { useMemo, useState } from 'react'
import { secsToHMS, computeEpisodeStats } from '../lib/stats'
import type { EpisodeStats } from '../lib/stats'
import type { EpisodesCache } from '../hooks/useEpisodesCache'
import DashboardExportMD from './DashboardExportMD'
import DashboardExportCSV from './DashboardExportCSV'
import ErrorView from './ErrorView'
import ExportPDFModal from './ExportPDFModal'
import { STUDIO_NAME } from '../config/sheets'
import { projectTitle } from '../config/projectConfig'
import { useProject } from '../contexts/ProjectContext'

interface Props {
  token: string
  cache: EpisodesCache
  onSelectEpisode: (ep: string) => void
  onOpenQuick: () => void
  onLogout: () => void
  logoutLabel?: string
}

interface EpisodeView {
  episode: string
  stats: EpisodeStats
}

const DASH_COL_DEFS: { key: string; label: string }[] = [
  { key: 'episode', label: '集數' },
  { key: 'roughPct', label: '已初剪%' },
  { key: 'finePct', label: '已精剪%' },
  { key: 'roughSecs', label: '初剪時長' },
  { key: 'fineSecs', label: '精剪時長' },
  { key: 'roughScenes', label: '初剪場次' },
  { key: 'fineScenes', label: '精剪場次' },
  { key: 'totalScenes', label: '總場次' },
  { key: 'roughPages', label: '初剪頁數' },
  { key: 'avgPage', label: '頁均時長' },
]

const DASH_PDF_FIELDS: { key: string; label: string }[] = [
  { key: 'summary', label: '統計摘要' },
  ...DASH_COL_DEFS,
]

const DASH_PDF_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  DASH_PDF_FIELDS.map(f => [f.key, true]),
)

function buildHideCSS(opts: Record<string, boolean>): string {
  const hiddenCols = DASH_COL_DEFS.filter(c => !opts[c.key]).map(c => `.pdf-col-${c.key}`)
  const parts: string[] = []
  if (hiddenCols.length > 0) {
    parts.push(`${hiddenCols.join(', ')} { display: none !important; }`)
  }
  if (!opts.summary) {
    parts.push(`.pdf-summary { display: none !important; }`)
  }
  return parts.length > 0 ? `@media print { ${parts.join(' ')} }` : ''
}

export default function Dashboard({ cache, onSelectEpisode, onOpenQuick, onLogout, logoutLabel = '登出' }: Props) {
  const { project } = useProject()
  const [hoveredEp, setHoveredEp] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [showExportMD, setShowExportMD] = useState(false)
  const [showExportCSV, setShowExportCSV] = useState(false)
  const [showExportPDF, setShowExportPDF] = useState(false)
  const [pdfOpts, setPdfOpts] = useState<Record<string, boolean>>(DASH_PDF_DEFAULTS)

  const { scenes, loading, error } = cache

  const eps = useMemo<EpisodeView[]>(() => {
    if (!scenes) return []
    return Object.keys(scenes)
      .sort()
      .map(ep => ({ episode: ep, stats: computeEpisodeStats(scenes[ep]) }))
  }, [scenes])

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

  const printDate = new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  })

  return (
    <div style={s.page}>
      <nav style={s.nav} className="no-print rt-nav">
        <div style={s.navTitleBox}>
          <span style={s.navTitle} className="rt-nav-title">Roughcut Tracker</span>
          <span style={s.navSub} className="rt-nav-sub">{projectTitle(project)}</span>
        </div>
        <button style={s.logoutBtn} onClick={onLogout}>{logoutLabel}</button>
      </nav>

      <main style={s.main} className="rt-main">
        {loading && <p style={s.msg}>載入中⋯</p>}
        {error && <ErrorView error={error} />}

        {!loading && !error && eps.length > 0 && (
          <>
            {/* 快速輸入入口 */}
            <button
              className="no-print rt-quick-banner"
              style={s.quickBanner}
              onClick={onOpenQuick}
            >
              <span style={s.quickBannerLeft}>
                <span style={s.quickBannerIcon}>⚡</span>
                <span>
                  <span style={s.quickBannerTitle}>快速輸入</span>
                  <span style={s.quickBannerSub}>手機版快速更新入口</span>
                </span>
              </span>
              <span style={s.quickBannerArrow}>→</span>
            </button>

            {/* 列印頁首 */}
            <div className="print-only print-header">
              <div className="print-header-row1">
                <span className="print-studio">{STUDIO_NAME}</span>
                <span className="print-meta">列印日期：{printDate}</span>
              </div>
              <h1 className="print-title">{projectTitle(project)}剪輯進度報告</h1>
            </div>

            {/* 列印用簡潔統計表 */}
            <table className="print-only print-summary pdf-summary">
              <thead>
                <tr>
                  <th>項目</th>
                  <th>時長</th>
                  <th>場次</th>
                  <th>百分比</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>已初剪</td>
                  <td>{secsToHMS(totals.roughcutSecs)}</td>
                  <td>{totals.roughcutScenes} / {totals.validScenes}</td>
                  <td>{(globalRoughcutPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>已精剪</td>
                  <td>{secsToHMS(totals.finecutSecs)}</td>
                  <td>{totals.finecutScenes} / {totals.validScenes}</td>
                  <td>{(globalFinecutPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>總計</td>
                  <td>{secsToHMS(totals.roughcutSecs + totals.finecutSecs)}</td>
                  <td>{totals.roughcutScenes + totals.finecutScenes} / {totals.validScenes}</td>
                  <td>{totals.validScenes > 0 ? (((totals.roughcutScenes + totals.finecutScenes) / totals.validScenes) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
                <tr>
                  <td>總頁數（已初剪）</td>
                  <td colSpan={3}>{totals.roughcutPages.toFixed(1)} 頁　・　頁均時長 {globalAvgPageDur}</td>
                </tr>
              </tbody>
            </table>

            {/* 統計卡片 */}
            <div style={s.statGrid} className="stat-grid-screen">
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
              <div style={s.statCard}>
                <p style={s.statLabel}>總頁數</p>
                <div style={s.statRow}>
                  <p style={s.statValue}>
                    {totals.roughcutPages.toFixed(1)}
                    <span style={s.statUnit}>頁</span>
                  </p>
                  <div style={{ ...s.statRight, justifyContent: 'flex-end' }}>
                    <span style={s.statSubValue}>已初剪頁數</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 工具列 */}
            <div style={s.toolbar} className="no-print rt-toolbar">
              <button style={s.actionBtn} onClick={() => setShowExportMD(true)}>匯出 MD</button>
              <button style={s.actionBtn} onClick={() => setShowExportCSV(true)}>匯出 CSV</button>
              <button style={s.actionBtn} onClick={() => setShowExportPDF(true)}>匯出 PDF</button>
            </div>

            {/* 手機卡片列表（桌機隱藏） */}
            <div className="mobile-episode-list only-mobile no-print" style={{ paddingBottom: 24 }}>
              {eps.map((row) => {
                const epId = row.episode.toLowerCase().replace(/\s+/g, '')
                const st = row.stats
                const combinedPct = st.validScenes > 0
                  ? (st.roughcutScenes + st.finecutScenes) / st.validScenes
                  : 0
                return (
                  <div key={row.episode} className="mobile-card" onClick={() => onSelectEpisode(epId)}>
                    <div className="mobile-card-head">
                      <span className="mobile-card-title">{row.episode}</span>
                      <span className="mobile-card-status" style={{ fontSize: 11 }}>
                        {st.totalScenes} 場
                      </span>
                    </div>
                    <div className="mobile-card-progress">
                      <div className="mobile-card-progress-row">
                        <span style={{ minWidth: 54 }}>已精剪</span>
                        <div className="mobile-card-progress-bar">
                          <div className="mobile-card-progress-fill" style={{ width: `${Math.min(st.finecutPct * 100, 100)}%`, background: '#4CAF50' }} />
                        </div>
                        <span style={{ minWidth: 50, textAlign: 'right' }}>{(st.finecutPct * 100).toFixed(1)}%</span>
                      </div>
                      <div className="mobile-card-progress-row">
                        <span style={{ minWidth: 54 }}>已初剪</span>
                        <div className="mobile-card-progress-bar">
                          <div className="mobile-card-progress-fill" style={{ width: `${Math.min(st.roughcutPct * 100, 100)}%`, background: '#FFC107' }} />
                        </div>
                        <span style={{ minWidth: 50, textAlign: 'right' }}>{(st.roughcutPct * 100).toFixed(1)}%</span>
                      </div>
                      <div className="mobile-card-progress-row">
                        <span style={{ minWidth: 54 }}>完成度</span>
                        <div className="mobile-card-progress-bar">
                          <div className="mobile-card-progress-fill" style={{ width: `${Math.min(combinedPct * 100, 100)}%`, background: '#E5E5E5' }} />
                        </div>
                        <span style={{ minWidth: 50, textAlign: 'right' }}>{(combinedPct * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="mobile-card-meta" style={{ fontSize: 11 }}>
                      <span>時長 {secsToHMS(st.roughcutSecs + st.finecutSecs)}</span>
                      <span>頁數 {st.roughcutPages > 0 ? st.roughcutPages.toFixed(1) : '—'}</span>
                    </div>
                  </div>
                )
              })}
              {/* 全劇合計 */}
              <div className="mobile-card" style={{ background: '#1C1C1C', cursor: 'default' }} onClick={e => e.stopPropagation()}>
                <div className="mobile-card-head">
                  <span className="mobile-card-title" style={{ color: 'var(--text-primary)' }}>全劇合計</span>
                  <span className="mobile-card-status" style={{ fontSize: 11 }}>{totals.totalScenes} 場</span>
                </div>
                <div className="mobile-card-progress">
                  <div className="mobile-card-progress-row">
                    <span style={{ minWidth: 54 }}>已精剪</span>
                    <div className="mobile-card-progress-bar">
                      <div className="mobile-card-progress-fill" style={{ width: `${Math.min(globalFinecutPct * 100, 100)}%`, background: '#4CAF50' }} />
                    </div>
                    <span style={{ minWidth: 50, textAlign: 'right' }}>{(globalFinecutPct * 100).toFixed(1)}%</span>
                  </div>
                  <div className="mobile-card-progress-row">
                    <span style={{ minWidth: 54 }}>已初剪</span>
                    <div className="mobile-card-progress-bar">
                      <div className="mobile-card-progress-fill" style={{ width: `${Math.min(globalRoughcutPct * 100, 100)}%`, background: '#FFC107' }} />
                    </div>
                    <span style={{ minWidth: 50, textAlign: 'right' }}>{(globalRoughcutPct * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="mobile-card-meta" style={{ fontSize: 11 }}>
                  <span>總時長 {secsToHMS(totals.roughcutSecs + totals.finecutSecs)}</span>
                  <span>頁均 {globalAvgPageDur}</span>
                </div>
              </div>
            </div>

            {/* 桌機進度表格（手機隱藏，但列印時仍需要） */}
            <div style={s.tableWrap} className="hide-on-mobile">
              <table style={s.table} className="data-table">
                <thead>
                  <tr>
                    {DASH_COL_DEFS.map(c => (
                      <th key={c.key} style={s.th} className={`pdf-col-${c.key}`}>{c.label}</th>
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
                          className="pdf-col-episode"
                          style={{ ...s.td, ...s.epLink, color: isHovered ? '#ccc' : 'var(--text-primary)', textDecorationColor: isHovered ? '#888' : 'transparent' }}
                          onClick={() => onSelectEpisode(epId)}
                          onMouseEnter={() => setHoveredEp(row.episode)}
                          onMouseLeave={() => setHoveredEp(null)}
                        >
                          {row.episode}
                        </td>
                        <td style={s.td} className="pdf-col-roughPct">{roughPct}%</td>
                        <td style={s.td} className="pdf-col-finePct">{finePct}%</td>
                        <td style={s.td} className="pdf-col-roughSecs">{st.roughcutSecs > 0 ? secsToHMS(st.roughcutSecs) : '—'}</td>
                        <td style={s.td} className="pdf-col-fineSecs">{st.finecutSecs > 0 ? secsToHMS(st.finecutSecs) : '—'}</td>
                        <td style={s.td} className="pdf-col-roughScenes">{st.roughcutScenes || '—'}</td>
                        <td style={s.td} className="pdf-col-fineScenes">{st.finecutScenes || '—'}</td>
                        <td style={s.td} className="pdf-col-totalScenes">{st.totalScenes || '—'}</td>
                        <td style={s.td} className="pdf-col-roughPages">{st.roughcutPages > 0 ? st.roughcutPages.toFixed(1) : '—'}</td>
                        <td style={s.td} className="pdf-col-avgPage">{epAvg}</td>
                      </tr>
                    )
                  })}
                  {/* 合計列 */}
                  <tr style={{ background: '#1C1C1C', borderTop: '1px solid #333' }}>
                    <td className="pdf-col-episode" style={{ ...s.td, fontWeight: 700, color: 'var(--text-primary)' }}>全劇合計</td>
                    <td className="pdf-col-roughPct" style={{ ...s.td, fontWeight: 600, color: 'var(--text-primary)' }}>{(globalRoughcutPct * 100).toFixed(1)}%</td>
                    <td className="pdf-col-finePct" style={{ ...s.td, fontWeight: 600, color: 'var(--text-primary)' }}>{(globalFinecutPct * 100).toFixed(1)}%</td>
                    <td className="pdf-col-roughSecs" style={{ ...s.td, fontWeight: 600 }}>{secsToHMS(totals.roughcutSecs)}</td>
                    <td className="pdf-col-fineSecs" style={{ ...s.td, fontWeight: 600 }}>{secsToHMS(totals.finecutSecs)}</td>
                    <td className="pdf-col-roughScenes" style={{ ...s.td, fontWeight: 600 }}>{totals.roughcutScenes || '—'}</td>
                    <td className="pdf-col-fineScenes" style={{ ...s.td, fontWeight: 600 }}>{totals.finecutScenes || '—'}</td>
                    <td className="pdf-col-totalScenes" style={{ ...s.td, fontWeight: 600 }}>{totals.totalScenes || '—'}</td>
                    <td className="pdf-col-roughPages" style={{ ...s.td, fontWeight: 600 }}>{totals.roughcutPages > 0 ? totals.roughcutPages.toFixed(1) : '—'}</td>
                    <td className="pdf-col-avgPage" style={{ ...s.td, fontWeight: 600 }}>{globalAvgPageDur}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: buildHideCSS(pdfOpts) }} />

      {showExportPDF && (
        <ExportPDFModal
          fieldDefs={DASH_PDF_FIELDS}
          initialOpts={pdfOpts}
          onClose={() => setShowExportPDF(false)}
          onConfirm={(opts) => {
            setPdfOpts(opts)
            setShowExportPDF(false)
            window.setTimeout(() => window.print(), 80)
          }}
        />
      )}

      {showExportMD && (
        <DashboardExportMD
          showName={project.name}
          eps={eps}
          totals={totals}
          globalRoughcutPct={globalRoughcutPct}
          globalFinecutPct={globalFinecutPct}
          globalAvgPageDur={globalAvgPageDur}
          scenesMap={scenes ?? {}}
          onClose={() => setShowExportMD(false)}
        />
      )}

      {showExportCSV && (
        <DashboardExportCSV
          showName={project.name}
          eps={eps}
          totals={totals}
          globalRoughcutPct={globalRoughcutPct}
          globalFinecutPct={globalFinecutPct}
          globalAvgPageDur={globalAvgPageDur}
          scenesMap={scenes ?? {}}
          onClose={() => setShowExportCSV(false)}
        />
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  nav: {
    position: 'relative',
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
    padding: '16px 32px', borderBottom: '1px solid var(--border)',
  },
  navTitleBox: {
    position: 'absolute', left: '50%', top: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
    pointerEvents: 'none',
  },
  navTitle: { fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: '1.4' },
  navSub: { fontSize: 11, color: '#666666', lineHeight: '1.4' },
  logoutBtn: {
    padding: '7px 16px', background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)', borderRadius: 6,
  },
  main: { padding: '24px 40px', maxWidth: 1400, margin: '0 auto' },
  msg: { color: 'var(--text-secondary)', textAlign: 'center', marginTop: 80 },
  statGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 20,
    alignItems: 'stretch',
  },
  statCard: {
    background: '#1C1C1C', border: '1px solid #2A2A2A',
    borderRadius: 4, padding: '14px 18px',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  },
  statLabel: { fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 },
  statRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  statValue: { fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, whiteSpace: 'nowrap' },
  statUnit: { fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 4 },
  statRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, gap: 6, minWidth: 0 },
  statPct: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 },
  statBarRow: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' },
  statSubValue: { fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', lineHeight: 1 },
  barTrack: { background: '#2A2A2A', borderRadius: 2, height: 4, flex: 1, minWidth: 0, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, transition: 'width 0.3s ease' },
  toolbar: {
    display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12,
  },
  actionBtn: {
    padding: '7px 14px', background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)', borderRadius: 6, fontSize: 13,
  },
  quickBanner: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', marginBottom: 16, padding: '14px 18px',
    background: 'linear-gradient(135deg, #2A2414 0%, #1C1C1C 100%)',
    border: '1px solid #3A3114', borderLeft: '3px solid #FFC107',
    borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer',
    textAlign: 'left',
  },
  quickBannerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  quickBannerIcon: { fontSize: 22, lineHeight: 1 },
  quickBannerTitle: {
    display: 'block', fontSize: 15, fontWeight: 600,
    color: '#FFC107', lineHeight: 1.3,
  },
  quickBannerSub: {
    display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2,
  },
  quickBannerArrow: { fontSize: 18, color: '#FFC107' },
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
