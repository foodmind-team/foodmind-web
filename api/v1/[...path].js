const hopByHopHeaders = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
])

export const config = { api: { bodyParser: false } }

function safeError(request, response) {
  const traceId = request.headers['x-correlation-id'] || crypto.randomUUID()
  response.status(502).setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Correlation-ID', traceId)
  response.end(JSON.stringify({
    timestamp: new Date().toISOString(), status: 502, code: 'UPSTREAM_UNAVAILABLE',
    message: 'FoodMind is temporarily unavailable.', path: request.url, traceId, fieldErrors: [],
  }))
}

export default async function handler(request, response) {
  let origin
  try {
    origin = new URL(process.env.FOODMIND_BACKEND_ORIGIN)
    if (!['http:', 'https:'].includes(origin.protocol)) return safeError(request, response)
  } catch {
    return safeError(request, response)
  }

  const incoming = new URL(request.url, 'https://foodmind.invalid')
  const upstream = new URL(incoming.pathname + incoming.search, origin.origin)
  const headers = new Headers()
  Object.entries(request.headers).forEach(([name, value]) => {
    if (!hopByHopHeaders.has(name.toLowerCase()) && value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
  })

  try {
    const chunks = []
    if (!['GET', 'HEAD'].includes(request.method)) for await (const chunk of request) chunks.push(chunk)
    const upstreamResponse = await fetch(upstream, {
      method: request.method, headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
      redirect: 'manual',
    })
    response.status(upstreamResponse.status)
    upstreamResponse.headers.forEach((value, name) => {
      if (!hopByHopHeaders.has(name.toLowerCase()) && name.toLowerCase() !== 'set-cookie') response.setHeader(name, value)
    })
    const cookies = upstreamResponse.headers.getSetCookie?.() || []
    if (cookies.length) response.setHeader('Set-Cookie', cookies)
    response.setHeader('Cache-Control', 'no-store')
    response.end(Buffer.from(await upstreamResponse.arrayBuffer()))
  } catch {
    safeError(request, response)
  }
}
