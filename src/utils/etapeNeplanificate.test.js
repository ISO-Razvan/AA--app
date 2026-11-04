import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  neprogramatePeEtapa,
  etapaDeProgramat,
  etapeFaraTehnician,
  lucrariRestante,
  lunaSalariu,
  zileDepasite,
  candidatiEtapa,
  tehnicianPresetat,
  problemeInchidere,
  problemeData,
  randuriDeInchis,
} from './etapeNeplanificate.js'

const ASTAZI = '2026-11-02'
const etape = [
  { id: 'e-model', nume: 'Model' },
  { id: 'e-design', nume: 'Design' },
  { id: 'e-frezare', nume: 'Frezare' },
  { id: 'e-livrare', nume: 'Livrare' },
]
const tehnicieni = [
  { id: 't-ana', nume: 'Ana', roluri: ['e-design'] },
  { id: 't-adm', nume: 'ADM', roluri: ['e-livrare'] },
]
const lucrare = (id, termen, extra = {}) => ({ id, termen_predare: termen, data_intrare: '2026-09-01', ...extra })
const rand = (lucrare_id, etapa_id, extra = {}) => ({ lucrare_id, etapa_id, ...extra })
const restante = (lucrari, alocari = []) => lucrariRestante({ lucrari, etape, alocari, livrareAutoId: 'e-livrare', astazi: ASTAZI })

test('zileDepasite și lunaSalariu', () => {
  assert.equal(zileDepasite('2026-10-20', ASTAZI), 13)
  assert.equal(zileDepasite('2026-11-01', ASTAZI), 1)
  assert.equal(lunaSalariu('2026-10-20'), 'octombrie 2026')
})

test('restantă: termen depășit + etapă neprogramată și nebifată', () => {
  const r = restante([lucrare('l1', '2026-10-20')])
  assert.equal(r.length, 1)
  assert.equal(r[0].zile, 13)
  assert.deepEqual(r[0].etape.map((x) => x.etapa.id), ['e-model', 'e-design', 'e-frezare', 'e-livrare'])
})

test('termenul de azi nu e depășit; fără termen nu e restantă', () => {
  assert.deepEqual(restante([lucrare('azi', ASTAZI), lucrare('fara', null)]), [])
})

test('nu e restantă dacă toate etapele nebifate sunt deja programate', () => {
  const alocari = etape.map((e) => rand('l1', e.id, { tehnician_id: 't-ana', data_planificata: '2026-10-10' }))
  assert.deepEqual(restante([lucrare('l1', '2026-10-20')], alocari), [])
})

test('nu e restantă dacă toate etapele sunt bifate', () => {
  const alocari = etape.map((e) => rand('l1', e.id, { finalizat: true }))
  assert.deepEqual(restante([lucrare('l1', '2026-10-20')], alocari), [])
})

test('restantă cu o etapă neprogramată: se închid toate etapele nebifate', () => {
  const alocari = [
    rand('l1', 'e-model', { finalizat: true }),
    rand('l1', 'e-design', { tehnician_id: 't-ana', data_planificata: '2026-10-02' }),
    rand('l1', 'e-livrare', { tehnician_id: 't-adm', data_planificata: '2026-10-20' }),
  ]
  const r = restante([lucrare('l1', '2026-10-20')], alocari)
  assert.equal(r.length, 1)
  assert.deepEqual(r[0].etape.map((x) => x.etapa.id), ['e-design', 'e-frezare', 'e-livrare'])
})

test('ordine: cele mai vechi primele', () => {
  const r = restante([lucrare('b', '2026-10-25'), lucrare('a', '2026-09-30'), lucrare('c', '2026-10-10')])
  assert.deepEqual(r.map((x) => x.lucrare.id), ['a', 'c', 'b'])
})

const neprogramate = (lucrari, alocari = [], livrareAutoId = 'e-livrare') =>
  neprogramatePeEtapa({ lucrari, etape, alocari, livrareAutoId, astazi: ASTAZI })
const ids = (map, etapaId) => (map.get(etapaId) || []).map((x) => x.lucrare.id)

test('restantele nu apar în neprogramate; lucrările în termen da', () => {
  const m = neprogramate([lucrare('veche', '2026-10-20'), lucrare('noua', '2026-11-20')])
  assert.deepEqual(ids(m, 'e-design'), ['noua'])
})

test('lucrarea nouă (Model nebifat) apare la DESIGN, nu la Model și nu la alte etape', () => {
  const m = neprogramate([lucrare('l1', '2026-11-20')])
  assert.deepEqual(ids(m, 'e-design'), ['l1'])
  assert.equal(m.has('e-model'), false)
  assert.equal(m.has('e-frezare'), false)
  assert.equal(m.has('e-livrare'), false)
})

test('după Design se programează etapa curentă următoare (doar ea)', () => {
  const alocari = [rand('l1', 'e-model', { finalizat: true }), rand('l1', 'e-design', { finalizat: true })]
  const m = neprogramate([lucrare('l1', '2026-11-20')], alocari)
  assert.deepEqual(ids(m, 'e-frezare'), ['l1'])
  assert.equal(m.has('e-design'), false)
})

test('etapă cu dată planificată = programată: nu mai apare nicăieri', () => {
  const alocari = [rand('l1', 'e-design', { tehnician_id: 't-ana', data_planificata: '2026-11-10' })]
  assert.equal(neprogramate([lucrare('l1', '2026-11-20')], alocari).size, 0)
  // chiar fără tehnician pe rând: contează data
  assert.equal(neprogramate([lucrare('l1', '2026-11-20')], [rand('l1', 'e-design', { data_planificata: '2026-11-10' })]).size, 0)
})

test('Design bifat, dar Model nebifat: etapa curentă rămâne Model -> nu apare', () => {
  const alocari = [rand('l1', 'e-design', { finalizat: true })]
  assert.equal(neprogramate([lucrare('l1', '2026-11-20')], alocari).size, 0)
})

test('Livrarea cu termen se planifică singură: nu apare; fără termen apare', () => {
  const toateInafara = [rand('l1', 'e-model', { finalizat: true }), rand('l1', 'e-design', { finalizat: true }), rand('l1', 'e-frezare', { finalizat: true })]
  assert.equal(neprogramate([lucrare('l1', '2026-11-20')], toateInafara).size, 0)
  const faraTermen = neprogramate([lucrare('l2', null)], [rand('l2', 'e-model', { finalizat: true }), rand('l2', 'e-design', { finalizat: true }), rand('l2', 'e-frezare', { finalizat: true })])
  assert.deepEqual(ids(faraTermen, 'e-livrare'), ['l2'])
})

test('lucrarea finalizată nu apare; ordinea: termenul cel mai apropiat primul, fără termen la coadă', () => {
  const toate = etape.map((e) => rand('gata', e.id, { finalizat: true }))
  const m = neprogramate([lucrare('gata', '2026-11-20'), lucrare('b', '2026-11-25'), lucrare('a', '2026-11-05'), lucrare('c', null)], toate)
  assert.deepEqual(ids(m, 'e-design'), ['a', 'b', 'c'])
})

test('etapaDeProgramat: aceeași etapă pe care o arată Kanban, cu excepția Model', () => {
  const randuriLucrare = [rand('l1', 'e-model', { finalizat: true })]
  assert.equal(etapaDeProgramat({ lucrare: lucrare('l1', '2026-11-20'), etape, randuriLucrare, livrareAutoId: null })?.id, 'e-design')
  assert.equal(etapaDeProgramat({ lucrare: lucrare('l1', '2026-11-20'), etape, randuriLucrare: [], livrareAutoId: null })?.id, 'e-design')
})

test('etape fără tehnician: doar cele la care așteaptă lucrări; Model nu intră', () => {
  const programate = neprogramate([lucrare('l1', '2026-11-20')], [rand('l1', 'e-model', { finalizat: true }), rand('l1', 'e-design', { finalizat: true })])
  const lipsa = etapeFaraTehnician({ etape, tehnicieni, programatePeEtapa: programate })
  assert.deepEqual(lipsa.map((x) => [x.etapa.id, x.nr]), [['e-frezare', 1]])
  // nicio lucrare blocată -> niciun avertisment
  assert.deepEqual(etapeFaraTehnician({ etape, tehnicieni, programatePeEtapa: neprogramate([]) }), [])
})

test('candidați: cei cu rolul etapei, altfel toți; cel existent rămâne', () => {
  assert.deepEqual(candidatiEtapa(etape[1], null, tehnicieni).map((t) => t.id), ['t-ana'])
  assert.deepEqual(candidatiEtapa(etape[2], null, tehnicieni).map((t) => t.id), ['t-ana', 't-adm'])
  assert.deepEqual(candidatiEtapa(etape[1], { tehnician_id: 't-adm' }, tehnicieni).map((t) => t.id), ['t-ana', 't-adm'])
})

test('tehnician presetat: alocat, altfel singurul cu rol; Model niciunul', () => {
  assert.equal(tehnicianPresetat(etape[1], null, tehnicieni), 't-ana')
  assert.equal(tehnicianPresetat(etape[1], { tehnician_id: 't-adm' }, tehnicieni), 't-adm')
  assert.equal(tehnicianPresetat(etape[2], null, tehnicieni), '')
  assert.equal(tehnicianPresetat(etape[0], { tehnician_id: 't-ana' }, tehnicieni), '')
})

test('fără închidere parțială: lipsa tehnicianului blochează, Model nu are nevoie', () => {
  const intrare = { lucrare: lucrare('l1', '2026-10-20'), etape: etape.map((etapa) => ({ etapa, rand: null })) }
  assert.deepEqual(problemeInchidere({ intrare, tehnicianPe: { 'e-design': 't-ana' } }), [
    'Alege cine a făcut etapa Frezare.',
    'Alege cine a făcut etapa Livrare.',
  ])
  assert.deepEqual(problemeInchidere({ intrare, tehnicianPe: { 'e-design': 't-ana', 'e-frezare': 't-ana', 'e-livrare': 't-adm' } }), [])
})

test('data: obligatorie, nu în viitor, nu înainte de intrare', () => {
  const intrare = { lucrare: lucrare('l1', '2026-10-20'), etape: [] }
  assert.equal(problemeData({ intrare, data: '', astazi: ASTAZI }).length, 1)
  assert.equal(problemeData({ intrare, data: '2026-11-03', astazi: ASTAZI }).length, 1)
  assert.equal(problemeData({ intrare, data: '2026-08-31', astazi: ASTAZI }).length, 1)
  assert.deepEqual(problemeData({ intrare, data: '2026-10-20', astazi: ASTAZI }), [])
})

test('rândurile de scris: tehnician + dată planificată; Model fără tehnician', () => {
  const intrare = { lucrare: lucrare('l1', '2026-10-20'), etape: etape.map((etapa) => ({ etapa, rand: null })) }
  const tehnicianPe = { 'e-design': 't-ana', 'e-frezare': 't-ana', 'e-livrare': 't-adm' }
  const randuri = randuriDeInchis({ intrare, tehnicianPe, data: '2026-10-20' })
  assert.equal(randuri.length, 4)
  assert.deepEqual(randuri[0], { lucrare_id: 'l1', etapa_id: 'e-model', tehnician_id: null, data_planificata: null })
  assert.deepEqual(randuri[1], { lucrare_id: 'l1', etapa_id: 'e-design', tehnician_id: 't-ana', data_planificata: '2026-10-20' })
})
