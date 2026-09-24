import './DeschideFisaButton.css'

// Iconiță mică „deschide fișa comenzii" — pe carduri trase cu drag & drop
// sau în rânduri clicabile. Oprește pointerdown/click, ca să nu pornească
// tragerea cardului și nici acțiunea elementului părinte.
export default function DeschideFisaButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`deschide-fisa-btn ${className}`}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label="Deschide fișa comenzii"
      title="Deschide fișa comenzii"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M9.5 2.5H13.5V6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.5 2.5L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M11.5 9.5V12.5C11.5 13.05 11.05 13.5 10.5 13.5H3.5C2.95 13.5 2.5 13.05 2.5 12.5V5.5C2.5 4.95 2.95 4.5 3.5 4.5H6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}
