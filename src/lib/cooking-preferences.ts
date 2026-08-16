export type CookingPreferences = {
  region: string
}

const STORAGE_KEY = 'foodmind:cooking-preferences:v1'

export const DEFAULT_COOKING_PREFERENCES: CookingPreferences = {
  region: 'SG',
}

export function loadCookingPreferences(): CookingPreferences {
  if (typeof window === 'undefined') return DEFAULT_COOKING_PREFERENCES
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, unknown>
    return {
      region: typeof parsed.region === 'string' && parsed.region.trim() ? parsed.region.trim().toUpperCase() : 'SG',
    }
  } catch {
    return DEFAULT_COOKING_PREFERENCES
  }
}

export function saveCookingPreferences(preferences: CookingPreferences) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    region: preferences.region.trim().toUpperCase() || 'SG',
  }))
}
