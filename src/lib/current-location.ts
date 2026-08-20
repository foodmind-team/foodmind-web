export type CurrentCoordinates = {
  latitude: number
  longitude: number
}

export class CurrentLocationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CurrentLocationError'
  }
}

export function requestCurrentLocation(): Promise<CurrentCoordinates> {
  if (!navigator.geolocation) {
    return Promise.reject(new CurrentLocationError('This browser cannot provide your current location.'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Allow access and try again.'
          : 'Your current location is unavailable. Check location services and try again.'
        reject(new CurrentLocationError(message))
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}
