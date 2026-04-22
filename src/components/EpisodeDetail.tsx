import { useRef, useState } from 'react'
import { getDataService } from '../services'
import type { SceneRow } from '../types'
import {
  secsToHMS, normalizeScene, computeEpisodeStats,
  finecutMetaKey,
} from '../lib/stats'
import { sortScenes, scenesOrderChanged } from '../lib/sceneSort'
import type { EpisodesCache } from '../hooks/useEpisodesCache'
import BatchImport from './BatchImport'
import ExportMD from './ExportMD'
import ExportCSV from './ExportCSV'
import ErrorView from './ErrorView'
import ExportPDFModal from './ExportPDFModal'
import SceneTable, { EP_COL_DEFS, EP_PDF_FIELDS, EP_PDF_DEFAULTS } from './SceneTable'
import SummaryBar from './SummaryBar'
import FinecutTotalInline from './FinecutTotalInline'
import { STUDIO_NAME } from '../config/sheets'
import { getTabNames, projectTitle, hasSummaryTab } from '../config/projectConfig'
import { useProject } from '../contexts/ProjectContext'

interface Props {
  episode: string
  token: string
  cache: EpisodesCache
  onNavigate: (ep: string) => void
  onOpenQuick: () => void
  onBack: () => void
  backLabel?: string
}

function buildEpHideCSS(opts: Record<string, boolean>): string {
  const hiddenCols = EP_COL_DEFS.filter(c => !opts[c.key]).map(c => `.pdf-col-${c.key}`)
  const parts: string[] = []
  if (hiddenCols.length > 0) {
    parts.push(`${hiddenCols.join(', ')} { display: none !important; }`)
  }
  if (!opts.summary) {
    parts.push(`.pdf-summary { display: none !important; }`)
  }
  return parts.length > 0 ? `@media print { ${parts.join(' ')} }` : ''
}

export default function EpisodeDetail({ episode, token, cache, onNavigate, onOpenQuick, onBack, backLabel }: Props) {
  const { project } = useProject()
  const EPISODES = getTabNames(project)
  const IS_FILM = project.type === 'film'
  const [saving, setSaving] = useState(false)
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [showExportMD, setShowExportMD] = useState(false)
  const [showExportCSV, setShowExportCSV] = useState(false)
  const [showExportPDF, setShowExportPDF] = useState(false)
  const [pdfOpts, setPdfOpts] = useState<Record<string, boolean>>(EP_PDF_DEFAULTS)
  const tabScrollRef = useRef<HTMLDivElement>(null)

  const scenes = cache.scenes?.[episode] ?? []
  const loading = cache.loading && !cache.scenes
  const error = cache.error

  function scrollTabs(dir: 'left' | 'right') {
    if (tabScrollRef.current) {
      tabScrollRef.current.scrollBy({ left: dir === 'left' ? -120 : 120, behavior: 'smooth' })
    }
  }

  function syncSummary(rows: SceneRow[]) {
    if (!hasSummaryTab(project)) return
    getDataService(token).updateSummaryRow(project, episode, computeEpisodeStats(rows)).catch(() => {})
  }

  async function handleUpdateScene(i: number, draft: SceneRow) {
    setSaving(true)
    try {
      const svc = getDataService(token)
      const cleaned = normalizeScene(draft)
      await svc.updateScene(project, episode, i, cleaned)
      const replaced = scenes.map((r, idx) => idx === i ? cleaned : r)
      const sorted = sortScenes(replaced)
      if (scenesOrderChanged(replaced, sorted)) {
        const updates = sorted.map((scene, rowIndex) => ({ rowIndex, scene }))
        await svc.batchUpdateScenes(project, episode, updates).catch(() => {})
      }
      cache.setEpisodeScenes(episode, () => sorted)
      syncSummary(sorted)
    } catch (e: unknown) {
      alert('儲存失敗：' + (e instanceof Error ? e.message : String(e)))
      throw e
    } finally {
      setSaving(false)
    }
  }

  async function handleAppendScene(scene: SceneRow) {
    setSaving(true)
    try {
      const svc = getDataService(token)
      const cleaned = normalizeScene(scene)
      await svc.appendScene(project, episode, cleaned)
      const appended = [...scenes, cleaned]
      const sorted = sortScenes(appended)
      if (scenesOrderChanged(appended, sorted)) {
        const updates = sorted.map((sc, rowIndex) => ({ rowIndex, scene: sc }))
        await svc.batchUpdateScenes(project, episode, updates).catch(() => {})
      }
      cache.setEpisodeScenes(episode, () => sorted)
      syncSummary(sorted)
    } catch (e: unknown) {
      alert('新增失敗：' + (e instanceof Error ? e.message : String(e)))
      throw e
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteScene(i: number) {
    setSaving(true)
    try {
      await getDataService(token).deleteScene(project, episode, i)
      const updated = scenes.filter((_, idx) => idx !== i)
      cache.setEpisodeScenes(episode, () => updated)
      syncSummary(updated)
    } catch (e: unknown) {
      alert('刪除失敗：' + (e instanceof Error ? e.message : String(e)))
      throw e
    } finally {
      setSaving(false)
    }
  }

  async function handleBatchUpdateStatus(rowIndices: number[], newStatus: string) {
    setSaving(true)
    try {
      const updates = rowIndices.map(idx => ({
        rowIndex: idx,
        scene: { ...scenes[idx], status: newStatus },
      }))
      await getDataService(token).batchUpdateScenes(project, episode, updates)
      const targetSet = new Set(rowIndices)
      const updated = scenes.map((r, i) =>
        targetSet.has(i) ? { ...r, status: newStatus } : r,
      )
      cache.setEpisodeScenes(episode, () => updated)
      syncSummary(updated)
    } catch (e: unknown) {
      alert('批次更新失敗：' + (e instanceof Error ? e.message : String(e)))
      throw e
    } finally {
      setSaving(false)
    }
  }

  async function handleBatchDeleteScenes(rowIndices: number[]) {
    setSaving(true)
    try {
      await getDataService(token).batchDeleteScenes(project, episode, rowIndices)
      const targetSet = new Set(rowIndices)
      const updated = scenes.filter((_, i) => !targetSet.has(i))
      cache.setEpisodeScenes(episode, () => updated)
      syncSummary(updated)
    } catch (e: unknown) {
      alert('批次刪除失敗：' + (e instanceof Error ? e.message : String(e)))
      throw e
    } finally {
      setSaving(false)
    }
  }

  async function handleBatchImportScenes(newScenes: SceneRow[]) {
    const svc = getDataService(token)
    for (const sc of newScenes) {
      await svc.appendScene(project, episode, sc)
    }
    const appended = [...scenes, ...newScenes]
    const sorted = sortScenes(appended)
    if (scenesOrderChanged(appended, sorted)) {
      const updates = sorted.map((sc, rowIndex) => ({ rowIndex, scene: sc }))
      await svc.batchUpdateScenes(project, episode, updates).catch(() => {})
    }
    cache.setEpisodeScenes(episode, () => sorted)
    syncSummary(sorted)
  }

  const stats = computeEpisodeStats(scenes)
  const printDate = new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const totalSecs = stats.roughcutSecs + stats.finecutSecs
  const combinedPct = stats.validScenes > 0 ? (stats.roughcutScenes + stats.finecutScenes) / stats.validScenes : 0

  const finecutKey = finecutMetaKey(episode)
  const finecutTotalRaw = cache.meta[finecutKey] ?? ''

  async function handleSaveFinecutTotal(next: string) {
    await cache.setMetaValue(finecutKey, next)
  }

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav} className="no-print rt-nav">
        <div style={s.navInner} className="rt-nav-inner">
          {IS_FILM ? (
            <button style={s.logoutBtn} onClick={onBack}>{backLabel ?? '登出'}</button>
          ) : (
            <button style={s.backBtn} onClick={onBack}>{backLabel ?? '← 返回'}</button>
          )}
          <div style={s.navTitleBox}>
            <span style={s.navTitle} className="rt-nav-title">Roughcut Tracker</span>
            <span style={s.navSub} className="rt-nav-sub">{projectTitle(project)}</span>
          </div>
        </div>
      </nav>

      {/* 快速輸入入口（置於所有內容最上方，電影/劇集模式皆適用） */}
      {!loading && !error && (
        <div style={s.quickBannerWrap} className="no-print rt-quick-banner-wrap">
          <button
            className="rt-quick-banner"
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
        </div>
      )}

      {/* 長度總覽（初剪總長 + 精剪總長 inline 編輯） */}
      {!loading && !error && (
        <div style={s.lengthBarWrap} className="no-print rt-length-bar-wrap">
          <div style={s.lengthGrid} className="rt-length-grid">
            <div style={s.statCard}>
              <p style={s.statLabel}>初剪總長</p>
              <p style={s.statValue}>
                {stats.roughcutTotalSecs > 0 ? secsToHMS(stats.roughcutTotalSecs) : '—'}
              </p>
            </div>
            <div style={s.statCard}>
              <FinecutTotalInline
                value={finecutTotalRaw}
                onSave={handleSaveFinecutTotal}
                label="精剪總長"
              />
            </div>
          </div>
        </div>
      )}

      {!IS_FILM && (
        <div style={s.tabBar} className="no-print rt-tabbar">
          <button style={s.scrollBtn} onClick={() => scrollTabs('left')}>‹</button>
          <div ref={tabScrollRef} style={s.tabs}>
            {EPISODES.map(ep => (
              <button
                key={ep}
                style={{ ...s.tab, ...(ep === episode ? s.tabActive : {}) }}
                onClick={() => onNavigate(ep)}
              >
                {ep}
              </button>
            ))}
          </div>
          <button style={s.scrollBtn} onClick={() => scrollTabs('right')}>›</button>
        </div>
      )}

      {IS_FILM && !loading && !error && (
        <SummaryBar stats={stats} />
      )}

      <main style={s.main} className="rt-main">
        {loading && <p style={s.msg}>載入中⋯</p>}
        {error && <ErrorView error={error} />}

        {!loading && !error && (
          <>
            {/* 列印頁首 */}
            <div className="print-only print-header">
              <div className="print-header-row1">
                <span className="print-studio">{STUDIO_NAME}</span>
                <span className="print-meta">列印日期：{printDate}</span>
              </div>
              <h1 className="print-title">
                {projectTitle(project)}剪輯進度報告{IS_FILM ? '' : `（${episode}）`}
              </h1>
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
                  <td>{secsToHMS(stats.roughcutSecs)}</td>
                  <td>{stats.roughcutScenes} / {stats.validScenes}</td>
                  <td>{(stats.roughcutPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>已精剪</td>
                  <td>{secsToHMS(stats.finecutSecs)}</td>
                  <td>{stats.finecutScenes} / {stats.validScenes}</td>
                  <td>{(stats.finecutPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>總計</td>
                  <td>{secsToHMS(totalSecs)}</td>
                  <td>{stats.roughcutScenes + stats.finecutScenes} / {stats.validScenes}</td>
                  <td>{(combinedPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>總頁數</td>
                  <td colSpan={3}>{stats.totalPages.toFixed(1)} 頁（{stats.validScenes} 場，不含整場刪除）</td>
                </tr>
              </tbody>
            </table>

            {/* 統計卡片（僅劇集模式） */}
            {!IS_FILM && (
              <div style={s.statGrid} className="stat-grid-screen">
                {[
                  { label: '已初剪', secs: stats.roughcutSecs, pct: stats.roughcutPct, count: stats.roughcutScenes, color: '#FFC107' },
                  { label: '已精剪', secs: stats.finecutSecs, pct: stats.finecutPct, count: stats.finecutScenes, color: '#4CAF50' },
                  {
                    label: '總計',
                    secs: stats.roughcutSecs + stats.finecutSecs,
                    pct: combinedPct,
                    count: stats.roughcutScenes + stats.finecutScenes,
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
                          <span style={s.statSubValue}>{c.count} / {stats.validScenes} 場</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={s.statCard}>
                  <p style={s.statLabel}>總頁數</p>
                  <div style={s.statRow}>
                    <p style={s.statValue}>
                      {stats.totalPages.toFixed(1)}
                      <span style={s.statUnit}>頁</span>
                    </p>
                    <div style={{ ...s.statRight, justifyContent: 'flex-end' }}>
                      <span style={s.statSubValue}>{stats.validScenes} 場（不含整場刪除）</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <SceneTable
              resetKey={episode}
              scenes={scenes}
              saving={saving}
              onUpdateScene={handleUpdateScene}
              onAppendScene={handleAppendScene}
              onDeleteScene={handleDeleteScene}
              onBatchUpdateStatus={handleBatchUpdateStatus}
              onBatchDeleteScenes={handleBatchDeleteScenes}
              onOpenBatchImport={() => setShowBatchImport(true)}
              onOpenExportMD={() => setShowExportMD(true)}
              onOpenExportCSV={() => setShowExportCSV(true)}
              onOpenExportPDF={() => setShowExportPDF(true)}
            />
          </>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: buildEpHideCSS(pdfOpts) }} />

      {showExportPDF && (
        <ExportPDFModal
          modes={[{
            key: 'summary',
            label: '場次明細',
            fieldDefs: EP_PDF_FIELDS,
            defaults: pdfOpts,
          }]}
          onClose={() => setShowExportPDF(false)}
          onConfirm={(_modeKey, opts) => {
            setPdfOpts(opts)
            setShowExportPDF(false)
            window.setTimeout(() => window.print(), 80)
          }}
        />
      )}

      {showBatchImport && (
        <BatchImport
          episode={episode}
          existingScenes={scenes}
          onClose={() => setShowBatchImport(false)}
          onImport={handleBatchImportScenes}
        />
      )}

      {showExportMD && (
        <ExportMD
          episode={episode}
          scenes={scenes}
          stats={stats}
          onClose={() => setShowExportMD(false)}
        />
      )}

      {showExportCSV && (
        <ExportCSV
          episode={episode}
          scenes={scenes}
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
  backBtn: {
    padding: '5px 12px', background: 'transparent', color: '#555',
    border: '1px solid #333', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0,
    fontSize: 12,
  },
  logoutBtn: {
    padding: '7px 16px', background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
  },
  tabBar: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '8px 40px', borderBottom: '1px solid var(--border)', overflow: 'hidden',
    maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box',
  },
  scrollBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
    fontSize: 18, padding: '0 6px', flexShrink: 0,
  },
  tabs: {
    display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none',
    flex: 1,
  },
  tab: {
    padding: '6px 14px', background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid transparent', borderRadius: 6, whiteSpace: 'nowrap', fontSize: 13,
  },
  tabActive: {
    background: 'var(--card-bg)', color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  },
  main: { padding: '20px 40px', maxWidth: 1400, margin: '0 auto' },
  quickBannerWrap: { padding: '12px 40px 0', maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' },
  lengthBarWrap: { padding: '12px 40px 0', maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' },
  lengthGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
    alignItems: 'stretch',
  },
  quickBanner: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', padding: '14px 18px',
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
  msg: { color: 'var(--text-secondary)', textAlign: 'center', marginTop: 60 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16, alignItems: 'stretch' },
  statCard: {
    background: '#1C1C1C', border: '1px solid #2A2A2A',
    borderRadius: 4, padding: '14px 18px',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  },
  statLabel: { fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 },
  statRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  statValue: { fontSize: 20, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)', whiteSpace: 'nowrap' },
  statUnit: { fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 4 },
  statRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, gap: 6, minWidth: 0 },
  statPct: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 },
  statBarRow: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' },
  statSubValue: { fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', lineHeight: 1 },
  barTrack: { background: '#2A2A2A', borderRadius: 2, height: 4, flex: 1, minWidth: 0, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, transition: 'width 0.3s ease' },
}
