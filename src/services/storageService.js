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

    const rawUrl = data?.signedUrl ?? data?.url ?? ''
    if (!rawUrl) {
      throw new Error('Supabase did not return a signed upload URL.')
    }

    const base = httpClient.defaults.baseURL?.replace(/\/$/, '') || ''

    const isAbsolute = /^https?:\/\//i.test(rawUrl)
    const absoluteUrl = (() => {
      if (isAbsolute) {
        return new URL(rawUrl)
      }

      const prefixedPath = rawUrl.startsWith('/storage/v1/')
        ? rawUrl
        : `${STORAGE_BASE_PATH}/${rawUrl.replace(/^\/+/, '')}`

      return new URL(prefixedPath, base)
    })()

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

export async function uploadToSignedUrl({ signedUrl, file, contentType, onProgress }) {
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

    const performUpload = () => {
      if (typeof XMLHttpRequest !== 'undefined' && typeof onProgress === 'function') {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              onProgress({
                loaded: event.loaded,
                total: event.total,
                percentage: event.total ? Math.round((event.loaded / event.total) * 100) : 0
              })
            }
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              reject(new Error(xhr.responseText || 'Upload failed.'))
            }
          }
          xhr.onerror = () => reject(new Error('Upload failed. Please try again.'))
          xhr.open('PUT', signedUrl, true)
          Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value)
          })
          xhr.send(body)
        })
      }

      return fetch(signedUrl, {
        method: 'PUT',
        headers,
        body
      }).then(async (response) => {
        if (!response.ok) {
          const text = await response.text()
          throw new Error(text || 'Upload failed.')
        }
      })
    }

    await performUpload()

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

export async function uploadFilesSequentially(files, {
  bucketId = DEFAULT_BUCKET,
  buildPath,
  upsert = true,
  onFileStart,
  onFileProgress,
  onFileComplete
} = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    return []
  }

  const uploads = []

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    if (!(file instanceof Blob)) continue

    const extension = file.name?.split('.').pop() || 'jpg'
    const safeName = file.name?.replace(/\s+/g, '-') || `image-${index}.${extension}`
    const path = typeof buildPath === 'function'
      ? buildPath(file, index)
      : `${Date.now()}-${index}-${safeName}`

    const { signedUrl, path: storagePath } = await createSignedUploadUrl({
      bucketId,
      path,
      upsert
    })

    onFileStart?.({ file, index, path: storagePath })

    await uploadToSignedUrl({
      signedUrl,
      file,
      contentType: file.type,
      onProgress: onFileProgress
        ? (event) => {
          const percentage = event.total
            ? Math.round((event.loaded / event.total) * 100)
            : event.percentage ?? 0
          onFileProgress({
            file,
            index,
            loaded: event.loaded,
            total: event.total,
            percentage
          })
        }
        : undefined
    })

    const metadata = {
      path: storagePath,
      bucketId,
      originalName: file.name || safeName,
      size: file.size ?? null,
      mimeType: file.type || null
    }

    onFileComplete?.({ file, index, metadata })
    uploads.push(metadata)
  }

  return uploads
}
