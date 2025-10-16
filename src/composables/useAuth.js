import { computed, reactive } from 'vue'
import {
  signIn as signInService,
  signUp as signUpService,
  signOut as signOutService,
  getCurrentUser,
  loadSessionFromStorage,
  clearPersistedSession
} from '../services/authService'
import {
  emitSessionExpired,
  onSessionExpired,
  resetSessionInvalidationThrottle
} from '../services/sessionManager'
import { pushToast } from './useToast'

const state = reactive({
  isAuthenticated: false,
  user: null,
  session: null,
  initializing: false,
  initialized: false
})

let sessionExpiryTimer = null

function cancelSessionExpiryTimer() {
  if (sessionExpiryTimer) {
    globalThis.clearTimeout(sessionExpiryTimer)
    sessionExpiryTimer = null
  }
}

function extractExpiration(session) {
  if (!session) return null
  if (session.expires_at) return session.expires_at
  if (session.expiresAt) return session.expiresAt
  if (session.expires_in) {
    return Math.floor(Date.now() / 1000 + session.expires_in)
  }
  return null
}

function scheduleSessionExpiry(session) {
  cancelSessionExpiryTimer()

  const expiresAt = extractExpiration(session)
  if (!expiresAt) return

  const bufferMs = 30 * 1000
  const millisUntilExpiry = expiresAt * 1000 - Date.now() - bufferMs

  if (millisUntilExpiry <= 0) {
    emitSessionExpired({ reason: 'expired', silent: true })
    return
  }

  sessionExpiryTimer = globalThis.setTimeout(() => {
    emitSessionExpired({ reason: 'expired' })
  }, millisUntilExpiry)
}

function invalidateSession(reason = 'expired', { silent = false } = {}) {
  const wasAuthenticated = state.isAuthenticated || Boolean(state.session)

  cancelSessionExpiryTimer()
  clearPersistedSession()
  state.isAuthenticated = false
  state.session = null
  state.user = null

  if (!silent && wasAuthenticated) {
    let message = 'Your session has ended. Please sign in again to continue.'
    if (reason === 'session-timeout') {
      message = 'Your session timed out due to inactivity. Please sign in again.'
    }

    pushToast({
      title: 'Session expired',
      message,
      variant: 'warning'
    })
  }
}

onSessionExpired((detail = {}) => {
  invalidateSession(detail.reason, { silent: detail.silent })
})

function bootstrapSession() {
  const storedSession = loadSessionFromStorage()
  if (storedSession?.access_token) {
    const expiresAt = extractExpiration(storedSession)
    if (expiresAt && expiresAt * 1000 <= Date.now()) {
      emitSessionExpired({ reason: 'expired', silent: true })
    } else {
      state.session = storedSession
      state.isAuthenticated = true
      state.user = storedSession.user || null
      scheduleSessionExpiry(storedSession)
    }
  }
  state.initialized = true
}

async function hydrateUser() {
  if (!state.isAuthenticated || state.user) {
    return
  }

  state.initializing = true
  try {
    const profile = await getCurrentUser()
    state.user = profile
  } catch (error) {
    console.warn('Failed to hydrate authenticated user', error)
    emitSessionExpired({ reason: 'expired' })
  } finally {
    state.initializing = false
  }
}

bootstrapSession()
hydrateUser()

export function useAuth() {
  const login = async ({ email, password }) => {
    const session = await signInService({ email, password })

    state.session = session
    state.isAuthenticated = Boolean(session?.access_token)
    state.user = session?.user || null

    if (state.isAuthenticated) {
      resetSessionInvalidationThrottle()
      scheduleSessionExpiry(session)
    }

    if (!state.user && state.isAuthenticated) {
      try {
        state.user = await getCurrentUser()
      } catch (error) {
        console.warn('Unable to hydrate user after login', error)
        emitSessionExpired({ reason: 'expired' })
        state.user = null
      }
    }

    return state.user
  }

  const register = async ({ email, password, fullName }) => {
    const response = await signUpService({
      email,
      password,
      data: fullName ? { full_name: fullName } : undefined
    })

    const session = response?.session || response

    if (session?.access_token) {
      state.session = session
      state.isAuthenticated = true
      state.user = session.user || null
      resetSessionInvalidationThrottle()
      scheduleSessionExpiry(session)

      if (!state.user) {
        try {
          state.user = await getCurrentUser()
        } catch (error) {
          console.warn('Unable to hydrate user after registration', error)
          emitSessionExpired({ reason: 'expired' })
        }
      }
    }

    return response
  }

  const logout = async () => {
    await signOutService()
    cancelSessionExpiryTimer()
    clearPersistedSession()
    state.isAuthenticated = false
    state.user = null
    state.session = null
  }

  const refreshUser = async () => {
    if (!state.isAuthenticated) return null
    try {
      state.user = await getCurrentUser()
    } catch (error) {
      console.warn('Failed to refresh user profile', error)
      emitSessionExpired({ reason: 'expired' })
    }
    return state.user
  }

  return {
    isAuthenticated: computed(() => state.isAuthenticated),
    user: computed(() => state.user),
    session: computed(() => state.session),
    initializing: computed(() => state.initializing),
    login,
    register,
    logout,
    refreshUser
  }
}

export function isUserAuthenticated() {
  return state.isAuthenticated
}
