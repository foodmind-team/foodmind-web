const catalogueImages: Readonly<Record<string, string>> = {
  // Local ML catalogue places.
  'fb61151e-a29a-507b-91b5-09907116fc35': '/explore/bistro-pasta.jpg',
  'ff90c8dc-7fe3-50c6-aaf0-8ea10f73c782': '/explore/udon.jpg',
  'a032d001-48a7-517a-bef0-95bc39640bca': '/explore/bistro-pasta.jpg',
  '5801e48d-a6bb-5ab5-b3e7-93791ea05ada': '/explore/burger-fries.jpg',
  '5ad2685a-0bad-528f-a067-54c3916fd7ac': '/explore/chana-masala.jpg',
  '92ec5b73-2358-548d-bbff-c8d5e4c49993': '/explore/mango-pomelo-sago.jpg',

  // Deterministic curated demo places.
  '21000000-0000-4000-8000-000000000001': '/explore/chicken-rice.jpg',
  '21000000-0000-4000-8000-000000000002': '/explore/nasi-lemak.jpg',
  '21000000-0000-4000-8000-000000000003': '/explore/chana-masala.jpg',
  '21000000-0000-4000-8000-000000000004': '/explore/chicken-rice.jpg',

  // Deterministic curated demo products.
  '23000000-0000-4000-8000-000000000001': '/explore/soy-milk.jpg',
  '23000000-0000-4000-8000-000000000002': '/explore/oatmeal.jpg',
  '23000000-0000-4000-8000-000000000003': '/explore/roasted-peanuts.jpg',
}

export function catalogueImageFor(sourceId: string) {
  return catalogueImages[sourceId] ?? null
}
