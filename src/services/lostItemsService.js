import httpClient from './httpClient'
import { normalizeSupabaseError } from '../utils/normalizeSupabaseError'
import { DEFAULT_STORAGE_BUCKET } from './storageService'

const LOST_ITEMS_PATH = '/rest/v1/lost_items'

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

export async function fetchLostItems(options = {}) {
  try {
    const { count: countStrategy, ...queryOptions } = options
    const query = buildQuery(queryOptions)
    const url = query ? `${LOST_ITEMS_PATH}?${query}` : LOST_ITEMS_PATH
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
      normalizeSupabaseError(error, 'Unable to load lost items. Please try again.')
    )
  }
}

export async function fetchLostItemById(id, { select = '*' } = {}) {
  try {
    const params = buildQuery({ select, filters: { id: `eq.${id}` } })
    const { data } = await httpClient.get(`${LOST_ITEMS_PATH}?${params}`)
    return Array.isArray(data) ? data[0] ?? null : null
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(error, 'Unable to load the requested lost item.')
    )
  }
}

function normalizeLostItemPayload(payload = {}) {
  const normalized = { ...payload }

  if ('image_url' in normalized) {
    delete normalized.image_url
  }

  if ('imageUrl' in normalized) {
    delete normalized.imageUrl
  }

  if (Array.isArray(payload.images)) {
    normalized.image_metadata = payload.images.map((image) => ({
      path: image.path,
      original_filename: image.originalName || image.original_filename || null,
      bucket_id: image.bucketId || image.bucket_id || DEFAULT_STORAGE_BUCKET,
      mime_type: image.mimeType || image.mime_type || null,
      size: image.size ?? null
    }))
    delete normalized.images
  }

  if (Array.isArray(payload.imageMetadata)) {
    normalized.image_metadata = payload.imageMetadata.map((image) => ({
      path: image.path,
      original_filename: image.originalName || image.original_filename || null,
      bucket_id: image.bucketId || image.bucket_id || DEFAULT_STORAGE_BUCKET,
      mime_type: image.mimeType || image.mime_type || null,
      size: image.size ?? null
    }))
    delete normalized.imageMetadata
  }

  if (Array.isArray(payload.image_metadata)) {
    normalized.image_metadata = payload.image_metadata.map((image) => ({
      path: image.path,
      original_filename: image.originalName || image.original_filename || null,
      bucket_id: image.bucketId || image.bucket_id || DEFAULT_STORAGE_BUCKET,
      mime_type: image.mimeType || image.mime_type || null,
      size: image.size ?? null
    }))
  }

  return normalized
}

export async function createLostItem(payload) {
  try {
    const normalizedPayload = normalizeLostItemPayload(payload)

    const { data } = await httpClient.post(LOST_ITEMS_PATH, normalizedPayload, {
      headers: { Prefer: 'return=representation' }
    })

    return Array.isArray(data) ? data[0] ?? null : data
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to create the lost item report. Please try again.'
      )
    )
  }
}

export async function updateLostItem(id, updates) {
  try {
    const normalizedUpdates = normalizeLostItemPayload(updates)

    const { data } = await httpClient.patch(
      `${LOST_ITEMS_PATH}?id=eq.${id}`,
      normalizedUpdates,
      {
        headers: { Prefer: 'return=representation' }
      }
    )

    return Array.isArray(data) ? data[0] ?? null : data
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to update the lost item report. Please try again.'
      )
    )
  }
}

export async function deleteLostItem(id) {
  try {
    const { data } = await httpClient.delete(`${LOST_ITEMS_PATH}?id=eq.${id}`, {
      headers: { Prefer: 'return=representation' }
    })

    return Array.isArray(data) ? data[0] ?? null : data
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to delete the lost item report. Please try again.'
      )
    )
  }
}
