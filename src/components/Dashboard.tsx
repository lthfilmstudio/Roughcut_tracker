import { useMemo, useState } from 'react'
import { secsToHMS, computeEpisodeStats, parseSecs, finecutMetaKey } from '../lib/stats'
import type { EpisodeStats } from '../lib/stats'
import type { EpisodesCache } from '../hooks/useEpisodesCache'
import DashboardExportMD from './DashboardExportMD'
import DashboardExportCSV from './DashboardExportCSV'
import ErrorView from './ErrorView'
import ExportPDFModal from './ExportPDFModal'
import { STUDIO_NAME } from '../config/sheets'
import { projectTitle } from '../config/projectConfig'
import { useProject } from '../contexts/ProjectContext'

const DASH_SCENE_COL_DEFS: { key: string; label: string }[] = [
  { key: 'sceneNum', label: '場次' },
  { key: 'roughcutLength', label: '長度' },
  { key: 'pages', label: '頁數' },
  { key: 'date', label: '日期' },
  { key: 'status', label: '狀態' },
  { key: 'missingShots', label: '缺鏡' },
  { key: 'notes', label: '備註' },
]

const STATUS_PRINT_CLASS: Record<string, string> = {
  已精剪: 'print-status-finecut',
  已初剪: 'print-status-roughcut',
  尚缺鏡頭: 'print-status-missing',
  整場刪除: 'print-status-deleted',
}

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
  { key: 'roughTotalSecs', label: '初剪原始總長' },
  { key: 'fineTotalSecs', label: '精剪總長' },
  { key: 'roughScenes', label: '初剪場次' },
  { key: 'fineScenes', label: '精剪場次' },
  { key: 'totalScenes', label: '總場次' },
  { key: 'roughPages', label: '初剪頁數' },
  { key: 'avgPage', label: '頁均時長' },
]

const DASH_PDF_SUMMARY_FIELDS: { key: string; label: string; indent?: boolean }[] = [
  { key: 'summary', label: '統計摘要（全劇合計）' },
  { key: 'table', label: '各集明細表' },
  ...DASH_COL_DEFS.map(c => ({ ...c, indent: true })),
]

const DASH_PDF_SUMMARY_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  DASH_PDF_SUMMARY_FIELDS.map(f => [f.key, true]),
)

const DASH_PDF_SCENES_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  DASH_SCENE_COL_DEFS.map(c => [c.key, c.key !== 'date' && c.key !== 'missingShots']),
)

function buildHideSummaryCSS(opts: Record<string, boolean>): string {
  const hiddenCols = DASH_COL_DEFS.filter(c => !opts[c.key]).map(c => `.pdf-col-${c.key}`)
  const parts: string[] = []
  if (hiddenCols.length > 0) {
    parts.push(`${hiddenCols.join(', ')} { display: none !important; }`)
  }
  if (!opts.summary) {
    parts.push(`.pdf-summary { display: none !important; }`)
  }
  if (!opts.table) {
    parts.push(`.pdf-dash-table { display: none !important; }`)
  }
  return parts.length > 0 ? `@media print { ${parts.join(' ')} }` : ''
}

function buildHideScenesCSS(opts: Record<string, boolean>): string {
  const hiddenCols = DASH_SCENE_COL_DEFS.filter(c => !opts[c.key]).map(c => `.pdf-col-${c.key}`)
  if (hiddenCols.length === 0) return ''
  return `@media print { ${hiddenCols.join(', ')} { display: none !important; } }`
}

export default function Dashboard({ cache, onSelectEpisode, onOpenQuick, onLogout, logoutLabel = '登出' }: Props) {
  const { project } = useProject()
  const [hoveredEp, setHoveredEp] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [showExportMD, setShowExportMD] = useState(false)
  const [showExportCSV, setShowExportCSV] = useState(false)
  const [showExportPDF, setShowExportPDF] = useState(false)
  const [pdfSummaryOpts, setPdfSummaryOpts] = useState<Record<string, boolean>>(DASH_PDF_SUMMARY_DEFAULTS)
  const [pdfScenesOpts, setPdfScenesOpts] = useState<Record<string, boolean>>(DASH_PDF_SCENES_DEFAULTS)
  const [printMode, setPrintMode] = useState<'summary' | 'allScenes'>('summary')

  const { scenes, meta, loading, error } = cache

  const eps = useMemo<EpisodeView[]>(() => {
    if (!scenes) return []
    return Object.keys(scenes)
      .sort()
      .map(ep => ({ episode: ep, stats: computeEpisodeStats(scenes[ep]) }))
  }, [scenes])

  const finecutTotalSecsByEp = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const e of eps) {
      out[e.episode] = parseSecs(meta[finecutMetaKey(e.episode)] ?? '')
    }
    return out
  }, [eps, meta])

  const totals = eps.reduce(
    (acc, e) => ({
      totalScenes: acc.totalScenes + e.stats.totalScenes,
      validScenes: acc.validScenes + e.stats.validScenes,
      roughcutScenes: acc.roughcutScenes + e.stats.roughcutScenes,
      finecutScenes: acc.finecutScenes + e.stats.finecutScenes,
      roughcutSecs: acc.roughcutSecs + e.stats.roughcutSecs,
      finecutSecs: acc.finecutSecs + e.stats.finecutSecs,
      roughcutTotalSecs: acc.roughcutTotalSecs + e.stats.roughcutTotalSecs,
      finecutTotalSecs: acc.finecutTotalSecs + (finecutTotalSecsByEp[e.episode] ?? 0),
      roughcutPages: acc.roughcutPages + e.stats.roughcutPages,
      finecutPages: acc.finecutPages + e.stats.finecutPages,
    }),
    { totalScenes: 0, validScenes: 0, roughcutScenes: 0, finecutScenes: 0, roughcutSecs: 0, finecutSecs: 0, roughcutTotalSecs: 0, finecutTotalSecs: 0, roughcutPages: 0, finecutPages: 0 },
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
        <div style={s.navInner} className="rt-nav-inner">
          <div style={s.navTitleBox}>
            <span style={s.navTitle} className="rt-nav-title">Roughcut Tracker</span>
            <span style={s.navSub} className="rt-nav-sub">{projectTitle(project)}</span>
          </div>
          <button style={s.logoutBtn} onClick={onLogout}>{logoutLabel}</button>
        </div>
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

            {/* 全劇長度總覽（初剪總長 + 精剪總長，各集加總） */}
            <div style={s.lengthGrid} className="no-print rt-length-grid">
              <div style={s.statCard}>
                <p style={s.statLabel}>全劇初剪總長</p>
                <p style={s.statValue}>
                  {totals.roughcutTotalSecs > 0 ? secsToHMS(totals.roughcutTotalSecs) : '—'}
                </p>
              </div>
              <div style={s.statCard}>
                <p style={s.statLabel}>全劇精剪總長</p>
                <p style={s.statValue}>
                  {totals.finecutTotalSecs > 0 ? secsToHMS(totals.finecutTotalSecs) : '—'}
                </p>
              </div>
            </div>

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
                  <td>全劇初剪總長</td>
                  <td>{totals.roughcutTotalSecs > 0 ? secsToHMS(totals.roughcutTotalSecs) : '—'}</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>全劇精剪總長</td>
                  <td>{totals.finecutTotalSecs > 0 ? secsToHMS(totals.finecutTotalSecs) : '—'}</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>總計</td>
                  <td>—</td>
                  <td>{totals.roughcutScenes + totals.finecutScenes} / {totals.validScenes}</td>
                  <td>{totals.validScenes > 0 ? (((totals.roughcutScenes + totals.finecutScenes) / totals.validScenes) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
                <tr>
                  <td>初剪頁數</td>
                  <td colSpan={3}>{totals.roughcutPages.toFixed(1)} 頁　・　頁均時長 {globalAvgPageDur}</td>
                </tr>
              </tbody>
            </table>

            {/* 統計卡片 */}
            <div style={s.statGrid} className="stat-grid-screen">
              {(() => {
                const combinedPct = totals.validScenes > 0 ? (totals.roughcutScenes + totals.finecutScenes) / totals.validScenes : 0
                const combinedCount = totals.roughcutScenes + totals.finecutScenes
                return (
                  <div style={s.statCard}>
                    <p style={s.statLabel}>總計</p>
                    <div style={s.statRow}>
                      <p style={s.statValue}>{Math.round(combinedPct * 100)}%</p>
                      <div style={s.statRight}>
                        <div style={s.statBarRow}>
                          <div style={s.barTrack}>
                            <div style={{ ...s.barFill, width: `${Math.min(combinedPct * 100, 100)}%`, background: '#E5E5E5' }} />
                          </div>
                          <span style={s.statSubValue}>{combinedCount} / {totals.validScenes} 場</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
              <div style={s.statCard}>
                <p style={s.statLabel}>初剪頁數</p>
                <div style={s.statRow}>
                  <p style={s.statValue}>
                    {totals.roughcutPages.toFixed(1)}
                    <span style={s.statUnit}>頁</span>
                  </p>
                  <div style={{ ...s.statRight, justifyContent: 'flex-end' }}>
                    <span style={s.statSubValue}>頁均 {globalAvgPageDur}</span>
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
                      <span>初剪 {st.roughcutTotalSecs > 0 ? secsToHMS(st.roughcutTotalSecs) : '—'}</span>
                      <span>精剪 {(finecutTotalSecsByEp[row.episode] ?? 0) > 0 ? secsToHMS(finecutTotalSecsByEp[row.episode]) : '—'}</span>
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
                  <span>初剪 {totals.roughcutTotalSecs > 0 ? secsToHMS(totals.roughcutTotalSecs) : '—'}</span>
                  <span>精剪 {totals.finecutTotalSecs > 0 ? secsToHMS(totals.finecutTotalSecs) : '—'}</span>
                  <span>頁均 {globalAvgPageDur}</span>
                </div>
              </div>
            </div>

            {/* 全劇完整場次表（僅列印時顯示） */}
            <div className="print-only pdf-allscenes-wrap">
              {eps.map((ep, epIdx) => {
                const epScenes = scenes?.[ep.episode] ?? []
                const st = ep.stats
                return (
                  <section key={ep.episode} style={epIdx > 0 ? { pageBreakBefore: 'always' } : undefined}>
                    <div className="pdf-allscenes-ep-head">
                      <span className="pdf-allscenes-ep-title">{ep.episode}</span>
                      <span className="pdf-allscenes-ep-meta">
                        已初剪 {(st.roughcutPct * 100).toFixed(1)}%　・
                        已精剪 {(st.finecutPct * 100).toFixed(1)}%　・
                        場次 {st.totalScenes}　・
                        初剪 {st.roughcutTotalSecs > 0 ? secsToHMS(st.roughcutTotalSecs) : '—'}　・
                        精剪 {(finecutTotalSecsByEp[ep.episode] ?? 0) > 0 ? secsToHMS(finecutTotalSecsByEp[ep.episode]) : '—'}
                      </span>
                    </div>
                    {epScenes.length === 0 ? (
                      <p className="pdf-allscenes-empty">（此集尚無場次資料）</p>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            {DASH_SCENE_COL_DEFS.map(c => (
                              <th key={c.key} className={`pdf-col-${c.key}`}>{c.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {epScenes.map((sc, i) => (
                            <tr key={i}>
                              <td className="pdf-col-sceneNum">{sc.scene || '—'}</td>
                              <td className="pdf-col-roughcutLength">{sc.roughcutLength || '—'}</td>
                              <td className="pdf-col-pages">{sc.pages || '—'}</td>
                              <td className="pdf-col-date">{sc.roughcutDate || '—'}</td>
                              <td className="pdf-col-status">
                                <span className={STATUS_PRINT_CLASS[sc.status] ?? ''}>{sc.status || '—'}</span>
                              </td>
                              <td className="pdf-col-missingShots" style={{ textAlign: 'center' }}>
                                {sc.missingShots === 'Y' ? 'Y' : '—'}
                              </td>
                              <td className="pdf-col-notes">{sc.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                )
              })}
            </div>

            {/* 桌機進度表格（手機隱藏，但列印時仍需要） */}
            <div style={s.tableWrap} className="hide-on-mobile pdf-dash-table">
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
                    const epFineTotalSecs = finecutTotalSecsByEp[row.episode] ?? 0
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
                        <td style={s.td} className="pdf-col-roughTotalSecs">{st.roughcutTotalSecs > 0 ? secsToHMS(st.roughcutTotalSecs) : '—'}</td>
                        <td style={s.td} className="pdf-col-fineTotalSecs">{epFineTotalSecs > 0 ? secsToHMS(epFineTotalSecs) : '—'}</td>
                        <td style={s.td} className="pdf-col-roughScenes">{st.roughcutScenes}</td>
                        <td style={s.td} className="pdf-col-fineScenes">{st.finecutScenes}</td>
                        <td style={s.td} className="pdf-col-totalScenes">{st.totalScenes}</td>
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
                    <td className="pdf-col-roughTotalSecs" style={{ ...s.td, fontWeight: 600 }}>{totals.roughcutTotalSecs > 0 ? secsToHMS(totals.roughcutTotalSecs) : '—'}</td>
                    <td className="pdf-col-fineTotalSecs" style={{ ...s.td, fontWeight: 600 }}>{totals.finecutTotalSecs > 0 ? secsToHMS(totals.finecutTotalSecs) : '—'}</td>
                    <td className="pdf-col-roughScenes" style={{ ...s.td, fontWeight: 600 }}>{totals.roughcutScenes}</td>
                    <td className="pdf-col-fineScenes" style={{ ...s.td, fontWeight: 600 }}>{totals.finecutScenes}</td>
                    <td className="pdf-col-totalScenes" style={{ ...s.td, fontWeight: 600 }}>{totals.totalScenes}</td>
                    <td className="pdf-col-roughPages" style={{ ...s.td, fontWeight: 600 }}>{totals.roughcutPages > 0 ? totals.roughcutPages.toFixed(1) : '—'}</td>
                    <td className="pdf-col-avgPage" style={{ ...s.td, fontWeight: 600 }}>{globalAvgPageDur}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html:
        (printMode === 'summary'
          ? buildHideSummaryCSS(pdfSummaryOpts) + '\n@media print { .pdf-allscenes-wrap { display: none !important; } }'
          : buildHideScenesCSS(pdfScenesOpts) + '\n@media print { .print-summary, .pdf-dash-table { display: none !important; } }')
      }} />

      {showExportPDF && (
        <ExportPDFModal
          modes={[
            {
              key: 'summary',
              label: '全劇進度摘要',
              fieldDefs: DASH_PDF_SUMMARY_FIELDS,
              defaults: pdfSummaryOpts,
            },
            {
              key: 'allScenes',
              label: '全劇完整場次表',
              fieldDefs: DASH_SCENE_COL_DEFS,
              defaults: pdfScenesOpts,
            },
          ]}
          onClose={() => setShowExportPDF(false)}
          onConfirm={(modeKey, opts) => {
            if (modeKey === 'summary') setPdfSummaryOpts(opts)
            else setPdfScenesOpts(opts)
            setPrintMode(modeKey as 'summary' | 'allScenes')
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
    borderBottom: '1px solid var(--border)',
  },
  navInner: {
    position: 'relative',
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
    padding: '16px 40px',
    maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box',
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
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20,
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
  lengthGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16,
    alignItems: 'stretch',
  },
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
