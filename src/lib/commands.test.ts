import { describe, expect, it, vi } from 'vitest'
import { clampCandidateIndex, prepareCommand, quotedVersion, usesRecommendationFallback } from './commands'

describe('idempotent commands', () => {
  it('reuses the exact key and payload while an unchanged command is pending', () => {
    const createKey = vi.fn().mockReturnValueOnce('key-1').mockReturnValueOnce('key-2')
    const first = prepareCommand(null, { groupId: 'g1', budget: 30 }, createKey)
    const retry = prepareCommand(first, { groupId: 'g1', budget: 30 }, createKey)
    expect(retry).toBe(first)
    expect(createKey).toHaveBeenCalledTimes(1)
  })

  it('uses a new key when the command payload changes or a completed command starts again', () => {
    const createKey = vi.fn().mockReturnValueOnce('key-1').mockReturnValueOnce('key-2').mockReturnValueOnce('key-3')
    const first = prepareCommand(null, { budget: 30 }, createKey)
    expect(prepareCommand(first, { budget: 40 }, createKey).key).toBe('key-2')
    expect(prepareCommand(null, { budget: 30 }, createKey).key).toBe('key-3')
  })
})

describe('decision and concurrency helpers', () => {
  it('quotes record versions for exact If-Match semantics', () => {
    expect(quotedVersion(7)).toBe('"7"')
  })

  it('clamps candidate selection to the returned ordered set', () => {
    expect(clampCandidateIndex(-1, 3)).toBe(0)
    expect(clampCandidateIndex(1, 3)).toBe(1)
    expect(clampCandidateIndex(8, 3)).toBe(2)
    expect(clampCandidateIndex(1, 0)).toBe(0)
  })

  it('recognizes backend and deterministic fallback success', () => {
    expect(usesRecommendationFallback('FALLBACK_SUCCEEDED')).toBe(true)
    expect(usesRecommendationFallback('SUCCEEDED', 'SUCCEEDED')).toBe(true)
    expect(usesRecommendationFallback('SUCCEEDED', 'NOT_REQUIRED')).toBe(false)
  })
})
