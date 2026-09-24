import { useEffect, useState } from 'react'
import { getStoredConsent } from './analytics'

const AD_CLIENT = 'ca-pub-4561414438757131'
const AD_SLOT = '9602939065'

/**
 * Bloco de anúncio manual e responsivo. Ao contrário dos auto ads (desligados em
 * analytics.ts), este componente só deve ser usado em ecrãs com conteúdo real
 * substancial (ex. lista de partidas encontradas) — nunca no ecrã de mapa/pesquisa,
 * que tem pouco ou nenhum conteúdo, para respeitar as políticas do AdSense sobre
 * anúncios em ecrãs sem conteúdo do publicador.
 */
export default function AdSlot() {
  const [granted, setGranted] = useState(false)

  useEffect(() => {
    setGranted(getStoredConsent() === 'granted')
  }, [])

  useEffect(() => {
    if (!granted) return
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
    } catch {
      /* script ainda não carregado ou bloqueado por um ad blocker */
    }
  }, [granted])

  if (!granted) return null

  return (
    <div className="ad-slot">
      <span className="ad-label">Publicidade</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={AD_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
