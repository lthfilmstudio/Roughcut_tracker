import { useState, useEffect } from 'react'
import { OAUTH_CONFIG, SHEETS_CONFIG } from '../config/sheets'
import type { AuthState } from '../types'

export function useAuth(): AuthState & { login: () => void; logout: () => void } {
  const [accessToken, setAccessToken] = useState<string | null>(
    () => sessionStorage.getItem('goog_access_token'),
  )

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const token = hash.get('access_token')
    if (token) {
      sessionStorage.setItem('goog_access_token', token)
      setAccessToken(token)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  function login() {
    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.clientId,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      response_type: 'token',
      scope: SHEETS_CONFIG.scopes.join(' '),
      prompt: 'consent',
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  function logout() {
    sessionStorage.removeItem('goog_access_token')
    setAccessToken(null)
  }

  return { accessToken, isAuthenticated: !!accessToken, login, logout }
}
