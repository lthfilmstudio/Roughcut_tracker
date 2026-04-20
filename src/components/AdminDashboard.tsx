import { useEffect, useMemo, useState } from 'react'
import bcrypt from 'bcryptjs'
import { getDataService } from '../services'
import type { ProjectConfig, ProjectType } from '../config/projectConfig'

interface Props {
  token: string
  onLogout: () => void
  onEnterProject: (project: ProjectConfig) => void
}

interface FormData {
  id: string
  name: string
  type: ProjectType
  sheetId: string
  episodeCount: string
  episodePrefix: string
  password: string
}

const EMPTY_FORM: FormData = {
  id: '', name: '', type: 'series', sheetId: '',
  episodeCount: '12', episodePrefix: 'ep', password: '',
}

function toForm(p: ProjectConfig): FormData {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    sheetId: p.sheetId,
    episodeCount: p.episodeCount ? String(p.episodeCount) : '',
    episodePrefix: p.episodePrefix ?? '',
    password: '',
  }
}

type CreateStep = 'creating' | 'saving' | null

const STEP_LABEL: Record<Exclude<CreateStep, null>, string> = {
  creating: '建立 Sheet 與 tab 結構中⋯',
  saving: '寫入 Meta Sheet 中⋯',
}

export default function AdminDashboard({ token, onLogout, onEnterProject }: Props) {
  const svc = useMemo(() => getDataService(token), [token])
  const [projects, setProjects] = useState<ProjectConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createStep, setCreateStep] = useState<CreateStep>(null)
  const [warning, setWarning] = useState('')

  async function reload() {
    setLoading(true)
    setError('')
    try {
      setProjects(await svc.getProjects())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function buildProject(form: FormData, existing?: ProjectConfig): ProjectConfig {
    const base: ProjectConfig = existing
      ? { ...existing }
      : { id: form.id.trim(), name: '', type: 'series', sheetId: '', createdAt: new Date().toISOString() }
    base.name = form.name.trim()
    base.type = form.type
    base.sheetId = form.sheetId.trim()
    if (form.type === 'series') {
      base.episodeCount = form.episodeCount ? parseInt(form.episodeCount, 10) : undefined
      base.episodePrefix = form.episodePrefix.trim() || undefined
    } else {
      base.episodeCount = undefined
      base.episodePrefix = undefined
    }
    return base
  }

  async function handleAdd(form: FormData) {
    setError('')
    setWarning('')
    const id = form.id.trim()
    if (!id || !form.name.trim()) {
      setError('id、name 為必填')
      return
    }
    if (projects.some(p => p.id === id)) {
      setError(`專案 id「${id}」已存在`)
      return
    }
    if (!form.password) {
      setError('新增專案必須設定密碼')
      return
    }
    if (form.type === 'series') {
      const count = parseInt(form.episodeCount, 10)
      if (!count || count < 1) {
        setError('劇集集數必須 ≥ 1')
        return
      }
      if (!form.episodePrefix.trim()) {
        setError('劇集必須填集別前綴（例如 ep）')
        return
      }
    }
    const dup = projects.find(p => p.passwordHash && bcrypt.compareSync(form.password, p.passwordHash))
    if (dup) {
      setError(`密碼已被專案「${dup.name}」使用，請改一組`)
      return
    }
    setSaving(true)
    try {
      const p = buildProject(form)
      p.passwordHash = bcrypt.hashSync(form.password, 10)

      setCreateStep('creating')
      const result = await svc.createProjectSheet(p)
      p.sheetId = result.sheetId

      setCreateStep('saving')
      await svc.createProject(p)

      setWarning(
        `Sheet 已自動建立於 Drive 根目錄，請手動拖入「00_Roughcut_Tracker」資料夾集中管理：${result.sheetUrl}`,
      )
      setShowAdd(false)
      await reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
      setCreateStep(null)
    }
  }

  async function handleUpdate(form: FormData, existing: ProjectConfig) {
    setError('')
    if (!form.name.trim() || !form.sheetId.trim()) {
      setError('name、sheetId 不可為空')
      return
    }
    const p = buildProject(form, existing)
    if (form.password) {
      const dup = projects.find(
        x => x.id !== existing.id && x.passwordHash && bcrypt.compareSync(form.password, x.passwordHash),
      )
      if (dup) {
        setError(`密碼已被專案「${dup.name}」使用，請改一組`)
        return
      }
      p.passwordHash = bcrypt.hashSync(form.password, 10)
    }
    setSaving(true)
    try {
      await svc.updateProject(p)
      setEditingId(null)
      await reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: ProjectConfig) {
    if (!window.confirm(`確定刪除專案「${p.name}」？此動作無法復原（Meta Sheet 該列會被移除，但原始 Sheet 不受影響）。`)) return
    setError('')
    setSaving(true)
    try {
      await svc.deleteProject(p.id)
      await reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.wrap}>
      <header style={s.header}>
        <div>
          <p style={s.sublabel}>Roughcut Tracker</p>
          <h1 style={s.title}>管理者模式</h1>
        </div>
        <button style={s.logoutBtn} onClick={onLogout}>登出</button>
      </header>

      {error && <div style={s.errorBox}>{error}</div>}
      {warning && <div style={s.warnBox}>{warning}</div>}
      {createStep && <div style={s.progressBox}>{STEP_LABEL[createStep]}</div>}

      <section style={s.section}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>新增專案</h2>
          {!showAdd && (
            <button style={s.primaryBtn} onClick={() => { setShowAdd(true); setError(''); setWarning('') }}>
              + 新增
            </button>
          )}
        </div>
        {showAdd && (
          <ProjectForm
            initial={EMPTY_FORM}
            isNew
            saving={saving}
            onSubmit={handleAdd}
            onCancel={() => { setShowAdd(false); setError(''); setWarning('') }}
          />
        )}
      </section>

      <section style={s.section}>
        <h2 style={s.sectionTitle}>
          專案列表 {loading ? '載入中⋯' : `(${projects.length})`}
        </h2>
        {projects.length === 0 && !loading && (
          <p style={s.empty}>尚無專案</p>
        )}
        <div style={s.list}>
          {projects.map(p => (
            <div key={p.id} style={s.card}>
              {editingId === p.id ? (
                <ProjectForm
                  initial={toForm(p)}
                  saving={saving}
                  onSubmit={form => handleUpdate(form, p)}
                  onCancel={() => { setEditingId(null); setError('') }}
                />
              ) : (
                <ProjectRow
                  project={p}
                  onEdit={() => { setEditingId(p.id); setError('') }}
                  onDelete={() => handleDelete(p)}
                  onEnter={() => onEnterProject(p)}
                  disabled={saving}
                />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ProjectRow({
  project, onEdit, onDelete, onEnter, disabled,
}: {
  project: ProjectConfig
  onEdit: () => void
  onDelete: () => void
  onEnter: () => void
  disabled?: boolean
}) {
  const sheetTail = project.sheetId.slice(-6)
  return (
    <div style={s.row}>
      <div style={s.rowMain}>
        <div style={s.rowTitle}>
          <span style={s.typeBadge}>{project.type === 'film' ? '電影' : '劇集'}</span>
          <span style={s.rowName}>{project.name}</span>
          <span style={s.rowId}>id: {project.id}</span>
        </div>
        <div style={s.rowMeta}>
          Sheet: …{sheetTail}
          {project.type === 'series' && project.episodeCount && (
            <> ・ {project.episodePrefix}01 ~ {project.episodePrefix}{String(project.episodeCount).padStart(2, '0')}</>
          )}
          {project.passwordHash ? <> ・ 🔒 已設密碼</> : <> ・ ⚠️ 無密碼</>}
        </div>
      </div>
      <div style={s.rowActions}>
        <button style={s.enterBtn} disabled={disabled} onClick={onEnter}>進入專案 →</button>
        <button style={s.secondaryBtn} disabled={disabled} onClick={onEdit}>編輯</button>
        <button style={s.dangerBtn} disabled={disabled} onClick={onDelete}>刪除</button>
      </div>
    </div>
  )
}

function ProjectForm({
  initial, isNew, saving, onSubmit, onCancel,
}: {
  initial: FormData
  isNew?: boolean
  saving: boolean
  onSubmit: (form: FormData) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormData>(initial)

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  return (
    <form style={s.form} onSubmit={e => { e.preventDefault(); onSubmit(form) }}>
      <div style={s.formGrid}>
        <label style={s.field}>
          <span style={s.fieldLabel}>專案 id</span>
          <input
            style={s.input}
            value={form.id}
            onChange={e => update('id', e.target.value)}
            placeholder="beicheng"
            disabled={!isNew}
            required
          />
        </label>
        <label style={s.field}>
          <span style={s.fieldLabel}>專案名稱</span>
          <input
            style={s.input}
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="北城百畫帖"
            required
          />
        </label>
        <label style={s.field}>
          <span style={s.fieldLabel}>類型</span>
          <select
            style={s.input}
            value={form.type}
            onChange={e => update('type', e.target.value as ProjectType)}
          >
            <option value="series">劇集</option>
            <option value="film">電影</option>
          </select>
        </label>
        {isNew ? (
          <div style={{ ...s.field, gridColumn: '1 / -1' }}>
            <span style={s.fieldLabel}>Sheet ID</span>
            <div style={s.autoNote}>送出後自動建立 Sheet 並寫入 tabs/header，sheetId 由系統填入。</div>
          </div>
        ) : (
          <label style={{ ...s.field, gridColumn: '1 / -1' }}>
            <span style={s.fieldLabel}>Sheet ID</span>
            <input
              style={s.input}
              value={form.sheetId}
              onChange={e => update('sheetId', e.target.value)}
              placeholder="1J5Ld..."
              required
            />
          </label>
        )}
        {form.type === 'series' && (
          <>
            <label style={s.field}>
              <span style={s.fieldLabel}>集數</span>
              <input
                style={s.input}
                type="number"
                min={1}
                value={form.episodeCount}
                onChange={e => update('episodeCount', e.target.value)}
              />
            </label>
            <label style={s.field}>
              <span style={s.fieldLabel}>集別前綴</span>
              <input
                style={s.input}
                value={form.episodePrefix}
                onChange={e => update('episodePrefix', e.target.value)}
                placeholder="ep"
              />
            </label>
          </>
        )}
        <label style={{ ...s.field, gridColumn: '1 / -1' }}>
          <span style={s.fieldLabel}>
            密碼 {isNew ? '（必填）' : '（留空代表不變）'}
          </span>
          <input
            style={s.input}
            type="password"
            value={form.password}
            onChange={e => update('password', e.target.value)}
            placeholder={isNew ? '設定一組密碼' : '輸入新密碼以更換'}
          />
        </label>
      </div>
      <div style={s.formActions}>
        <button type="button" style={s.secondaryBtn} onClick={onCancel} disabled={saving}>取消</button>
        <button type="submit" style={s.primaryBtn} disabled={saving}>
          {saving ? '儲存中⋯' : (isNew ? '新增' : '儲存變更')}
        </button>
      </div>
    </form>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-primary)',
    padding: '32px 40px 80px', maxWidth: 960, margin: '0 auto',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)',
  },
  sublabel: {
    fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6,
    letterSpacing: '0.08em', textTransform: 'uppercase',
  },
  title: { fontSize: 24, fontWeight: 600, margin: 0 },
  logoutBtn: {
    padding: '8px 16px', background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
  },
  errorBox: {
    padding: '10px 14px', background: 'rgba(239,68,68,0.12)', color: 'var(--color-missing)',
    border: '1px solid var(--color-missing)', borderRadius: 8, marginBottom: 16, fontSize: 13,
  },
  warnBox: {
    padding: '10px 14px', background: 'rgba(234,179,8,0.12)', color: '#FACC15',
    border: '1px solid rgba(234,179,8,0.4)', borderRadius: 8, marginBottom: 16,
    fontSize: 13, wordBreak: 'break-all',
  },
  progressBox: {
    padding: '10px 14px', background: 'rgba(96,165,250,0.12)', color: '#93C5FD',
    border: '1px solid rgba(147,197,253,0.4)', borderRadius: 8, marginBottom: 16, fontSize: 13,
  },
  autoNote: {
    fontSize: 12, color: 'var(--text-secondary)', padding: '8px 10px',
    background: '#111', border: '1px dashed var(--border)', borderRadius: 6,
  },
  section: { marginBottom: 32 },
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: 600, margin: 0 },
  empty: { color: 'var(--text-secondary)', fontSize: 13 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10,
    padding: 16,
  },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 },
  typeBadge: {
    fontSize: 11, padding: '2px 8px', background: '#222', color: 'var(--text-secondary)',
    borderRadius: 4, letterSpacing: '0.04em',
  },
  rowName: { fontSize: 15, fontWeight: 600 },
  rowId: { fontSize: 12, color: 'var(--text-secondary)' },
  rowMeta: { fontSize: 12, color: 'var(--text-secondary)' },
  rowActions: { display: 'flex', gap: 8 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 12, color: 'var(--text-secondary)' },
  input: {
    background: '#111', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text-primary)', padding: '8px 10px', outline: 'none', fontSize: 13,
  },
  formActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  primaryBtn: {
    padding: '8px 16px', background: 'var(--text-primary)', color: 'var(--bg)',
    border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13,
  },
  secondaryBtn: {
    padding: '8px 16px', background: 'transparent', color: 'var(--text-primary)',
    border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  dangerBtn: {
    padding: '8px 16px', background: 'transparent', color: 'var(--color-missing)',
    border: '1px solid var(--color-missing)', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  enterBtn: {
    padding: '8px 16px', background: 'rgba(96, 165, 250, 0.12)', color: '#93C5FD',
    border: '1px solid rgba(147, 197, 253, 0.4)', borderRadius: 8,
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
}
