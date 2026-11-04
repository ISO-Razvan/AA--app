import { useTipuriPrintate } from '../hooks/useTipuriPrintate'
import './EticheaPrintare.css'

// Semn „PRINTARE" pe lucrările al căror tip se printează (nu se frezează) — ca un
// tehnician nou să nu le frezeze din greșeală. Nu desenează nimic pentru alte tipuri.
export default function EticheaPrintare({ tip, className = '' }) {
  const printate = useTipuriPrintate()
  if (!tip || !printate?.has(tip)) return null
  return (
    <span className={`eticheta-printare ${className}`} title="Această lucrare se printează (nu se frezează)">
      PRINTARE
    </span>
  )
}
