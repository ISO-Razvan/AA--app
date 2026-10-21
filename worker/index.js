// Worker Cloudflare — servește aplicația (static assets din ./dist) și rutele
// de server de sub /api/. Cheia de serviciu Supabase vine DOAR din secretul
// SUPABASE_SERVICE_ROLE_KEY al Worker-ului; nu ajunge niciodată în browser.

import { createClient } from '@supabase/supabase-js'

const DOMENIU_TEHNICIENI = 'tehnicieni.algorithmlab.local'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// „Andrada Covaci" → „andrada.covaci" (fără diacritice, doar a-z, 0-9 și punct).
function slugNume(nume) {
  const slug = String(nume || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  return slug || 'tehnician'
}

// Creează contul unui tehnician sau, dacă are deja unul, îi resetează parola.
// Doar pentru patron (profiles.rol = 'patron'; 'admin' e valoarea veche a
// contului principal, de dinainte de rolurile patron/coordonator).
async function creareContTehnician(request, env) {
  if (request.method !== 'POST') return json({ eroare: 'Metodă nepermisă.' }, 405)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ eroare: 'Serverul nu e configurat: lipsește secretul SUPABASE_SERVICE_ROLE_KEY.' }, 500)
  }

  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ eroare: 'Neautentificat.' }, 401)

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: apelant, error: eApelant } = await supabase.auth.getUser(token)
  if (eApelant || !apelant?.user) return json({ eroare: 'Sesiune invalidă sau expirată.' }, 401)

  const { data: profilApelant } = await supabase.from('profiles').select('rol').eq('id', apelant.user.id).maybeSingle()
  if (!['patron', 'admin'].includes(profilApelant?.rol)) return json({ eroare: 'Doar patronul poate crea conturi.' }, 403)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ eroare: 'Cerere invalidă.' }, 400)
  }
  const { tehnician_id: tehnicianId, parola } = body || {}
  if (typeof tehnicianId !== 'string' || !tehnicianId) return json({ eroare: 'Lipsește tehnicianul.' }, 400)
  if (typeof parola !== 'string' || parola.length < 8 || parola.length > 72) {
    return json({ eroare: 'Parola trebuie să aibă între 8 și 72 de caractere.' }, 400)
  }

  const { data: tehnician } = await supabase.from('tehnicieni').select('id, nume').eq('id', tehnicianId).maybeSingle()
  if (!tehnician) return json({ eroare: 'Tehnicianul nu există.' }, 404)

  // Are deja cont → doar resetarea parolei, niciodată un cont nou.
  const { data: profilExistent } = await supabase.from('profiles').select('id').eq('tehnician_id', tehnician.id).maybeSingle()
  if (profilExistent) {
    const { data: actualizat, error } = await supabase.auth.admin.updateUserById(profilExistent.id, { password: parola })
    if (error) return json({ eroare: `Parola nu s-a putut reseta: ${error.message}` }, 500)
    const email = actualizat.user.email
    return json({ creat: false, email, utilizator: email.split('@')[0] })
  }

  const baza = slugNume(tehnician.nume)
  for (let i = 1; i <= 20; i++) {
    const utilizator = i === 1 ? baza : `${baza}${i}`
    const email = `${utilizator}@${DOMENIU_TEHNICIENI}`
    const { data: nou, error } = await supabase.auth.admin.createUser({
      email,
      password: parola,
      email_confirm: true,
      user_metadata: { nume: tehnician.nume },
    })
    if (error) {
      if (error.code === 'email_exists' || /already been registered|already exists/i.test(error.message)) continue
      return json({ eroare: `Contul nu s-a putut crea: ${error.message}` }, 500)
    }
    const { error: eProfil } = await supabase
      .from('profiles')
      .upsert({ id: nou.user.id, rol: 'tehnician', tehnician_id: tehnician.id, nume: tehnician.nume })
    if (eProfil) {
      await supabase.auth.admin.deleteUser(nou.user.id)
      return json({ eroare: `Contul nu s-a putut lega de tehnician: ${eProfil.message}` }, 500)
    }
    return json({ creat: true, email, utilizator })
  }
  return json({ eroare: 'Nu s-a găsit un nume de utilizator liber.' }, 409)
}

// Clientul cu cheia de serviciu + verificarea apelantului (token valid și rol
// permis). Întoarce { supabase } sau { raspuns } cu eroarea de trimis înapoi.
async function apelantCuRol(request, env, roluriPermise) {
  if (request.method !== 'POST') return { raspuns: json({ eroare: 'Metodă nepermisă.' }, 405) }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { raspuns: json({ eroare: 'Serverul nu e configurat: lipsește secretul SUPABASE_SERVICE_ROLE_KEY.' }, 500) }
  }
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return { raspuns: json({ eroare: 'Neautentificat.' }, 401) }
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: apelant, error } = await supabase.auth.getUser(token)
  if (error || !apelant?.user) return { raspuns: json({ eroare: 'Sesiune invalidă sau expirată.' }, 401) }
  const { data: profil } = await supabase.from('profiles').select('rol').eq('id', apelant.user.id).maybeSingle()
  if (!roluriPermise.includes(profil?.rol)) return { raspuns: json({ eroare: 'Nu ai dreptul la această acțiune.' }, 403) }
  return { supabase }
}

// Codul din linkul personal al medicului — 24 de caractere aleatoare.
function codAcces() {
  const alfabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint32Array(24)), (v) => alfabet[v % alfabet.length]).join('')
}

// Accesul unui medic la pagina lui (/medic), fără parolă — se autentifică cu
// cod pe email. Patron sau coordonator. Acțiuni:
//  - trimite: creează contul (rol medic, legat de medic) sau îl reactivează și
//    îi actualizează emailul; întoarce codul linkului personal;
//  - link_nou: cod nou (linkul vechi nu mai funcționează);
//  - dezactiveaza: contul rămâne, dar nu mai vede nimic (și nu se mai poate loga);
//  - sterge: contul e șters definitiv.
async function accesMedic(request, env) {
  const { supabase, raspuns } = await apelantCuRol(request, env, ['patron', 'admin', 'coordonator'])
  if (raspuns) return raspuns

  let body
  try {
    body = await request.json()
  } catch {
    return json({ eroare: 'Cerere invalidă.' }, 400)
  }
  const { medic_id: medicId, actiune } = body || {}
  if (typeof medicId !== 'string' || !medicId) return json({ eroare: 'Lipsește medicul.' }, 400)
  if (!['trimite', 'link_nou', 'dezactiveaza', 'sterge'].includes(actiune)) return json({ eroare: 'Acțiune necunoscută.' }, 400)

  const { data: medic } = await supabase.from('medici').select('id, nume, email').eq('id', medicId).maybeSingle()
  if (!medic) return json({ eroare: 'Medicul nu există.' }, 404)
  const { data: profil } = await supabase
    .from('profiles')
    .select('id, activ, cod_acces')
    .eq('rol', 'medic')
    .eq('medic_id', medic.id)
    .maybeSingle()

  if (actiune === 'dezactiveaza' || actiune === 'sterge' || actiune === 'link_nou') {
    if (!profil) return json({ eroare: 'Medicul nu are încă acces.' }, 404)
    if (actiune === 'sterge') {
      const { error } = await supabase.auth.admin.deleteUser(profil.id)
      if (error) return json({ eroare: `Accesul nu s-a putut șterge: ${error.message}` }, 500)
      return json({ stare: 'fara' })
    }
    if (actiune === 'dezactiveaza') {
      const { error } = await supabase.from('profiles').update({ activ: false }).eq('id', profil.id)
      if (error) return json({ eroare: `Accesul nu s-a putut dezactiva: ${error.message}` }, 500)
      // Blocat și la autentificare / reîmprospătarea sesiunii.
      await supabase.auth.admin.updateUserById(profil.id, { ban_duration: '876000h' })
      return json({ stare: 'dezactivat' })
    }
    const cod = codAcces()
    const { error } = await supabase.from('profiles').update({ cod_acces: cod }).eq('id', profil.id)
    if (error) return json({ eroare: `Linkul nu s-a putut regenera: ${error.message}` }, 500)
    return json({ stare: profil.activ ? 'activ' : 'dezactivat', cod })
  }

  // trimite
  const email = String(medic.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ eroare: 'Completează mai întâi un email valid pentru medic.' }, 400)

  if (profil) {
    const { error: eUser } = await supabase.auth.admin.updateUserById(profil.id, {
      email,
      email_confirm: true,
      ban_duration: 'none',
    })
    if (eUser) {
      const ocupat = eUser.code === 'email_exists' || /already been registered|already exists/i.test(eUser.message)
      return json({ eroare: ocupat ? 'Emailul e deja folosit de alt cont.' : `Accesul nu s-a putut actualiza: ${eUser.message}` }, ocupat ? 409 : 500)
    }
    const cod = profil.cod_acces || codAcces()
    const { error } = await supabase.from('profiles').update({ activ: true, cod_acces: cod, nume: medic.nume }).eq('id', profil.id)
    if (error) return json({ eroare: `Accesul nu s-a putut reactiva: ${error.message}` }, 500)
    return json({ stare: 'activ', cod, email, creat: false })
  }

  // Cont nou. Un email deja folosit (ex. de un cont din laborator) e refuzat —
  // nu legăm niciodată rolul de medic de un cont existent.
  const { data: nou, error: eNou } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nume: medic.nume },
  })
  if (eNou) {
    const ocupat = eNou.code === 'email_exists' || /already been registered|already exists/i.test(eNou.message)
    return json({ eroare: ocupat ? 'Emailul e deja folosit de alt cont.' : `Contul nu s-a putut crea: ${eNou.message}` }, ocupat ? 409 : 500)
  }
  const cod = codAcces()
  const { error: eProfil } = await supabase
    .from('profiles')
    .insert({ id: nou.user.id, rol: 'medic', medic_id: medic.id, nume: medic.nume, activ: true, cod_acces: cod })
  if (eProfil) {
    await supabase.auth.admin.deleteUser(nou.user.id)
    return json({ eroare: `Contul nu s-a putut lega de medic: ${eProfil.message}` }, 500)
  }
  return json({ stare: 'activ', cod, email, creat: true })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/creare-cont-tehnician') return creareContTehnician(request, env)
    if (url.pathname === '/api/acces-medic') return accesMedic(request, env)
    if (url.pathname.startsWith('/api/')) return json({ eroare: 'Rută inexistentă.' }, 404)
    return env.ASSETS.fetch(request)
  },
}
