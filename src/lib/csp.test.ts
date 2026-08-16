import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, exactS3Origin } from './csp'

describe('media Content Security Policy', () => {
  it('allows one exact configured virtual-hosted S3 origin for PUT and image reads', () => {
    const origin = 'https://foodmind-private.s3.ap-southeast-1.amazonaws.com'
    const policy = contentSecurityPolicy(origin)

    expect(exactS3Origin(`${origin}/`)).toBe(origin)
    expect(policy).toContain(`connect-src 'self' ${origin}`)
    expect(policy).toContain(`img-src 'self' data: blob: ${origin}`)
    expect(policy).not.toContain('*.amazonaws.com')
  })

  it('fails closed for non-S3, insecure, path-bearing, or malformed values', () => {
    expect(exactS3Origin('https://example.com')).toBeNull()
    expect(exactS3Origin('http://foodmind.s3.us-east-1.amazonaws.com')).toBeNull()
    expect(exactS3Origin('https://foodmind.s3.us-east-1.amazonaws.com/object')).toBeNull()
    expect(exactS3Origin('not a url')).toBeNull()
    expect(contentSecurityPolicy('https://example.com')).toContain("connect-src 'self';")
  })
})
