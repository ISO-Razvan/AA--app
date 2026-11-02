import { test } from 'node:test'
import assert from 'node:assert/strict'
import { urgentaCaseta, esteUrgenta, etapeDinCasete, filtreazaCasete, aplicaPatchAlocari } from './casetePlanificare.js'

const ASTAZI = '2026-11-02'

test('urgență: depășit și azi = roșu, 1–2 zile = portocaliu, restul neutru; mereu cu etichetă', () => {
  assert.deepEqual(urgentaCaseta('2026-10-30', ASTAZI), { nivel: 'rosu', eticheta: 'Depășit' })
  assert.deepEqual(urgentaCaseta('2026-11-02', ASTAZI), { nivel: 'rosu', eticheta: 'Azi' })
  assert.deepEqual(urgentaCaseta('2026-11-03', ASTAZI), { nivel: 'portocaliu', eticheta: 'Mâine' })
  assert.deepEqual(urgentaCaseta('2026-11-04', ASTAZI), { nivel: 'portocaliu', eticheta: 'În 2 zile' })
  assert.equal(urgentaCaseta('2026-11-05', ASTAZI).nivel, 'neutru')
  assert.equal(urgentaCaseta(null, ASTAZI).nivel, 'neutru')
  assert.equal(esteUrgenta('2026-11-04', ASTAZI), true)
  assert.equal(esteUrgenta('2026-11-10', ASTAZI), false)
})

test('urgența trece corect peste sfârșit de lună', () => {
  assert.equal(urgentaCaseta('2026-12-01', '2026-11-30').eticheta, 'Mâine')
  assert.equal(urgentaCaseta('2027-01-01', '2026-12-31').eticheta, 'Mâine')
})

const etape = [
  { id: 'e-design', nume: 'Design' },
  { id: 'e-frezare', nume: 'Frezare' },
  { id: 'e-ceramica', nume: 'Ceramică' },
]
const casete = [
  { lucrare: { id: 'a', termen_predare: '2026-11-03' }, etape: [etape[0]] },
  { lucrare: { id: 'b', termen_predare: '2026-11-20' }, etape: [etape[0], etape[1]] },
  { lucrare: { id: 'c', termen_predare: null }, etape: [etape[1]] },
]

test('etapele din casete, fără dubluri, în ordinea din Setup', () => {
  assert.deepEqual(etapeDinCasete(casete, etape).map((e) => e.id), ['e-design', 'e-frezare'])
})

test('filtre: etapă, doar urgente, combinate; ordinea se păstrează', () => {
  const ids = (r) => r.map((c) => c.lucrare.id)
  assert.deepEqual(ids(filtreazaCasete({ casete, etapaId: null, doarUrgente: false, astazi: ASTAZI })), ['a', 'b', 'c'])
  assert.deepEqual(ids(filtreazaCasete({ casete, etapaId: 'e-frezare', doarUrgente: false, astazi: ASTAZI })), ['b', 'c'])
  assert.deepEqual(ids(filtreazaCasete({ casete, etapaId: null, doarUrgente: true, astazi: ASTAZI })), ['a'])
  assert.deepEqual(ids(filtreazaCasete({ casete, etapaId: 'e-frezare', doarUrgente: true, astazi: ASTAZI })), [])
})

test('aplicaPatchAlocari: actualizează rândurile existente și adaugă pe cele lipsă, fără să modifice originalul', () => {
  const alocari = [
    { lucrare_id: 'a', etapa_id: 'e-design', tehnician_id: null, data_planificata: null, finalizat: false },
    { lucrare_id: 'x', etapa_id: 'e-design', tehnician_id: 't1', data_planificata: '2026-11-04', finalizat: true },
  ]
  const copie = JSON.parse(JSON.stringify(alocari))
  const nou = aplicaPatchAlocari(alocari, 'a', ['e-design', 'e-frezare'], { tehnician_id: 't2', data_planificata: '2026-11-05' })
  assert.deepEqual(alocari, copie)
  assert.equal(nou.length, 3)
  assert.deepEqual(nou[0], { lucrare_id: 'a', etapa_id: 'e-design', tehnician_id: 't2', data_planificata: '2026-11-05', finalizat: false })
  assert.deepEqual(nou[1], alocari[1])
  assert.deepEqual(nou[2], { lucrare_id: 'a', etapa_id: 'e-frezare', finalizat: false, tehnician_id: 't2', data_planificata: '2026-11-05' })
})
