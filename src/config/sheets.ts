export const SHEETS_CONFIG = {
  spreadsheetId: '1J5LdXoTVzf2xWE6YsjZ7Y1Wk6xOWLwTLHBi2ohkTeus',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
}

export const SHOW_NAME = '北城百畫帖'

export const OAUTH_CONFIG = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  redirectUri: import.meta.env.PROD
    ? 'https://lthfilmstudio.github.io/Roughcut_tracker'
    : 'http://localhost:5173',
}
