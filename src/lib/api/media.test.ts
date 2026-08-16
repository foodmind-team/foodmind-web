import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/server'
import { MAX_MEDIA_BYTES, mediaValidationMessage, sha256Hex, uploadRecordMedia } from './media'

const origin = 'http://localhost:3000'
const assetId = '00000000-0000-4000-8000-000000000077'

function imageFile(bytes = new TextEncoder().encode('hello'), type = 'image/png') {
  return {
    name: 'meal.png',
    size: bytes.byteLength,
    type,
    arrayBuffer: async () => bytes.buffer,
  } as File
}

describe('bounded record media upload', () => {
  it('validates the backend file constraints before requesting an instruction', () => {
    expect(mediaValidationMessage({ type: 'image/gif', size: 1 })).toContain('JPEG')
    expect(mediaValidationMessage({ type: 'image/png', size: 0 })).toContain('not empty')
    expect(mediaValidationMessage({ type: 'image/webp', size: MAX_MEDIA_BYTES + 1 })).toContain('5 MB')
    expect(mediaValidationMessage({ type: 'image/jpeg', size: MAX_MEDIA_BYTES })).toBeNull()
  })

  it('computes the lowercase SHA-256 checksum required by the API', async () => {
    expect(await sha256Hex(new TextEncoder().encode('hello').buffer)).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('creates, transfers without credentials, and finalises a ready asset', async () => {
    const declarations = vi.fn()
    const storageRequests = vi.fn()
    server.use(
      http.post(`${origin}/api/v1/media/uploads`, async ({ request }) => {
        declarations(await request.json())
        return HttpResponse.json({
          mediaAssetId: assetId,
          status: 'PENDING',
          uploadUrl: 'https://storage.example.test/upload-once',
          requiredHeaders: { 'Content-Type': 'image/png', 'Content-Length': '999', 'x-amz-checksum-sha256': 'signed-checksum' },
          expiresAt: '2026-08-01T12:05:00Z',
        }, { status: 201 })
      }),
      http.put('https://storage.example.test/upload-once', ({ request }) => {
        storageRequests({ authorization: request.headers.get('authorization'), contentLength: request.headers.get('content-length'), credentials: request.credentials, type: request.headers.get('content-type') })
        return new HttpResponse(null, { status: 200 })
      }),
      http.post(`${origin}/api/v1/media/${assetId}/finalise`, () => HttpResponse.json({ mediaAssetId: assetId, status: 'READY', contentType: 'image/png', byteSize: 5, createdAt: '2026-08-01T12:00:00Z', finalisedAt: '2026-08-01T12:00:01Z' })),
    )

    await expect(uploadRecordMedia(imageFile())).resolves.toMatchObject({ mediaAssetId: assetId, status: 'READY' })
    expect(declarations).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'image/png', byteSize: 5, checksumSha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' }))
    expect(storageRequests).toHaveBeenCalledWith(expect.objectContaining({ authorization: null, credentials: 'omit', type: 'image/png' }))
    expect(storageRequests.mock.calls[0]?.[0].contentLength).not.toBe('999')
  })

  it('deletes a pending asset when storage transfer fails', async () => {
    const cleanup = vi.fn()
    server.use(
      http.post(`${origin}/api/v1/media/uploads`, () => HttpResponse.json({ mediaAssetId: assetId, status: 'PENDING', uploadUrl: 'https://storage.example.test/fails', requiredHeaders: {}, expiresAt: '2026-08-01T12:05:00Z' }, { status: 201 })),
      http.put('https://storage.example.test/fails', () => new HttpResponse(null, { status: 503 })),
      http.delete(`${origin}/api/v1/media/${assetId}`, () => { cleanup(); return new HttpResponse(null, { status: 204 }) }),
    )

    await expect(uploadRecordMedia(imageFile())).rejects.toThrow(/secure storage/i)
    expect(cleanup).toHaveBeenCalledOnce()
  })
})
