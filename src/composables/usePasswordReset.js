import { useAuth } from './useAuth'
import {
  requestPasswordReset as requestPasswordResetService,
  updateUserPassword as updateUserPasswordService
} from '../services/authService'

function normalizeRecoverySession(params = {}) {
  const accessToken = params.access_token || params.accessToken
  const refreshToken = params.refresh_token || params.refreshToken
  const tokenType = params.token_type || params.tokenType || 'bearer'
  const expiresIn = params.expires_in ?? params.expiresIn
  const expiresAt = params.expires_at ?? params.expiresAt

  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType
  }

  if (typeof expiresAt !== 'undefined') {
    session.expires_at = expiresAt
  } else if (typeof expiresIn !== 'undefined') {
    session.expires_in = expiresIn
  }

  return session
}

export function usePasswordReset() {
  const { adoptSession, refreshUser } = useAuth()

  const requestPasswordReset = async ({ email, redirectTo }) => {
    await requestPasswordResetService({ email, redirectTo })
  }

  const applyRecoverySession = async (params = {}) => {
    const session = normalizeRecoverySession(params)

    if (!session.access_token || !session.refresh_token) {
      throw new Error('Missing recovery session tokens')
    }

    await adoptSession(session)
  }

  const completePasswordReset = async ({ password }) => {
    await updateUserPasswordService({ password })
    await refreshUser()
  }

  return {
    requestPasswordReset,
    applyRecoverySession,
    completePasswordReset
  }
}
