import { describe, expect, it } from 'vitest'
import { queryKeys } from './query-keys'

describe('query keys', () => {
  it('normalizes arrays and removes empty values', () => {
    expect(queryKeys.records.history({ types: ['DRINK', 'FOOD'], page: 0, unused: undefined, empty: '' })).toEqual([
      'records',
      'history',
      { types: ['DRINK', 'FOOD'], page: 0 },
    ])
  })

  it('keeps user-scoped resources distinct', () => {
    expect(queryKeys.groups.detail('one')).not.toEqual(queryKeys.groups.detail('two'))
    expect(queryKeys.chat.messages('chat')).toEqual(['chat', 'chat', 'messages'])
  })

  it('builds stable keys for every server-owned resource', () => {
    expect(queryKeys.catalogue.reference()).toEqual(['catalogue', 'reference'])
    expect(queryKeys.catalogue.detail('place', 'p1')).toEqual(['catalogue', 'place', 'p1'])
    expect(queryKeys.users.me()).toEqual(['users', 'me'])
    expect(queryKeys.users.preferences()).toEqual(['users', 'preferences'])
    expect(queryKeys.records.detail('food', 'r1')).toEqual(['records', 'food', 'r1'])
    expect(queryKeys.groups.list()).toEqual(['groups'])
    expect(queryKeys.groups.members('g1')).toEqual(['groups', 'g1', 'members'])
    expect(queryKeys.groups.feed('g1')).toEqual(['groups', 'g1', 'feed'])
    expect(queryKeys.recommendations.detail('s1')).toEqual(['recommendations', 's1'])
    expect(queryKeys.recommendations.history()).toEqual(['recommendations', 'history'])
    expect(queryKeys.saved.list()).toEqual(['saved', 0])
    expect(queryKeys.saved.list(2)).toEqual(['saved', 2])
    expect(queryKeys.explore.feed({ groupId: 'g1' })).toEqual(['explore', { groupId: 'g1' }])
    expect(queryKeys.explore.search({ q: 'ramen' })).toEqual(['search', { q: 'ramen' }])
    expect(queryKeys.cooking.detail('c1')).toEqual(['cooking', 'c1'])
    expect(queryKeys.cooking.history()).toEqual(['cooking', 'history'])
    expect(queryKeys.chat.sessions()).toEqual(['chat', 'sessions'])
    expect(queryKeys.chat.detail('c1')).toEqual(['chat', 'c1'])
    expect(queryKeys.analytics.dashboard({ range: 'week' })).toEqual(['analytics', { range: 'week' }])
    expect(queryKeys.analytics.recap('2026-07-27')).toEqual(['analytics', 'recap', '2026-07-27'])
  })
})
