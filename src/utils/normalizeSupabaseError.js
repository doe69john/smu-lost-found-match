const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.'

function normalizePostgrestError(data) {
  if (!data) return null

  if (data.code === '23505') {
    return 'A record with the same value already exists.'
  }

  if (data.code === '23503') {
    return 'The referenced record could not be found.'
  }

  if (data.message) {
    return data.message
  }

  return null
}

function normalizeAuthError(data) {
  if (!data) return null

  if (data.msg) {
    return data.msg
  }

  if (data.error_description) {
    return data.error_description
  }

  if (data.error === 'invalid_grant') {
    return 'Invalid credentials. Please check your email and password.'
  }

  if (data.error) {
    return data.error
  }

  if (data.message) {
    return data.message
  }

  return null
}

function normalizeStorageError(data) {
  if (!data) return null

  if (typeof data.error === 'string') {
    return data.error
  }

  if (data.message) {
    return data.message
  }

  return null
}

export function normalizeSupabaseError(error, fallbackMessage = DEFAULT_ERROR_MESSAGE) {
  if (!error) {
    return fallbackMessage
  }

  if (typeof error === 'string') {
    return error
  }

  const response = error.response
  const data = response?.data

  let normalized =
    normalizePostgrestError(data) ||
    normalizeAuthError(data) ||
    normalizeStorageError(data)

  if (normalized) {
    return normalized
  }

  if (response?.status === 401) {
    return 'Your session has expired. Please sign in again.'
  }

  if (response?.status === 404) {
    return 'The requested resource could not be found.'
  }

  if (response?.status === 409) {
    return 'The request could not be completed because of a conflict with the current state of the resource.'
  }

  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return 'Network error. Please check your connection and try again.'
  }

  if (error.message) {
    return error.message
  }

  return fallbackMessage
}
