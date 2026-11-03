// Înfășoară un câmp din fișă: când lipsește, chenar roșu + text mic „Lipsește"
// (roșul vine mereu cu text). Marcajul dispare imediat ce `lipsa` devine false.
export default function CampLipsa({ lipsa, children }) {
  return (
    <div className={`camp-lipsa-wrap ${lipsa ? 'camp-lipsa' : ''}`}>
      {children}
      {lipsa && <span className="camp-lipsa-text">Lipsește</span>}
    </div>
  )
}
