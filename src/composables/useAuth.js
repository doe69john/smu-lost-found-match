import { computed, reactive } from 'vue'
import {
  signIn as signInService,
  signUp as signUpService,
  signOut as signOutService,
  getCurrentUser,
  loadSessionFromStorage
} from '../services/authService'

const state = reactive({
  isAuthenticated: false,
  user: null,
  session: null,
  initializing: false,
  initialized: false
})

function bootstrapSession() {
  const storedSession = loadSessionFromStorage()
  if (storedSession?.access_token) {
    state.session = storedSession
    state.isAuthenticated = true
    state.user = storedSession.user || null
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
  } catch {
    state.isAuthenticated = false
    state.session = null
    state.user = null
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

    if (!state.user && state.isAuthenticated) {
      try {
        state.user = await getCurrentUser()
      } catch {
        state.isAuthenticated = false
        state.session = null
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

      if (!state.user) {
        try {
          state.user = await getCurrentUser()
        } catch {
          state.isAuthenticated = false
          state.session = null
        }
      }
    }

    return response
  }

  const logout = async () => {
    await signOutService()
    state.isAuthenticated = false
    state.user = null
    state.session = null
  }

  const refreshUser = async () => {
    if (!state.isAuthenticated) return null
    state.user = await getCurrentUser().catch(() => state.user)
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
