import httpClient from './httpClient'
import { normalizeSupabaseError } from '../utils/normalizeSupabaseError'

const STORAGE_BASE_PATH = '/storage/v1'
const DEFAULT_BUCKET = 'item-images'

export const DEFAULT_STORAGE_BUCKET = DEFAULT_BUCKET

function encodePath(path) {
  return encodeURIComponent(path).replace(/%2F/g, '/')
}

export async function createSignedUploadUrl({
  bucketId = DEFAULT_BUCKET,
  path,
  upsert = false
}) {
  if (!path) {
    throw new Error('A storage path is required to create a signed upload URL.')
  }

  try {
    const headers = upsert ? { 'x-upsert': 'true' } : {}
    const encodedPath = encodePath(path)
    const { data } = await httpClient.post(
      `${STORAGE_BASE_PATH}/object/upload/sign/${bucketId}/${encodedPath}`,
      {},
      { headers }
    )

    const relativeUrl = data?.url || ''
    const base = httpClient.defaults.baseURL?.replace(/\/$/, '') || ''
    const absoluteUrl = new URL(relativeUrl, base)

    const token = absoluteUrl.searchParams.get('token')

    return {
      signedUrl: absoluteUrl.toString(),
      token,
      path
    }
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(
        error,
        'Unable to generate a signed upload URL. Please try again.'
      )
    )
  }
}

export async function uploadToSignedUrl({ signedUrl, file, contentType }) {
  if (!signedUrl) {
    throw new Error('A signed URL is required to upload a file.')
  }

  try {
    const headers = {}
    let body = file

    if (file instanceof FormData) {
      body = file
    } else {
      const isBlob = typeof Blob !== 'undefined' && file instanceof Blob
      const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && file instanceof ArrayBuffer
      const isArrayBufferView =
        typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(file)

      if (contentType) {
        headers['Content-Type'] = contentType
      } else if (isBlob) {
        headers['Content-Type'] = file.type || 'application/octet-stream'
      } else if (isArrayBuffer || isArrayBufferView) {
        headers['Content-Type'] = 'application/octet-stream'
      } else {
        headers['Content-Type'] = 'application/octet-stream'
      }
    }

    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers,
      body
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || 'Upload failed.')
    }

    const url = new URL(signedUrl)
    const [, objectPath = ''] = url.pathname.split('/object/upload/sign/')
    const [bucketFromUrl, ...pathSegments] = objectPath.split('/')

    return {
      success: true,
      bucketId: bucketFromUrl,
      path: decodeURIComponent(pathSegments.join('/')),
      signedUrl
    }
  } catch (error) {
    throw new Error(
      normalizeSupabaseError(error, 'Unable to upload the file. Please try again.')
    )
  }
}

export function getPublicAssetUrl(path, bucketId = DEFAULT_BUCKET) {
  const cleanedPath = path?.replace(/^\/+/, '') || ''
  const base = httpClient.defaults.baseURL?.replace(/\/$/, '') || ''
  return `${base}${STORAGE_BASE_PATH}/object/public/${bucketId}/${cleanedPath}`
}
