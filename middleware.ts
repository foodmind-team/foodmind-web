import { next } from '@vercel/functions'
import { contentSecurityPolicy } from './src/lib/csp.js'

export const config = {
  matcher: '/(.*)',
}

export default function middleware() {
  const response = next()
  response.headers.set('Content-Security-Policy', contentSecurityPolicy(process.env.FOODMIND_MEDIA_ORIGIN))
  return response
}
