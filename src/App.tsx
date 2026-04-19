import { useState, useEffect, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { useEpisodesCache } from './hooks/useEpisodesCache'
import LoginScreen from './components/LoginScreen'
import Dashboard from './components/Dashboard'
import EpisodeDetail from './components/EpisodeDetail'
import './App.css'

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD ?? ''

type View = { page: 'dashboard' } | { page: 'episode'; ep: string }

export default function App() {
  const { isAuthenticated, accessToken, login, logout } = useAuth()
  const [passwordOk, setPasswordOk] = useState(
    () => sessionStorage.getItem('app_pwd_ok') === '1',
  )
  const [view, setView] = useState<View>({ page: 'dashboard' })
  const loginTriggered = useRef(false)
  const cache = useEpisodesCache(accessToken)

  useEffect(() => {
    const isOAuthCallback = window.location.hash.includes('access_token')
    if (passwordOk && !isAuthenticated && !isOAuthCallback && !loginTriggered.current) {
      loginTriggered.current = true
      login()
    }
  }, [passwordOk, isAuthenticated])

  function handlePasswordSubmit(pwd: string): boolean {
    if (pwd === APP_PASSWORD) {
      sessionStorage.setItem('app_pwd_ok', '1')
      setPasswordOk(true)
      return true
    }
    return false
  }

  function handleLogout() {
    sessionStorage.removeItem('app_pwd_ok')
    setPasswordOk(false)
    logout()
  }

  const waitingForOAuth = passwordOk && !isAuthenticated

  if (!passwordOk || !isAuthenticated || !accessToken) {
    return <LoginScreen onSubmit={handlePasswordSubmit} waiting={waitingForOAuth} />
  }

  if (view.page === 'episode') {
    return (
      <EpisodeDetail
        episode={view.ep}
        token={accessToken}
        cache={cache}
        onNavigate={(ep) => setView({ page: 'episode', ep })}
        onBack={() => setView({ page: 'dashboard' })}
      />
    )
  }

  return (
    <Dashboard
      token={accessToken}
      cache={cache}
      onSelectEpisode={(ep) => setView({ page: 'episode', ep })}
      onLogout={handleLogout}
    />
  )
}
