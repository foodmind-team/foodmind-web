import { beforeEach, describe, expect, it } from 'vitest'
import { loadCookingPreferences, saveCookingPreferences } from './cooking-preferences'

describe('cooking preferences', () => {
  beforeEach(() => localStorage.clear())

  it('persists only the normalized cooking region', () => {
    localStorage.setItem('foodmind:cooking-preferences:v1', JSON.stringify({ region: 'us', requiredDietaryTagCodes: ['VEGAN'], avoidAllergenCodes: ['PEANUT'] }))
    expect(loadCookingPreferences()).toEqual({ region: 'US' })

    saveCookingPreferences({ region: 'cn' })

    expect(loadCookingPreferences()).toEqual({ region: 'CN' })
    expect(JSON.parse(localStorage.getItem('foodmind:cooking-preferences:v1') || '{}')).toEqual({ region: 'CN' })
  })
})
