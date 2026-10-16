-- Roluri patron / coordonator / tehnician — FAZA 2 (blocarea financiarului
-- și mutarea conturilor)
-- Proiect Supabase: kuxcmmrxhppudbwiwmxv. Idempotent. Se rulează DUPĂ faza 1
-- și abia când codul nou e gata de publicat: aplicația publicată înainte de
-- roluri nu mai poate înregistra lucrări după acest pas.
--
-- Coordonatorul are acces la tabelul `lucrari` (ca să poată înregistra și
-- edita), dar fără coloanele financiare: rolul de bază de date `authenticated`
-- (comun tuturor celor logați) primește drepturi doar pe coloanele operaționale.
-- Valorile financiare se citesc prin view-ul `lucrari_vizibile` (doar patronul
-- le vede) și se scriu doar de triggerul `lucrari_instantaneu_financiar`.
-- ATENȚIE la o coloană nouă pe `lucrari`: trebuie adăugată și în grant-urile
-- de mai jos, altfel aplicația nu o poate citi/scrie direct.

revoke select, insert, update, truncate, references, trigger on public.lucrari from anon, authenticated;

grant select (
  id, nr_inregistrare, clinica, medic, pacient, tip_lucrare, dinti, nr_elemente,
  culoare, implant, try_in, model, data_intrare, termen_predare, ora_programare,
  next_date, nota, arhivat, data_arhivare, created_at
) on public.lucrari to authenticated;

-- `extra_uri` se scrie ca selecție [{ extra_id, cantitate }]; prețurile le
-- completează triggerul. Nu se poate citi direct (conține prețuri).
grant insert (
  nr_inregistrare, clinica, medic, pacient, tip_lucrare, dinti, nr_elemente,
  culoare, implant, try_in, model, data_intrare, termen_predare, ora_programare,
  next_date, nota, extra_uri, arhivat, data_arhivare
) on public.lucrari to authenticated;

grant update (
  clinica, medic, pacient, tip_lucrare, dinti, nr_elemente,
  culoare, implant, try_in, model, data_intrare, termen_predare, ora_programare,
  next_date, nota, extra_uri, arhivat, data_arhivare
) on public.lucrari to authenticated;

grant delete on public.lucrari to authenticated;

-- Mutarea conturilor: contul nou devine patron, contul principal de până acum
-- devine coordonator. Într-un singur bloc — dacă un cont lipsește, nu se
-- schimbă nimic (altfel ar putea rămâne aplicația fără patron).
do $$
declare
  v_patron uuid;
  v_coordonator uuid;
begin
  select id into v_patron from auth.users where lower(email) = 'flaviu.andrei.oros@gmail.com';
  select id into v_coordonator from auth.users where lower(email) = 'algorithmaesthetics@gmail.com';
  if v_patron is null then
    raise exception 'Contul flaviu.andrei.oros@gmail.com nu există în Authentication → Users.';
  end if;
  if v_coordonator is null then
    raise exception 'Contul algorithmaesthetics@gmail.com nu există în Authentication → Users.';
  end if;
  update public.profiles set rol = 'coordonator', tehnician_id = null where id = v_coordonator;
  insert into public.profiles (id, rol)
  values (v_patron, 'patron')
  on conflict (id) do update set rol = 'patron', tehnician_id = null;
end $$;

-- Verificare: conturile și rolurile lor, plus câte coloane din `lucrari` pot
-- citi direct cei logați (trebuie 20 — fără cele financiare).
select
  u.email,
  p.rol,
  (select count(*) from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'lucrari' and grantee = 'authenticated' and privilege_type = 'SELECT') as coloane_lucrari_citibile
from public.profiles p
join auth.users u on u.id = p.id
order by p.rol, u.email;
