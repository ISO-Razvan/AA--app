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
import { pathPentruDinte, CENTRAL_CROWN_PATH, CENTRAL_ROOT_PATH } from '../utils/toothShapes'
import SearchableSelect from './SearchableSelect.jsx'
import './DentalChart.css'

const RAD = Math.PI / 180

const CX = 205
const MAX = { cy: 270, rx: 112, ry: 190 }
const MAN = { cy: 380, rx: 109, ry: 181 }
const OUTER_DELTA = 24

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

      {teeth.map((t) => {
        const selectat = selectedSet.has(t.numar)
        return (
          <g
            key={t.numar}
            className={`dc-tooth ${selectat ? 'dc-tooth-selected' : ''}`}
            transform={`translate(${t.x},${t.y}) rotate(${t.rotate})`}
            onClick={() => onToggleTooth(t.numar)}
            role="button"
            aria-pressed={selectat}
          >
            <circle className="dc-tooth-hit" r="18" />
            <path className="dc-tooth-shape" d={pathPentruDinte(t.numar)} />
          </g>
        )
      })}

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
          <circle
            key={`dot-${numar}-${numarB}`}
            className={`dc-link-dot ${linked ? 'dc-link-dot-active' : ''}`}
            cx={pos.x}
            cy={pos.y}
            r="6.5"
            onClick={(e) => {
              e.stopPropagation()
              onToggleLink(numar, numarB)
            }}
          />
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

  const centerY = useMemo(() => {
    const maxOuter = pozitieMaxilar(ANGLE_SPAN / 2, CX, MAX.cy, MAX.rx, MAX.ry).y
    const manOuter = pozitieMandibula(ANGLE_SPAN / 2, CX, MAN.cy, MAN.rx, MAN.ry).y
    return (maxOuter + manOuter) / 2
  }, [])

  const culoareHex = VITA_HEX[culoare] || null

  return (
    <div className="dental-chart">
      <svg viewBox="0 0 410 620" className="dc-svg" role="img" aria-label="Schemă dentară">
        <text x={CX} y={MAX.cy - MAX.ry * 0.25} className="dc-arch-label" textAnchor="middle">
          MAXILAR
        </text>
        <text x={CX} y={MAN.cy + MAN.ry * 0.28} className="dc-arch-label" textAnchor="middle">
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
          className="dc-center-tooth"
          transform={`translate(${CX},${centerY})`}
          onClick={() => setPicatorDeschis((v) => !v)}
          role="button"
          aria-label="Alege culoarea"
        >
          <circle className="dc-center-hit" r="34" />
          <path className="dc-center-root" d={CENTRAL_ROOT_PATH} />
          <path
            className="dc-center-crown"
            d={CENTRAL_CROWN_PATH}
            style={culoareHex ? { fill: culoareHex } : undefined}
          />
          {!culoare && (
            <text className="dc-center-hint" x="0" y="-17" textAnchor="middle">
              ?
            </text>
          )}
          {culoare && (
            <text className="dc-center-label" x="0" y="46" textAnchor="middle">
              {culoare}
            </text>
          )}
        </g>
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
    </div>
  )
}
