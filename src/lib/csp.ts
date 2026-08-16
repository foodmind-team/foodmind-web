const S3_VIRTUAL_HOST_PATTERN = /^[a-z0-9][a-z0-9.-]*\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/

export function exactS3Origin(value?: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    const hasUnexpectedParts = url.protocol !== 'https:'
      || Boolean(url.username)
      || Boolean(url.password)
      || url.pathname !== '/'
      || Boolean(url.search)
      || Boolean(url.hash)
    if (hasUnexpectedParts || !S3_VIRTUAL_HOST_PATTERN.test(url.hostname.toLowerCase())) return null
    return url.origin
  } catch {
    return null
  }
}

export function contentSecurityPolicy(mediaOrigin?: string | null) {
  const origin = exactS3Origin(mediaOrigin)
  const storageSource = origin ? ` ${origin}` : ''
  return `default-src 'self'; connect-src 'self'${storageSource}; img-src 'self' data: blob:${storageSource}; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
}
