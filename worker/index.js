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
// Doar pentru un apelant autentificat cu profiles.rol = 'admin'.
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
  if (profilApelant?.rol !== 'admin') return json({ eroare: 'Doar un administrator poate crea conturi.' }, 403)

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/creare-cont-tehnician') return creareContTehnician(request, env)
    if (url.pathname.startsWith('/api/')) return json({ eroare: 'Rută inexistentă.' }, 404)
    return env.ASSETS.fetch(request)
  },
}
