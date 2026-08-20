import { api, dataOrThrow, type Schema } from './client'

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024
export const SUPPORTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number]

export function mediaValidationMessage(file: Pick<Blob, 'size' | 'type'>) {
  if (file.size < 1) return 'Choose an image that is not empty.'
  if (file.size > MAX_MEDIA_BYTES) return 'Choose an image smaller than 5 MB.'
  return null
}

function canUploadWithoutTranscoding(file: Pick<Blob, 'type'>): file is Blob & { type: SupportedMediaType } {
  return SUPPORTED_MEDIA_TYPES.includes(file.type as SupportedMediaType)
}

type DrawableImage = {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

async function decodeForCanvas(file: Blob): Promise<DrawableImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image()
      candidate.onload = () => resolve(candidate)
      candidate.onerror = () => reject(new Error('Image decoding failed.'))
      candidate.src = objectUrl
    })
    return { source: image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, release: () => URL.revokeObjectURL(objectUrl) }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

async function canvasJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image conversion failed.')), 'image/jpeg', 0.92)
  })
}

export async function normaliseRecordMedia(file: Blob): Promise<Blob> {
  const invalid = mediaValidationMessage(file)
  if (invalid && canUploadWithoutTranscoding(file)) throw new Error(invalid)
  if (canUploadWithoutTranscoding(file)) return file

  let drawable: DrawableImage | null = null
  try {
    drawable = await decodeForCanvas(file)
    if (drawable.width < 1 || drawable.height < 1) throw new Error('Image decoding failed.')
    const canvas = document.createElement('canvas')
    canvas.width = drawable.width
    canvas.height = drawable.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image conversion failed.')
    context.drawImage(drawable.source, 0, 0, drawable.width, drawable.height)
    const jpeg = await canvasJpeg(canvas)
    const convertedInvalid = mediaValidationMessage(jpeg)
    if (convertedInvalid) throw new Error(convertedInvalid)
    return jpeg
  } catch (error) {
    if (error instanceof Error && error.message.includes('5 MB')) throw error
    throw new Error('Choose a JPEG, PNG, or WebP image, or an image that can be converted to JPEG.')
  } finally {
    drawable?.release()
  }
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


export async function uploadRecordMedia(file: Blob, signal?: AbortSignal) {
  const invalid = mediaValidationMessage(file)
  if (invalid) throw new Error(invalid)
  if (!canUploadWithoutTranscoding(file)) throw new Error('Choose a JPEG, PNG, or WebP image.')

  const bytes = await file.arrayBuffer()
  const checksumSha256 = await sha256Hex(bytes)
  let mediaAssetId: string | null = null

  try {
    const instruction = dataOrThrow<Schema<'MediaUploadInstructionResponse'>>(await api.POST('/media/uploads', {
      body: {
        contentType: file.type,
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
