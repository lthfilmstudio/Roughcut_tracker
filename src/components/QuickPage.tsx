import { useMemo, useState } from 'react'
import type { SceneRow } from '../types'
import { formatRoughcutLength, formatDate, normalizeScene, todayYMD, computeEpisodeStats } from '../lib/stats'
import { sortScenes, scenesOrderChanged } from '../lib/sceneSort'
import { getDataService } from '../services'
import { useProject } from '../contexts/ProjectContext'
import { getTabNames, hasSummaryTab, projectTitle } from '../config/projectConfig'
import type { EpisodesCache } from '../hooks/useEpisodesCache'

const STATUS_COLOR: Record<string, string> = {
  已初剪: '#FFC107',
  已精剪: '#4CAF50',
  整場刪除: '#555555',
}
const MISSING_COLOR = '#FF9800'

const FILTERS = [
  { key: '全部' },
  { key: '未處理' },
  { key: '已初剪', color: STATUS_COLOR['已初剪'] },
  { key: '已精剪', color: STATUS_COLOR['已精剪'] },
  { key: '尚缺鏡頭', color: MISSING_COLOR },
  { key: '整場刪除', color: STATUS_COLOR['整場刪除'] },
]

const EMPTY: SceneRow = {
  scene: '', roughcutLength: '', pages: '',
  roughcutDate: '', status: '', missingShots: '', notes: '',
}

interface Props {
  token: string
  cache: EpisodesCache
  onExit: () => void
  exitLabel?: string
}

export default function QuickPage({ token, cache, onExit, exitLabel = '← 返回總覽' }: Props) {
  const { project } = useProject()
  const episodes = useMemo(() => getTabNames(project), [project])
  const isFilm = project.type === 'film'

  const [ep, setEp] = useState<string | null>(isFilm ? episodes[0] : null)
  const [filter, setFilter] = useState<string>('全部')
  const [editing, setEditing] = useState<{ rowIndex: number | null; draft: SceneRow } | null>(null)
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState('')

  const scenes = ep ? (cache.scenes?.[ep] ?? []) : []

  function flash(msg: string) {
    setHint(msg)
    window.setTimeout(() => setHint(h => (h === msg ? '' : h)), 1200)
  }

  const filtered = useMemo(() => {
    if (filter === '全部') return scenes.map((r, i) => ({ r, i }))
    if (filter === '未處理') return scenes.map((r, i) => ({ r, i })).filter(({ r }) => !r.status && r.missingShots !== 'Y')
    if (filter === '尚缺鏡頭') return scenes.map((r, i) => ({ r, i })).filter(({ r }) => r.missingShots === 'Y')
    return scenes.map((r, i) => ({ r, i })).filter(({ r }) => r.status === filter)
  }, [scenes, filter])

  const counts = useMemo(() => ({
    全部: scenes.length,
    未處理: scenes.filter(r => !r.status && r.missingShots !== 'Y').length,
    已初剪: scenes.filter(r => r.status === '已初剪').length,
    已精剪: scenes.filter(r => r.status === '已精剪').length,
    尚缺鏡頭: scenes.filter(r => r.missingShots === 'Y').length,
    整場刪除: scenes.filter(r => r.status === '整場刪除').length,
  }), [scenes])

  function syncSummary(currentEp: string, rows: SceneRow[]) {
    if (!hasSummaryTab(project)) return
    getDataService(token).updateSummaryRow(project, currentEp, computeEpisodeStats(rows)).catch(() => {})
  }

  async function writeSceneAt(currentEp: string, rowIndex: number, scene: SceneRow, successMsg: string) {
    setSaving(true)
    try {
      const svc = getDataService(token)
      const cleaned = normalizeScene(scene)
      await svc.updateScene(project, currentEp, rowIndex, cleaned)
      const currentList = cache.scenes?.[currentEp] ?? []
      const replaced = currentList.map((r, i) => i === rowIndex ? cleaned : r)
      const sorted = sortScenes(replaced)
      if (scenesOrderChanged(replaced, sorted)) {
        const updates = sorted.map((sc, ri) => ({ rowIndex: ri, scene: sc }))
        await svc.batchUpdateScenes(project, currentEp, updates).catch(() => {})
      }
      const next = cache.setEpisodeScenes(currentEp, () => sorted)
      syncSummary(currentEp, next)
      flash(successMsg)
      return cleaned
    } catch (e: unknown) {
      alert('儲存失敗：' + (e instanceof Error ? e.message : String(e)))
      throw e
    } finally {
      setSaving(false)
    }
  }

  async function writeAppend(currentEp: string, scene: SceneRow) {
    setSaving(true)
    try {
      const svc = getDataService(token)
      const cleaned = normalizeScene(scene)
      await svc.appendScene(project, currentEp, cleaned)
      const currentList = cache.scenes?.[currentEp] ?? []
      const appended = [...currentList, cleaned]
      const sorted = sortScenes(appended)
      if (scenesOrderChanged(appended, sorted)) {
        const updates = sorted.map((sc, ri) => ({ rowIndex: ri, scene: sc }))
        await svc.batchUpdateScenes(project, currentEp, updates).catch(() => {})
      }
      const next = cache.setEpisodeScenes(currentEp, () => sorted)
      syncSummary(currentEp, next)
      flash('✓ 已新增場次')
    } catch (e: unknown) {
      alert('新增失敗：' + (e instanceof Error ? e.message : String(e)))
      throw e
    } finally {
      setSaving(false)
    }
  }

  async function handleQuickStatus(rowIndex: number, newStatus: string) {
    if (!ep) return
    const current = scenes[rowIndex]
    if (!current) return
    const updated: SceneRow = { ...current, status: newStatus }
    setEditing(prev => prev ? { ...prev, draft: updated } : prev)
    await writeSceneAt(ep, rowIndex, updated, newStatus ? `✓ ${newStatus}` : '✓ 已清除狀態')
  }

  async function handleQuickToggleMissing(rowIndex: number) {
    if (!ep) return
    const current = scenes[rowIndex]
    if (!current) return
    const nextFlag = current.missingShots === 'Y' ? '' : 'Y'
    const updated: SceneRow = { ...current, missingShots: nextFlag }
    setEditing(prev => prev ? { ...prev, draft: updated } : prev)
    await writeSceneAt(ep, rowIndex, updated, nextFlag === 'Y' ? '✓ 標記尚缺' : '✓ 取消尚缺')
  }

  async function handleSaveDetails() {
    if (!ep || !editing) return
    const draft = editing.draft
    const cleaned: SceneRow = {
      ...draft,
      roughcutLength: formatRoughcutLength(draft.roughcutLength),
      roughcutDate: draft.roughcutDate ? formatDate(draft.roughcutDate) : '',
    }
    if (editing.rowIndex == null) {
      if (!cleaned.scene.trim()) { alert('請填入場次編號'); return }
      await writeAppend(ep, cleaned)
    } else {
      await writeSceneAt(ep, editing.rowIndex, cleaned, '✓ 已儲存')
    }
    setEditing(null)
  }

  // -------- Episode picker (series only) --------
  if (!ep) {
    return (
      <div style={s.page}>
        <header style={s.header}>
          <button style={s.backBtn} onClick={onExit}>{exitLabel}</button>
          <div style={s.headerTitle}>
            <div style={s.headerMain}>快速輸入</div>
            <div style={s.headerSub}>{projectTitle(project)} · 選擇集數</div>
          </div>
          <span style={{ width: 60 }} />
        </header>
        <main style={s.list}>
          {episodes.map(e => {
            const rows = cache.scenes?.[e] ?? []
            const st = computeEpisodeStats(rows)
            const rp = Math.round(st.roughcutPct * 100)
            const fp = Math.round(st.finecutPct * 100)
            return (
              <button key={e} style={s.epItem} onClick={() => { setEp(e); setFilter('全部') }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={s.epName}>{e}</div>
                  <div style={s.epMeta}>
                    {rows.length > 0
                      ? <>初剪 {rp}%　精剪 {fp}%　{rows.length} 場</>
                      : '尚無資料'}
                  </div>
                </div>
                <span style={s.chev}>›</span>
              </button>
            )
          })}
        </main>
      </div>
    )
  }

  // -------- Scene list --------
  const stats = computeEpisodeStats(scenes)
  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => isFilm ? onExit() : setEp(null)}>
          {isFilm ? exitLabel : '‹'}
        </button>
        <div style={s.headerTitle}>
          <div style={s.headerMain}>{isFilm ? projectTitle(project) : `${project.name} · ${ep}`}</div>
          <div style={s.headerSub}>
            {scenes.length} 場　初剪 {Math.round(stats.roughcutPct * 100)}%　精剪 {Math.round(stats.finecutPct * 100)}%
          </div>
        </div>
        <span style={{ width: 60 }} />
      </header>

      {/* Filter chips */}
      <div style={s.filterBar}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            style={{ ...s.fChip, ...(filter === f.key ? s.fChipActive : {}) }}
            onClick={() => setFilter(f.key)}
          >
            {f.color && <span style={{ ...s.fDot, background: f.color }} />}
            {f.key} {counts[f.key as keyof typeof counts] ?? 0}
          </button>
        ))}
      </div>

      {/* Scene cards */}
      <main style={s.list}>
        {cache.loading && <p style={s.emptyMsg}>載入中⋯</p>}
        {!cache.loading && filtered.length === 0 && (
          <p style={s.emptyMsg}>沒有符合條件的場次</p>
        )}
        {filtered.map(({ r, i }) => {
          const color = STATUS_COLOR[r.status] ?? '#555'
          const hasNote = r.notes && r.notes.trim() !== ''
          const hasMissing = r.missingShots === 'Y'
          return (
            <button key={`${r.scene}-${i}`} style={s.card} onClick={() => setEditing({ rowIndex: i, draft: { ...r, roughcutDate: r.roughcutDate || todayYMD() } })}>
              <span style={{ ...s.dot, background: color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.row1}>
                  <span style={s.sceneName}>{r.scene || '—'}</span>
                  <span style={{ ...s.status, color }}>{r.status || '未處理'}</span>
                  {hasMissing && <span style={s.missFlag}>缺鏡</span>}
                </div>
                <div style={s.row2}>
                  <span>長度 {r.roughcutLength || '—'}</span>
                  <span>頁 {r.pages || '—'}</span>
                  {hasNote && <span style={s.noteFlag}>備註</span>}
                </div>
              </div>
            </button>
          )
        })}
        <div style={{ height: 80 }} />
      </main>

      {/* FAB */}
      <button
        style={s.fab}
        onClick={() => setEditing({ rowIndex: null, draft: { ...EMPTY, roughcutDate: todayYMD() } })}
      >＋</button>

      {/* Bottom sheet */}
      {editing && (
        <SheetEditor
          key={editing.rowIndex ?? 'new'}
          value={editing.draft}
          isNew={editing.rowIndex == null}
          saving={saving}
          onDraft={draft => setEditing(prev => prev ? { ...prev, draft } : prev)}
          onStatusChange={st => editing.rowIndex != null
            ? handleQuickStatus(editing.rowIndex, st)
            : setEditing(prev => prev ? { ...prev, draft: { ...prev.draft, status: st } } : prev)}
          onToggleMissing={() => editing.rowIndex != null
            ? handleQuickToggleMissing(editing.rowIndex)
            : setEditing(prev => prev ? {
                ...prev, draft: { ...prev.draft, missingShots: prev.draft.missingShots === 'Y' ? '' : 'Y' },
              } : prev)}
          onSave={handleSaveDetails}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Saved hint */}
      {hint && <div style={s.hint}>{hint}</div>}
    </div>
  )
}

interface EditorProps {
  value: SceneRow
  isNew: boolean
  saving: boolean
  onDraft: (v: SceneRow) => void
  onStatusChange: (status: string) => void
  onToggleMissing: () => void
  onSave: () => void
  onClose: () => void
}

function SheetEditor({ value, isNew, saving, onDraft, onStatusChange, onToggleMissing, onSave, onClose }: EditorProps) {
  function patch(p: Partial<SceneRow>) { onDraft({ ...value, ...p }) }
  const statusColor = STATUS_COLOR[value.status] ?? '#555'

  return (
    <>
      <div style={s.scrim} onClick={onClose} />
      <div style={s.sheet}>
        <div style={s.grab} />
        <div style={s.sheetHead}>
          <div>
            <div style={s.sheetTitle}>
              {value.scene || '新場次'}
              {!isNew && <span style={{ ...s.sheetStatus, color: statusColor, marginLeft: 10 }}>
                {value.status || '未處理'}
              </span>}
            </div>
            <div style={s.sheetSub}>{isNew ? '填完後按儲存' : '點狀態即時存'}</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.sheetBody}>
          {isNew && (
            <div style={s.field}>
              <label style={s.label}>場次編號</label>
              <input
                style={s.input}
                value={value.scene}
                autoFocus
                placeholder="S01 / 1A / 12-3"
                onChange={e => patch({ scene: e.target.value })}
              />
            </div>
          )}

          <div style={s.statusGrid}>
            {(['已初剪', '已精剪'] as const).map(st => (
              <button
                key={st}
                style={{
                  ...s.stBtn,
                  color: STATUS_COLOR[st],
                  borderColor: value.status === st ? STATUS_COLOR[st] : '#2a2a2a',
                  background: value.status === st ? '#2a2618' : '#1a1a1a',
                }}
                disabled={saving}
                onClick={() => onStatusChange(st)}
              >
                <span style={{ ...s.stDot, background: STATUS_COLOR[st] }} />{st}
              </button>
            ))}
            <button
              style={{
                ...s.stBtn,
                color: MISSING_COLOR,
                borderColor: value.missingShots === 'Y' ? MISSING_COLOR : '#2a2a2a',
                background: value.missingShots === 'Y' ? '#2a2112' : '#1a1a1a',
              }}
              disabled={saving}
              onClick={onToggleMissing}
            >
              <span style={{ ...s.stDot, background: MISSING_COLOR }} />尚缺鏡頭
            </button>
            <button
              style={{
                ...s.stBtn,
                color: STATUS_COLOR['整場刪除'],
                borderColor: value.status === '整場刪除' ? STATUS_COLOR['整場刪除'] : '#2a2a2a',
                background: value.status === '整場刪除' ? '#1f1f1f' : '#1a1a1a',
              }}
              disabled={saving}
              onClick={() => onStatusChange('整場刪除')}
            >
              <span style={{ ...s.stDot, background: STATUS_COLOR['整場刪除'] }} />整場刪除
            </button>
            <button
              style={{ ...s.stBtn, gridColumn: '1 / -1', color: '#888', borderStyle: 'dashed', fontWeight: 500, fontSize: 13, padding: '10px' }}
              disabled={saving}
              onClick={() => onStatusChange('')}
            >
              清除狀態
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>初剪長度</label>
              <input
                style={s.input}
                inputMode="numeric"
                placeholder="輸入數字即可"
                value={value.roughcutLength}
                onChange={e => patch({ roughcutLength: e.target.value })}
                onBlur={e => patch({ roughcutLength: formatRoughcutLength(e.target.value) })}
              />
              <div style={s.help}>例：打 230 → 0:02:30</div>
            </div>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>初剪日期</label>
              <input
                style={s.input}
                inputMode="numeric"
                placeholder="YYYY/MM/DD"
                value={value.roughcutDate}
                onChange={e => patch({ roughcutDate: e.target.value })}
                onBlur={e => patch({ roughcutDate: e.target.value ? formatDate(e.target.value) : '' })}
              />
              <div style={s.help}>預設今天，可改</div>
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>頁數</label>
            <input
              style={s.input}
              placeholder="1-3"
              value={value.pages}
              onChange={e => patch({ pages: e.target.value })}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>備註</label>
            <textarea
              style={{ ...s.input, minHeight: 70, resize: 'none' }}
              placeholder="空景、導演 note、補拍需求⋯"
              value={value.notes}
              onChange={e => patch({ notes: e.target.value })}
            />
          </div>
        </div>

        <div style={s.sheetFoot}>
          <button style={s.btnGhost} onClick={onClose} disabled={saving}>取消</button>
          <button style={s.btnPrimary} onClick={onSave} disabled={saving}>
            {saving ? '儲存中⋯' : (isNew ? '新增' : '儲存')}
          </button>
        </div>
      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-primary)',
    display: 'flex', flexDirection: 'column', position: 'relative',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0,
    background: 'var(--bg)', zIndex: 5,
  },
  backBtn: {
    padding: '6px 10px', background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)', borderRadius: 6, fontSize: 13,
    whiteSpace: 'nowrap', minWidth: 40,
  },
  headerTitle: { flex: 1, textAlign: 'center', minWidth: 0 },
  headerMain: {
    fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  headerSub: { fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 },
  filterBar: {
    display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 14px 12px',
    borderBottom: '1px solid var(--border)', scrollbarWidth: 'none',
  },
  fChip: {
    background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)',
    padding: '6px 12px', borderRadius: 999, fontSize: 12, whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
  },
  fChipActive: { background: '#2a2a2a', borderColor: '#3a3a3a' },
  fDot: { width: 8, height: 8, borderRadius: '50%' },
  list: { padding: '10px 14px 40px', flex: 1, overflowY: 'auto' },
  emptyMsg: { color: 'var(--text-secondary)', textAlign: 'center', marginTop: 40 },
  epItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12,
    padding: '14px 16px', marginBottom: 8, width: '100%',
    color: 'var(--text-primary)', textAlign: 'left',
  },
  epName: { fontSize: 15, fontWeight: 500 },
  epMeta: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  chev: { color: 'var(--text-secondary)', fontSize: 18 },
  card: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12,
    padding: '12px 14px', marginBottom: 8, width: '100%',
    color: 'var(--text-primary)', textAlign: 'left',
  },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  row1: { display: 'flex', alignItems: 'center', gap: 10 },
  sceneName: { fontSize: 17, fontWeight: 600, letterSpacing: '.02em' },
  status: { fontSize: 13, fontWeight: 500 },
  missFlag: {
    fontSize: 10, color: MISSING_COLOR, border: `1px solid ${MISSING_COLOR}`,
    padding: '1px 6px', borderRadius: 4,
  },
  row2: {
    fontSize: 12, color: 'var(--text-secondary)', marginTop: 4,
    display: 'flex', gap: 10, flexWrap: 'wrap',
  },
  noteFlag: { color: '#60a5fa', fontSize: 11, padding: '1px 6px', background: '#1e2a3a', borderRadius: 4 },
  fab: {
    position: 'fixed', right: 18, bottom: 24, width: 56, height: 56, borderRadius: '50%',
    background: '#FFC107', color: '#111', border: 'none', fontSize: 28, fontWeight: 600,
    boxShadow: '0 8px 24px rgba(255,193,7,0.35)', zIndex: 20,
  },
  scrim: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 30,
  },
  sheet: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
    background: '#1a1a1a', borderRadius: '20px 20px 0 0',
    maxHeight: '92vh', display: 'flex', flexDirection: 'column',
    borderTop: '1px solid var(--border)',
  },
  grab: { width: 40, height: 4, borderRadius: 2, background: '#3a3a3a', margin: '8px auto 6px' },
  sheetHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '4px 18px 10px',
  },
  sheetTitle: { fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center' },
  sheetStatus: { fontSize: 13, fontWeight: 500 },
  sheetSub: { fontSize: 12, color: 'var(--text-secondary)' },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
    fontSize: 20, width: 36, height: 36, borderRadius: 10,
  },
  sheetBody: { padding: '6px 18px 18px', overflowY: 'auto', flex: 1 },
  statusGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 },
  stBtn: {
    padding: '14px 10px', borderRadius: 12, border: '2px solid #2a2a2a',
    background: '#1a1a1a', fontSize: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    color: 'var(--text-primary)',
  },
  stDot: { width: 10, height: 10, borderRadius: '50%' },
  field: { marginBottom: 14 },
  label: {
    display: 'block', fontSize: 11, color: 'var(--text-secondary)',
    marginBottom: 6, letterSpacing: '.05em',
  },
  input: {
    width: '100%', background: '#0f0f0f', border: '1px solid var(--border)',
    borderRadius: 10, padding: '12px 14px', color: 'var(--text-primary)',
    fontSize: 15, fontFamily: 'inherit',
  },
  help: { fontSize: 11, color: '#666', marginTop: 4, paddingLeft: 2 },
  sheetFoot: {
    padding: '12px 18px 20px', borderTop: '1px solid var(--border)',
    display: 'flex', gap: 10, background: '#1a1a1a',
  },
  btnGhost: {
    flex: 1, padding: 14, borderRadius: 12, border: '1px solid var(--border)',
    background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 15, fontWeight: 600,
  },
  btnPrimary: {
    flex: 1, padding: 14, borderRadius: 12, border: 'none',
    background: '#FFC107', color: '#111', fontSize: 15, fontWeight: 600,
  },
  hint: {
    position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)',
    background: '#1e2a3a', color: '#60a5fa', fontSize: 12,
    padding: '6px 14px', borderRadius: 999, border: '1px solid #2a3a4a', zIndex: 50,
  },
}
