import { describe, expect, it, vi } from 'vitest'
import { installChunkRecovery, isStaleChunkError } from './chunk-recovery'

function preloadError(message: string) {
  const event = new Event('vite:preloadError', { cancelable: true }) as VitePreloadErrorEvent
  event.payload = new Error(message)
  return event
}

describe('stale chunk recovery', () => {
  it('recognises JavaScript and CSS deployment rollover failures', () => {
    expect(isStaleChunkError(new Error('Failed to fetch dynamically imported module: /assets/Cooking.js'))).toBe(true)
    expect(isStaleChunkError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isStaleChunkError(new Error('Unable to preload CSS for /assets/app.css'))).toBe(true)
    expect(isStaleChunkError(new Error('Network request failed'))).toBe(false)
  })

  it('reloads once for each failed asset and lets a repeated failure reach the boundary', () => {
    const reload = vi.fn()
    const remove = installChunkRecovery({ reload })
    const first = preloadError('Failed to fetch dynamically imported module: /assets/Cooking-old.js')
    const repeat = preloadError('Failed to fetch dynamically imported module: /assets/Cooking-old.js')
    const nextDeployment = preloadError('Failed to fetch dynamically imported module: /assets/Cooking-new.js')

    window.dispatchEvent(first)
    window.dispatchEvent(repeat)
    window.dispatchEvent(nextDeployment)

    expect(first.defaultPrevented).toBe(true)
    expect(repeat.defaultPrevented).toBe(false)
    expect(nextDeployment.defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)

    remove()
  })
})
