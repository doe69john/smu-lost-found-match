import httpClient from './httpClient'
import { normalizeSupabaseError } from '../utils/normalizeSupabaseError'

const SECURITY_OFFICES_PATH = '/rest/v1/security_offices'

let cachedOffices = null
let pendingRequest = null

export async function fetchSecurityOffices({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedOffices) {
    return cachedOffices
  }

  if (!forceRefresh && pendingRequest) {
    return pendingRequest
  }

  pendingRequest = httpClient
    .get(`${SECURITY_OFFICES_PATH}?select=id,name,location,is_active&order=name.asc`)
    .then(({ data }) => {
      const offices = Array.isArray(data)
        ? data.filter((office) => office?.is_active !== false)
        : []
      cachedOffices = offices
      return offices
    })
    .catch((error) => {
      throw new Error(
        normalizeSupabaseError(error, 'Unable to load security office options. Please try again later.')
      )
    })
    .finally(() => {
      pendingRequest = null
    })

  return pendingRequest
}

export function getCachedSecurityOffices() {
  return cachedOffices ?? []
}

export function clearSecurityOfficesCache() {
  cachedOffices = null
}
