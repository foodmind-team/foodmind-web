import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPinned, Navigation } from 'lucide-react'
import { api, dataOrThrow, errorMessage, type Schema } from '../../lib/api/client'

type Place = Schema<'CataloguePlaceResponse'>
type Route = Schema<'WalkingRouteResponse'>

export function PlaceMap({ place }: { place: Place }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const routeLayer = useRef<L.Polyline | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const coordinates = place.coordinates

  useEffect(() => {
    if (!container.current || !coordinates) return
    const current = L.map(container.current, { scrollWheelZoom: false }).setView([coordinates.latitude, coordinates.longitude], 16)
    L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
      maxZoom: 18, minZoom: 11,
      attribution: '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> © Singapore Land Authority',
    }).addTo(current)
    L.marker([coordinates.latitude, coordinates.longitude]).addTo(current).bindPopup(place.name)
    map.current = current
    return () => { current.remove(); map.current = null; routeLayer.current = null }
  }, [coordinates, place.name])

  async function showRoute() {
    if (!coordinates || !navigator.geolocation) { setMessage('Your browser cannot provide a current location.'); return }
    setLoading(true); setMessage(null)
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const next = dataOrThrow<Route>(await api.GET('/catalogue/places/{id}/walking-route', { params: { path: { id: place.id }, query: { originLatitude: position.coords.latitude, originLongitude: position.coords.longitude } } }))
        setRoute(next)
        if (map.current) {
          routeLayer.current?.remove()
          routeLayer.current = L.polyline(next.coordinates.map(([longitude, latitude]) => [latitude, longitude])).addTo(map.current)
          map.current.fitBounds(routeLayer.current.getBounds(), { padding: [24, 24] })
        }
      } catch (error) { setMessage(errorMessage(error)) } finally { setLoading(false) }
    }, () => { setLoading(false); setMessage('Location permission is needed to show a walking route. Your location is not saved.') }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 })
  }

  if (!coordinates) return <section className="detail-card place-map-card"><p className="eyebrow">Location</p><h2>Map unavailable</h2><p>This controlled place does not yet have verified coordinates.</p></section>
  return <section className="detail-card place-map-card"><p className="eyebrow">OneMap location</p><h2><MapPinned size={19} /> Find this place</h2><div ref={container} className="place-map" aria-label={`Map showing ${place.name}`} /> <button className="secondary-action" type="button" disabled={loading} onClick={() => void showRoute()}><Navigation size={16} /> {loading ? 'Finding route…' : 'Use my location for walking route'}</button>{route && <p className="map-route-summary">Walking route: {(route.distanceMeters / 1000).toFixed(1)} km · {Math.max(1, Math.round(route.durationSeconds / 60))} min. Your location is not saved.</p>}{message && <p className="form-alert" role="alert">{message}</p>}</section>
}
