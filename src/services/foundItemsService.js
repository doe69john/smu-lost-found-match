import httpClient from './httpClient'
import { normalizeSupabaseError } from '../utils/normalizeSupabaseError'

const FOUND_ITEMS_PATH = '/rest/v1/found_items'

function buildQuery({ select = '*', filters = {}, order, limit, offset } = {}) {
  const params = new URLSearchParams()
  params.set('select', select)

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.append(key, value)
  })

  if (order) {
    params.append('order', order)
  }

  if (typeof limit === 'number') {
    params.append('limit', limit.toString())
  }

  if (typeof offset === 'number') {
    params.append('offset', offset.toString())
  }

  return params.toString()
}

function extractCountFromRange(header) {
  if (!header) return undefined
  const [, total] = header.split('/')
  const parsed = Number(total)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function fetchFoundItems(options = {}) {
  try {
    const { count: countStrategy, ...queryOptions } = options
    const query = buildQuery(queryOptions)
    const url = query ? `${FOUND_ITEMS_PATH}?${query}` : FOUND_ITEMS_PATH
    const config = countStrategy
      ? { headers: { Prefer: `count=${countStrategy}` } }
      : undefined
    const response = await httpClient.get(url, config)
    const data = response.data
    const countFromHeader = extractCountFromRange(response.headers?.['content-range'])
    const count = typeof countFromHeader === 'number'
      ? countFromHeader
      : Array.isArray(data)
        ? data.length
        : 0

    return { data, count }
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(error, 'Unable to load found items. Please try again.')
    )
  }
}

export async function fetchFoundItemById(id, { select = '*' } = {}) {
  try {
    const params = buildQuery({ select, filters: { id: `eq.${id}` } })
    const { data } = await httpClient.get(`${FOUND_ITEMS_PATH}?${params}`)
    return Array.isArray(data) ? data[0] ?? null : null
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(error, 'Unable to load the requested found item.')
    )
  }
}

export async function createFoundItem(payload) {
  try {
    const { data } = await httpClient.post(FOUND_ITEMS_PATH, payload, {
      headers: { Prefer: 'return=representation' }
    })

    return Array.isArray(data) ? data[0] ?? null : data
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to create the found item report. Please try again.'
      )
    )
  }
}

export async function updateFoundItem(id, updates) {
  try {
    const { data } = await httpClient.patch(
      `${FOUND_ITEMS_PATH}?id=eq.${id}`,
      updates,
      {
        headers: { Prefer: 'return=representation' }
      }
    )

    return Array.isArray(data) ? data[0] ?? null : data
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to update the found item report. Please try again.'
      )
    )
  }
}

export async function deleteFoundItem(id) {
  try {
    const { data } = await httpClient.delete(`${FOUND_ITEMS_PATH}?id=eq.${id}`, {
      headers: { Prefer: 'return=representation' }
    })

    return Array.isArray(data) ? data[0] ?? null : data
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to delete the found item report. Please try again.'
      )
    )
  }
}
