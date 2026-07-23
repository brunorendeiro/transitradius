import { haversineKm } from './geo'
import { fetchNearbyStations, fetchStationboard, type Departure, type StationHit, type TransportType } from './transportApi'

export type Origin = { latitude: number; longitude: number }

export type DeparturesResult = {
  departures: Departure[]
  stopsFound: number
}

// The public API caps /locations at 10 hits regardless of radius, so very
// large radii on sparse stops may under-report — acceptable for the MVP.
const STATIONBOARD_LIMIT = 25

export async function loadDepartures(
  origin: Origin,
  radiusKm: number,
  windowMinutes: number,
  types: TransportType[],
): Promise<DeparturesResult> {
  const rawStations = await fetchNearbyStations(origin.latitude, origin.longitude)

  const stations: StationHit[] = rawStations
    .map(station => ({
      ...station,
      distanceKm: haversineKm(origin.latitude, origin.longitude, station.latitude, station.longitude),
    }))
    .filter(station => station.distanceKm! <= radiusKm)
    .sort((a, b) => a.distanceKm! - b.distanceKm!)

  if (stations.length === 0) {
    return { departures: [], stopsFound: 0 }
  }

  const now = Date.now()
  const windowEnd = now + windowMinutes * 60_000
  const typeSet = new Set(types)

  const boards = await Promise.all(
    stations.map(station =>
      fetchStationboard(station, STATIONBOARD_LIMIT).catch(() => [] as Departure[]),
    ),
  )

  const departures = boards
    .flat()
    .filter(dep => dep.departureTimestamp >= now && dep.departureTimestamp <= windowEnd)
    .filter(dep => typeSet.size === 0 || typeSet.has(dep.transportType))
    .sort((a, b) => a.departureTimestamp - b.departureTimestamp)

  return { departures, stopsFound: stations.length }
}
