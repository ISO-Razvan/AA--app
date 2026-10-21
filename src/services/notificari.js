// Notificarea medicului despre o notă nouă pe comanda lui — SINGURUL loc din
// aplicație care știe CUM ajunge mesajul la medic. Acum (etapa 1) deschide
// WhatsApp (wa.me) cu mesajul pregătit, iar trimiterea o face omul din
// laborator. Ulterior se poate înlocui doar această funcție cu trimiterea
// automată prin WhatsApp Business API (ex. un apel către /api/...), fără să se
// schimbe componentele care o folosesc.

// Linkul către comanda respectivă, pe pagina medicului.
export function linkComandaMedic(nrInregistrare) {
  return `${window.location.origin}/medic/comanda/${encodeURIComponent(nrInregistrare)}`
}

// Număr în formatul cerut de wa.me: doar cifre, cu prefixul de țară.
// „0722 123 456" / „+40 722 123 456" / „0040722123456" → „40722123456".
export function telefonWhatsApp(telefon) {
  let cifre = String(telefon || '').replace(/\D/g, '')
  if (cifre.startsWith('00')) cifre = cifre.slice(2)
  if (cifre.length === 10 && cifre.startsWith('0')) cifre = `4${cifre}`
  return cifre.length >= 10 ? cifre : null
}

export function mesajNotaMedic({ nota, comanda }) {
  return `Algorithm Lab — pacient ${comanda.pacient || '—'}, comanda ${comanda.nr_inregistrare}: ${nota.subiect}. Răspunde aici: ${linkComandaMedic(comanda.nr_inregistrare)}`
}

// Linkul personal al medicului (Setup → Medici → Trimite acces).
export function linkAccesMedic(cod) {
  return `${window.location.origin}/medic/acces/${encodeURIComponent(cod)}`
}

function deschideWhatsApp(medic, mesaj) {
  const telefon = telefonWhatsApp(medic?.telefon)
  if (!telefon) {
    return { ok: false, motiv: 'Medicul nu are un număr de telefon valid (Setup → Medici).' }
  }
  window.open(`https://wa.me/${telefon}?text=${encodeURIComponent(mesaj)}`, '_blank', 'noopener')
  return { ok: true }
}

// -> { ok: true } sau { ok: false, motiv }.
export function notificaMedic({ nota, comanda, medic }) {
  return deschideWhatsApp(medic, mesajNotaMedic({ nota, comanda }))
}

// Linkul de acces, trimis medicului la „Trimite acces".
export function trimiteLinkAccesMedic({ medic, cod }) {
  return deschideWhatsApp(
    medic,
    `Algorithm Lab — aveți acces la comenzile dvs. și la notele laboratorului. Deschideți: ${linkAccesMedic(cod)} (vă autentificați cu codul primit pe emailul ${medic.email}).`
  )
}
