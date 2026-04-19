import { useEffect, useRef, useState } from 'react'
import {
  fetchEpisode, updateScene, appendScene, deleteScene,
  batchUpdateScenes, updateSummaryRow,
} from '../services/sheetsService'
import type { SceneRow } from '../types'
import {
  secsToHMS, formatRoughcutLength, formatDate, normalizeScene, computeEpisodeStats,
} from '../lib/stats'
import BatchImport from './BatchImport'
import ExportMD from './ExportMD'
import ExportCSV from './ExportCSV'

interface Props {
  episode: string
  token: string
  onNavigate: (ep: string) => void
  onBack: () => void
}

const EPISODES = Array.from({ length: 12 }, (_, i) => `ep${String(i + 1).padStart(2, '0')}`)

const STATUS_LIST = ['已精剪', '已初剪', '尚缺鏡頭', '整場刪除'] as const
const FORM_STATUS_LIST = ['已精剪', '已初剪', '整場刪除'] as const
type Status = typeof STATUS_LIST[number] | ''

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

export default function EpisodeDetail({ episode, token, onNavigate, onBack }: Props) {
  const [scenes, setScenes] = useState<SceneRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editRow, setEditRow] = useState<number | null>(null)
  const [draft, setDraft] = useState<SceneRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<string>('全部')
  const [showAddRow, setShowAddRow] = useState(false)
  const [newScene, setNewScene] = useState<SceneRow>(EMPTY_SCENE)
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [showExportMD, setShowExportMD] = useState(false)
  const [showExportCSV, setShowExportCSV] = useState(false)
  const tabScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    setEditRow(null)
    setShowAddRow(false)
    setFilter('全部')
    fetchEpisode(episode, token)
      .then(async data => {
        const normalized = data.map(normalizeScene)
        setScenes(normalized)
        const dirty = normalized
          .map((n, i) => (
            n.roughcutLength !== data[i].roughcutLength || n.roughcutDate !== data[i].roughcutDate
              ? { rowIndex: i, scene: n }
              : null
          ))
          .filter((x): x is { rowIndex: number; scene: SceneRow } => x !== null)
        if (dirty.length > 0) {
          await batchUpdateScenes(episode, dirty, token).catch(() => {})
        }
        await updateSummaryRow(episode, computeEpisodeStats(normalized), token).catch(() => {})
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [episode, token])

  function scrollTabs(dir: 'left' | 'right') {
    if (tabScrollRef.current) {
      tabScrollRef.current.scrollBy({ left: dir === 'left' ? -120 : 120, behavior: 'smooth' })
    }
  }

  function startEdit(i: number) {
    setEditRow(i)
    setDraft({ ...scenes[i] })
    setShowAddRow(false)
  }

  function cancelEdit() {
    setEditRow(null)
    setDraft(null)
  }

  function syncSummary(rows: SceneRow[]) {
    updateSummaryRow(episode, computeEpisodeStats(rows), token).catch(() => {})
  }

  async function saveEdit(i: number) {
    if (!draft) return
    setSaving(true)
    try {
      const cleaned = normalizeScene(draft)
      await updateScene(episode, i, cleaned, token)
      const updated = scenes.map((r, idx) => idx === i ? cleaned : r)
      setScenes(updated)
      setEditRow(null)
      syncSummary(updated)
    } catch (e: unknown) {
      alert('儲存失敗：' + (e instanceof Error ? e.message : String(e)))
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
      const updated = [...scenes, cleaned]
      setScenes(updated)
      setNewScene(EMPTY_SCENE)
      setShowAddRow(false)
      syncSummary(updated)
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
      setScenes(updated)
      if (editRow === i) setEditRow(null)
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
    const updated = [...scenes, ...newScenes]
    setScenes(updated)
    syncSummary(updated)
  }

  function editKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(i) }
    if (e.key === 'Escape') cancelEdit()
  }

  function newKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveNew() }
    if (e.key === 'Escape') cancelNew()
  }

  const stats = computeEpisodeStats(scenes)
  const roughcutPct = Math.round(stats.roughcutPct * 100)
  const finecutPct = Math.round(stats.finecutPct * 100)

  const filteredScenes = (() => {
    if (filter === '全部') return scenes
    if (filter === '尚缺鏡頭') return scenes.filter(r => r.missingShots === 'Y')
    if (filter === '有備註') return scenes.filter(r => r.notes && r.notes.trim() !== '')
    return scenes.filter(r => r.status === filter)
  })()

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <button style={s.backBtn} onClick={onBack}>← 返回總覽</button>
        <div style={s.tabRow}>
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
      </nav>

      <main style={s.main}>
        {loading && <p style={s.msg}>載入中⋯</p>}
        {error && <p style={{ ...s.msg, color: 'var(--color-missing)' }}>錯誤：{error}</p>}

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
                <button style={s.actionBtn} onClick={() => setShowAddRow(true)}>+ 新增第一個場次</button>
              </div>
            )}

            {/* 場次表格 */}
            {(scenes.length > 0 || showAddRow) && (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
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

                      return (
                        <tr key={i} style={{ background: rawIdx % 2 === 0 ? 'var(--card-bg)' : '#161616' }}>
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
                              <td style={s.td}>
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
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '12px 24px', borderBottom: '1px solid var(--border)',
  },
  backBtn: {
    padding: '5px 12px', background: 'transparent', color: '#555',
    border: '1px solid #333', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0,
    fontSize: 12,
  },
  tabRow: { display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', flex: 1 },
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
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16, alignItems: 'stretch' },
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
  filters: { display: 'flex', gap: 6, flexWrap: 'wrap' },
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
