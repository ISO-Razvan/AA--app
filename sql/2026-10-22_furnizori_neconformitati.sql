-- Furnizori (agendă) + Neconformități (registru) + refaceri
-- Proiect Supabase: kuxcmmrxhppudbwiwmxv. Idempotent; doar ALTER TABLE,
-- tabele noi și funcții — nu șterge date.

-- ---------------------------------------------------------------------------
-- 1. Refaceri: coloane noi pe lucrari + instantaneul financiar
-- ---------------------------------------------------------------------------
alter table lucrari add column if not exists refacere_pentru uuid references lucrari (id) on delete set null;
alter table lucrari add column if not exists fara_incasare boolean not null default false;
alter table lucrari add column if not exists fara_comisioane boolean not null default false;

-- Coloanele noi se pot citi direct (nu sunt sume); se scriu doar de
-- funcția creeaza_refacere.
grant select (refacere_pentru, fara_incasare, fara_comisioane) on public.lucrari to authenticated;

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
       and new.extra_uri is not distinct from old.extra_uri
       and new.fara_incasare is not distinct from old.fara_incasare
       and new.fara_comisioane is not distinct from old.fara_comisioane then
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
  -- Refacere nefacturată medicului: fără încasare (costul rămâne, ca să se
  -- vadă cât a costat); fără comisioane: tehnicienii nu primesc nimic pe ea.
  if new.fara_incasare then
    new.incasare := 0;
    new.pret_dinte_simplu := 0;
    new.pret_dinte_implant := 0;
    new.profit := -new.cost_laborator;
  end if;
  if new.fara_comisioane then
    new.comisioane := '[]'::jsonb;
    new.adaosuri_design := null;
  end if;
  return new;
end;
$$;

drop trigger if exists lucrari_instantaneu_financiar on lucrari;
create trigger lucrari_instantaneu_financiar
  before insert or update on lucrari
  for each row execute function public.lucrari_calculeaza_instantaneu();

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
  case when r.patron then l.adaosuri_design end as adaosuri_design,
  l.refacere_pentru,
  l.fara_incasare,
  l.fara_comisioane
from public.lucrari l
cross join (
  select public.este_patron() as patron, public.are_acces_operational() as operational, public.tehnicianul_meu() as tehnician
) r
where r.operational
   or (r.tehnician is not null and l.id in (select public.lucrarile_mele()));

revoke all on public.lucrari_vizibile from anon, authenticated;
grant select on public.lucrari_vizibile to authenticated;

-- ---------------------------------------------------------------------------
-- Furnizori — agendă (fără prețuri). Patron + coordonator modifică; cei din
-- laborator citesc (tehnicianul alege furnizorul la o neconformitate).
-- ---------------------------------------------------------------------------
create table if not exists furnizori (
  id uuid primary key default gen_random_uuid(),
  nume text not null unique,
  cui text,
  persoana_contact text,
  telefon text,
  email text,
  adresa text,
  -- din lista fixă din aplicație (src/utils/calitate.js)
  categorii text[] not null default '{}',
  termen_livrare_zile integer check (termen_livrare_zile is null or termen_livrare_zile >= 0),
  observatii text,
  activ boolean not null default true,
  created_at timestamptz not null default now()
);

alter table furnizori enable row level security;
drop policy if exists "citire_laborator" on furnizori;
drop policy if exists "operational_all" on furnizori;
create policy "citire_laborator" on furnizori for select to authenticated using ((select public.este_din_laborator()));
create policy "operational_all" on furnizori for all to authenticated
  using ((select public.are_acces_operational())) with check ((select public.are_acces_operational()));

-- ---------------------------------------------------------------------------
-- Neconformități — registru. Oricine din laborator raportează; tehnicianul
-- doar pe comenzile lui, vede doar ce a raportat el și nu mai modifică după
-- trimitere. Patron + coordonator completează analiza și închid; ștergerea e
-- doar a patronului. Medicul nu are acces. Costul e într-un tabel separat,
-- doar pentru patron.
-- ---------------------------------------------------------------------------
create sequence if not exists neconformitati_nr_seq;

create table if not exists neconformitati (
  id uuid primary key default gen_random_uuid(),
  numar text not null unique default '',            -- NC-001…, pus de trigger
  data_constatare date not null default current_date,
  tip text not null check (tip in ('productie', 'reclamatie_medic', 'furnizor', 'altele')),
  gravitate text not null default 'minora' check (gravitate in ('minora', 'majora', 'critica')),
  comanda_id uuid references lucrari (id) on delete set null,
  -- instantaneu al comenzii (rămâne și dacă se șterge comanda)
  comanda_nr text,
  pacient text,
  medic text,
  etapa_id uuid references etape_productie (id) on delete set null,
  tehnician_id uuid references tehnicieni (id) on delete set null,
  furnizor_id uuid references furnizori (id) on delete set null,
  nota_id uuid references note_comanda (id) on delete set null,
  descriere text not null check (char_length(descriere) between 1 and 2000),
  actiune_imediata text,
  cauza text,
  actiune_corectiva text,
  responsabil text,
  termen date,
  status text not null default 'deschisa' check (status in ('deschisa', 'in_lucru', 'inchisa')),
  data_inchidere timestamptz,
  inchisa_de text,
  refacere_comanda_id uuid references lucrari (id) on delete set null,
  raportata_de_id uuid references auth.users (id) on delete set null,
  raportata_de_nume text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists neconformitati_data_idx on neconformitati (data_constatare);
create index if not exists neconformitati_comanda_idx on neconformitati (comanda_id);

create table if not exists neconformitati_costuri (
  neconformitate_id uuid primary key references neconformitati (id) on delete cascade,
  cost_material numeric not null default 0 check (cost_material >= 0),
  cost_manopera numeric not null default 0 check (cost_manopera >= 0),
  observatii text
);

alter table neconformitati enable row level security;
alter table neconformitati_costuri enable row level security;

drop policy if exists "nc_citire" on neconformitati;
drop policy if exists "nc_raportare" on neconformitati;
drop policy if exists "nc_modificare" on neconformitati;
drop policy if exists "nc_stergere" on neconformitati;
create policy "nc_citire" on neconformitati for select to authenticated using (
  (select public.are_acces_operational())
  or ((select public.tehnicianul_meu()) is not null and raportata_de_id = (select auth.uid()))
);
create policy "nc_raportare" on neconformitati for insert to authenticated with check (
  (select public.are_acces_operational())
  or (
    (select public.tehnicianul_meu()) is not null
    and (comanda_id is null or comanda_id in (select public.lucrarile_mele()))
  )
);
create policy "nc_modificare" on neconformitati for update to authenticated
  using ((select public.are_acces_operational())) with check ((select public.are_acces_operational()));
create policy "nc_stergere" on neconformitati for delete to authenticated using ((select public.este_patron()));

drop policy if exists "patron_all" on neconformitati_costuri;
create policy "patron_all" on neconformitati_costuri for all to authenticated
  using ((select public.este_patron())) with check ((select public.este_patron()));

-- Numărul, cine a raportat, închiderea și instantaneul comenzii — din baza de
-- date, nu din aplicație. La un raport de tehnician, starea e „deschisă" și
-- analiza rămâne goală (o completează patronul / coordonatorul).
create or replace function public.neconformitati_completeaza()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.rolul_meu();
  v_nume text := coalesce(nullif((select nume from public.profiles where id = auth.uid()), ''), initcap(coalesce(public.rolul_meu(), '')));
  v_nr bigint;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or v_rol is null or v_rol = 'medic' then
      raise exception 'Neconformitățile se raportează doar din aplicație, din laborator.' using errcode = '42501';
    end if;
    v_nr := nextval('public.neconformitati_nr_seq');
    new.numar := 'NC-' || lpad(v_nr::text, greatest(3, length(v_nr::text)), '0');
    new.raportata_de_id := auth.uid();
    new.raportata_de_nume := v_nume;
    new.created_at := now();
    new.refacere_comanda_id := null;
    if v_rol = 'tehnician' then
      new.status := 'deschisa';
      new.cauza := null;
      new.actiune_corectiva := null;
      new.responsabil := null;
      new.termen := null;
    end if;
  else
    new.id := old.id;
    new.numar := old.numar;
    new.raportata_de_id := old.raportata_de_id;
    new.raportata_de_nume := old.raportata_de_nume;
    new.created_at := old.created_at;
  end if;

  if new.status = 'inchisa' then
    if tg_op = 'INSERT' or old.status <> 'inchisa' then
      new.data_inchidere := now();
      new.inchisa_de := v_nume;
    else
      new.data_inchidere := old.data_inchidere;
      new.inchisa_de := old.inchisa_de;
    end if;
  else
    new.data_inchidere := null;
    new.inchisa_de := null;
  end if;

  if new.comanda_id is not null and (tg_op = 'INSERT' or new.comanda_id is distinct from old.comanda_id) then
    select l.nr_inregistrare, l.pacient, l.medic into new.comanda_nr, new.pacient, new.medic
    from public.lucrari l where l.id = new.comanda_id;
  end if;
  return new;
end;
$$;

drop trigger if exists neconformitati_completeaza on neconformitati;
create trigger neconformitati_completeaza
  before insert or update on neconformitati
  for each row execute function public.neconformitati_completeaza();

-- „Creează refacere": o comandă nouă cu datele comenzii neconforme, legată de
-- ea și de neconformitate. Patron + coordonator. Întoarce numărul comenzii noi.
create or replace function public.creeaza_refacere(p_nc uuid, p_facturata boolean, p_comisioane boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nc public.neconformitati%rowtype;
  v_l public.lucrari%rowtype;
  v_max bigint;
  v_nr text;
  v_id uuid;
begin
  if not public.are_acces_operational() then
    raise exception 'Doar patronul sau coordonatorul pot crea o refacere.' using errcode = '42501';
  end if;
  select * into v_nc from public.neconformitati where id = p_nc for update;
  if not found then
    raise exception 'Neconformitatea nu există.';
  end if;
  if v_nc.refacere_comanda_id is not null then
    raise exception 'Refacerea a fost deja creată pentru această neconformitate.';
  end if;
  select * into v_l from public.lucrari where id = v_nc.comanda_id;
  if not found then
    raise exception 'Neconformitatea nu e legată de o comandă existentă.';
  end if;

  -- Numărul următor AA-xxx, fără coliziuni cu o înregistrare simultană.
  perform pg_advisory_xact_lock(hashtext('lucrari.nr_inregistrare'));
  select coalesce(max(substring(nr_inregistrare from '^AA-(\d+)$')::bigint), 0) + 1 into v_max from public.lucrari;
  v_nr := 'AA-' || lpad(v_max::text, greatest(3, length(v_max::text)), '0');

  insert into public.lucrari (
    nr_inregistrare, clinica, medic, pacient, tip_lucrare, dinti, nr_elemente, culoare,
    implant, try_in, model, data_intrare, nota, extra_uri,
    refacere_pentru, fara_incasare, fara_comisioane
  ) values (
    v_nr, v_l.clinica, v_l.medic, v_l.pacient, v_l.tip_lucrare, v_l.dinti, v_l.nr_elemente, v_l.culoare,
    v_l.implant, v_l.try_in, v_l.model, current_date,
    format('Refacere pentru %s (%s)', v_l.nr_inregistrare, v_nc.numar), v_l.extra_uri,
    v_l.id, not coalesce(p_facturata, false), not coalesce(p_comisioane, true)
  )
  returning id into v_id;

  update public.neconformitati set refacere_comanda_id = v_id where id = p_nc;
  return v_nr;
end;
$$;

revoke all on function public.creeaza_refacere(uuid, boolean, boolean) from public, anon;
grant execute on function public.creeaza_refacere(uuid, boolean, boolean) to authenticated;

-- Verificare: tabelele noi și coloanele de refacere.
select 'tabel' as tip, table_name as nume from information_schema.tables
where table_schema = 'public' and table_name in ('furnizori', 'neconformitati', 'neconformitati_costuri')
union all
select 'coloana lucrari', column_name from information_schema.columns
where table_schema = 'public' and table_name = 'lucrari' and column_name in ('refacere_pentru', 'fara_incasare', 'fara_comisioane')
order by tip, nume;
