import { mkdir, writeFile } from 'node:fs/promises'

const workerSource = `const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function exactS3Origin(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    const hasUnexpectedParts = url.protocol !== 'https:'
      || Boolean(url.username)
      || Boolean(url.password)
      || url.pathname !== '/'
      || Boolean(url.search)
      || Boolean(url.hash)
    const s3VirtualHost = /^[a-z0-9][a-z0-9.-]*\\.s3(?:[.-][a-z0-9-]+)?\\.amazonaws\\.com$/
    if (hasUnexpectedParts || !s3VirtualHost.test(url.hostname.toLowerCase())) return null
    return url.origin
  } catch {
    return null
  }
}

function contentSecurityPolicy(mediaOrigin) {
  const origin = exactS3Origin(mediaOrigin)
  const storageSource = origin ? ' ' + origin : ''
  return "default-src 'self'; connect-src 'self'" + storageSource + "; img-src 'self' data: blob:" + storageSource + "; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
}

function secureHeaders(response, env) {
  const headers = new Headers(response.headers)
  headers.set('Content-Security-Policy', contentSecurityPolicy(env.FOODMIND_MEDIA_ORIGIN))
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function safeGatewayError(request) {
  const traceId = request.headers.get('X-Correlation-ID') || crypto.randomUUID()
  return new Response(JSON.stringify({
    timestamp: new Date().toISOString(),
    status: 502,
    code: 'UPSTREAM_UNAVAILABLE',
    message: 'FoodMind is temporarily unavailable.',
    path: new URL(request.url).pathname,
    traceId,
    fieldErrors: [],
  }), { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Correlation-ID': traceId } })
}

async function proxyApi(request, env) {
  if (!env.FOODMIND_BACKEND_ORIGIN) return safeGatewayError(request)
  let backendOrigin
  try {
    backendOrigin = new URL(env.FOODMIND_BACKEND_ORIGIN)
    if (!['http:', 'https:'].includes(backendOrigin.protocol)) return safeGatewayError(request)
  } catch {
    return safeGatewayError(request)
  }

  const incoming = new URL(request.url)
  const upstream = new URL(incoming.pathname + incoming.search, backendOrigin.origin)
  const headers = new Headers(request.headers)
  hopByHopHeaders.forEach((header) => headers.delete(header))
  headers.delete('host')
  headers.set('X-Forwarded-Host', incoming.host)
  headers.set('X-Forwarded-Proto', incoming.protocol.replace(':', ''))

  try {
    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    })
    const responseHeaders = new Headers(response.headers)
    hopByHopHeaders.forEach((header) => responseHeaders.delete(header))
    responseHeaders.set('Cache-Control', 'no-store')
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders })
  } catch {
    return safeGatewayError(request)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/v1' || url.pathname.startsWith('/api/v1/')) {
      return secureHeaders(await proxyApi(request, env), env)
    }

    let response = await env.ASSETS.fetch(request)
    const acceptsHtml = request.headers.get('accept')?.includes('text/html')
    if (response.status === 404 && acceptsHtml) {
      response = await env.ASSETS.fetch(new Request(new URL('/', request.url), request))
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('text/html')) {
      const body = (await response.text()).replaceAll('__FOODMIND_ORIGIN__', new URL(request.url).origin)
      const headers = new Headers(response.headers)
      headers.delete('content-length')
      response = new Response(body, { status: response.status, statusText: response.statusText, headers })
    }
    return secureHeaders(response, env)
  },
}
`

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true })
await writeFile(new URL('../dist/server/index.js', import.meta.url), workerSource)
