import { api, dataOrThrow, type Schema } from './client'

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024
export const SUPPORTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number]

export function mediaValidationMessage(file: Pick<File, 'size' | 'type'>) {
  if (!SUPPORTED_MEDIA_TYPES.includes(file.type as SupportedMediaType)) {
    return 'Choose a JPEG, PNG, or WebP image.'
  }
  if (file.size < 1) return 'Choose an image that is not empty.'
  if (file.size > MAX_MEDIA_BYTES) return 'Choose an image smaller than 5 MB.'
  return null
}

export async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function cleanupPendingMedia(mediaAssetId: string) {
  try {
    await api.DELETE('/media/{mediaAssetId}', { params: { path: { mediaAssetId } } })
  } catch {
    // The backend also expires stale PENDING assets. Never mask the useful upload error.
  }
}
function browserSafeStorageHeaders(requiredHeaders: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(requiredHeaders)
      .filter(([name]) => name.toLowerCase() !== 'content-length'),
  )
}


export async function uploadRecordMedia(file: File, signal?: AbortSignal) {
  const invalid = mediaValidationMessage(file)
  if (invalid) throw new Error(invalid)

  const bytes = await file.arrayBuffer()
  const checksumSha256 = await sha256Hex(bytes)
  let mediaAssetId: string | null = null

  try {
    const instruction = dataOrThrow<Schema<'MediaUploadInstructionResponse'>>(await api.POST('/media/uploads', {
      body: {
        contentType: file.type as SupportedMediaType,
        byteSize: file.size,
        checksumSha256,
      },
      signal,
    }))
    mediaAssetId = instruction.mediaAssetId

    const uploaded = await fetch(instruction.uploadUrl, {
      method: 'PUT',
      body: bytes,
      headers: browserSafeStorageHeaders(instruction.requiredHeaders),
      credentials: 'omit',
      redirect: 'error',
      signal,
    })
    if (!uploaded.ok) throw new Error('The image could not be transferred to secure storage. Please try again.')

    const asset = dataOrThrow<Schema<'MediaAssetResponse'>>(await api.POST('/media/{mediaAssetId}/finalise', {
      params: { path: { mediaAssetId } },
      signal,
    }))
    if (asset.status !== 'READY') throw new Error('The image upload could not be verified. Please try again.')
    return asset
  } catch (error) {
    if (mediaAssetId) await cleanupPendingMedia(mediaAssetId)
    throw error
  }
}

export async function deleteRecordMedia(mediaAssetId: string) {
  return dataOrThrow<void>(await api.DELETE('/media/{mediaAssetId}', { params: { path: { mediaAssetId } } }))
}
