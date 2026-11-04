import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  motivBlocareRedenumire,
  esteEtapaValidare,
  esteTrimisaLaValidare,
  etapeAplicabile,
  etapaCurentaPentru,
} from './etapaProductie.js'
import { statusLucrare } from './statusLucrare.js'

test('Model, Design și Livrare nu se pot redenumi (indiferent de majuscule/spații)', () => {
  assert.ok(motivBlocareRedenumire('Model'))
  assert.ok(motivBlocareRedenumire('  design '))
  assert.ok(motivBlocareRedenumire('LIVRARE'))
})

test('celelalte etape se pot redenumi', () => {
  assert.equal(motivBlocareRedenumire('Proba'), null)
  assert.equal(motivBlocareRedenumire('Frezare'), null)
  assert.equal(motivBlocareRedenumire(''), null)
  assert.equal(motivBlocareRedenumire(undefined), null)
})

// ── Validare ────────────────────────────────────────────────────────────────
const etape = [
  { id: 'm', nume: 'Model' },
  { id: 'd', nume: 'Design' },
  { id: 'v', nume: 'Verificare (redenumită)', cod: 'validare' }, // redenumită: contează codul
  { id: 'f', nume: 'Frezare' },
]
const etapeFaraValidare = etape.filter((e) => e.id !== 'v')
const rand = (etapa_id, extra = {}) => ({ lucrare_id: 'L', etapa_id, finalizat: false, ...extra })
const gata = (etapa_id) => rand(etapa_id, { finalizat: true })
const TRIMIS = '2026-11-05T10:00:00Z'

test('Validare se recunoaște după cod, nu după nume', () => {
  assert.equal(esteEtapaValidare(etape[2]), true)
  assert.equal(esteEtapaValidare({ id: 'x', nume: 'Validare' }), false)
})

test('lucrare obișnuită: etapa curentă = prima nefinalizată; Validare nu se aplică (nu strică lucrările vechi)', () => {
  assert.equal(etapaCurentaPentru(etape, [gata('m')]).etapa.id, 'd')
  // Design finalizat, fără rând Validare (lucrare veche): trece direct la Frezare
  assert.equal(etapaCurentaPentru(etape, [gata('m'), gata('d')]).etapa.id, 'f')
  assert.deepEqual(etapeAplicabile(etape, [gata('m'), gata('d')]).map((e) => e.id), ['m', 'd', 'f'])
})

test('trimisă la validare (Design cu marcaj, nefinalizat): etapa curentă = Validare', () => {
  const randuri = [gata('m'), rand('d', { trimis_la_validare_la: TRIMIS })]
  assert.equal(esteTrimisaLaValidare(etape, randuri), true)
  const { etapa, rand: r } = etapaCurentaPentru(etape, randuri)
  assert.equal(etapa.id, 'v')
  assert.equal(r, null)
  assert.deepEqual(etapeAplicabile(etape, randuri).map((e) => e.id), ['m', 'd', 'v', 'f'])
})

test('după Finalizat (Design finalizat + Validare sărită): curentă = Frezare', () => {
  const randuri = [gata('m'), rand('d', { finalizat: true, trimis_la_validare_la: TRIMIS }), gata('v')]
  assert.equal(esteTrimisaLaValidare(etape, randuri), false)
  assert.equal(etapaCurentaPentru(etape, randuri).etapa.id, 'f')
})

test('fără etapă Validare marcată: comportament neschimbat, chiar dacă rândul are marcaj', () => {
  const randuri = [gata('m'), rand('d', { trimis_la_validare_la: TRIMIS })]
  assert.equal(etapaCurentaPentru(etapeFaraValidare, randuri).etapa.id, 'd')
})

test('statusul nu se strică: lucrare veche rămâne Finalizat după ce apare etapa Validare', () => {
  const veche = [gata('m'), gata('d'), gata('f')]
  assert.equal(statusLucrare(etapeFaraValidare, veche).id, 'finalizat')
  assert.equal(statusLucrare(etape, veche).id, 'finalizat')
})

test('statusul: trimisă la validare = În lucru; după Finalizat (Validare sărită) = Finalizat când restul e gata', () => {
  assert.equal(statusLucrare(etape, [gata('m'), rand('d', { trimis_la_validare_la: TRIMIS })]).id, 'in_lucru')
  assert.equal(statusLucrare(etape, [gata('m'), gata('d'), gata('v'), gata('f')]).id, 'finalizat')
  assert.equal(statusLucrare(etape, [gata('m'), gata('d'), gata('v')]).id, 'in_lucru')
  assert.equal(statusLucrare(etape, []).id, 'neinceput')
})
