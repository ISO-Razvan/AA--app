// Ce se scrie în productie_lucrare când un card de pe Kanban e tras în altă coloană.
// Funcție pură, testată în kanbanMutare.test.js. Regula veche (bifează etapele
// „sărite", debifează de la țintă) rămâne; Validare are tratament aparte, ca
// mutarea unui card să nu finalizeze (și nu plătească) Designul din greșeală:
//  - spre Validare: Designul se TRIMITE la validare (marcaj), nu se finalizează;
//  - din Validare spre înainte: Designul se finalizează (Validare se finalizează odată cu el);
//  - din Validare înapoi: marcajul de validare se scoate.

import { esteEtapaValidare, esteEtapaDesignNume, etapaCurentaPentru } from './etapaProductie.js'

// -> [{ etapa_id, patch }], câte o intrare pe etapă (scrierile pe aceeași etapă se îmbină).
export function scrieriMutareKanban({ etape, randuriLucrare, tintaId, finalizatId, azi, acum }) {
  const design = etape.find(esteEtapaDesignNume) || null
  const validare = etape.find(esteEtapaValidare) || null
  const idx = (id) => etape.findIndex((e) => e.id === id)
  const { etapa: curenta } = etapaCurentaPentru(etape, randuriLucrare)
  const vechi = curenta ? idx(curenta.id) : etape.length
  const nou = tintaId === finalizatId ? etape.length : idx(tintaId)
  if (nou < 0 || nou === vechi) return []

  const spreValidare = !!validare && etape[nou]?.id === validare.id
  const dinValidare = !!validare && curenta?.id === validare.id
  const bifa = (e) => ({ etapa_id: e.id, patch: { finalizat: true, data_finalizare: azi } })
  const debifa = (e) => ({ etapa_id: e.id, patch: { finalizat: false, data_finalizare: null } })
  const scrieri = []

  if (nou > vechi) {
    // Ieșind din Validare, Designul (aflat înaintea ei) se finalizează.
    if (dinValidare && design) scrieri.push(bifa(design))
    for (let i = vechi; i < nou; i++) {
      const e = etape[i]
      if (spreValidare && design && e.id === design.id) {
        scrieri.push({ etapa_id: e.id, patch: { trimis_la_validare_la: acum } })
        continue
      }
      scrieri.push(bifa(e))
    }
    if (nou < etape.length && !spreValidare) scrieri.push(debifa(etape[nou]))
  } else if (spreValidare && design) {
    // Înapoi în Validare: Designul revine „trimis la validare", nefinalizat.
    scrieri.push({ etapa_id: design.id, patch: { finalizat: false, data_finalizare: null, trimis_la_validare_la: acum } })
  } else {
    for (let i = nou; i < vechi; i++) {
      const e = etape[i]
      if (validare && e.id === validare.id) continue
      scrieri.push(debifa(e))
    }
    if (dinValidare && design) scrieri.push({ etapa_id: design.id, patch: { trimis_la_validare_la: null } })
  }

  // O singură scriere pe etapă.
  const pePeEtapa = new Map()
  for (const w of scrieri) {
    pePeEtapa.set(w.etapa_id, { etapa_id: w.etapa_id, patch: { ...(pePeEtapa.get(w.etapa_id)?.patch || {}), ...w.patch } })
  }
  return [...pePeEtapa.values()]
}
