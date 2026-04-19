import { CURRENT_PROJECT } from './projectConfig'

export const SHEETS_CONFIG = {
  spreadsheetId: CURRENT_PROJECT.sheetId,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
}

export const STUDIO_NAME = '原本那間剪輯工作室'

export const OAUTH_CONFIG = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  redirectUri: import.meta.env.PROD
    ? 'https://lthfilmstudio.github.io/Roughcut_tracker'
    : 'http://localhost:5173',
}
