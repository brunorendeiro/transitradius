export function formatClock(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  })
}

export function formatCountdown(timestampMs: number, nowMs: number): string {
  const diffMin = Math.round((timestampMs - nowMs) / 60_000)
  if (diffMin <= 0) return 'Parte agora'
  if (diffMin === 1) return 'Parte dentro de 1 minuto'
  return `Parte dentro de ${diffMin} minutos`
}

export function minutesUntil(timestampMs: number, nowMs: number): number {
  return Math.max(0, Math.round((timestampMs - nowMs) / 60_000))
}
