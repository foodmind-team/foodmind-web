import { describe, expect, it } from 'vitest'
import { catalogueImageFor } from './catalogue-images'

describe('catalogueImageFor', () => {
  it('returns representative local images for curated places and products', () => {
    expect(catalogueImageFor('ff90c8dc-7fe3-50c6-aaf0-8ea10f73c782')).toBe('/explore/udon.jpg')
    expect(catalogueImageFor('92ec5b73-2358-548d-bbff-c8d5e4c49993')).toBe('/explore/mango-pomelo-sago.jpg')
    expect(catalogueImageFor('21000000-0000-4000-8000-000000000004')).toBe('/explore/chicken-rice.jpg')
    expect(catalogueImageFor('23000000-0000-4000-8000-000000000003')).toBe('/explore/roasted-peanuts.jpg')
  })

  it('does not invent an image for group or unknown content', () => {
    expect(catalogueImageFor('00000000-0000-4000-8000-000000000051')).toBeNull()
  })
})
