import { useEffect, useRef, useState } from 'react'
import {
  updateScene, appendScene, deleteScene,
  batchUpdateScenes, updateSummaryRow,
} from '../services/sheetsService'
import type { SceneRow } from '../types'
import {
  secsToHMS, formatRoughcutLength, formatDate, normalizeScene, computeEpisodeStats, todayYMD,
} from '../lib/stats'
import { sortScenes, scenesOrderChanged } from '../lib/sceneSort'
import type { EpisodesCache } from '../hooks/useEpisodesCache'
import BatchImport from './BatchImport'
import ExportMD from './ExportMD'
import ExportCSV from './ExportCSV'
import ErrorView from './ErrorView'
import { SHOW_NAME } from '../config/sheets'

interface Props {
  episode: string
  token: string
  cache: EpisodesCache
  onNavigate: (ep: string) => void
  onBack: () => void
}

const EPISODES = Array.from({ length: 12 }, (_, i) => `ep${String(i + 1).padStart(2, '0')}`)

const FORM_STATUS_LIST = ['已精剪', '已初剪', '整場刪除'] as const
type Status = '已精剪' | '已初剪' | '尚缺鏡頭' | '整場刪除' | ''

const STATUS_COLOR: Record<string, string> = {
  已精剪: '#4CAF50',
  已初剪: '#FFC107',
  尚缺鏡頭: '#FF9800',
  整場刪除: '#555555',
}

const FILTERS: { key: string; color?: string }[] = [
  { key: '全部' },
  { key: '已精剪', color: STATUS_COLOR['已精剪'] },
  { key: '已初剪', color: STATUS_COLOR['已初剪'] },
  { key: '尚缺鏡頭', color: STATUS_COLOR['尚缺鏡頭'] },
  { key: '整場刪除', color: STATUS_COLOR['整場刪除'] },
  { key: '有備註', color: '#60a5fa' },
]

const EMPTY_SCENE: SceneRow = { scene: '', roughcutLength: '', pages: '', roughcutDate: '', status: '', missingShots: '', notes: '' }

const BATCH_ACTIONS: { label: string; value: string }[] = [
  { label: '已初剪', value: '已初剪' },
  { label: '已精剪', value: '已精剪' },
  { label: '整場刪除', value: '整場刪除' },
  { label: '清除狀態', value: '' },
]

export default function EpisodeDetail({ episode, token, cache, onNavigate, onBack }: Props) {
  const [editRow, setEditRow] = useState<number | null>(null)
  const [draft, setDraft] = useState<SceneRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<string>('全部')
  const [search, setSearch] = useState('')
  const [showAddRow, setShowAddRow] = useState(false)
  const [newScene, setNewScene] = useState<SceneRow>(EMPTY_SCENE)
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [showExportMD, setShowExportMD] = useState(false)
  const [showExportCSV, setShowExportCSV] = useState(false)
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set())
  const [showBatchMenu, setShowBatchMenu] = useState(false)
  const tabScrollRef = useRef<HTMLDivElement>(null)
  const batchMenuRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef<SceneRow | null>(null)

  useEffect(() => { draftRef.current = draft }, [draft])

  const scenes = cache.scenes?.[episode] ?? []
  const loading = cache.loading && !cache.scenes
  const error = cache.error

  useEffect(() => {
    setEditRow(null)
    setShowAddRow(false)
    setFilter('全部')
    setSearch('')
    setSelectedScenes(new Set())
    setShowBatchMenu(false)
  }, [episode])

  useEffect(() => {
    if (!showBatchMenu) return
    function onDocClick(e: MouseEvent) {
      if (batchMenuRef.current && !batchMenuRef.current.contains(e.target as Node)) {
        setShowBatchMenu(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showBatchMenu])

  function scrollTabs(dir: 'left' | 'right') {
    if (tabScrollRef.current) {
      tabScrollRef.current.scrollBy({ left: dir === 'left' ? -120 : 120, behavior: 'smooth' })
    }
  }

  function startEdit(i: number) {
    const base = scenes[i]
    setEditRow(i)
    setDraft({
      ...base,
      roughcutDate: base.roughcutDate || todayYMD(),
    })
    setShowAddRow(false)
  }

  function cancelEdit() {
    setEditRow(null)
    setDraft(null)
  }

  function syncSummary(rows: SceneRow[]) {
    updateSummaryRow(episode, computeEpisodeStats(rows), token).catch(() => {})
  }

  async function saveEdit(i: number, draftOverride?: SceneRow): Promise<SceneRow[] | null> {
    const currentDraft = draftOverride ?? draftRef.current
    if (!currentDraft) return null
    setSaving(true)
    try {
      const cleaned = normalizeScene(currentDraft)
      await updateScene(episode, i, cleaned, token)
      const replaced = scenes.map((r, idx) => idx === i ? cleaned : r)
      const sorted = sortScenes(replaced)
      setEditRow(null)
      setDraft(null)
      if (scenesOrderChanged(replaced, sorted)) {
        const updates = sorted.map((scene, rowIndex) => ({ rowIndex, scene }))
        await batchUpdateScenes(episode, updates, token).catch(() => {})
      }
      cache.setEpisodeScenes(episode, () => sorted)
      syncSummary(sorted)
      return sorted
    } catch (e: unknown) {
      alert('儲存失敗：' + (e instanceof Error ? e.message : String(e)))
      return null
    } finally {
      setSaving(false)
    }
  }

  async function saveNew() {
    if (!newScene.scene) return
    setSaving(true)
    try {
      const cleaned = normalizeScene(newScene)
      await appendScene(episode, cleaned, token)
      const appended = [...scenes, cleaned]
      const sorted = sortScenes(appended)
      setNewScene(EMPTY_SCENE)
      setShowAddRow(false)
      if (scenesOrderChanged(appended, sorted)) {
        const updates = sorted.map((scene, rowIndex) => ({ rowIndex, scene }))
        await batchUpdateScenes(episode, updates, token).catch(() => {})
      }
      cache.setEpisodeScenes(episode, () => sorted)
      syncSummary(sorted)
    } catch (e: unknown) {
      alert('新增失敗：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  function cancelNew() {
    setShowAddRow(false)
    setNewScene(EMPTY_SCENE)
  }

  async function handleDelete(i: number) {
    if (!confirm(`確定刪除場次「${scenes[i].scene}」？`)) return
    setSaving(true)
    try {
      await deleteScene(episode, i, token)
      const updated = scenes.filter((_, idx) => idx !== i)
      if (editRow === i) setEditRow(null)
      const sceneKey = scenes[i].scene
      if (selectedScenes.has(sceneKey)) {
        const next = new Set(selectedScenes)
        next.delete(sceneKey)
        setSelectedScenes(next)
      }
      cache.setEpisodeScenes(episode, () => updated)
      syncSummary(updated)
    } catch (e: unknown) {
      alert('刪除失敗：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  async function handleBatchImportScenes(newScenes: SceneRow[]) {
    for (const sc of newScenes) {
      await appendScene(episode, sc, token)
    }
    const appended = [...scenes, ...newScenes]
    const sorted = sortScenes(appended)
    if (scenesOrderChanged(appended, sorted)) {
      const updates = sorted.map((scene, rowIndex) => ({ rowIndex, scene }))
      await batchUpdateScenes(episode, updates, token).catch(() => {})
    }
    cache.setEpisodeScenes(episode, () => sorted)
    syncSummary(sorted)
  }

  function editKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(i) }
    if (e.key === 'Escape') cancelEdit()
  }

  function newKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveNew() }
    if (e.key === 'Escape') cancelNew()
  }

  function toggleSelectScene(sceneKey: string) {
    setSelectedScenes(prev => {
      const next = new Set(prev)
      if (next.has(sceneKey)) next.delete(sceneKey)
      else next.add(sceneKey)
      return next
    })
  }

  function toggleSelectAll() {
    const allKeys = filteredScenes.map(r => r.scene)
    const allSelected = allKeys.length > 0 && allKeys.every(k => selectedScenes.has(k))
    if (allSelected) {
      setSelectedScenes(prev => {
        const next = new Set(prev)
        allKeys.forEach(k => next.delete(k))
        return next
      })
    } else {
      setSelectedScenes(prev => {
        const next = new Set(prev)
        allKeys.forEach(k => next.add(k))
        return next
      })
    }
  }

  async function handleBatchStatus(newStatus: string) {
    setShowBatchMenu(false)
    const targets = scenes
      .map((r, i) => ({ row: r, idx: i }))
      .filter(x => selectedScenes.has(x.row.scene))
    if (targets.length === 0) return
    const statusLabel = newStatus || '清除狀態'
    if (!confirm(`確定將 ${targets.length} 個場次改為 ${statusLabel}？`)) return
    setSaving(true)
    try {
      const updates = targets.map(({ row, idx }) => ({
        rowIndex: idx,
        scene: { ...row, status: newStatus },
      }))
      await batchUpdateScenes(episode, updates, token)
      const updated = scenes.map(r =>
        selectedScenes.has(r.scene) ? { ...r, status: newStatus } : r
      )
      cache.setEpisodeScenes(episode, () => updated)
      syncSummary(updated)
      setSelectedScenes(new Set())
    } catch (e: unknown) {
      alert('批次更新失敗：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  const stats = computeEpisodeStats(scenes)
  const roughcutPct = Math.round(stats.roughcutPct * 100)
  const finecutPct = Math.round(stats.finecutPct * 100)

  const filteredScenes = (() => {
    let result = scenes
    if (filter === '尚缺鏡頭') result = result.filter(r => r.missingShots === 'Y')
    else if (filter === '有備註') result = result.filter(r => r.notes && r.notes.trim() !== '')
    else if (filter !== '全部') result = result.filter(r => r.status === filter)
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(r =>
        r.scene.toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      )
    }
    return result
  })()

  const selectedCount = selectedScenes.size
  const visibleKeys = filteredScenes.map(r => r.scene)
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(k => selectedScenes.has(k))
  const someVisibleSelected = visibleKeys.some(k => selectedScenes.has(k))

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <button style={s.backBtn} onClick={onBack}>← 返回總覽</button>
        <div style={s.navTitleBox}>
          <span style={s.navTitle}>Roughcut Tracker</span>
          <span style={s.navSub}>劇集《{SHOW_NAME}》</span>
        </div>
      </nav>
      <div style={s.tabBar}>
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

      <main style={s.main}>
        {loading && <p style={s.msg}>載入中⋯</p>}
        {error && <ErrorView error={error} />}

        {!loading && !error && (
          <>
            {/* 統計卡片 */}
            <div style={s.statGrid}>
              {[
                { label: '已初剪', secs: stats.roughcutSecs, pct: stats.roughcutPct, count: stats.roughcutScenes, color: '#FFC107' },
                { label: '已精剪', secs: stats.finecutSecs, pct: stats.finecutPct, count: stats.finecutScenes, color: '#4CAF50' },
                {
                  label: '總計',
                  secs: stats.roughcutSecs + stats.finecutSecs,
                  pct: stats.validScenes > 0 ? (stats.roughcutScenes + stats.finecutScenes) / stats.validScenes : 0,
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
                  <p style={s.statValue}>{stats.totalPages.toFixed(1)} 頁</p>
                  <div style={s.statRight}>
                    <span style={s.statSubValue}>{stats.validScenes} 場（不含整場刪除）</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 篩選列 + 操作按鈕 */}
            <div style={s.toolbar}>
              <div style={s.filters}>
                {FILTERS.map(f => (
                  <button
                    key={f.key}
                    style={{ ...s.filterBtn, ...(filter === f.key ? s.filterActive : {}) }}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.color && (
                      <span style={{ ...s.dot, background: f.color }} />
                    )}
                    {f.key}
                  </button>
                ))}
                <div style={s.searchBox}>
                  <input
                    style={s.searchInput}
                    placeholder="搜尋場次號或備註⋯"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button style={s.searchClear} onClick={() => setSearch('')}>✕</button>
                  )}
                </div>
                {selectedCount > 0 && (
                  <div style={s.batchWrap} ref={batchMenuRef}>
                    <button
                      style={s.batchBtn}
                      onClick={() => setShowBatchMenu(v => !v)}
                      disabled={saving}
                    >
                      批次修改狀態（{selectedCount}）
                    </button>
                    {showBatchMenu && (
                      <div style={s.batchMenu}>
                        {BATCH_ACTIONS.map(a => (
                          <button
                            key={a.label}
                            style={s.batchMenuItem}
                            onClick={() => handleBatchStatus(a.value)}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={s.actions}>
                <button style={s.actionBtn} onClick={() => setShowBatchImport(true)}>批次匯入</button>
                <button style={s.actionBtn} onClick={() => setShowExportMD(true)}>匯出 MD</button>
                <button style={s.actionBtn} onClick={() => setShowExportCSV(true)}>匯出 CSV</button>
                <button style={s.actionBtn} onClick={() => { setShowAddRow(true); setEditRow(null) }}>+ 新增場次</button>
              </div>
            </div>

            <div style={{ marginTop: 12 }} />

            {/* 空白提示 */}
            {!showAddRow && scenes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{ marginBottom: 16, fontSize: 13, color: '#555555' }}>此集尚無場次資料</p>
                <button style={s.actionBtn} onClick={() => { setShowAddRow(true); setEditRow(null) }}>+ 新增第一個場次</button>
              </div>
            )}

            {/* 場次表格 */}
            {(scenes.length > 0 || showAddRow) && (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, width: 36, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          ref={el => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected }}
                          onChange={toggleSelectAll}
                          style={{ accentColor: '#fff', width: 14, height: 14, cursor: 'pointer' }}
                        />
                      </th>
                      {['場次', '長度', '頁數', '日期', '狀態', '缺鏡', '備註', '操作'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScenes.map((row, rawIdx) => {
                      const i = scenes.indexOf(row)
                      const isEditing = editRow === i
                      const data = isEditing && draft ? draft : row
                      const statusColor = STATUS_COLOR[data.status] ?? '#555'
                      const isSelected = selectedScenes.has(row.scene)

                      return (
                        <tr key={i} style={{ background: rawIdx % 2 === 0 ? 'var(--card-bg)' : '#161616' }}>
                          {/* 勾選欄 */}
                          <td
                            style={{ ...s.td, textAlign: 'center', width: 36 }}
                            onClick={e => { e.stopPropagation(); toggleSelectScene(row.scene) }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectScene(row.scene)}
                              onClick={e => e.stopPropagation()}
                              style={{ accentColor: '#fff', width: 14, height: 14, cursor: 'pointer' }}
                            />
                          </td>
                          {isEditing ? (
                            <>
                              <td style={s.td}>
                                <input style={s.input} value={draft?.scene ?? ''}
                                  onChange={e => setDraft(d => d ? { ...d, scene: e.target.value } : d)}
                                  onKeyDown={e => editKeyDown(e, i)}
                                />
                              </td>
                              <td style={s.td}>
                                <input style={s.input} value={draft?.roughcutLength ?? ''}
                                  onChange={e => setDraft(d => d ? { ...d, roughcutLength: e.target.value } : d)}
                                  onBlur={e => setDraft(d => d ? { ...d, roughcutLength: formatRoughcutLength(e.target.value) } : d)}
                                  onKeyDown={e => editKeyDown(e, i)}
                                />
                              </td>
                              <td style={s.td}>
                                <input style={s.input} value={draft?.pages ?? ''}
                                  onChange={e => setDraft(d => d ? { ...d, pages: e.target.value } : d)}
                                  onKeyDown={e => editKeyDown(e, i)}
                                />
                              </td>
                              <td style={s.td}>
                                <input style={s.input} placeholder="YYYY/MM/DD" value={draft?.roughcutDate ?? ''}
                                  onChange={e => setDraft(d => d ? { ...d, roughcutDate: e.target.value } : d)}
                                  onBlur={e => setDraft(d => d ? { ...d, roughcutDate: formatDate(e.target.value) } : d)}
                                  onKeyDown={e => editKeyDown(e, i)}
                                />
                              </td>
                              <td style={s.td}>
                                <select style={s.input} value={draft?.status ?? ''}
                                  onChange={e => setDraft(d => d ? { ...d, status: e.target.value as Status } : d)}
                                  onKeyDown={e => editKeyDown(e, i)}
                                >
                                  <option value="">—</option>
                                  {FORM_STATUS_LIST.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                              </td>
                              <td style={{ ...s.td, textAlign: 'center' }}>
                                <input type="checkbox"
                                  checked={draft?.missingShots === 'Y'}
                                  onChange={e => setDraft(d => d ? { ...d, missingShots: e.target.checked ? 'Y' : '' } : d)}
                                  style={{ accentColor: '#FF9800', width: 14, height: 14 }} />
                              </td>
                              <td style={s.td}>
                                <input style={s.input} value={draft?.notes ?? ''}
                                  onChange={e => setDraft(d => d ? { ...d, notes: e.target.value } : d)}
                                  onKeyDown={e => editKeyDown(e, i)}
                                />
                              </td>
                              <td style={s.td} onClick={e => e.stopPropagation()}>
                                <button style={s.saveBtn} onClick={() => saveEdit(i)} disabled={saving}>{saving ? '⋯' : '儲存'}</button>
                                <button style={s.cancelBtn} onClick={cancelEdit}>取消</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ ...s.td, color: 'var(--text-primary)', fontWeight: 500 }}>{row.scene}</td>
                              <td style={s.td}>{data.roughcutLength || '—'}</td>
                              <td style={s.td}>{data.pages || '—'}</td>
                              <td style={s.td}>{data.roughcutDate || '—'}</td>
                              <td style={s.td}>
                                <span style={s.statusCell}>
                                  <span style={{ ...s.dot, background: statusColor }} />
                                  <span style={{ color: statusColor }}>{data.status || '—'}</span>
                                </span>
                              </td>
                              <td style={{ ...s.td, textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-block', width: 14, height: 14, borderRadius: 3,
                                  border: `2px solid ${data.missingShots === 'Y' ? '#FF9800' : '#444'}`,
                                  background: data.missingShots === 'Y' ? '#FF9800' : 'transparent',
                                  verticalAlign: 'middle',
                                }} />
                              </td>
                              <td style={{ ...s.td, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.notes || '—'}</td>
                              <td style={s.td}>
                                <button style={s.editBtn} onClick={() => startEdit(i)}>編輯</button>
                                <button style={s.deleteBtn} onClick={() => handleDelete(i)}>刪除</button>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}

                    {/* 新增場次列 */}
                    {showAddRow && (
                      <tr style={{ background: '#111', outline: '1px solid var(--border)' }}>
                        <td style={{ ...s.td, width: 36 }} />
                        <td style={s.td}>
                          <input style={s.input} placeholder="場次" value={newScene.scene}
                            onChange={e => setNewScene(n => ({ ...n, scene: e.target.value }))}
                            onKeyDown={newKeyDown}
                            autoFocus />
                        </td>
                        <td style={s.td}>
                          <input style={s.input} value={newScene.roughcutLength}
                            onChange={e => setNewScene(n => ({ ...n, roughcutLength: e.target.value }))}
                            onBlur={e => setNewScene(n => ({ ...n, roughcutLength: formatRoughcutLength(e.target.value) }))}
                            onKeyDown={newKeyDown}
                          />
                        </td>
                        <td style={s.td}>
                          <input style={s.input} value={newScene.pages}
                            onChange={e => setNewScene(n => ({ ...n, pages: e.target.value }))}
                            onKeyDown={newKeyDown} />
                        </td>
                        <td style={s.td}>
                          <input style={s.input} placeholder="YYYY/MM/DD" value={newScene.roughcutDate}
                            onChange={e => setNewScene(n => ({ ...n, roughcutDate: e.target.value }))}
                            onBlur={e => setNewScene(n => ({ ...n, roughcutDate: formatDate(e.target.value) }))}
                            onKeyDown={newKeyDown}
                          />
                        </td>
                        <td style={s.td}>
                          <select style={s.input} value={newScene.status}
                            onChange={e => setNewScene(n => ({ ...n, status: e.target.value }))}
                            onKeyDown={newKeyDown}>
                            <option value="">—</option>
                            {FORM_STATUS_LIST.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <input type="checkbox"
                            checked={newScene.missingShots === 'Y'}
                            onChange={e => setNewScene(n => ({ ...n, missingShots: e.target.checked ? 'Y' : '' }))}
                            onKeyDown={newKeyDown}
                            style={{ accentColor: '#FF9800', width: 14, height: 14 }} />
                        </td>
                        <td style={s.td}>
                          <input style={s.input} value={newScene.notes}
                            onChange={e => setNewScene(n => ({ ...n, notes: e.target.value }))}
                            onKeyDown={newKeyDown} />
                        </td>
                        <td style={s.td}>
                          <button style={s.saveBtn} onClick={saveNew} disabled={!newScene.scene || saving}>
                            {saving ? '⋯' : '新增'}
                          </button>
                          <button style={s.cancelBtn} onClick={cancelNew}>取消</button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

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
          roughcutPct={roughcutPct}
          finecutPct={finecutPct}
          totalDuration={secsToHMS(stats.roughcutSecs)}
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
    position: 'relative',
    display: 'flex', alignItems: 'center',
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
  backBtn: {
    padding: '5px 12px', background: 'transparent', color: '#555',
    border: '1px solid #333', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0,
    fontSize: 12,
  },
  tabBar: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '8px 24px', borderBottom: '1px solid var(--border)', overflow: 'hidden',
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
  msg: { color: 'var(--text-secondary)', textAlign: 'center', marginTop: 60 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16, alignItems: 'stretch' },
  statCard: {
    background: '#1C1C1C', border: '1px solid #2A2A2A',
    borderRadius: 4, padding: '14px 18px',
    display: 'flex', flexDirection: 'column',
  },
  statLabel: { fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 },
  statRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  statValue: { fontSize: 20, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)', whiteSpace: 'nowrap' },
  statRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, gap: 6, minWidth: 0 },
  statPct: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 },
  statBarRow: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' },
  statSubValue: { fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', lineHeight: 1 },
  barTrack: { background: '#2A2A2A', borderRadius: 2, height: 4, flex: 1, minWidth: 0, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, transition: 'width 0.3s ease' },
  toolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 0, paddingBottom: 12, gap: 16, flexWrap: 'wrap',
    borderBottom: '1px solid #2A2A2A',
  },
  filters: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  filterBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)', borderRadius: 20, fontSize: 12,
  },
  filterActive: {
    background: 'var(--card-bg)', color: 'var(--text-primary)',
    border: '1px solid #555',
  },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  searchBox: {
    position: 'relative', display: 'flex', alignItems: 'center',
    marginLeft: 6,
  },
  searchInput: {
    background: '#111', border: '1px solid var(--border)', borderRadius: 20,
    color: 'var(--text-primary)', padding: '6px 28px 6px 12px', fontSize: 12,
    width: 180, outline: 'none',
  },
  searchClear: {
    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
    background: 'transparent', border: 'none', color: '#666', fontSize: 11,
    cursor: 'pointer', padding: 2,
  },
  batchWrap: { position: 'relative', marginLeft: 6 },
  batchBtn: {
    padding: '6px 14px', background: '#1e3a5f', color: '#60a5fa',
    border: '1px solid #2a5082', borderRadius: 20, fontSize: 12, cursor: 'pointer',
  },
  batchMenu: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
    background: '#1A1A1A', border: '1px solid #333', borderRadius: 6,
    display: 'flex', flexDirection: 'column', minWidth: 140,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  },
  batchMenuItem: {
    padding: '8px 14px', background: 'transparent', color: '#ccc',
    border: 'none', textAlign: 'left', fontSize: 12, cursor: 'pointer',
  },
  actions: { display: 'flex', gap: 8 },
  actionBtn: {
    padding: '7px 14px', background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)', borderRadius: 6, fontSize: 13,
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 14px', color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)', fontWeight: 500, whiteSpace: 'nowrap', fontSize: 12,
  },
  td: {
    padding: '11px 14px', color: 'var(--text-secondary)',
    borderBottom: '1px solid #1a1a1a', whiteSpace: 'nowrap', verticalAlign: 'middle',
  },
  statusCell: { display: 'flex', alignItems: 'center', gap: 6 },
  input: {
    background: '#111', border: '1px solid #333', borderRadius: 6,
    color: 'var(--text-primary)', padding: '5px 8px', width: '100%', minWidth: 80,
  },
  editBtn: {
    padding: '4px 10px', background: 'transparent', color: '#60a5fa',
    border: '1px solid #1e3a5f', borderRadius: 4, fontSize: 12, marginRight: 4,
  },
  deleteBtn: {
    padding: '4px 10px', background: 'transparent', color: '#888',
    border: '1px solid #333', borderRadius: 4, fontSize: 12,
  },
  saveBtn: {
    padding: '4px 10px', background: '#14532d', color: 'var(--color-finecut)',
    border: 'none', borderRadius: 4, fontSize: 12, marginRight: 6,
  },
  cancelBtn: {
    padding: '4px 10px', background: 'transparent', color: '#666',
    border: '1px solid #333', borderRadius: 4, fontSize: 12,
  },
}
