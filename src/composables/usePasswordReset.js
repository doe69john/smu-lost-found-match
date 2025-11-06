import { useAuth } from './useAuth'
import {
  requestPasswordReset as requestPasswordResetService,
  updateUserPassword as updateUserPasswordService,
  verifyRecoveryToken as verifyRecoveryTokenService
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
    let session = normalizeRecoverySession(params)

    if (!session.access_token || !session.refresh_token) {
      const token = params.token || params.recovery_token || params.oob_code

      if (!token) {
        throw new Error('Missing recovery session tokens')
      }

      const verification = await verifyRecoveryTokenService({ token })
      const verifiedSession = normalizeRecoverySession(
        verification?.session || verification
      )

      if (!verifiedSession.access_token || !verifiedSession.refresh_token) {
        throw new Error('Unable to verify recovery session tokens')
      }

      session = verifiedSession
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
