import { useEffect, useRef, useState } from 'react'
import type { SceneRow } from '../types'
import { formatRoughcutLength, formatDate, todayYMD } from '../lib/stats'
import { useIsMobile } from '../hooks/useMediaQuery'

const FORM_STATUS_LIST = ['已精剪', '已初剪', '整場刪除'] as const
type Status = '已精剪' | '已初剪' | '尚缺鏡頭' | '整場刪除' | ''

const STATUS_COLOR: Record<string, string> = {
  已精剪: '#4CAF50',
  已初剪: '#FFC107',
  尚缺鏡頭: '#FF9800',
  整場刪除: '#555555',
}

const STATUS_PRINT_CLASS: Record<string, string> = {
  已精剪: 'print-status-finecut',
  已初剪: 'print-status-roughcut',
  尚缺鏡頭: 'print-status-missing',
  整場刪除: 'print-status-deleted',
}

const FILTERS: { key: string; color?: string }[] = [
  { key: '全部' },
  { key: '已精剪', color: STATUS_COLOR['已精剪'] },
  { key: '已初剪', color: STATUS_COLOR['已初剪'] },
  { key: '尚缺鏡頭', color: STATUS_COLOR['尚缺鏡頭'] },
  { key: '整場刪除', color: STATUS_COLOR['整場刪除'] },
  { key: '有備註', color: '#60a5fa' },
]

const EMPTY_SCENE: SceneRow = {
  scene: '', roughcutLength: '', pages: '',
  roughcutDate: '', status: '', missingShots: '', notes: '',
}

const BATCH_ACTIONS: { label: string; value: string }[] = [
  { label: '已初剪', value: '已初剪' },
  { label: '已精剪', value: '已精剪' },
  { label: '整場刪除', value: '整場刪除' },
  { label: '清除狀態', value: '' },
]

export const EP_COL_DEFS: { key: string; label: string }[] = [
  { key: 'sceneNum', label: '場次' },
  { key: 'roughcutLength', label: '長度' },
  { key: 'pages', label: '頁數' },
  { key: 'date', label: '日期' },
  { key: 'status', label: '狀態' },
  { key: 'missingShots', label: '缺鏡' },
  { key: 'notes', label: '備註' },
]

export const EP_PDF_FIELDS: { key: string; label: string }[] = [
  { key: 'summary', label: '統計摘要' },
  ...EP_COL_DEFS,
]

export const EP_PDF_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  EP_PDF_FIELDS.map(f => [f.key, true]),
)

function ymdToIso(ymd: string): string {
  if (!ymd) return ''
  const m = ymd.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (!m) return ''
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

function isoToYmd(iso: string): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${m[1]}/${m[2]}/${m[3]}`
}

interface Props {
  resetKey: string
  scenes: SceneRow[]
  saving: boolean
  onUpdateScene: (rowIndex: number, scene: SceneRow) => Promise<void>
  onAppendScene: (scene: SceneRow) => Promise<void>
  onDeleteScene: (rowIndex: number) => Promise<void>
  onBatchUpdateStatus: (rowIndices: number[], newStatus: string) => Promise<void>
  onBatchDeleteScenes: (rowIndices: number[]) => Promise<void>
  onOpenBatchImport: () => void
  onOpenExportMD: () => void
  onOpenExportCSV: () => void
  onOpenExportPDF: () => void
}

export default function SceneTable({
  resetKey, scenes, saving,
  onUpdateScene, onAppendScene, onDeleteScene,
  onBatchUpdateStatus, onBatchDeleteScenes,
  onOpenBatchImport, onOpenExportMD, onOpenExportCSV, onOpenExportPDF,
}: Props) {
  const isMobile = useIsMobile()
  const [editRow, setEditRow] = useState<number | null>(null)
  const [draft, setDraft] = useState<SceneRow | null>(null)
  const [filter, setFilter] = useState<string>('全部')
  const [search, setSearch] = useState('')
  const [showAddRow, setShowAddRow] = useState(false)
  const [newScene, setNewScene] = useState<SceneRow>(EMPTY_SCENE)
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set())
  const [showBatchMenu, setShowBatchMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const batchMenuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef<SceneRow | null>(null)

  useEffect(() => { draftRef.current = draft }, [draft])

  useEffect(() => {
    setEditRow(null)
    setShowAddRow(false)
    setFilter('全部')
    setSearch('')
    setSelectedScenes(new Set())
    setShowBatchMenu(false)
    setShowMobileMenu(false)
  }, [resetKey])

  useEffect(() => {
    if (!showBatchMenu && !showMobileMenu) return
    function onDocClick(e: MouseEvent) {
      if (batchMenuRef.current && !batchMenuRef.current.contains(e.target as Node)) {
        setShowBatchMenu(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showBatchMenu, showMobileMenu])

  // Bottom sheet 打開時鎖住 body 捲動
  useEffect(() => {
    const sheetOpen = isMobile && (editRow !== null || showAddRow)
    if (!sheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isMobile, editRow, showAddRow])

  function startEdit(i: number) {
    const base = scenes[i]
    setEditRow(i)
    setDraft({ ...base, roughcutDate: base.roughcutDate || todayYMD() })
    setShowAddRow(false)
  }

  function cancelEdit() {
    setEditRow(null)
    setDraft(null)
  }

  async function saveEdit(i: number) {
    const currentDraft = draftRef.current
    if (!currentDraft) return
    try {
      await onUpdateScene(i, currentDraft)
      setEditRow(null)
      setDraft(null)
    } catch {
      // 父層已顯示錯誤
    }
  }

  async function saveNew() {
    if (!newScene.scene) return
    try {
      await onAppendScene(newScene)
      setNewScene(EMPTY_SCENE)
      setShowAddRow(false)
    } catch {
      // 父層已顯示錯誤
    }
  }

  function cancelNew() {
    setShowAddRow(false)
    setNewScene(EMPTY_SCENE)
  }

  function openAdd() {
    setEditRow(null)
    setDraft(null)
    setNewScene({ ...EMPTY_SCENE, roughcutDate: todayYMD() })
    setShowAddRow(true)
  }

  async function handleDelete(i: number) {
    if (!confirm(`確定刪除場次「${scenes[i].scene}」？`)) return
    try {
      await onDeleteScene(i)
      const sceneKey = scenes[i].scene
      if (editRow === i) { setEditRow(null); setDraft(null) }
      if (selectedScenes.has(sceneKey)) {
        const next = new Set(selectedScenes)
        next.delete(sceneKey)
        setSelectedScenes(next)
      }
    } catch {
      // 父層已顯示錯誤
    }
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

  const filteredScenes = (() => {
    let result = scenes
    if (filter === '尚缺鏡頭') result = result.filter(r => r.missingShots === 'Y')
    else if (filter === '有備註') result = result.filter(r => r.notes && r.notes.trim() !== '')
    else if (filter !== '全部') result = result.filter(r => r.status === filter)
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(r =>
        r.scene.toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q),
      )
    }
    return result
  })()

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
    try {
      await onBatchUpdateStatus(targets.map(t => t.idx), newStatus)
      setSelectedScenes(new Set())
    } catch {
      // 父層已顯示錯誤
    }
  }

  async function handleBatchDelete() {
    const targets = scenes
      .map((r, i) => ({ row: r, idx: i }))
      .filter(x => selectedScenes.has(x.row.scene))
    if (targets.length === 0) return
    if (!confirm(`確定刪除 ${targets.length} 個場次？此操作無法復原。`)) return
    try {
      await onBatchDeleteScenes(targets.map(t => t.idx))
      if (editRow !== null && selectedScenes.has(scenes[editRow].scene)) setEditRow(null)
      setSelectedScenes(new Set())
    } catch {
      // 父層已顯示錯誤
    }
  }

  const selectedCount = selectedScenes.size
  const visibleKeys = filteredScenes.map(r => r.scene)
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(k => selectedScenes.has(k))
  const someVisibleSelected = visibleKeys.some(k => selectedScenes.has(k))

  if (isMobile) {
    return (
      <MobileView
        filteredScenes={filteredScenes}
        scenes={scenes}
        selectedScenes={selectedScenes}
        toggleSelectScene={toggleSelectScene}
        filter={filter}
        setFilter={setFilter}
        search={search}
        setSearch={setSearch}
        selectedCount={selectedCount}
        onStartEdit={(i) => startEdit(i)}
        onOpenAdd={openAdd}
        onClearSelection={() => setSelectedScenes(new Set())}
        onBatchStatus={handleBatchStatus}
        onBatchDelete={handleBatchDelete}
        saving={saving}
        showMobileMenu={showMobileMenu}
        setShowMobileMenu={setShowMobileMenu}
        mobileMenuRef={mobileMenuRef}
        onOpenBatchImport={onOpenBatchImport}
        onOpenExportMD={onOpenExportMD}
        onOpenExportCSV={onOpenExportCSV}
        onOpenExportPDF={onOpenExportPDF}
        editRow={editRow}
        draft={draft}
        setDraft={setDraft}
        onSaveEdit={saveEdit}
        onCancelEdit={cancelEdit}
        onDeleteEdit={handleDelete}
        showAddRow={showAddRow}
        newScene={newScene}
        setNewScene={setNewScene}
        onSaveNew={saveNew}
        onCancelNew={cancelNew}
      />
    )
  }

  return (
    <>
      {/* 篩選列 + 操作按鈕 */}
      <div style={s.toolbar} className="no-print">
        <div style={s.filters}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              style={{ ...s.filterBtn, ...(filter === f.key ? s.filterActive : {}) }}
              onClick={() => setFilter(f.key)}
            >
              {f.color && <span style={{ ...s.dot, background: f.color }} />}
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
            <>
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
              <button
                style={s.batchDeleteBtn}
                onClick={handleBatchDelete}
                disabled={saving}
              >
                批次刪除（{selectedCount}）
              </button>
            </>
          )}
        </div>
        <div style={s.actions}>
          <button style={s.actionBtn} onClick={onOpenBatchImport}>批次匯入</button>
          <button style={s.actionBtn} onClick={onOpenExportMD}>匯出 MD</button>
          <button style={s.actionBtn} onClick={onOpenExportCSV}>匯出 CSV</button>
          <button style={s.actionBtn} onClick={onOpenExportPDF}>匯出 PDF</button>
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
          <table style={s.table} className="data-table">
            <thead>
              <tr>
                <th style={{ ...s.th, width: 36, textAlign: 'center' }} className="no-print">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={el => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected }}
                    onChange={toggleSelectAll}
                    style={{ accentColor: '#fff', width: 14, height: 14, cursor: 'pointer' }}
                  />
                </th>
                {EP_COL_DEFS.map(c => (
                  <th key={c.key} style={s.th} className={`pdf-col-${c.key}`}>{c.label}</th>
                ))}
                <th style={s.th} className="no-print">操作</th>
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
                    <td
                      className="no-print"
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
                        <td style={s.td} className="no-print" onClick={e => e.stopPropagation()}>
                          <button style={s.saveBtn} onClick={() => saveEdit(i)} disabled={saving}>{saving ? '⋯' : '儲存'}</button>
                          <button style={s.cancelBtn} onClick={cancelEdit}>取消</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="pdf-col-sceneNum" style={{ ...s.td, color: 'var(--text-primary)', fontWeight: 500 }}>{row.scene}</td>
                        <td className="pdf-col-roughcutLength" style={s.td}>{data.roughcutLength || '—'}</td>
                        <td className="pdf-col-pages" style={s.td}>{data.pages || '—'}</td>
                        <td className="pdf-col-date" style={s.td}>{data.roughcutDate || '—'}</td>
                        <td className="pdf-col-status" style={s.td}>
                          <span style={s.statusCell}>
                            <span className="no-print" style={{ ...s.dot, background: statusColor }} />
                            <span className={STATUS_PRINT_CLASS[data.status] ?? ''} style={{ color: statusColor }}>{data.status || '—'}</span>
                          </span>
                        </td>
                        <td className="pdf-col-missingShots" style={{ ...s.td, textAlign: 'center' }}>
                          <span className="no-print" style={{
                            display: 'inline-block', width: 14, height: 14, borderRadius: 3,
                            border: `2px solid ${data.missingShots === 'Y' ? '#FF9800' : '#444'}`,
                            background: data.missingShots === 'Y' ? '#FF9800' : 'transparent',
                            verticalAlign: 'middle',
                          }} />
                          <span className="print-only">{data.missingShots === 'Y' ? 'Y' : '—'}</span>
                        </td>
                        <td className="pdf-col-notes" style={{ ...s.td, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.notes || '—'}</td>
                        <td style={s.td} className="no-print">
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
                <tr className="no-print" style={{ background: '#111', outline: '1px solid var(--border)' }}>
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
  )
}

/* =========================================================================
 *  Mobile
 * ========================================================================= */

interface MobileProps {
  filteredScenes: SceneRow[]
  scenes: SceneRow[]
  selectedScenes: Set<string>
  toggleSelectScene: (sceneKey: string) => void
  filter: string
  setFilter: (f: string) => void
  search: string
  setSearch: (s: string) => void
  selectedCount: number
  onStartEdit: (i: number) => void
  onOpenAdd: () => void
  onClearSelection: () => void
  onBatchStatus: (value: string) => void
  onBatchDelete: () => void
  saving: boolean
  showMobileMenu: boolean
  setShowMobileMenu: (v: boolean) => void
  mobileMenuRef: React.RefObject<HTMLDivElement | null>
  onOpenBatchImport: () => void
  onOpenExportMD: () => void
  onOpenExportCSV: () => void
  onOpenExportPDF: () => void
  editRow: number | null
  draft: SceneRow | null
  setDraft: React.Dispatch<React.SetStateAction<SceneRow | null>>
  onSaveEdit: (i: number) => Promise<void>
  onCancelEdit: () => void
  onDeleteEdit: (i: number) => Promise<void>
  showAddRow: boolean
  newScene: SceneRow
  setNewScene: React.Dispatch<React.SetStateAction<SceneRow>>
  onSaveNew: () => Promise<void>
  onCancelNew: () => void
}

function MobileView(p: MobileProps) {
  const editing = p.editRow !== null && p.draft !== null
  const sheetOpen = editing || p.showAddRow

  return (
    <>
      {/* 搜尋 */}
      <div style={{ marginBottom: 8 }} className="no-print">
        <div style={m.searchBox}>
          <input
            style={m.searchInput}
            placeholder="搜尋場次號或備註⋯"
            value={p.search}
            onChange={e => p.setSearch(e.target.value)}
          />
          {p.search && (
            <button style={m.searchClear} onClick={() => p.setSearch('')}>✕</button>
          )}
        </div>
      </div>

      {/* 篩選 pills（橫向捲動） */}
      <div style={m.filterRow} className="no-print">
        {FILTERS.map(f => (
          <button
            key={f.key}
            style={{ ...m.filterBtn, ...(p.filter === f.key ? m.filterActive : {}) }}
            onClick={() => p.setFilter(f.key)}
          >
            {f.color && <span style={{ ...m.dot, background: f.color }} />}
            {f.key}
          </button>
        ))}
        <div style={m.moreWrap} ref={p.mobileMenuRef}>
          <button style={m.moreBtn} onClick={() => p.setShowMobileMenu(!p.showMobileMenu)}>⋯</button>
          {p.showMobileMenu && (
            <div style={m.moreMenu}>
              <button style={m.moreItem} onClick={() => { p.setShowMobileMenu(false); p.onOpenBatchImport() }}>批次匯入</button>
              <button style={m.moreItem} onClick={() => { p.setShowMobileMenu(false); p.onOpenExportMD() }}>匯出 MD</button>
              <button style={m.moreItem} onClick={() => { p.setShowMobileMenu(false); p.onOpenExportCSV() }}>匯出 CSV</button>
              <button style={m.moreItem} onClick={() => { p.setShowMobileMenu(false); p.onOpenExportPDF() }}>匯出 PDF</button>
            </div>
          )}
        </div>
      </div>

      {/* 批次工具列 */}
      {p.selectedCount > 0 && (
        <div className="mobile-batch-bar no-print">
          <span>已選 {p.selectedCount}</span>
          <span className="mobile-batch-spacer" />
          <button onClick={() => p.onBatchStatus('已初剪')} disabled={p.saving}>→ 已初剪</button>
          <button onClick={() => p.onBatchStatus('已精剪')} disabled={p.saving}>→ 已精剪</button>
          <button onClick={p.onBatchDelete} disabled={p.saving} style={{ borderColor: '#f87171', color: '#fca5a5' }}>刪除</button>
          <button onClick={p.onClearSelection}>取消</button>
        </div>
      )}

      {/* 卡片列表 */}
      {p.scenes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0 120px', color: '#555', fontSize: 13 }}>
          此集尚無場次資料，點右下角 + 新增第一個場次
        </div>
      ) : p.filteredScenes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#555', fontSize: 13 }}>
          沒有符合的場次
        </div>
      ) : (
        <div className="mobile-scene-list" style={{ paddingBottom: 100 }}>
          {p.filteredScenes.map(row => {
            const i = p.scenes.indexOf(row)
            const statusColor = STATUS_COLOR[row.status] ?? '#555'
            const isSelected = p.selectedScenes.has(row.scene)
            return (
              <div
                key={i}
                className="mobile-card"
                onClick={() => p.onStartEdit(i)}
                style={isSelected ? { outline: '2px solid #60a5fa' } : undefined}
              >
                <div className="mobile-card-head">
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="mobile-card-select"
                      checked={isSelected}
                      onChange={() => p.toggleSelectScene(row.scene)}
                    />
                    <span className="mobile-card-title">{row.scene}</span>
                  </label>
                  <span className="mobile-card-status">
                    <span className="mobile-card-dot" style={{ background: statusColor }} />
                    <span style={{ color: statusColor }}>{row.status || '—'}</span>
                  </span>
                </div>
                <div className="mobile-card-meta">
                  <span>長度 {row.roughcutLength || '—'}</span>
                  <span>頁數 {row.pages || '—'}</span>
                  <span>{row.roughcutDate || '—'}</span>
                </div>
                {(row.missingShots === 'Y' || (row.notes && row.notes.trim() !== '')) && (
                  <div className="mobile-card-flags">
                    {row.missingShots === 'Y' && <span className="mobile-flag mobile-flag-missing">缺鏡</span>}
                    {row.notes && row.notes.trim() !== '' && (
                      <span className="mobile-flag mobile-flag-notes" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        備註：{row.notes}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* FAB */}
      <button className="fab no-print" onClick={p.onOpenAdd} aria-label="新增場次">+</button>

      {/* Bottom sheet */}
      {sheetOpen && (
        <SceneFormSheet
          title={editing ? '編輯場次' : '新增場次'}
          saving={p.saving}
          value={editing ? p.draft! : p.newScene}
          onChange={(patch) => {
            if (editing) p.setDraft(d => d ? { ...d, ...patch } : d)
            else p.setNewScene(n => ({ ...n, ...patch }))
          }}
          onSave={async () => {
            if (editing) await p.onSaveEdit(p.editRow!)
            else await p.onSaveNew()
          }}
          onCancel={() => {
            if (editing) p.onCancelEdit()
            else p.onCancelNew()
          }}
          onDelete={editing ? () => p.onDeleteEdit(p.editRow!) : undefined}
        />
      )}
    </>
  )
}

/* =========================================================================
 *  Bottom Sheet 表單
 * ========================================================================= */

interface SheetProps {
  title: string
  saving: boolean
  value: SceneRow
  onChange: (patch: Partial<SceneRow>) => void
  onSave: () => Promise<void>
  onCancel: () => void
  onDelete?: () => void | Promise<void>
}

function SceneFormSheet({ title, saving, value, onChange, onSave, onCancel, onDelete }: SheetProps) {
  const canSave = !!value.scene && !saving

  return (
    <div className="bottom-sheet-backdrop no-print" onClick={onCancel}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-header">
          <span className="bottom-sheet-title">{title}</span>
          <button className="bottom-sheet-close" onClick={onCancel} aria-label="關閉">✕</button>
        </div>

        <div className="bottom-sheet-body">
          <div className="form-field">
            <label className="form-field-label">場次</label>
            <input
              className="form-field-input"
              value={value.scene}
              onChange={e => onChange({ scene: e.target.value })}
              placeholder="例：12 或 12A"
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-field-label">初剪長度（HH:MM:SS）</label>
            <input
              className="form-field-input"
              value={value.roughcutLength}
              inputMode="numeric"
              placeholder="直接打 6 位數字，例 013045 → 01:30:45"
              onChange={e => onChange({ roughcutLength: e.target.value })}
              onBlur={e => onChange({ roughcutLength: formatRoughcutLength(e.target.value) })}
            />
          </div>

          <div className="form-field">
            <label className="form-field-label">頁數</label>
            <input
              className="form-field-input"
              value={value.pages}
              inputMode="decimal"
              placeholder="例：2.5"
              onChange={e => onChange({ pages: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label className="form-field-label">日期</label>
            <input
              className="form-field-input"
              type="date"
              value={ymdToIso(value.roughcutDate)}
              onChange={e => onChange({ roughcutDate: isoToYmd(e.target.value) })}
            />
          </div>

          <div className="form-field">
            <label className="form-field-label">狀態</label>
            <select
              className="form-field-select"
              value={value.status}
              onChange={e => onChange({ status: e.target.value })}
            >
              <option value="">—</option>
              {FORM_STATUS_LIST.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <label className="form-field-check">
            <input
              type="checkbox"
              checked={value.missingShots === 'Y'}
              onChange={e => onChange({ missingShots: e.target.checked ? 'Y' : '' })}
            />
            <span>尚缺鏡頭</span>
          </label>

          <div className="form-field">
            <label className="form-field-label">備註</label>
            <textarea
              className="form-field-input"
              value={value.notes ?? ''}
              rows={3}
              onChange={e => onChange({ notes: e.target.value })}
              style={{ resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }}
            />
          </div>
        </div>

        <div className="bottom-sheet-footer">
          {onDelete && (
            <button className="bottom-sheet-delete" onClick={onDelete} disabled={saving}>
              刪除
            </button>
          )}
          <button className="bottom-sheet-cancel" onClick={onCancel}>取消</button>
          <button className="bottom-sheet-save" onClick={onSave} disabled={!canSave}>
            {saving ? '儲存中⋯' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
 *  Styles
 * ========================================================================= */

const s: Record<string, React.CSSProperties> = {
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
  searchBox: { position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 6 },
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
  batchDeleteBtn: {
    padding: '6px 14px', marginLeft: 6, background: 'transparent', color: '#f87171',
    border: '1px solid #f87171', borderRadius: 20, fontSize: 12, cursor: 'pointer',
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

const m: Record<string, React.CSSProperties> = {
  searchBox: { position: 'relative', display: 'flex', alignItems: 'center', width: '100%' },
  searchInput: {
    background: '#0b0b0b', border: '1px solid var(--border)', borderRadius: 10,
    color: 'var(--text-primary)', padding: '10px 32px 10px 14px', fontSize: 14,
    width: '100%', outline: 'none', boxSizing: 'border-box',
  },
  searchClear: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'transparent', border: 'none', color: '#666', fontSize: 14,
    cursor: 'pointer', padding: 4,
  },
  filterRow: {
    display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10,
    paddingBottom: 4, scrollbarWidth: 'none',
  },
  filterBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
    padding: '8px 14px', background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)', borderRadius: 20, fontSize: 13, whiteSpace: 'nowrap',
  },
  filterActive: {
    background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid #555',
  },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  moreWrap: { position: 'relative', marginLeft: 'auto', flexShrink: 0 },
  moreBtn: {
    padding: '6px 14px', background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)', borderRadius: 20, fontSize: 16, lineHeight: 1,
  },
  moreMenu: {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
    background: '#1A1A1A', border: '1px solid #333', borderRadius: 8,
    display: 'flex', flexDirection: 'column', minWidth: 140,
    boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
  },
  moreItem: {
    padding: '10px 16px', background: 'transparent', color: '#ddd',
    border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer',
  },
}
