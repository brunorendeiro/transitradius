import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { loadDepartures, type Origin } from './lib/departures'
import { searchStationsByName, type Departure, type TransportType } from './lib/transportApi'
import { formatDistance, walkMinutes } from './lib/geo'
import { formatClock, formatCountdown, minutesUntil } from './lib/time'

type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'
type DataStatus = 'idle' | 'loading' | 'ready' | 'error'
type GroupBy = 'none' | 'hour' | 'stop' | 'type' | 'distance'
type Toast = { id: number; message: string }

const RADIUS_OPTIONS = [1, 3, 5, 10]
const INTERVAL_OPTIONS = [
  { minutes: 60, label: 'Próxima hora' },
  { minutes: 120, label: 'Próximas duas horas' },
  { minutes: 180, label: 'Próximas três horas' },
]
const TYPE_OPTIONS: { key: TransportType | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'tram', label: 'Tram' },
  { key: 'bus', label: 'Autocarro' },
  { key: 'train', label: 'Comboio' },
  { key: 'boat', label: 'Barco' },
  { key: 'other', label: 'Outros' },
]
const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: 'none', label: 'Sem agrupar' },
  { key: 'hour', label: 'Hora' },
  { key: 'stop', label: 'Paragem' },
  { key: 'type', label: 'Tipo' },
  { key: 'distance', label: 'Distância' },
]

const TYPE_LABEL: Record<TransportType, string> = {
  tram: 'Tram',
  bus: 'Autocarro',
  train: 'Comboio',
  boat: 'Barco',
  other: 'Outro',
}

const TYPE_ICON: Record<TransportType, ReactElement> = {
  tram: (
    <path d="M4 16V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z M4 12h16 M8 22l1.5-3 M16 22l-1.5-3 M8 6V3h8v3" />
  ),
  bus: (
    <path d="M4 16V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z M4 12h16 M7 21v-2 M17 21v-2 M7 9h2 M15 9h2" />
  ),
  train: (
    <path d="M6 15V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v9a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z M6 11h12 M9 22l-2-3 M17 22l-2-3 M10 7h4" />
  ),
  boat: (
    <path d="M4 15h16l-2 5H6l-2-5Z M6 15V6l6-3 6 3v9 M9 15V9h6v6" />
  ),
  other: (
    <path d="M12 3v18 M3 12h18 M6 6l12 12 M18 6 6 18" />
  ),
}

function TransportIcon({ type }: { type: TransportType }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TYPE_ICON[type]}
    </svg>
  )
}

function useNowTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function groupDepartures(departures: Departure[], groupBy: GroupBy): [string, Departure[]][] {
  if (groupBy === 'none') return [['', departures]]
  const buckets = new Map<string, Departure[]>()
  for (const dep of departures) {
    let key: string
    if (groupBy === 'hour') {
      key = formatClock(dep.departureTimestamp).slice(0, 2) + 'h'
    } else if (groupBy === 'stop') {
      key = dep.stop.name
    } else if (groupBy === 'type') {
      key = TYPE_LABEL[dep.transportType]
    } else {
      const km = dep.stop.distanceKm
      if (km < 0.25) key = 'Até 250 m'
      else if (km < 0.5) key = '250–500 m'
      else if (km < 1) key = '500 m–1 km'
      else if (km < 2) key = '1–2 km'
      else if (km < 5) key = '2–5 km'
      else key = 'Mais de 5 km'
    }
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(dep)
  }
  return Array.from(buckets.entries())
}

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <motion.div
      className="departure-card skeleton"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <div className="skeleton-line w40" />
      <div className="skeleton-line w70" />
      <div className="skeleton-line w50" />
    </motion.div>
  )
}

function DepartureCard({ dep, now }: { dep: Departure; now: number }) {
  const mins = minutesUntil(dep.departureTimestamp, now)
  const urgent = mins <= 5
  return (
    <motion.div
      layout
      className={`departure-card${urgent ? ' urgent' : ''}`}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      whileHover={{ y: -3 }}
    >
      <div className="departure-top">
        <span className="departure-time">{formatClock(dep.departureTimestamp)}</span>
        <span className={`type-badge type-${dep.transportType}`}>
          <TransportIcon type={dep.transportType} />
          {TYPE_LABEL[dep.transportType]} {dep.line}
        </span>
      </div>
      <p className="departure-route">
        {dep.stop.name} <span className="arrow">→</span> {dep.destination}
      </p>
      <div className="departure-meta">
        <span>{formatDistance(dep.stop.distanceKm)}</span>
        <span>·</span>
        <span>🚶 {walkMinutes(dep.stop.distanceKm)} min a pé</span>
        <span>·</span>
        <span>{dep.operator}</span>
        {dep.platform && (
          <>
            <span>·</span>
            <span>Cais {dep.platform}</span>
          </>
        )}
      </div>
      <div className={`countdown${urgent ? ' urgent' : ''}`}>{formatCountdown(dep.departureTimestamp, now)}</div>
    </motion.div>
  )
}

export default function App() {
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [dataStatus, setDataStatus] = useState<DataStatus>('idle')
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [originLabel, setOriginLabel] = useState<string | null>(null)
  const [radiusKm, setRadiusKm] = useState(10)
  const [windowMinutes, setWindowMinutes] = useState(120)
  const [activeType, setActiveType] = useState<TransportType | 'all'>('all')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [departures, setDepartures] = useState<Departure[]>([])
  const [stopsFound, setStopsFound] = useState(0)
  const [manualQuery, setManualQuery] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const now = useNowTick(15_000)
  const toastId = useRef(0)

  const pushToast = useCallback((message: string) => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('unavailable')
      return
    }
    setLocationStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setOriginLabel(null)
        setLocationStatus('granted')
      },
      err => {
        setLocationStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }, [])

  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  const activeTypes = useMemo<TransportType[]>(
    () => (activeType === 'all' ? [] : [activeType]),
    [activeType],
  )

  const refresh = useCallback(async () => {
    if (!origin) return
    setDataStatus('loading')
    try {
      const result = await loadDepartures(origin, radiusKm, windowMinutes, activeTypes)
      setDepartures(result.departures)
      setStopsFound(result.stopsFound)
      setDataStatus('ready')
      setLastUpdated(Date.now())
    } catch {
      setDataStatus('error')
      pushToast('Não foi possível carregar os horários. Tenta novamente.')
    }
  }, [origin, radiusKm, windowMinutes, activeTypes, pushToast])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const id = setInterval(refresh, 90_000)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    setDepartures(prev => {
      const next = prev.filter(dep => dep.departureTimestamp >= now)
      return next.length === prev.length ? prev : next
    })
  }, [now])

  async function submitManualSearch(e: React.FormEvent) {
    e.preventDefault()
    const query = manualQuery.trim()
    if (!query) return
    try {
      const hits = await searchStationsByName(query)
      if (hits.length === 0) {
        pushToast(`Sem resultados para "${query}".`)
        return
      }
      const best = hits[0]
      setOrigin({ latitude: best.latitude, longitude: best.longitude })
      setOriginLabel(best.name)
      setLocationStatus('granted')
    } catch {
      pushToast('Pesquisa falhou. Tenta novamente.')
    }
  }

  const groups = useMemo(() => groupDepartures(departures, groupBy), [departures, groupBy])
  const showManualSearch = locationStatus === 'denied' || locationStatus === 'unavailable'
  const showResults = locationStatus === 'granted'

  return (
    <div className="app-shell">
      <div className="backdrop" aria-hidden="true" />
      <header>
        <div className="brand">
          <span className="brand-mark">TR</span>
          <div>
            <strong>TransitRadius</strong>
            <small>Suíça · horários oficiais planeados</small>
          </div>
        </div>
        <div className="clock">{formatClock(now)}</div>
      </header>

      <main>
        <section className="hero">
          <h1>Descobre todas as partidas planeadas nas próximas horas à tua volta.</h1>
          <p>Horários oficiais de transportes públicos, organizados por proximidade e hora.</p>

          <div className="status-row">
            {locationStatus === 'requesting' && <span className="pill pill-loading">A pedir localização…</span>}
            {locationStatus === 'granted' && (
              <span className="pill pill-ok">
                {originLabel ? `Localização: ${originLabel}` : 'Localização atual encontrada'}
              </span>
            )}
            {locationStatus === 'denied' && <span className="pill pill-warn">Localização recusada</span>}
            {locationStatus === 'unavailable' && <span className="pill pill-warn">Localização indisponível</span>}
            {locationStatus !== 'requesting' && (
              <button className="ghost small" onClick={requestLocation}>Usar localização atual</button>
            )}
          </div>
        </section>

        {showManualSearch && (
          <motion.form
            className="manual-search"
            onSubmit={submitManualSearch}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <input
              value={manualQuery}
              onChange={e => setManualQuery(e.target.value)}
              placeholder="Pesquisar por cidade ou código postal (ex. Basel, Zürich)"
            />
            <button type="submit" className="primary small">Pesquisar</button>
          </motion.form>
        )}

        {showResults && (
          <>
            <section className="controls">
              <div className="control-group">
                <span className="control-label">Raio</span>
                <div className="button-group">
                  {RADIUS_OPTIONS.map(r => (
                    <button key={r} className={radiusKm === r ? 'active' : ''} onClick={() => setRadiusKm(r)}>
                      {r} km
                    </button>
                  ))}
                </div>
              </div>
              <div className="control-group">
                <span className="control-label">Intervalo</span>
                <div className="button-group">
                  {INTERVAL_OPTIONS.map(opt => (
                    <button
                      key={opt.minutes}
                      className={windowMinutes === opt.minutes ? 'active' : ''}
                      onClick={() => setWindowMinutes(opt.minutes)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="control-group">
                <span className="control-label">Transporte</span>
                <div className="button-group wrap">
                  {TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      className={activeType === opt.key ? 'active' : ''}
                      onClick={() => setActiveType(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="control-group">
                <span className="control-label">Agrupar por</span>
                <div className="button-group wrap">
                  {GROUP_OPTIONS.map(opt => (
                    <button key={opt.key} className={groupBy === opt.key ? 'active' : ''} onClick={() => setGroupBy(opt.key)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="results-summary">
              <span>{stopsFound} {stopsFound === 1 ? 'paragem encontrada' : 'paragens encontradas'}</span>
              <span>·</span>
              <span>{departures.length} {departures.length === 1 ? 'partida' : 'partidas'}</span>
              {lastUpdated && <span className="updated">Atualizado às {formatClock(lastUpdated)}</span>}
            </section>

            {dataStatus === 'loading' && departures.length === 0 && (
              <div className="departure-grid">
                {[0, 1, 2, 3].map(i => (
                  <SkeletonCard key={i} delay={i * 0.06} />
                ))}
              </div>
            )}

            {dataStatus === 'error' && (
              <div className="empty-state">
                <span>⚠️</span>
                <h2>Erro ao carregar os horários</h2>
                <p>Verifica a ligação e tenta novamente.</p>
                <button className="ghost small" onClick={refresh}>Tentar novamente</button>
              </div>
            )}

            {dataStatus === 'ready' && stopsFound === 0 && (
              <div className="empty-state">
                <span>📍</span>
                <h2>Nenhuma paragem encontrada</h2>
                <p>Tenta aumentar o raio de pesquisa.</p>
              </div>
            )}

            {dataStatus === 'ready' && stopsFound > 0 && departures.length === 0 && (
              <div className="empty-state">
                <span>🕒</span>
                <h2>Nenhuma partida nas próximas horas</h2>
                <p>Tenta aumentar o intervalo de tempo ou mudar o filtro de transporte.</p>
              </div>
            )}

            {dataStatus === 'ready' && departures.length > 0 && (
              <div className="groups">
                {groups.map(([label, items]) => (
                  <div key={label || 'all'} className="group-block">
                    {label && <h3 className="group-heading">{label}</h3>}
                    <motion.div layout className="departure-grid">
                      <AnimatePresence mode="popLayout">
                        {items.map(dep => (
                          <DepartureCard key={dep.id} dep={dep} now={now} />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <div className="toast-stack">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              className="toast"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <footer>
        <span>Dados oficiais via transport.opendata.ch — sem tempo real, apenas horários planeados.</span>
        <a href="https://vibe-portfolio-one.vercel.app/" target="_blank" rel="noreferrer">Created by Bruno Rendeiro</a>
        <span className="powered-badge">⚡ Powered by AI</span>
      </footer>
    </div>
  )
}
