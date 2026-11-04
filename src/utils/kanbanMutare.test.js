import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scrieriMutareKanban } from './kanbanMutare.js'

const etape = [
  { id: 'm', nume: 'Model' },
  { id: 'd', nume: 'Design' },
  { id: 'v', nume: 'Validare', cod: 'validare' },
  { id: 'f', nume: 'Frezare' },
]
const rand = (etapa_id, extra = {}) => ({ lucrare_id: 'L', etapa_id, finalizat: false, ...extra })
const gata = (etapa_id) => rand(etapa_id, { finalizat: true })
const AZI = '2026-11-05'
const ACUM = '2026-11-05T09:00:00.000Z'
const mutare = (randuriLucrare, tintaId) => scrieriMutareKanban({ etape, randuriLucrare, tintaId, finalizatId: '__finalizat__', azi: AZI, acum: ACUM })
const peEtapa = (scrieri) => Object.fromEntries(scrieri.map((w) => [w.etapa_id, w.patch]))

test('Design -> Validare: designul e trimis la validare, NU finalizat (nu se plătește)', () => {
  const w = peEtapa(mutare([gata('m')], 'v'))
  assert.deepEqual(w, { d: { trimis_la_validare_la: ACUM } })
})

test('Model -> Validare: Model se bifează, designul e trimis la validare', () => {
  const w = peEtapa(mutare([], 'v'))
  assert.deepEqual(w, { m: { finalizat: true, data_finalizare: AZI }, d: { trimis_la_validare_la: ACUM } })
})

test('Validare -> Frezare: designul se finalizează, Validare se finalizează (sărită)', () => {
  const randuri = [gata('m'), rand('d', { trimis_la_validare_la: ACUM })]
  const w = peEtapa(mutare(randuri, 'f'))
  assert.deepEqual(w.d, { finalizat: true, data_finalizare: AZI })
  assert.deepEqual(w.v, { finalizat: true, data_finalizare: AZI })
  assert.equal(w.f?.finalizat, false)
})

test('Validare -> Design (înapoi): marcajul de validare se scoate; Validare nu se atinge', () => {
  const randuri = [gata('m'), rand('d', { trimis_la_validare_la: ACUM })]
  const w = peEtapa(mutare(randuri, 'd'))
  assert.deepEqual(w, { d: { finalizat: false, data_finalizare: null, trimis_la_validare_la: null } })
})

test('Design -> Frezare (fără validare): Design și Validare se bifează', () => {
  const w = peEtapa(mutare([gata('m')], 'f'))
  assert.deepEqual(w.d, { finalizat: true, data_finalizare: AZI })
  assert.deepEqual(w.v, { finalizat: true, data_finalizare: AZI })
})

test('Frezare -> Validare (înapoi): designul revine trimis la validare, nefinalizat', () => {
  const randuri = [gata('m'), gata('d'), gata('v')]
  const w = peEtapa(mutare(randuri, 'v'))
  assert.deepEqual(w, { d: { finalizat: false, data_finalizare: null, trimis_la_validare_la: ACUM } })
})

test('Frezare -> Design (înapoi): se debifează Design și Frezare, Validare rămâne neatinsă', () => {
  const randuri = [gata('m'), gata('d'), gata('v')]
  const w = peEtapa(mutare(randuri, 'd'))
  assert.deepEqual(Object.keys(w).sort(), ['d'])
  assert.deepEqual(w.d, { finalizat: false, data_finalizare: null })
})

test('către Finalizat din Validare: designul și Validare se finalizează', () => {
  const randuri = [gata('m'), rand('d', { trimis_la_validare_la: ACUM })]
  const w = peEtapa(mutare(randuri, '__finalizat__'))
  assert.equal(w.d.finalizat, true)
  assert.equal(w.v.finalizat, true)
  assert.equal(w.f.finalizat, true)
})

test('aceeași coloană = nimic de scris', () => {
  assert.deepEqual(mutare([gata('m')], 'd'), [])
})

test('fără etapă Validare: mutarea veche, neschimbată', () => {
  const faraV = etape.filter((e) => e.id !== 'v')
  const w = peEtapa(scrieriMutareKanban({ etape: faraV, randuriLucrare: [gata('m')], tintaId: 'f', finalizatId: '__finalizat__', azi: AZI, acum: ACUM }))
  assert.deepEqual(w.d, { finalizat: true, data_finalizare: AZI })
  assert.equal(w.f.finalizat, false)
  assert.equal(w.v, undefined)
})
