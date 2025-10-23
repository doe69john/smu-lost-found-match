import axios from 'axios'

import { emitSessionExpired } from './sessionManager'


const runtimeSupabaseUrl =
  typeof globalThis !== 'undefined' && globalThis.__SUPABASE_URL__
    ? globalThis.__SUPABASE_URL__
    : undefined

const runtimeSupabaseAnonKey =
  typeof globalThis !== 'undefined' && globalThis.__SUPABASE_ANON_KEY__
    ? globalThis.__SUPABASE_ANON_KEY__
    : undefined

const rawSupabaseUrl =
  runtimeSupabaseUrl || import.meta.env?.VITE_SUPABASE_URL || ''

const SUPABASE_URL = rawSupabaseUrl ? rawSupabaseUrl.replace(/\/$/, '') : ''

const SUPABASE_ANON_KEY =
  runtimeSupabaseAnonKey || import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase configuration is missing. Ensure the Cloudflare worker exposes VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
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

const defaultHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json'
}

if (SUPABASE_ANON_KEY) {
  defaultHeaders.apikey = SUPABASE_ANON_KEY
}

const httpClient = axios.create({
  baseURL: SUPABASE_URL || undefined,
  headers: defaultHeaders
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
