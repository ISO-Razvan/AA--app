import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bazaCaz, lucrariDinCaz, urmatorulNrInCaz, cazuri, incasareCaz } from './caz.js'

const l = (nr, extra = {}) => ({ id: nr, nr_inregistrare: nr, caz_id: null, ...extra })

test('baza cazului: caz_id, altfel propriul nr', () => {
  assert.equal(bazaCaz(l('AA-101')), 'AA-101')
  assert.equal(bazaCaz(l('AA-101-2', { caz_id: 'AA-101' })), 'AA-101')
})

test('următorul nr pe caz: pornește de la -1 și crește după cel mai mare sufix', () => {
  assert.equal(urmatorulNrInCaz([l('AA-101')], 'AA-101'), 'AA-101-1')
  assert.equal(urmatorulNrInCaz([l('AA-101'), l('AA-101-1', { caz_id: 'AA-101' })], 'AA-101'), 'AA-101-2')
  // sufix lipsă (ștearsă) nu se refolosește: contează maximul
  assert.equal(urmatorulNrInCaz([l('AA-101'), l('AA-101-3', { caz_id: 'AA-101' })], 'AA-101'), 'AA-101-4')
})

test('nr-ul de pe caz nu se încurcă cu alte lucrări (AA-10 vs AA-101)', () => {
  const lucrari = [l('AA-10'), l('AA-101'), l('AA-101-1', { caz_id: 'AA-101' })]
  assert.equal(urmatorulNrInCaz(lucrari, 'AA-10'), 'AA-10-1')
  assert.equal(urmatorulNrInCaz(lucrari, 'AA-101'), 'AA-101-2')
})

test('generatorul obișnuit AA-<n> ignoră nr. cu sufix', () => {
  const re = /^AA-(\d+)$/
  assert.equal(re.test('AA-101-1'), false)
  assert.equal(re.test('AA-101'), true)
})

test('lucrările din caz: baza prima, apoi după sufix; baza intră și fără caz_id', () => {
  const lucrari = [l('AA-101-2', { caz_id: 'AA-101' }), l('AA-200'), l('AA-101'), l('AA-101-1', { caz_id: 'AA-101' })]
  assert.deepEqual(lucrariDinCaz(lucrari, 'AA-101').map((x) => x.nr_inregistrare), ['AA-101', 'AA-101-1', 'AA-101-2'])
})

test('cazuri: doar grupurile cu cel puțin 2 lucrări', () => {
  const lucrari = [l('AA-101', { caz_id: 'AA-101' }), l('AA-102'), l('AA-300-1', { caz_id: 'AA-300' })]
  assert.equal(cazuri(lucrari).size, 0)
  const cu = cazuri([...lucrari, l('AA-101-1', { caz_id: 'AA-101' })])
  assert.deepEqual([...cu.keys()], ['AA-101'])
  assert.equal(cu.get('AA-101').length, 2)
})

test('încasarea pe caz: suma pentru patron, null când sumele nu se văd', () => {
  assert.equal(incasareCaz([l('A', { incasare: 100 }), l('B', { incasare: '250.5' })]), 350.5)
  assert.equal(incasareCaz([l('A', { incasare: null }), l('B', { incasare: null })]), null)
})
