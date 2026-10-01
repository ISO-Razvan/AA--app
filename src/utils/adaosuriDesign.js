// Adaosuri la salariul tehnicianului de pe etapa Design, peste comisionul de
// bază. Se adaugă DOAR tehnicianului alocat pe Design-ul lucrării respective.
// Sumele unitare vin din Setup → Adaosuri Design, copiate ca instantaneu pe
// lucrare (`lucrare.adaosuri_design`, vezi calculeazaInstantaneu); o lucrare
// fără instantaneu (veche) nu are adaosuri.
//
//  1. Implant: + suma × nr. elementelor SIMPLE (fără punte) marcate pe implant.
//     Nu se aplică la lucrările All-on.
//  2. Thimble: la tipurile marcate All-on, + suma × nr. elemente.
//  3. Model printat: + suma, o singură dată, dacă lucrare.model === 'Print'.

export const ADAOS_IMPLANT = 'implant'
export const ADAOS_THIMBLE = 'thimble'
export const ADAOS_MODEL_PRINTAT = 'model_printat'

const ETICHETE = {
  [ADAOS_IMPLANT]: 'Implant',
  [ADAOS_THIMBLE]: 'Thimble',
  [ADAOS_MODEL_PRINTAT]: 'Model printat',
}

// Etapele se identifică după nume (nu au un „tip" separat), ca „Model"/„Livrare".
export function esteEtapaDesign(etapa) {
  return (etapa?.nume || '').trim().toLowerCase() === 'design'
}

// Element simplu pe implant = dinte marcat `implant` care nu face parte dintr-o
// punte (`grup` null). Elementele vechi fără câmpul `implant` contează ca false.
export function numaraImplanturiSimple(dinti) {
  return (dinti || []).filter((d) => d && d.implant === true && !d.grup).length
}

// -> [{ tip, eticheta, cantitate, sumaUnitara, total }]; rândurile cu
// cantitate 0 sau sumă 0 lipsesc.
export function calculeazaAdaosuriDesign(lucrare) {
  const t = lucrare?.adaosuri_design
  if (!t) return []
  const randuri = []
  const adauga = (tip, cantitate, sumaUnitara) => {
    const c = Number(cantitate) || 0
    const s = Number(sumaUnitara) || 0
    if (c > 0 && s > 0) randuri.push({ tip, eticheta: ETICHETE[tip], cantitate: c, sumaUnitara: s, total: c * s })
  }
  if (t.all_on) {
    adauga(ADAOS_THIMBLE, lucrare.nr_elemente, t.thimble)
  } else {
    adauga(ADAOS_IMPLANT, numaraImplanturiSimple(lucrare.dinti), t.implant)
  }
  if (lucrare.model === 'Print') adauga(ADAOS_MODEL_PRINTAT, 1, t.model_printat)
  return randuri
}

// Adaosurile unei etape finalizate: doar dacă etapa e Design.
export function adaosuriPentruEtapa(lucrare, etapa) {
  return esteEtapaDesign(etapa) ? calculeazaAdaosuriDesign(lucrare) : []
}

export const totalAdaosuri = (adaosuri) => adaosuri.reduce((s, a) => s + a.total, 0)
