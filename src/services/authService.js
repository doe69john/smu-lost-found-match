import httpClient, {
  getAuthStorageKey,
  getSessionFromStorage
} from './httpClient'
import { normalizeSupabaseError } from '../utils/normalizeSupabaseError'

const AUTH_BASE_PATH = '/auth/v1'

function persistSession(session) {
  if (!session) return null

  const storageKey = getAuthStorageKey()
  if (!storageKey || typeof window === 'undefined') {
    return session
  }

  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at:
      session.expires_at ||
      Math.floor(Date.now() / 1000 + (session.expires_in || 0)),
    token_type: session.token_type,
    user: session.user
  }

  window.localStorage.setItem(storageKey, JSON.stringify(payload))

  return payload
}

function clearSession() {
  const storageKey = getAuthStorageKey()
  if (storageKey && typeof window !== 'undefined') {
    window.localStorage.removeItem(storageKey)
  }
}

function computeExpiration(session) {
  if (!session) return null

  if (session.expires_at) {
    return session.expires_at
  }

  if (session.expiresAt) {
    return session.expiresAt
  }

  if (session.expires_in) {
    return Math.floor(Date.now() / 1000 + session.expires_in)
  }

  return null
}

function extractSession(payload) {
  if (!payload) return null

  if (payload.session) {
    return payload.session
  }

  return payload
}

export async function signIn({ email, password }) {
  try {
    const { data } = await httpClient.post(
      `${AUTH_BASE_PATH}/token?grant_type=password`,
      {
        email,
        password
      }
    )

    const session = extractSession(data)
    if (session?.access_token) {
      const persisted = persistSession({ ...session, expires_at: computeExpiration(session) })
      return persisted
    }

    return session
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to sign in. Please check your credentials and try again.'
      )
    )
  }
}

export async function signUp({ email, password, data = {} }) {
  try {
    const response = await httpClient.post(`${AUTH_BASE_PATH}/signup`, {
      email,
      password,
      data
    })

    const session = extractSession(response.data)
    if (session?.access_token) {
      const persisted = persistSession({ ...session, expires_at: computeExpiration(session) })
      return persisted
    }

    return response.data
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to complete registration. Please try again.'
      )
    )
  }
}

export async function signOut() {
  try {
    await httpClient.post(`${AUTH_BASE_PATH}/logout`, {})
    clearSession()
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to sign out at the moment. Please try again.'
      )
    )
  }
}

export async function getCurrentUser() {
  try {
    const { data } = await httpClient.get(`${AUTH_BASE_PATH}/user`)
    return data
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(error, 'Unable to fetch the current user.')
    )
  }
}

export function getCurrentSession() {
  return getSessionFromStorage()
}

export function loadSessionFromStorage() {
  const session = getSessionFromStorage()
  if (session?.access_token) {
    persistSession({ ...session, expires_at: computeExpiration(session) })
  }
  return session
}

export function clearPersistedSession() {
  clearSession()
}
