import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

export default function HelpModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.card} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div>
            <p style={s.sublabel}>Roughcut Tracker</p>
            <h2 style={s.title}>使用說明</h2>
          </div>
          <button style={s.closeBtn} onClick={onClose} aria-label="關閉">✕</button>
        </div>

        <div style={s.body}>
          <Section title="這是什麼？">
            <p style={s.p}>
              給剪輯指導用的初剪進度追蹤工具，取代手動維護的 Google Sheet。
              一個入口管多個專案（劇集 / 電影），場次狀態、剪輯長度、缺鏡筆記都能即時更新。
            </p>
          </Section>

          <Section title="快速上手">
            <ol style={s.ol}>
              <li>用 Google 帳號完成 OAuth 授權</li>
              <li>輸入剪輯指導給你的<strong>專案密碼</strong>進入專案</li>
              <li>劇集：從總覽點進某一集；電影：直接看到場次表</li>
              <li>點場次列即可編輯，Enter 儲存、Esc 取消</li>
              <li>右上角可匯出 Markdown / CSV / PDF 給導演 / 製片</li>
            </ol>
          </Section>

          <Section title="找不到專案 / 密碼錯誤？">
            <p style={s.p}>密碼由剪輯指導統一發放，忘記或沒收到請直接聯絡剪輯指導。</p>
          </Section>

          <Section title="列印 / PDF 匯出">
            <p style={s.p}>
              <strong>只支援 Chrome 瀏覽器</strong>。
              Safari 會因為 CSS 支援差異導致排版跑掉（浮水印、頁碼、縮放都會出狀況），這是已知限制。
            </p>
          </Section>

          <Section title="管理者功能">
            <p style={s.p}>
              輸入 admin 密碼會直接進管理介面，可新增 / 編輯 / 刪除專案。
              新增專案時系統會自動建立對應的 Google Sheet 與分頁結構，
              建完後請手動把 Sheet 拖進「<code style={s.code}>00_Roughcut_Tracker</code>」資料夾集中管理。
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={s.section}>
      <h3 style={s.sectionTitle}>{title}</h3>
      {children}
    </section>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, zIndex: 1000,
  },
  card: {
    width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
    background: 'var(--card-bg)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '28px 32px 32px',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)',
  },
  sublabel: {
    fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6,
    letterSpacing: '0.08em', textTransform: 'uppercase',
  },
  title: { fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
    fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1,
  },
  body: { display: 'flex', flexDirection: 'column', gap: 20 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionTitle: {
    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
    margin: 0, letterSpacing: '0.02em',
  },
  p: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 },
  ol: {
    fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7,
    margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4,
  },
  code: {
    background: '#111', border: '1px solid var(--border)', borderRadius: 4,
    padding: '1px 6px', fontSize: 12, fontFamily: 'ui-monospace, monospace',
  },
}
