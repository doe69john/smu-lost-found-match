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

function normalizeSessionInput(session) {
  if (!session) return null

  const normalized = {
    ...session,
    access_token: session.access_token || session.accessToken,
    refresh_token: session.refresh_token || session.refreshToken,
    token_type: session.token_type || session.tokenType || 'bearer',
    expires_in:
      typeof session.expires_in !== 'undefined'
        ? session.expires_in
        : session.expiresIn,
    expires_at:
      typeof session.expires_at !== 'undefined'
        ? session.expires_at
        : session.expiresAt
  }

  if (
    typeof normalized.expires_in === 'string' &&
    normalized.expires_in.trim() !== '' &&
    !Number.isNaN(Number(normalized.expires_in))
  ) {
    normalized.expires_in = Number(normalized.expires_in)
  }

  if (
    typeof normalized.expires_at === 'string' &&
    normalized.expires_at.trim() !== '' &&
    !Number.isNaN(Number(normalized.expires_at))
  ) {
    normalized.expires_at = Number(normalized.expires_at)
  }

  return normalized
}

export function persistSupabaseSession(session) {
  const normalized = normalizeSessionInput(session)
  if (!normalized?.access_token) {
    return null
  }

  const payload = {
    ...normalized,
    expires_at: normalized.expires_at || computeExpiration(normalized)
  }

  return persistSession(payload)
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
      return persistSupabaseSession(session)
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
      return persistSupabaseSession(session)
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
    persistSupabaseSession(session)
  }
  return session
}

export function clearPersistedSession() {
  clearSession()
}

export async function requestPasswordReset({ email, redirectTo }) {
  try {
    await httpClient.post(`${AUTH_BASE_PATH}/recover`, {
      email,
      ...(redirectTo ? { redirect_to: redirectTo } : {})
    })
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to start the password reset process. Please try again.'
      )
    )
  }
}

export async function verifyRecoveryToken({ token }) {
  try {
    const { data } = await httpClient.post(`${AUTH_BASE_PATH}/verify`, {
      token,
      type: 'recovery'
    })

    const session = extractSession(data)
    if (session?.access_token) {
      const persisted = persistSupabaseSession(session)
      return { ...data, session: persisted }
    }

    throw new Error('Unable to verify the recovery session from this link.')
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'This reset link is invalid or has expired. Please request a new one.'
      )
    )
  }
}

export async function updateUserPassword({ password, accessToken } = {}) {
  try {
    const config = {}
    if (accessToken) {
      config.headers = { Authorization: `Bearer ${accessToken}` }
    }

    const { data } = await httpClient.put(
      `${AUTH_BASE_PATH}/user`,
      { password },
      config
    )

    const session = extractSession(data)
    if (session?.access_token) {
      const persisted = persistSupabaseSession(session)
      return { ...data, session: persisted }
    }

    return data
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to update the password. The reset link may have expired.'
      )
    )
  }
}
