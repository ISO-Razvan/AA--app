import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zileSaptamanii, facutePeZi, textTotal } from './facuteSaptamana.js'

test('săptămâna luni–duminică, cu navigare', () => {
  const sapt = zileSaptamanii('2026-11-05') // joi
  assert.equal(sapt.length, 7)
  assert.equal(sapt[0], '2026-11-02')
  assert.equal(sapt[6], '2026-11-08')
  assert.equal(zileSaptamanii('2026-11-08')[0], '2026-11-02') // duminică
  assert.equal(zileSaptamanii('2026-11-02')[0], '2026-11-02') // luni
  assert.equal(zileSaptamanii('2026-11-05', -1)[0], '2026-10-26')
  assert.equal(zileSaptamanii('2026-11-05', 1)[0], '2026-11-09')
})

const etape = [{ id: 'd', nume: 'Design' }, { id: 'f', nume: 'Frezare' }]
const lucrari = [
  { id: 'L1', nr_inregistrare: 'AA-010', pacient: 'Ana', arhivat: true }, // arhivată: tot apare
  { id: 'L2', nr_inregistrare: 'AA-002', pacient: 'Bob' },
  { id: 'L3', nr_inregistrare: 'AA-003', pacient: 'Cora' },
]
const rand = (lucrare_id, etapa_id, tehnician_id, extra = {}) => ({ lucrare_id, etapa_id, tehnician_id, finalizat: true, data_finalizare: '2026-11-04', data_planificata: '2026-11-01', ...extra })
const zile = zileSaptamanii('2026-11-05')
const pe = (alocari, tehnicianId = 't1') => facutePeZi({ alocari, lucrari, etape, tehnicianId, zile })

test('ziua vine din data_finalizare, nu din data_planificata', () => {
  const r = pe([rand('L2', 'd', 't1', { data_planificata: '2026-10-01', data_finalizare: '2026-11-03' })])
  assert.equal(r['2026-11-03'].length, 1)
  assert.equal(r['2026-10-01'], undefined)
  assert.equal(r['2026-11-04'].length, 0)
})

test('doar tehnicianul ales; doar finalizate', () => {
  const alocari = [
    rand('L2', 'd', 't1'),
    rand('L3', 'd', 't2'), // alt tehnician
    rand('L3', 'f', 't1', { finalizat: false, data_finalizare: null }), // nefinalizată
  ]
  const r = pe(alocari)
  assert.deepEqual(r['2026-11-04'].map((x) => x.lucrare.id), ['L2'])
})

test('în afara săptămânii nu apare; lucrările arhivate apar; etapa e numele etapei', () => {
  const alocari = [rand('L1', 'f', 't1', { data_finalizare: '2026-11-06' }), rand('L2', 'd', 't1', { data_finalizare: '2026-11-20' })]
  const r = pe(alocari)
  assert.equal(r['2026-11-06'][0].lucrare.arhivat, true)
  assert.equal(r['2026-11-06'][0].etapa.nume, 'Frezare')
  assert.equal(Object.values(r).flat().length, 1)
})

test('același tehnician cu două etape pe aceeași lucrare: două casete, ordonate după nr. comenzii', () => {
  const alocari = [rand('L3', 'f', 't1'), rand('L3', 'd', 't1'), rand('L2', 'd', 't1')]
  const lista = pe(alocari)['2026-11-04']
  assert.deepEqual(lista.map((x) => `${x.lucrare.nr_inregistrare}/${x.etapa.nume}`).sort(), ['AA-002/Design', 'AA-003/Design', 'AA-003/Frezare'])
  assert.equal(lista[0].lucrare.nr_inregistrare, 'AA-002')
})

test('totalul zilei', () => {
  assert.equal(textTotal(0), '—')
  assert.equal(textTotal(1), '1 lucrare')
  assert.equal(textTotal(5), '5 lucrări')
})
