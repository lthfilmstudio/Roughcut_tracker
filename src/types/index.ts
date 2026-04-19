export interface SummaryRow {
  episode: string
  roughcutPct: number
  finecutPct: number
  roughcutDuration: string
  finecutDuration: string
  totalDuration: string
  roughcutScenes: number
  finecutScenes: number
  totalScenes: number
  roughcutPages: number
  finecutPages: number
  avgPageDuration: string
}

export interface SceneRow {
  scene: string
  roughcutLength: string
  pages: string
  roughcutDate: string
  status: string
  missingShots: string
  notes: string
}

export interface AuthState {
  accessToken: string | null
  isAuthenticated: boolean
}
