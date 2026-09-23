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
// Conectorul de punte stă mai departe de dinte decât șurubul de implant
// (vezi IMPLANT_*), ca cele două marcaje să nu se atingă.
const OUTER_DELTA = 32
const PALATE_Y = 245

// Șurub de implant, în coordonatele locale ale dintelui: spre y negativ e
// exteriorul arcadei (partea rădăcinii), deci „sub coroană".
const IMPLANT_BODY_PATH = 'M -4,-18.5 L 4,-18.5 L 4,-16.5 L -4,-16.5 Z M -3,-18.5 L 3,-18.5 L 2,-25.5 Q 0,-27.8 -2,-25.5 Z'
const IMPLANT_THREADS_PATH = 'M -2.9,-20.4 L 2.8,-21.2 M -2.6,-22.5 L 2.5,-23.3 M -2.3,-24.5 L 2.1,-25.1'

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
function Tooth({ numar, x, y, rotate, stare, implant, onClick, onToggleImplant, readOnly }) {
  const { path, sx, sy, groove } = formaPentruDinte(numar)
  const selectat = stare === 'selectat'
  return (
    <g
      className={`dc-tooth dc-tooth-${stare} ${selectat && implant ? 'dc-tooth-implant' : ''}`}
      transform={`translate(${x},${y}) rotate(${rotate})`}
      onClick={onClick}
      role="button"
      aria-pressed={selectat}
      aria-label={`Dinte ${numar}${selectat && implant ? ' (pe implant)' : ''}`}
    >
      <circle className="dc-tooth-hit" r="18" />
      <g transform={`scale(${sx},${sy})`}>
        <path className="dc-tooth-shape" d={path} />
        {groove && <path className="dc-tooth-groove" d={groove} fill="none" />}
      </g>
      {selectat && (implant || !readOnly) && (
        <g
          className={`dc-implant ${implant ? 'dc-implant-activ' : 'dc-implant-ghost'}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleImplant(numar)
          }}
          role="button"
          aria-pressed={implant}
          aria-label={implant ? `Scoate dintele ${numar} de pe implant` : `Marchează dintele ${numar} pe implant`}
        >
          <title>{implant ? 'Pe implant — click ca să scoți marcajul' : 'Click ca să marchezi dintele pe implant'}</title>
          <rect className="dc-implant-hit" x="-9" y="-30" width="18" height="15" />
          <path className="dc-implant-body" d={IMPLANT_BODY_PATH} />
          <path className="dc-implant-threads" d={IMPLANT_THREADS_PATH} fill="none" />
        </g>
      )}
    </g>
  )
}

function ArcadaSvg({ order, geo, isMaxilar, selectedSet, implantSet, linkPairs, onToggleTooth, onToggleLink, onToggleImplant, readOnly }) {
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
          implant={implantSet.has(t.numar)}
          onClick={() => onToggleTooth(t.numar)}
          onToggleImplant={onToggleImplant}
          readOnly={readOnly}
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

function LegendaDinte({ implant }) {
  const { path, sx, sy } = formaPentruDinte(11)
  return (
    <svg viewBox="-12 -30 24 46" className="dc-legend-icon" aria-hidden="true">
      <g className={`dc-tooth dc-tooth-selectat ${implant ? 'dc-tooth-implant' : ''}`}>
        <g transform={`scale(${sx},${sy})`}>
          <path className="dc-tooth-shape" d={path} />
        </g>
        {implant && (
          <g className="dc-implant dc-implant-activ">
            <path className="dc-implant-body" d={IMPLANT_BODY_PATH} />
            <path className="dc-implant-threads" d={IMPLANT_THREADS_PATH} fill="none" />
          </g>
        )}
      </g>
    </svg>
  )
}

export default function DentalChart({
  selectateNumere,
  linkPairs,
  implantNumere = [],
  onToggleTooth,
  onToggleLink,
  onToggleImplant,
  culoare,
  culoriOptions,
  onCuloareChange,
  onAddCuloare,
  readOnly = false,
}) {
  const [picatorDeschis, setPicatorDeschis] = useState(false)
  const selectedSet = useMemo(() => new Set(selectateNumere), [selectateNumere])
  const implantSet = useMemo(() => new Set(implantNumere), [implantNumere])
  const nrImplant = selectateNumere.filter((n) => implantSet.has(n)).length

  const culoareHex = VITA_HEX[culoare] || null

  return (
    <div className={`dental-chart ${readOnly ? 'dental-chart-readonly' : ''}`}>
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
          implantSet={implantSet}
          linkPairs={linkPairs}
          onToggleTooth={readOnly ? () => {} : onToggleTooth}
          onToggleLink={readOnly ? () => {} : onToggleLink}
          onToggleImplant={readOnly ? () => {} : onToggleImplant}
          readOnly={readOnly}
        />
        <ArcadaSvg
          order={ORDINE_MANDIBULA}
          geo={MAN}
          isMaxilar={false}
          selectedSet={selectedSet}
          implantSet={implantSet}
          linkPairs={linkPairs}
          onToggleTooth={readOnly ? () => {} : onToggleTooth}
          onToggleLink={readOnly ? () => {} : onToggleLink}
          onToggleImplant={readOnly ? () => {} : onToggleImplant}
          readOnly={readOnly}
        />

        <g
          className="dc-palate"
          transform={`translate(${CX},${PALATE_Y})`}
          onClick={() => !readOnly && setPicatorDeschis((v) => !v)}
          role="button"
          aria-label="Alege culoarea"
          aria-disabled={readOnly}
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

      <div className="dc-legend">
        <span className="dc-legend-item">
          <LegendaDinte implant={false} />
          Dinte simplu
        </span>
        <span className="dc-legend-item">
          <LegendaDinte implant />
          Pe implant
        </span>
      </div>

      <p className="dental-chart-count">
        {selectateNumere.length} {selectateNumere.length === 1 ? 'dinte selectat' : 'dinți selectați'}
        {nrImplant > 0 && ` · ${nrImplant} pe implant`}
      </p>
      <p className="dental-chart-hint">
        Selectează 2 dinți vecini ca să apară punctul de legare (⊕) între ei — click pe el îi unește într-o punte.
        Click pe șurubul de sub un dinte selectat îl marchează pe implant.
      </p>
    </div>
  )
}
