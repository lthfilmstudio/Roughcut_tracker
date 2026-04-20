import { useState, useEffect, useRef } from 'react'
import bcrypt from 'bcryptjs'
import { useAuth } from './hooks/useAuth'
import { useEpisodesCache } from './hooks/useEpisodesCache'
import LoginScreen from './components/LoginScreen'
import Dashboard from './components/Dashboard'
import EpisodeDetail from './components/EpisodeDetail'
import AdminDashboard from './components/AdminDashboard'
import QuickPage from './components/QuickPage'
import { getTabNames, type ProjectConfig } from './config/projectConfig'
import { useProject } from './contexts/ProjectContext'
import { getDataService } from './services'
import './App.css'

const PENDING_PWD_KEY = 'pending_pwd'
const MATCHED_PROJECT_KEY = 'matched_project_id'
const ADMIN_MODE_KEY = 'admin_mode'
const ADMIN_VERIFIED_KEY = 'admin_verified'
const ADMIN_PASSWORD_HASH = import.meta.env.VITE_ADMIN_PASSWORD ?? ''

type View = { page: 'dashboard' } | { page: 'episode'; ep: string } | { page: 'quick' }

export default function App() {
  const { project, setProject } = useProject()
  const { isAuthenticated, accessToken, login, logout } = useAuth()

  const [adminHashEntry, setAdminHashEntry] = useState<boolean>(
    () => window.location.hash === '#admin',
  )
  const [adminMode, setAdminMode] = useState<boolean>(
    () => sessionStorage.getItem(ADMIN_MODE_KEY) === '1',
  )
  const [adminVerified, setAdminVerified] = useState<boolean>(
    () => sessionStorage.getItem(ADMIN_VERIFIED_KEY) === '1',
  )
  const [matchedId, setMatchedId] = useState<string | null>(
    () => sessionStorage.getItem(MATCHED_PROJECT_KEY),
  )
  const [verifying, setVerifying] = useState(false)
  const [loginError, setLoginError] = useState('')
  const verifiedRef = useRef(false)

  const authed = !!matchedId && !!accessToken && project.id === matchedId
  const adminEntered = adminVerified && !adminMode && authed
  const effectiveToken = authed ? accessToken : null
  const cache = useEpisodesCache(effectiveToken)

  const isFilm = project.type === 'film'
  const filmTab = getTabNames(project)[0] ?? 'Scenes'
  const [view, setView] = useState<View>(
    () => (isFilm ? { page: 'episode', ep: filmTab } : { page: 'dashboard' }),
  )

  useEffect(() => {
    if (window.location.hash === '#admin') {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (!authed) return
    setView(project.type === 'film'
      ? { page: 'episode', ep: getTabNames(project)[0] ?? 'Scenes' }
      : { page: 'dashboard' })
  }, [matchedId, authed, project])

  useEffect(() => {
    if (!accessToken || verifiedRef.current || verifying) return

    const pendingPwd = sessionStorage.getItem(PENDING_PWD_KEY)
    const savedId = sessionStorage.getItem(MATCHED_PROJECT_KEY)

    if (pendingPwd) {
      verifyPassword(pendingPwd, accessToken)
    } else if (savedId && project.id !== savedId) {
      restoreProject(savedId, accessToken)
    } else if (savedId && project.id === savedId) {
      verifiedRef.current = true
    }
  }, [accessToken])

  async function verifyPassword(pwd: string, token: string) {
    setVerifying(true)
    setLoginError('')
    try {
      sessionStorage.removeItem(PENDING_PWD_KEY)

      // 先比對管理者密碼
      if (ADMIN_PASSWORD_HASH && bcrypt.compareSync(pwd, ADMIN_PASSWORD_HASH)) {
        sessionStorage.setItem(ADMIN_VERIFIED_KEY, '1')
        sessionStorage.setItem(ADMIN_MODE_KEY, '1')
        setAdminVerified(true)
        setAdminMode(true)
        setAdminHashEntry(false)
        verifiedRef.current = true
        return
      }

      // 再比對 Meta Sheet 各專案密碼
      const svc = getDataService(token)
      const projects = await svc.getProjects()
      const match = projects.find(p => p.passwordHash && bcrypt.compareSync(pwd, p.passwordHash))
      if (match) {
        setProject(match)
        setMatchedId(match.id)
        sessionStorage.setItem(MATCHED_PROJECT_KEY, match.id)
        verifiedRef.current = true
      } else {
        setLoginError('密碼錯誤，請重試')
        logout()
      }
    } catch (e: unknown) {
      setLoginError('連線失敗：' + (e instanceof Error ? e.message : String(e)))
      logout()
    } finally {
      setVerifying(false)
    }
  }

  async function restoreProject(id: string, token: string) {
    setVerifying(true)
    try {
      const svc = getDataService(token)
      const projects = await svc.getProjects()
      const match = projects.find(p => p.id === id)
      if (match) {
        setProject(match)
        verifiedRef.current = true
      } else {
        sessionStorage.removeItem(MATCHED_PROJECT_KEY)
        setMatchedId(null)
        logout()
      }
    } catch {
      sessionStorage.removeItem(MATCHED_PROJECT_KEY)
      setMatchedId(null)
      logout()
    } finally {
      setVerifying(false)
    }
  }

  function handlePasswordSubmit(pwd: string) {
    sessionStorage.setItem(PENDING_PWD_KEY, pwd)
    setLoginError('')
    if (accessToken) {
      verifyPassword(pwd, accessToken)
    } else {
      login()
    }
  }

  function handleEnterProject(p: ProjectConfig) {
    setProject(p)
    setMatchedId(p.id)
    sessionStorage.setItem(MATCHED_PROJECT_KEY, p.id)
    verifiedRef.current = true
    sessionStorage.removeItem(ADMIN_MODE_KEY)
    setAdminMode(false)
  }

  function handleReturnToAdmin() {
    sessionStorage.removeItem(MATCHED_PROJECT_KEY)
    setMatchedId(null)
    verifiedRef.current = false
    sessionStorage.setItem(ADMIN_MODE_KEY, '1')
    setAdminMode(true)
  }

  function handleAdminLogout() {
    sessionStorage.removeItem(ADMIN_MODE_KEY)
    sessionStorage.removeItem(ADMIN_VERIFIED_KEY)
    sessionStorage.removeItem(MATCHED_PROJECT_KEY)
    setAdminMode(false)
    setAdminVerified(false)
    setMatchedId(null)
    verifiedRef.current = false
    setLoginError('')
    logout()
  }

  function handleLogout() {
    sessionStorage.removeItem(MATCHED_PROJECT_KEY)
    sessionStorage.removeItem(PENDING_PWD_KEY)
    setMatchedId(null)
    verifiedRef.current = false
    setLoginError('')
    logout()
  }

  // 管理者已驗證 + 在 admin mode → 顯示管理介面
  if (adminMode && adminVerified && accessToken) {
    return (
      <AdminDashboard
        token={accessToken}
        onLogout={handleAdminLogout}
        onEnterProject={handleEnterProject}
      />
    )
  }

  // 尚未進入任一專案 → 顯示登入頁（統一入口）
  if (!authed) {
    const hasPending = !!sessionStorage.getItem(PENDING_PWD_KEY)
    const waiting = verifying || (hasPending && !isAuthenticated)
    const waitingLabel = verifying ? '驗證中⋯' : '正在連結 Google 帳號⋯'
    const isAdminEntry = adminHashEntry || (adminMode && !adminVerified)
    return (
      <LoginScreen
        title={isAdminEntry ? '管理者登入' : '輸入專案密碼'}
        sublabel={isAdminEntry ? 'Roughcut Tracker · Admin' : 'Roughcut Tracker'}
        hint={isAdminEntry ? '忘記密碼？請翻開 GitHub Secrets' : '忘記密碼？請聯絡剪輯指導'}
        onSubmit={handlePasswordSubmit}
        waiting={waiting}
        waitingLabel={waitingLabel}
        error={loginError}
      />
    )
  }

  const exitFn = adminEntered ? handleReturnToAdmin : handleLogout
  const exitLabel = adminEntered ? '← 返回總覽' : '登出'

  if (view.page === 'quick') {
    return (
      <QuickPage
        token={accessToken}
        cache={cache}
        onExit={isFilm ? exitFn : () => setView({ page: 'dashboard' })}
        exitLabel={isFilm ? exitLabel : '← 返回總覽'}
      />
    )
  }

  if (view.page === 'episode') {
    return (
      <EpisodeDetail
        episode={view.ep}
        token={accessToken}
        cache={cache}
        onNavigate={(ep) => setView({ page: 'episode', ep })}
        onOpenQuick={() => setView({ page: 'quick' })}
        onBack={isFilm ? exitFn : () => setView({ page: 'dashboard' })}
        backLabel={isFilm ? exitLabel : '← 返回總覽'}
      />
    )
  }

  return (
    <Dashboard
      token={accessToken}
      cache={cache}
      onSelectEpisode={(ep) => setView({ page: 'episode', ep })}
      onOpenQuick={() => setView({ page: 'quick' })}
      onLogout={exitFn}
      logoutLabel={exitLabel}
    />
  )
}
