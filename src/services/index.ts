import type { DataService } from './dataService'
import { GoogleSheetsService } from './googleSheetsService'

const META_SHEET_ID = import.meta.env.VITE_META_SHEET_ID ?? ''

export function getDataService(token: string): DataService {
  return new GoogleSheetsService(token, META_SHEET_ID)
}

export type { DataService } from './dataService'
