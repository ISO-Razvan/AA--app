import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CAMPURI_OBLIGATORII, esteGol, campuriLipsa, esteFinalizata, lucrariCuLipsuri, textNotificare } from './informatiiLipsa.js'

const completa = { clinica: 'MB', medic: 'Dr. X', pacient: 'Ion', tip_lucrare: 'Wax-UP', termen_predare: '2026-11-20', dinti: [{ numar: 11 }] }
const lucrare = (id, extra = {}) => ({ id, nr_inregistrare: id, created_at: '2026-11-01T10:00:00Z', arhivat: false, ...completa, ...extra })
const ETAPE3 = [{ id: 'e0', nume: 'A' }, { id: 'e1', nume: 'B' }, { id: 'e2', nume: 'C' }]
const finalizate = (id, n) => Array.from({ length: n }, (_, i) => ({ lucrare_id: id, etapa_id: `e${i}`, finalizat: true }))

test('goale: null, text din spații, listă goală; nu "0" sau false', () => {
  assert.equal(esteGol(null), true)
  assert.equal(esteGol(undefined), true)
  assert.equal(esteGol(''), true)
  assert.equal(esteGol('   '), true)
  assert.equal(esteGol([]), true)
  assert.equal(esteGol('?'), false)
  assert.equal(esteGol(0), false)
  assert.equal(esteGol([{ numar: 11 }]), false)
})

test('câmpurile obligatorii: fără culoare/model/implant/try_in', () => {
  const chei = CAMPURI_OBLIGATORII.map((c) => c.cheie)
  assert.deepEqual(chei, ['clinica', 'medic', 'pacient', 'tip_lucrare', 'termen_predare', 'dinti'])
})

test('lipsa unei lucrări complete = nimic; câmpurile goale apar în ordinea din listă', () => {
  assert.deepEqual(campuriLipsa(completa), [])
  const lipsa = campuriLipsa({ ...completa, termen_predare: null, medic: '', dinti: [] })
  assert.deepEqual(lipsa.map((c) => c.cheie), ['medic', 'termen_predare', 'dinti'])
})

test('finalizată doar când toate etapele sunt bifate', () => {
  assert.equal(esteFinalizata(ETAPE3, finalizate('a', 3)), true)
  assert.equal(esteFinalizata(ETAPE3, finalizate('a', 2)), false)
  assert.equal(esteFinalizata(ETAPE3, []), false)
})

test('lucrări cu lipsuri: doar nefinalizate și nearhivate, cele mai recente primele', () => {
  const lucrari = [
    lucrare('A', { medic: '', created_at: '2026-11-01T10:00:00Z' }),
    lucrare('B', { termen_predare: null, created_at: '2026-11-03T10:00:00Z' }),
    lucrare('C', { medic: '' }), // finalizată -> exclusă
    lucrare('D', { medic: '', arhivat: true }), // arhivată -> exclusă
    lucrare('E'), // completă -> exclusă
  ]
  const alocari = finalizate('C', 3)
  const r = lucrariCuLipsuri({ lucrari, etape: ETAPE3, alocari })
  assert.deepEqual(r.map((x) => x.lucrare.id), ['B', 'A'])
})

test('textul notificării', () => {
  const l = lucrare('AA-123', { pacient: 'Popescu', termen_predare: '', dinti: [] })
  const lipsa = campuriLipsa(l)
  assert.equal(textNotificare({ lucrare: l, lipsa }), 'AA-123 · Popescu — lipsește: termen de predare, dinți')
  const faraPacient = lucrare('AA-124', { pacient: '', medic: '' })
  assert.equal(textNotificare({ lucrare: faraPacient, lipsa: campuriLipsa(faraPacient) }), 'AA-124 — lipsește: medic, pacient')
})
