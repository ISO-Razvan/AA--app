import { useMemo, useState } from 'react'
import {
  ORDINE_MAXILAR,
  ORDINE_MANDIBULA,
  ANGLE_SPAN,
  unghiDinte,
  pozitieMaxilar,
  pozitieMandibula,
  rotatieMaxilar,
  rotatieMandibula,
} from '../utils/fdi'
import { VITA_HEX } from '../data/configDefaults'
import {
  formaPentruDinte,
  CENTER_TOOTH_CROWN_PATH,
  CENTER_TOOTH_ROOT_PATH,
  CENTER_TOOTH_NECK_LINE,
} from '../utils/toothShapes'
import SearchableSelect from './SearchableSelect.jsx'
import './DentalChart.css'

const RAD = Math.PI / 180

const CX = 205
const MAX = { cy: 270, rx: 112, ry: 190 }
const MAN = { cy: 380, rx: 109, ry: 181 }
const OUTER_DELTA = 24
const PALATE_Y = 245

function buildTeeth(order, geo, isMaxilar) {
  return order.map((numar, i) => {
    const theta = unghiDinte(i, order.length)
    const pos = isMaxilar
      ? pozitieMaxilar(theta, CX, geo.cy, geo.rx, geo.ry)
      : pozitieMandibula(theta, CX, geo.cy, geo.rx, geo.ry)
    const rotate = isMaxilar ? rotatieMaxilar(theta) : rotatieMandibula(theta)
    const t = theta * RAD
    const normal = isMaxilar ? { x: Math.sin(t), y: -Math.cos(t) } : { x: Math.sin(t), y: Math.cos(t) }
    const labelDist = 22
    return {
      numar,
      theta,
      x: pos.x,
      y: pos.y,
      rotate,
      labelX: pos.x - normal.x * labelDist,
      labelY: pos.y - normal.y * labelDist + 3,
    }
  })
}

function arcPath(theta1, theta2, geo, isMaxilar, rxOverride, ryOverride) {
  const rx = rxOverride ?? geo.rx
  const ry = ryOverride ?? geo.ry
  const p1 = isMaxilar ? pozitieMaxilar(theta1, CX, geo.cy, rx, ry) : pozitieMandibula(theta1, CX, geo.cy, rx, ry)
  const p2 = isMaxilar ? pozitieMaxilar(theta2, CX, geo.cy, rx, ry) : pozitieMandibula(theta2, CX, geo.cy, rx, ry)
  const span = Math.abs(theta2 - theta1)
  const largeArc = span > 180 ? 1 : 0
  const sweep = isMaxilar ? 1 : 0
  return `M ${p1.x.toFixed(1)},${p1.y.toFixed(1)} A ${rx},${ry} 0 ${largeArc} ${sweep} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
}

// Element independent per dinte — pregătit pentru extensii viitoare ale
// câmpului `stare` (ex. 'absent', 'tratat'), dincolo de 'normal'/'selectat'
// folosite acum.
function Tooth({ numar, x, y, rotate, stare, onClick }) {
  const { path, sx, sy, groove } = formaPentruDinte(numar)
  return (
    <g
      className={`dc-tooth dc-tooth-${stare}`}
      transform={`translate(${x},${y}) rotate(${rotate})`}
      onClick={onClick}
      role="button"
      aria-pressed={stare === 'selectat'}
      aria-label={`Dinte ${numar}`}
    >
      <circle className="dc-tooth-hit" r="18" />
      <g transform={`scale(${sx},${sy})`}>
        <path className="dc-tooth-shape" d={path} />
        {groove && <path className="dc-tooth-groove" d={groove} fill="none" />}
      </g>
    </g>
  )
}

function ArcadaSvg({ order, geo, isMaxilar, selectedSet, linkPairs, onToggleTooth, onToggleLink }) {
  const teeth = useMemo(() => buildTeeth(order, geo, isMaxilar), [order, geo, isMaxilar])
  const linkSet = useMemo(() => new Set(linkPairs.map(([a, b]) => `${a}-${b}`)), [linkPairs])

  const runs = useMemo(() => {
    const list = []
    let i = 0
    while (i < order.length) {
      if (!selectedSet.has(order[i])) {
        i++
        continue
      }
      let j = i
      while (j + 1 < order.length && selectedSet.has(order[j + 1]) && linkSet.has(`${order[j]}-${order[j + 1]}`)) {
        j++
      }
      if (j > i) list.push({ startIdx: i, endIdx: j })
      i = j + 1
    }
    return list
  }, [order, selectedSet, linkSet])

  return (
    <g>
      <path
        className="dc-guide"
        d={arcPath(-ANGLE_SPAN / 2, ANGLE_SPAN / 2, geo, isMaxilar, geo.rx + 14, geo.ry + 14)}
        fill="none"
      />

      {runs.map((run) => (
        <path
          key={`run-${order[run.startIdx]}-${order[run.endIdx]}`}
          className="dc-connector"
          d={arcPath(unghiDinte(run.startIdx, order.length), unghiDinte(run.endIdx, order.length), geo, isMaxilar, geo.rx + OUTER_DELTA, geo.ry + OUTER_DELTA)}
          fill="none"
        />
      ))}

      {teeth.map((t) => (
        <Tooth
          key={t.numar}
          numar={t.numar}
          x={t.x}
          y={t.y}
          rotate={t.rotate}
          stare={selectedSet.has(t.numar) ? 'selectat' : 'normal'}
          onClick={() => onToggleTooth(t.numar)}
        />
      ))}

      {teeth.map((t) => (
        <text key={`lbl-${t.numar}`} className="dc-label" x={t.labelX} y={t.labelY} textAnchor="middle">
          {t.numar}
        </text>
      ))}

      {order.slice(0, -1).map((numar, i) => {
        const numarB = order[i + 1]
        if (!selectedSet.has(numar) || !selectedSet.has(numarB)) return null
        const thetaMid = (unghiDinte(i, order.length) + unghiDinte(i + 1, order.length)) / 2
        const pos = isMaxilar
          ? pozitieMaxilar(thetaMid, CX, geo.cy, geo.rx, geo.ry)
          : pozitieMandibula(thetaMid, CX, geo.cy, geo.rx, geo.ry)
        const linked = linkSet.has(`${numar}-${numarB}`)
        return (
          <g
            key={`dot-${numar}-${numarB}`}
            className={`dc-link-dot ${linked ? 'dc-link-dot-active' : ''}`}
            transform={`translate(${pos.x},${pos.y})`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleLink(numar, numarB)
            }}
            role="button"
            aria-pressed={linked}
            aria-label={linked ? `Desparte puntea ${numar}-${numarB}` : `Leagă puntea ${numar}-${numarB}`}
          >
            <circle className="dc-link-dot-hit" r="13" />
            <circle className="dc-link-dot-ring" r="9" />
            {linked ? (
              <path className="dc-link-dot-glyph" d="M -3.5,0 L 3.5,0" />
            ) : (
              <path className="dc-link-dot-glyph" d="M -3.5,0 L 3.5,0 M 0,-3.5 L 0,3.5" />
            )}
          </g>
        )
      })}
    </g>
  )
}

export default function DentalChart({
  selectateNumere,
  linkPairs,
  onToggleTooth,
  onToggleLink,
  culoare,
  culoriOptions,
  onCuloareChange,
  onAddCuloare,
}) {
  const [picatorDeschis, setPicatorDeschis] = useState(false)
  const selectedSet = useMemo(() => new Set(selectateNumere), [selectateNumere])

  const culoareHex = VITA_HEX[culoare] || null

  return (
    <div className="dental-chart">
      <svg viewBox="0 0 410 620" className="dc-svg" role="img" aria-label="Schemă dentară">
        <text x={CX} y={MAX.cy - MAX.ry * 0.75} className="dc-arch-label" textAnchor="middle">
          MAXILAR
        </text>
        <text x={CX} y={MAN.cy + MAN.ry * 0.66} className="dc-arch-label" textAnchor="middle">
          MANDIBULA
        </text>

        <ArcadaSvg
          order={ORDINE_MAXILAR}
          geo={MAX}
          isMaxilar
          selectedSet={selectedSet}
          linkPairs={linkPairs}
          onToggleTooth={onToggleTooth}
          onToggleLink={onToggleLink}
        />
        <ArcadaSvg
          order={ORDINE_MANDIBULA}
          geo={MAN}
          isMaxilar={false}
          selectedSet={selectedSet}
          linkPairs={linkPairs}
          onToggleTooth={onToggleTooth}
          onToggleLink={onToggleLink}
        />

        <g
          className="dc-palate"
          transform={`translate(${CX},${PALATE_Y})`}
          onClick={() => setPicatorDeschis((v) => !v)}
          role="button"
          aria-label="Alege culoarea"
        >
          <circle className="dc-palate-hit" r="48" />
          <path className="dc-center-tooth-root" d={CENTER_TOOTH_ROOT_PATH} />
          <path
            className="dc-center-tooth-crown"
            d={CENTER_TOOTH_CROWN_PATH}
            style={culoareHex ? { fill: culoareHex } : undefined}
          />
          <path className="dc-center-tooth-neck" d={CENTER_TOOTH_NECK_LINE} fill="none" />
        </g>
        {culoare && (
          <text className="dc-center-label" x={CX} y={PALATE_Y + 82} textAnchor="middle">
            {culoare}
          </text>
        )}
      </svg>

      {picatorDeschis && (
        <div className="dc-color-popover">
          <p className="field-label">Culoare (VITA)</p>
          <SearchableSelect
            value={culoare}
            onChange={(v) => {
              onCuloareChange(v)
            }}
            options={culoriOptions}
            onAddOption={onAddCuloare}
            placeholder="ex. A2"
          />
          <button type="button" className="btn btn-ghost dc-color-popover-close" onClick={() => setPicatorDeschis(false)}>
            Închide
          </button>
        </div>
      )}

      <p className="dental-chart-count">
        {selectateNumere.length} {selectateNumere.length === 1 ? 'dinte selectat' : 'dinți selectați'}
      </p>
      <p className="dental-chart-hint">
        Selectează 2 dinți vecini ca să apară punctul de legare (⊕) între ei — click pe el îi unește într-o punte.
      </p>
    </div>
  )
}
