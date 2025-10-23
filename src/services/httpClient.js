import axios from 'axios'

import { emitSessionExpired } from './sessionManager'

const rawSupabaseUrl = import.meta.env?.VITE_SUPABASE_URL
const SUPABASE_URL = rawSupabaseUrl?.replace(/\/$/, '')
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable')
}

if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable')
}

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

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const requestUrl = error.config?.url || ''

    const isAuthRequest = /\/auth\/v1\/(token|signup|logout)/.test(requestUrl)

    if ((status === 401 || status === 419) && !isAuthRequest) {
      emitSessionExpired({ reason: status === 419 ? 'session-timeout' : 'expired' })
    }

    return Promise.reject(error)
  }
)

export default httpClient
