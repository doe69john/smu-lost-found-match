import axios from 'axios'

const DEFAULT_SUPABASE_URL = 'https://oxubfeizhswsrczchtkr.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dWJmZWl6aHN3c3JjemNodGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMTkxMjQsImV4cCI6MjA3NTU5NTEyNH0.4ddHb2caQRrkO01b2eE3tAL-gVQAdxTOAiXTWk_mTxU'

const SUPABASE_URL = (
  import.meta.env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
).replace(/\/$/, '')
const SUPABASE_ANON_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

function extractProjectRef(url) {
  if (!url) return ''
  try {
    const { hostname } = new URL(url)
    const [projectRef] = hostname.split('.')
    return projectRef
  } catch {
    return ''
  }
}

const projectRef = extractProjectRef(SUPABASE_URL)
const AUTH_STORAGE_KEY = projectRef ? `sb-${projectRef}-auth-token` : null

export function getAuthStorageKey() {
  return AUTH_STORAGE_KEY
}

export function getSessionFromStorage() {
  if (!AUTH_STORAGE_KEY || typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (parsed?.access_token) {
      return parsed
    }

    if (parsed?.currentSession?.access_token) {
      return parsed.currentSession
    }

    return parsed
  } catch (error) {
    console.warn('Failed to parse Supabase session from storage', error)
    return null
  }
}

const httpClient = axios.create({
  baseURL: SUPABASE_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY
  }
})

httpClient.interceptors.request.use((config) => {
  const session = getSessionFromStorage()
  const token = session?.access_token || session?.accessToken

  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export default httpClient
