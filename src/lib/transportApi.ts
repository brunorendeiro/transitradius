const API_BASE = 'https://transport.opendata.ch/v1'

export type StationHit = {
  id: string
  name: string
  latitude: number
  longitude: number
  /** Straight-line distance in km, only present when the query used coordinates. */
  distanceKm?: number
}

type RawLocation = {
  id: string | null
  name: string | null
  coordinate: { x: number | null; y: number | null } | null
  distance: number | null
}

export async function fetchNearbyStations(lat: number, lon: number): Promise<StationHit[]> {
  const url = `${API_BASE}/locations?x=${lat}&y=${lon}&type=station`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`locations request failed (${res.status})`)
  const data = (await res.json()) as { stations: RawLocation[] }
  return data.stations
    .filter((s): s is RawLocation & { id: string; name: string; coordinate: { x: number; y: number } } =>
      Boolean(s.id && s.name && s.coordinate?.x && s.coordinate?.y),
    )
    .map(s => ({
      id: s.id,
      name: s.name,
      latitude: s.coordinate.x,
      longitude: s.coordinate.y,
      distanceKm: s.distance != null ? s.distance / 1000 : undefined,
    }))
}

export async function searchStationsByName(query: string): Promise<StationHit[]> {
  const url = `${API_BASE}/locations?query=${encodeURIComponent(query)}&type=station`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`locations search failed (${res.status})`)
  const data = (await res.json()) as { stations: RawLocation[] }
  return data.stations
    .filter((s): s is RawLocation & { id: string; name: string; coordinate: { x: number; y: number } } =>
      Boolean(s.id && s.name && s.coordinate?.x && s.coordinate?.y),
    )
    .map(s => ({
      id: s.id,
      name: s.name,
      latitude: s.coordinate.x,
      longitude: s.coordinate.y,
    }))
}

export type TransportType = 'tram' | 'bus' | 'train' | 'boat' | 'other'

export type RawPassListEntry = {
  station: { name: string | null }
  arrival: string | null
  departure: string | null
}

export type RawStopover = {
  name: string | null
  category: string | null
  number: string | null
  operator: string | null
  to: string | null
  stop: {
    departure: string | null
    departureTimestamp: number | null
    platform: string | null
    prognosis?: { platform: string | null } | null
  }
  passList?: RawPassListEntry[] | null
}

export type RouteStop = {
  name: string
  time: string | null
}

export type Departure = {
  id: string
  departureTime: string
  departureTimestamp: number
  transportType: TransportType
  line: string
  destination: string
  operator: string
  platform: string | null
  stop: {
    id: string
    name: string
    latitude: number
    longitude: number
    distanceKm: number
  }
  routeStops: RouteStop[]
}

const CATEGORY_MAP: Record<string, TransportType> = {
  T: 'tram',
  TRAM: 'tram',
  B: 'bus',
  BUS: 'bus',
  NFB: 'bus',
  BAT: 'boat',
  SHIP: 'boat',
  S: 'train',
  SN: 'train',
  R: 'train',
  RE: 'train',
  IR: 'train',
  IC: 'train',
  ICE: 'train',
  EC: 'train',
  TGV: 'train',
  ATZ: 'train',
  EXT: 'train',
  PE: 'train',
  RJ: 'train',
}

export function categorize(category: string | null): TransportType {
  if (!category) return 'other'
  return CATEGORY_MAP[category.toUpperCase()] ?? 'other'
}

export async function fetchStationboard(station: StationHit, limit: number): Promise<Departure[]> {
  const url = `${API_BASE}/stationboard?id=${station.id}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`stationboard request failed for ${station.name} (${res.status})`)
  const data = (await res.json()) as { stationboard: RawStopover[] }
  return data.stationboard
    .filter(entry => entry.stop?.departure && entry.stop?.departureTimestamp)
    .map((entry, index) => ({
      id: `${station.id}-${entry.stop.departureTimestamp}-${entry.number ?? index}`,
      departureTime: entry.stop.departure as string,
      departureTimestamp: (entry.stop.departureTimestamp as number) * 1000,
      transportType: categorize(entry.category),
      line: entry.number ?? entry.name ?? '—',
      destination: entry.to ?? '—',
      operator: entry.operator ?? '—',
      platform: entry.stop.platform,
      stop: {
        id: station.id,
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        distanceKm: station.distanceKm ?? 0,
      },
      routeStops: (entry.passList ?? [])
        .filter((p): p is RawPassListEntry & { station: { name: string } } => Boolean(p.station?.name))
        .map(p => ({ name: p.station.name, time: p.departure ?? p.arrival })),
    }))
}
