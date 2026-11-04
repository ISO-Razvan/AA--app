import { useEffect, useState } from 'react'
import { getTipuriPrintate } from '../services/dataService'

// Numele tipurilor de lucrare care se printează (bifă în Setup). Se încarcă o singură
// dată pe sesiune și se refolosește la toate casetele; `invalideazaTipuriPrintate()`
// o repetă (după schimbarea bifei din Setup).
let promisiune = null
const ascultatori = new Set()

function incarca() {
  if (!promisiune) promisiune = getTipuriPrintate().then((nume) => new Set(nume)).catch(() => new Set())
  return promisiune
}

export function invalideazaTipuriPrintate() {
  promisiune = null
  incarca().then((set) => ascultatori.forEach((fn) => fn(set)))
}

export function useTipuriPrintate() {
  const [set, setSet] = useState(null)
  useEffect(() => {
    let activ = true
    const fn = (s) => activ && setSet(s)
    ascultatori.add(fn)
    incarca().then(fn)
    return () => {
      activ = false
      ascultatori.delete(fn)
    }
  }, [])
  return set
}
