import { describe, expect, it } from 'vitest'
import { isEnglishScriptInput } from './english-input'

describe('English-only recipe input policy', () => {
  it('accepts Latin text, measurements, punctuation, and emoji', () => {
    expect(isEnglishScriptInput('Crème pasta — 200 g, bake at 180 °C 😊')).toBe(true)
  })

  it.each(['Tomato 番茄 pasta', 'トマト salad', '토마토 salad'])('rejects mixed or non-Latin text: %s', (value) => {
    expect(isEnglishScriptInput(value)).toBe(false)
  })
})
