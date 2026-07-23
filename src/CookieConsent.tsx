import { useEffect, useState } from 'react'
import { getStoredConsent, setConsent } from './analytics'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(getStoredConsent() === null)
  }, [])

  if (!visible) return null

  const decide = (value: 'granted' | 'denied') => {
    setConsent(value)
    setVisible(false)
  }

  return (
    <div className="cookie-consent" role="dialog" aria-live="polite" aria-label="Cookies">
      <p>Uso o Google Analytics para perceber quantas pessoas visitam este projeto. Aceitas cookies analíticos?</p>
      <div className="cookie-actions">
        <button className="cookie-reject" onClick={() => decide('denied')}>Recusar</button>
        <button className="cookie-accept" onClick={() => decide('granted')}>Aceitar</button>
      </div>
    </div>
  )
}
