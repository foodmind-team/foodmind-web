import { beforeEach, describe, expect, it } from 'vitest'
import { loadCookingPreferences, saveCookingPreferences } from './cooking-preferences'

describe('cooking preferences', () => {
  beforeEach(() => localStorage.clear())

  it('persists normalized plan constraints', () => {
    saveCookingPreferences({ region: 'cn', requiredDietaryTagCodes: ['vegan', 'VEGAN'], avoidAllergenCodes: ['peanut'] })

    expect(loadCookingPreferences()).toEqual({
      region: 'CN',
      requiredDietaryTagCodes: ['VEGAN'],
      avoidAllergenCodes: ['PEANUT'],
    })
  })
})
