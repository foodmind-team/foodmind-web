import { mkdir, writeFile } from 'node:fs/promises'

const workerSource = `export default {
  async fetch(request, env) {
    let response = await env.ASSETS.fetch(request)
    const acceptsHtml = request.headers.get('accept')?.includes('text/html')

    if (response.status === 404 && acceptsHtml) {
      const fallbackUrl = new URL('/', request.url)
      response = await env.ASSETS.fetch(new Request(fallbackUrl, request))
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      return response
    }

    const origin = new URL(request.url).origin
    const body = (await response.text()).replaceAll('__FOODMIND_ORIGIN__', origin)
    const headers = new Headers(response.headers)
    headers.delete('content-length')

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
}
`

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true })
await writeFile(new URL('../dist/server/index.js', import.meta.url), workerSource)
