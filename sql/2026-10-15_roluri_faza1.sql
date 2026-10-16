-- Roluri patron / coordonator / tehnician — FAZA 1 (sigur de rulat acum)
-- Proiect Supabase: kuxcmmrxhppudbwiwmxv. Idempotent — se poate rula de mai
-- multe ori. Nu recreează niciun tabel și nu șterge date.
--
-- Faza 1 e compatibilă cu aplicația publicată acum: contul existent
-- (rol 'admin') e tratat ca patron până la faza 2, deci nu se schimbă nimic
-- pentru el. Faza 2 (blocarea coloanelor financiare + mutarea conturilor) se
-- rulează abia după ce codul nou e gata, chiar înainte de publicare.
-- Sursa de adevăr pentru toate acestea rămâne schema.sql.

-- ---------------------------------------------------------------------------
-- 1. Rolurile permise + un singur patron
-- ---------------------------------------------------------------------------
-- 'admin' rămâne permis temporar (= patron), până la faza 2.
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%rol%'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end $$;
alter table profiles add constraint profiles_rol_check
  check (rol in ('admin', 'patron', 'coordonator', 'tehnician'));

-- Al doilea cont de patron e refuzat de baza de date.
create unique index if not exists profiles_un_singur_patron on profiles ((true)) where rol in ('admin', 'patron');

-- ---------------------------------------------------------------------------
-- 2. Funcții de rol (security definer — citesc `profiles` peste politicile lui)
-- ---------------------------------------------------------------------------
create or replace function public.rolul_meu()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case rol when 'admin' then 'patron' else rol end from public.profiles where id = auth.uid();
$$;

-- Acces complet, inclusiv financiar.
create or replace function public.este_patron()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rolul_meu() = 'patron', false);
$$;

-- Patron sau coordonator: tot ce ține de comenzi și producție, fără financiar.
create or replace function public.are_acces_operational()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rolul_meu() in ('patron', 'coordonator'), false);
$$;

-- Păstrată pentru compatibilitate (nu mai e folosită de politici).
create or replace function public.este_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.este_patron();
$$;

-- Lucrările în care tehnicianul logat are cel puțin o etapă alocată.
create or replace function public.lucrarile_mele()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct lucrare_id from public.productie_lucrare where tehnician_id = public.tehnicianul_meu();
$$;

-- ---------------------------------------------------------------------------
-- 3. Politici RLS
-- ---------------------------------------------------------------------------

-- Financiar și prețuri — doar patronul.
do $$
declare
  t text;
begin
  for t in
    select unnest(array['comisioane', 'extra_uri', 'tipuri_lucrare', 'devize', 'deviz_lucrari', 'setari_salarii'])
  loop
    execute format(
      'drop policy if exists "authenticated_all" on %I;
       drop policy if exists "admin_all" on %I;
       drop policy if exists "patron_all" on %I;
       create policy "patron_all" on %I for all to authenticated
         using ((select public.este_patron())) with check ((select public.este_patron()));',
      t, t, t, t
    );
  end loop;
end $$;

-- Lucrările — patron și coordonator (coloanele financiare le blochează faza 2
-- și triggerul de instantaneu de mai jos). Tehnicianul citește prin view.
drop policy if exists "authenticated_all" on lucrari;
drop policy if exists "admin_all" on lucrari;
drop policy if exists "operational_all" on lucrari;
create policy "operational_all" on lucrari for all to authenticated
  using ((select public.are_acces_operational())) with check ((select public.are_acces_operational()));

-- Configurare fără prețuri — citire pentru toți, scriere patron + coordonator.
do $$
declare
  t text;
begin
  for t in
    select unnest(array['tehnicieni', 'etape_productie', 'culori', 'medici', 'clinici'])
  loop
    execute format(
      'drop policy if exists "authenticated_all" on %I;
       drop policy if exists "citire_toti" on %I;
       drop policy if exists "admin_all" on %I;
       drop policy if exists "operational_all" on %I;
       create policy "citire_toti" on %I for select to authenticated using (true);
       create policy "operational_all" on %I for all to authenticated
         using ((select public.are_acces_operational())) with check ((select public.are_acces_operational()));',
      t, t, t, t, t, t
    );
  end loop;
end $$;

-- Galerie — patron + coordonator pe toate; tehnicianul doar pe lucrările lui.
do $$
declare
  t text;
begin
  for t in select unnest(array['poze_lucrare', 'linkuri_lucrare']) loop
    execute format(
      'drop policy if exists "authenticated_all" on %I;
       drop policy if exists "operational_all" on %I;
       drop policy if exists "tehnician_lucrarile_mele" on %I;
       create policy "operational_all" on %I for all to authenticated
         using ((select public.are_acces_operational())) with check ((select public.are_acces_operational()));
       create policy "tehnician_lucrarile_mele" on %I for all to authenticated
         using (lucrare_id in (select public.lucrarile_mele()))
         with check (lucrare_id in (select public.lucrarile_mele()));',
      t, t, t, t, t
    );
  end loop;
end $$;

-- Producție — patron + coordonator modifică orice; tehnicianul vede etapele
-- lucrărilor lui și bifează doar rândurile alocate lui.
drop policy if exists "authenticated_all" on productie_lucrare;
drop policy if exists "citire_toti" on productie_lucrare;
drop policy if exists "admin_all" on productie_lucrare;
drop policy if exists "operational_all" on productie_lucrare;
drop policy if exists "tehnician_citire" on productie_lucrare;
drop policy if exists "tehnician_finalizare" on productie_lucrare;
create policy "operational_all" on productie_lucrare for all to authenticated
  using ((select public.are_acces_operational())) with check ((select public.are_acces_operational()));
create policy "tehnician_citire" on productie_lucrare for select to authenticated
  using (lucrare_id in (select public.lucrarile_mele()));
create policy "tehnician_finalizare" on productie_lucrare for update to authenticated
  using (tehnician_id = (select public.tehnicianul_meu()))
  with check (tehnician_id = (select public.tehnicianul_meu()));

create or replace function public.protectie_productie_tehnician()
returns trigger
language plpgsql
as $$
begin
  -- auth.uid() null = SQL Editor / cheia de serviciu / triggerul Livrare rulat de server.
  if auth.uid() is null or public.are_acces_operational() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.lucrare_id is distinct from old.lucrare_id
     or new.etapa_id is distinct from old.etapa_id
     or new.tehnician_id is distinct from old.tehnician_id
     or new.data_planificata is distinct from old.data_planificata
     or new.created_at is distinct from old.created_at then
    raise exception 'Un tehnician poate modifica doar bifa Finalizat și data finalizării.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- profiles — fiecare își citește rândul; patronul le vede pe toate.
drop policy if exists "admin_citire" on profiles;
drop policy if exists "patron_citire" on profiles;
create policy "patron_citire" on profiles
  for select to authenticated
  using ((select public.este_patron()));

-- ---------------------------------------------------------------------------
-- 4. Instantaneul financiar al lucrării — calculat în baza de date
-- ---------------------------------------------------------------------------

-- Număr dintr-o valoare jsonb (număr sau text numeric); altfel null.
create or replace function public.jsonb_numar(p jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when jsonb_typeof(p) = 'number' then (p #>> '{}')::numeric
    when jsonb_typeof(p) = 'string' and trim(p #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then trim(p #>> '{}')::numeric
  end;
$$;

-- Un extra de pe lucrare: { extra_id, nume, cantitate, pret_unitar, cost_unitar,
-- mod_taxare }. Unul deja prezent pe lucrare (`p_vechi`) își păstrează
-- prețul/costul din instantaneu; unul nou preia prețul curent din Setup. Cu
-- `p_curente` (recalcularea patronului) toate primesc prețul curent.
create or replace function public.instantaneu_extra(p_extra_id text, p_cantitate jsonb, p_vechi jsonb, p_curente boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_setup public.extra_uri%rowtype;
  v_are_setup boolean;
  v_existent jsonb;
  v_din_setup boolean;
  v_mod text;
  v_cantitate numeric;
begin
  select * into v_setup from public.extra_uri where id::text = p_extra_id;
  v_are_setup := found;
  select e into v_existent from jsonb_array_elements(coalesce(p_vechi, '[]'::jsonb)) e where e ->> 'extra_id' = p_extra_id limit 1;
  if not v_are_setup and v_existent is null then
    return null;
  end if;
  v_din_setup := v_are_setup and (p_curente or v_existent is null);
  v_mod := case when v_are_setup then v_setup.mod_taxare else v_existent ->> 'mod_taxare' end;
  v_cantitate := case
    when v_mod = 'per_bucata' then greatest(1, round(coalesce(nullif(public.jsonb_numar(p_cantitate), 0), 1)))
    else 1
  end;
  return jsonb_build_object(
    'extra_id', p_extra_id,
    'nume', case when v_are_setup then v_setup.nume else v_existent ->> 'nume' end,
    'cantitate', v_cantitate,
    'pret_unitar', case when v_din_setup then coalesce(v_setup.pret, 0) else coalesce(public.jsonb_numar(v_existent -> 'pret_unitar'), 0) end,
    'cost_unitar', case when v_din_setup then coalesce(v_setup.cost_laborator, 0) else coalesce(public.jsonb_numar(v_existent -> 'cost_unitar'), 0) end,
    'mod_taxare', v_mod
  );
end;
$$;

-- Trigger pe `lucrari`: coloanele financiare (cost_laborator, incasare, profit,
-- comisioane, pret_dinte_simplu, pret_dinte_implant, adaosuri_design și
-- prețurile din extra_uri) nu se mai scriu din aplicație — se calculează aici,
-- din Setup, la înregistrare și ori de câte ori se schimbă tipul, numărul de
-- elemente, dinții, Try-in-ul sau extra-urile. Orice altă modificare păstrează
-- valorile salvate. Așa coordonatorul poate edita lucrări fără să vadă prețuri.
--  - Dinți: elemente simple × încasare + elemente pe implant × preț implant;
--    elementele pe implant = dinții marcați implant (maxim nr. elemente).
--  - Cost dinți și comisioane: preț per element × nr. elemente.
--  - Extra-uri (inclusiv Try-in): Σ cantitate × preț/cost unitar.
create or replace function public.lucrari_calculeaza_instantaneu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curente boolean := coalesce(current_setting('aa.preturi_curente', true), '') = 'on';
  v_tip public.tipuri_lucrare%rowtype;
  v_setari public.setari_salarii%rowtype;
  v_try_in_id text;
  v_vechi jsonb := '[]'::jsonb;
  v_extra jsonb := '[]'::jsonb;
  v_element jsonb;
  v_sel jsonb;
  v_id text;
  v_n numeric;
  v_n_implant numeric;
  v_incasare_extra numeric;
  v_cost_extra numeric;
begin
  if tg_op = 'UPDATE' then
    v_vechi := coalesce(old.extra_uri, '[]'::jsonb);
    if not v_curente
       and new.tip_lucrare is not distinct from old.tip_lucrare
       and new.nr_elemente is not distinct from old.nr_elemente
       and new.dinti is not distinct from old.dinti
       and new.try_in is not distinct from old.try_in
       and new.extra_uri is not distinct from old.extra_uri then
      new.cost_laborator := old.cost_laborator;
      new.incasare := old.incasare;
      new.profit := old.profit;
      new.comisioane := old.comisioane;
      new.pret_dinte_simplu := old.pret_dinte_simplu;
      new.pret_dinte_implant := old.pret_dinte_implant;
      new.adaosuri_design := old.adaosuri_design;
      return new;
    end if;
  end if;

  -- Extra-uri: Try-in (dacă e bifat) primul, apoi selecția, fără dubluri.
  select id::text into v_try_in_id from public.extra_uri where sistem = 'try_in';
  if new.try_in and v_try_in_id is not null then
    v_element := public.instantaneu_extra(v_try_in_id, '1'::jsonb, v_vechi, v_curente);
    if v_element is not null then
      v_extra := v_extra || jsonb_build_array(v_element);
    end if;
  end if;
  for v_sel in
    select e from jsonb_array_elements(case when jsonb_typeof(new.extra_uri) = 'array' then new.extra_uri else '[]'::jsonb end) e
  loop
    v_id := v_sel ->> 'extra_id';
    continue when v_id is null or v_id = v_try_in_id;
    continue when exists (select 1 from jsonb_array_elements(v_extra) x where x ->> 'extra_id' = v_id);
    v_element := public.instantaneu_extra(v_id, v_sel -> 'cantitate', v_vechi, v_curente);
    if v_element is not null then
      v_extra := v_extra || jsonb_build_array(v_element);
    end if;
  end loop;
  new.extra_uri := v_extra;

  select coalesce(sum(coalesce(public.jsonb_numar(x -> 'cantitate'), 0) * coalesce(public.jsonb_numar(x -> 'pret_unitar'), 0)), 0),
         coalesce(sum(coalesce(public.jsonb_numar(x -> 'cantitate'), 0) * coalesce(public.jsonb_numar(x -> 'cost_unitar'), 0)), 0)
  into v_incasare_extra, v_cost_extra
  from jsonb_array_elements(v_extra) x;

  -- Prețuri per element (tip inexistent în Setup = 0) și adaosurile Design.
  select * into v_tip from public.tipuri_lucrare where nume = new.tip_lucrare;
  select * into v_setari from public.setari_salarii where id = 1;
  v_n := coalesce(new.nr_elemente, 0);
  select count(*) into v_n_implant
  from jsonb_array_elements(case when jsonb_typeof(new.dinti) = 'array' then new.dinti else '[]'::jsonb end) d
  where jsonb_typeof(d) = 'object' and d -> 'implant' = 'true'::jsonb;
  v_n_implant := least(v_n, v_n_implant);

  new.cost_laborator := coalesce(v_tip.cost_laborator, 0) * v_n + v_cost_extra;
  new.incasare := coalesce(v_tip.incasare, 0) * (v_n - v_n_implant) + coalesce(v_tip.pret_implant, 0) * v_n_implant + v_incasare_extra;
  new.profit := new.incasare - new.cost_laborator;
  new.pret_dinte_simplu := coalesce(v_tip.incasare, 0);
  new.pret_dinte_implant := coalesce(v_tip.pret_implant, 0);
  new.comisioane := coalesce((
    select jsonb_agg(
      jsonb_build_object('etapa_id', c.etapa_id, 'etapa_nume', coalesce(e.nume, ''), 'suma', coalesce(c.suma, 0) * v_n)
      order by e.ordine nulls last
    )
    from public.comisioane c
    left join public.etape_productie e on e.id = c.etapa_id
    where c.tip_lucrare = new.tip_lucrare
  ), '[]'::jsonb);
  new.adaosuri_design := jsonb_build_object(
    'implant', coalesce(v_setari.adaos_implant, 0),
    'thimble', coalesce(v_setari.adaos_thimble, 0),
    'model_printat', coalesce(v_setari.adaos_model_printat, 0),
    'all_on', coalesce(v_tip.all_on, false)
  );
  return new;
end;
$$;

drop trigger if exists lucrari_instantaneu_financiar on lucrari;
create trigger lucrari_instantaneu_financiar
  before insert or update on lucrari
  for each row execute function public.lucrari_calculeaza_instantaneu();

-- Recalcularea cu prețurile curente din Setup (dinți, comisioane, extra-uri,
-- Try-in) — doar patronul. Devizele deja generate nu se modifică.
create or replace function public.recalculeaza_lucrare(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tip text;
begin
  if not public.este_patron() then
    raise exception 'Doar patronul poate recalcula valorile financiare.' using errcode = '42501';
  end if;
  select tip_lucrare into v_tip from public.lucrari where id = p_id;
  if not found then
    raise exception 'Lucrarea nu a fost găsită.';
  end if;
  if not exists (select 1 from public.tipuri_lucrare where nume = v_tip) then
    raise exception 'Tipul de lucrare „%” nu mai există în Setup — valorile nu pot fi recalculate.', v_tip;
  end if;
  perform set_config('aa.preturi_curente', 'on', true);
  update public.lucrari set extra_uri = extra_uri where id = p_id;
  perform set_config('aa.preturi_curente', 'off', true);
end;
$$;

-- Toate lucrările; cele cu un tip care nu mai există în Setup sunt sărite.
-- Întoarce { actualizate, sarite: [nr_inregistrare] }.
create or replace function public.recalculeaza_toate_lucrarile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actualizate integer;
  v_sarite jsonb;
begin
  if not public.este_patron() then
    raise exception 'Doar patronul poate recalcula valorile financiare.' using errcode = '42501';
  end if;
  perform set_config('aa.preturi_curente', 'on', true);
  with actualizate as (
    update public.lucrari l set extra_uri = l.extra_uri
    where exists (select 1 from public.tipuri_lucrare t where t.nume = l.tip_lucrare)
    returning 1
  )
  select count(*) into v_actualizate from actualizate;
  perform set_config('aa.preturi_curente', 'off', true);
  select coalesce(jsonb_agg(l.nr_inregistrare order by l.nr_inregistrare), '[]'::jsonb) into v_sarite
  from public.lucrari l
  where not exists (select 1 from public.tipuri_lucrare t where t.nume = l.tip_lucrare);
  return jsonb_build_object('actualizate', v_actualizate, 'sarite', v_sarite);
end;
$$;

revoke all on function public.recalculeaza_lucrare(uuid) from public, anon;
grant execute on function public.recalculeaza_lucrare(uuid) to authenticated;
revoke all on function public.recalculeaza_toate_lucrarile() from public, anon;
grant execute on function public.recalculeaza_toate_lucrarile() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. View-uri de citire
-- ---------------------------------------------------------------------------

-- Lucrările: toate coloanele pentru patron; coordonatorul le vede pe toate,
-- fără coloanele financiare; tehnicianul doar lucrările în care are o etapă,
-- tot fără financiar. Extra-urile apar fără prețuri și fără Try-in (bifă separată).
create or replace view public.lucrari_vizibile
with (security_barrier = true)
as
select
  l.id,
  l.nr_inregistrare,
  l.clinica,
  l.medic,
  l.pacient,
  l.tip_lucrare,
  l.dinti,
  l.nr_elemente,
  l.culoare,
  l.implant,
  l.try_in,
  l.model,
  l.data_intrare,
  l.termen_predare,
  l.ora_programare,
  l.next_date,
  l.nota,
  l.arhivat,
  l.data_arhivare,
  l.created_at,
  case when r.patron then l.cost_laborator end as cost_laborator,
  case when r.patron then l.incasare end as incasare,
  case when r.patron then l.profit end as profit,
  case when r.patron then l.pret_dinte_simplu end as pret_dinte_simplu,
  case when r.patron then l.pret_dinte_implant end as pret_dinte_implant,
  case when r.patron then l.comisioane else '[]'::jsonb end as comisioane,
  case
    when r.patron then l.extra_uri
    else coalesce((
      select jsonb_agg(
        jsonb_build_object('extra_id', x.e -> 'extra_id', 'nume', x.e -> 'nume', 'cantitate', x.e -> 'cantitate', 'mod_taxare', x.e -> 'mod_taxare')
        order by x.ord
      )
      from jsonb_array_elements(l.extra_uri) with ordinality as x(e, ord)
      where not exists (
        select 1 from public.extra_uri s where s.id::text = x.e ->> 'extra_id' and s.sistem is not null
      )
    ), '[]'::jsonb)
  end as extra_uri,
  case when r.patron then l.adaosuri_design end as adaosuri_design
from public.lucrari l
cross join (
  select public.este_patron() as patron, public.are_acces_operational() as operational, public.tehnicianul_meu() as tehnician
) r
where r.operational
   or (r.tehnician is not null and l.id in (select public.lucrarile_mele()));

revoke all on public.lucrari_vizibile from anon, authenticated;
grant select on public.lucrari_vizibile to authenticated;

-- Tipurile de lucrare și extra-urile fără prețuri — pentru formularele
-- coordonatorului (tabelele întregi sunt doar ale patronului).
create or replace view public.tipuri_lucrare_nume
with (security_barrier = true)
as
select t.id, t.nume, t.created_at
from public.tipuri_lucrare t
where public.are_acces_operational();

revoke all on public.tipuri_lucrare_nume from anon, authenticated;
grant select on public.tipuri_lucrare_nume to authenticated;

create or replace view public.extra_uri_nume
with (security_barrier = true)
as
select e.id, e.nume, e.mod_taxare, e.activ, e.sistem, e.created_at
from public.extra_uri e
where public.are_acces_operational();

revoke all on public.extra_uri_nume from anon, authenticated;
grant select on public.extra_uri_nume to authenticated;

-- Verificare: rolurile existente (contul actual trebuie să apară ca 'admin').
select rol, count(*) as conturi from profiles group by rol order by rol;
