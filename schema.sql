-- Algorithm Aesthetics — schema Supabase (Postgres) — v3 (+ autentificare)
-- Rulează acest fișier o singură dată, integral, în Supabase → SQL Editor
-- (proiect: kuxcmmrxhppudbwiwmxv). Sigur de rulat de mai multe ori — toate
-- comenzile sunt idempotente (`if not exists` / `on conflict do nothing`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tabele de configurare (liste editabile din UI, folosite ca sugestii în
-- dropdown-urile cu căutare + "adaugă valoare nouă" din formularul de comandă)
-- ---------------------------------------------------------------------------

create table if not exists tipuri_lucrare (
  id uuid primary key default gen_random_uuid(),
  nume text not null unique,
  -- cost/încasare curente pentru acest tip de lucrare (Setup); lucrările deja
  -- înregistrate NU se actualizează retroactiv — valorile sunt copiate ca
  -- instantaneu pe `lucrari` la înregistrare (vezi cost_laborator/incasare/
  -- profit de mai jos).
  cost_laborator numeric not null default 0,
  -- `incasare` = prețul per element pentru dinte simplu; `pret_implant` =
  -- prețul per element pentru dinte pe implant. Costul de laborator e unic.
  incasare numeric not null default 0,
  pret_implant numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Prețul pe implant — adăugat ulterior, pe un tabel cu date reale. Coloana și
-- valoarea de pornire (pret_implant = incasare) se aplică o singură dată,
-- doar când coloana lipsește — rularea repetată nu suprascrie prețurile
-- ajustate manual după aceea.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tipuri_lucrare' and column_name = 'pret_implant'
  ) then
    alter table tipuri_lucrare add column pret_implant numeric not null default 0;
    update tipuri_lucrare set pret_implant = incasare;
  end if;
end $$;

-- „All-on" — bifă pe tipul de lucrare (Setup → Tipuri de lucrare). Folosită la
-- adaosul „thimble" al tehnicianului de Design. Adăugată ulterior: ALTER
-- idempotent, nu atinge datele existente.
alter table tipuri_lucrare add column if not exists all_on boolean not null default false;

-- Extra-uri taxabile pe comandă (ex. model printat, bont), configurate din
-- Setup. `mod_taxare`: 'per_comanda' (cantitate fixă 1) sau 'per_bucata'.
-- Un extra dezactivat nu mai apare la înregistrare, dar rămâne pe lucrările
-- care îl au deja. `sistem` marchează rândurile gestionate de aplicație —
-- 'try_in' e legat de bifa Try-in a lucrării (nu se redenumește/dezactivează).
create table if not exists extra_uri (
  id uuid primary key default gen_random_uuid(),
  nume text not null unique,
  pret numeric not null default 0,
  cost_laborator numeric not null default 0,
  mod_taxare text not null default 'per_comanda' check (mod_taxare in ('per_comanda', 'per_bucata')),
  activ boolean not null default true,
  sistem text unique,
  created_at timestamptz not null default now()
);

insert into extra_uri (nume, sistem, mod_taxare, pret, cost_laborator)
values ('Try-in', 'try_in', 'per_comanda', 0, 0)
on conflict do nothing;

create table if not exists culori (
  id uuid primary key default gen_random_uuid(),
  nume text not null unique, -- cheia VITA: A1-D4, BL1-BL4
  created_at timestamptz not null default now()
);

create table if not exists medici (
  id uuid primary key default gen_random_uuid(),
  nume text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists clinici (
  id uuid primary key default gen_random_uuid(),
  nume text not null unique,
  created_at timestamptz not null default now()
);

-- Etape de producție — listă editabilă (Setup), ordonată prin `ordine`.
create table if not exists etape_productie (
  id uuid primary key default gen_random_uuid(),
  nume text not null unique,
  ordine integer not null,
  -- Durată estimată (minute) per element, pentru această etapă — folosită
  -- pentru a calcula orele de muncă alocate unui tehnician într-o zi
  -- (nr. elemente ale lucrării × durata etapei), în ecranul de capacitate.
  durata_minute numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Tehnicieni — nume + rolurile lor (etapele de producție pe care le pot
-- executa). `roluri` e un array de id-uri din `etape_productie`, păstrat ca
-- jsonb pentru simplitate; validarea referințelor se face la nivel de aplicație.
create table if not exists tehnicieni (
  id uuid primary key default gen_random_uuid(),
  nume text not null,
  roluri jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Comisioane — sumă fixă per (tip de lucrare, etapă de producție), editabilă
-- din Setup ca grilă. Modificarea unei sume NU afectează lucrările deja
-- înregistrate, doar cele noi (vezi `comisioane` din `lucrari`, care păstrează
-- instantaneul de la înregistrare).
create table if not exists comisioane (
  id uuid primary key default gen_random_uuid(),
  tip_lucrare text not null,
  etapa_id uuid not null references etape_productie (id) on delete cascade,
  suma numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (tip_lucrare, etapa_id)
);

-- Adaosuri la salariul tehnicianului de Design (Setup → Adaosuri Design) —
-- un singur rând (id = 1). Valorile curente se copiază ca instantaneu pe
-- fiecare lucrare (`lucrari.adaosuri_design`), la fel ca sumele din `comisioane`.
create table if not exists setari_salarii (
  id smallint primary key default 1 check (id = 1),
  adaos_implant numeric not null default 5,       -- RON per element simplu pe implant
  adaos_thimble numeric not null default 20,      -- RON per thimble (1 / element, lucrări All-on)
  adaos_model_printat numeric not null default 10 -- RON per comandă cu model = 'Print'
);
insert into setari_salarii (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tabela principală — lucrări (comenzi)
-- ---------------------------------------------------------------------------

create table if not exists lucrari (
  id uuid primary key default gen_random_uuid(),
  nr_inregistrare text not null unique, -- generat secvențial, format AA-001
  clinica text,
  medic text,
  pacient text,
  tip_lucrare text not null,
  -- array de obiecte { numar: <FDI 11-48>, grup: <id text> | null, implant?: boolean }.
  -- `grup` leagă între ei dinții selectați pentru aceeași punte/lucrare unitară.
  -- `implant` lipsă (elemente vechi) = false.
  dinti jsonb not null default '[]'::jsonb,
  nr_elemente integer not null default 0,
  culoare text,
  -- derivat automat: true dacă măcar un element din `dinti` are implant = true.
  implant boolean not null default false,
  try_in boolean not null default false,
  model text check (model in ('Gips', 'Print')),
  data_intrare date not null default current_date,
  termen_predare date,
  ora_programare time,
  -- NU se completează din formularul de înregistrare — doar din panoul de
  -- editare al unei lucrări existente (următoarea probă/control programat).
  next_date date,
  nota text,
  -- Instantaneu financiar de la momentul înregistrării — copiat din
  -- tipuri_lucrare.cost_laborator/incasare și din grila `comisioane` pentru
  -- acest tip_lucrare, exact cum erau în acel moment. Modificările ulterioare
  -- din Setup NU ating aceste valori pe lucrări deja create.
  cost_laborator numeric,
  incasare numeric,
  profit numeric,
  -- array de { etapa_id, etapa_nume, suma }, instantaneu din `comisioane`
  comisioane jsonb not null default '[]'::jsonb,
  -- Arhivare — o lucrare cu toate etapele finalizate poate fi arhivată manual
  -- din tabul Producție; dispare din ecranele operaționale curente (Dashboard,
  -- Kanban, Listă implicită, Task-uri, Capacitate) dar rămâne vizibilă în
  -- modul „Arhivate" din Listă lucrări și inclusă normal în Salarii.
  arhivat boolean not null default false,
  data_arhivare timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lucrari_data_intrare_idx on lucrari (data_intrare);
create index if not exists lucrari_termen_predare_idx on lucrari (termen_predare);
create index if not exists lucrari_next_date_idx on lucrari (next_date);
create index if not exists lucrari_created_at_idx on lucrari (created_at);
create index if not exists lucrari_arhivat_idx on lucrari (arhivat);

-- ---------------------------------------------------------------------------
-- Arhivare — adăugat ulterior, pe un tabel deja existent cu date reale.
-- ALTER TABLE (nu recreare), idempotent — sigur de rulat chiar dacă tabelul
-- `lucrari` există deja și are rânduri. Nu atinge nicio valoare existentă.
-- ---------------------------------------------------------------------------
alter table lucrari add column if not exists arhivat boolean not null default false;
alter table lucrari add column if not exists data_arhivare timestamptz;

-- Extra-uri pe lucrare — instantaneu de la momentul adăugării: array de
-- { extra_id, nume, cantitate, pret_unitar, cost_unitar, mod_taxare }. Dacă
-- try_in = true, conține și extra-ul de sistem „Try-in" (cantitate 1).
alter table lucrari add column if not exists extra_uri jsonb not null default '[]'::jsonb;
-- Prețul per element (dinte simplu / pe implant) folosit în instantaneul
-- lucrării — necesar pentru defalcarea din deviz. Null la lucrările vechi.
alter table lucrari add column if not exists pret_dinte_simplu numeric;
alter table lucrari add column if not exists pret_dinte_implant numeric;
-- Instantaneul adaosurilor Design: { implant, thimble, model_printat, all_on }
-- (sumele unitare din setari_salarii + dacă tipul era All-on la momentul
-- calculului). Null la lucrările vechi = fără adaosuri, până la „Recalculează
-- valorile financiare" din Setup → Tipuri de lucrare.
alter table lucrari add column if not exists adaosuri_design jsonb;

-- Programare producție per lucrare — un rând per (lucrare, etapă), cu
-- tehnicianul alocat, data planificată și starea de finalizare. Afișat ca
-- tab „Producție" în fișa lucrării, sub formă de cronologie verticală.
create table if not exists productie_lucrare (
  id uuid primary key default gen_random_uuid(),
  lucrare_id uuid not null references lucrari (id) on delete cascade,
  etapa_id uuid not null references etape_productie (id) on delete cascade,
  tehnician_id uuid references tehnicieni (id) on delete set null,
  data_planificata date,
  finalizat boolean not null default false,
  data_finalizare date,
  created_at timestamptz not null default now(),
  unique (lucrare_id, etapa_id)
);

create index if not exists productie_lucrare_lucrare_idx on productie_lucrare (lucrare_id);

-- Poze asociate unei lucrări — tab „Galerie". DEOCAMDATĂ `referinta_fisier`
-- conține imaginea codificată base64 (data URL) direct în coloană — mutarea
-- în Supabase Storage e o îmbunătățire ulterioară, nu parte din runda asta.
create table if not exists poze_lucrare (
  id uuid primary key default gen_random_uuid(),
  lucrare_id uuid not null references lucrari (id) on delete cascade,
  nume_fisier text,
  referinta_fisier text not null,
  data_incarcare timestamptz not null default now()
);

create index if not exists poze_lucrare_lucrare_idx on poze_lucrare (lucrare_id);

-- Link-uri externe (ex. Google Drive) asociate unei lucrări — tab „Galerie",
-- listă separată de thumbnail-urile foto.
create table if not exists linkuri_lucrare (
  id uuid primary key default gen_random_uuid(),
  lucrare_id uuid not null references lucrari (id) on delete cascade,
  url text not null,
  eticheta text,
  data_adaugare timestamptz not null default now()
);

create index if not exists linkuri_lucrare_lucrare_idx on linkuri_lucrare (lucrare_id);

-- ---------------------------------------------------------------------------
-- Devize — grupează lucrări finalizate ale unui medic, needeja facturate
-- (verificat prin `deviz_lucrari`), într-un document printabil. `suma` de pe
-- `deviz_lucrari` e un instantaneu al `lucrari.incasare` de la momentul
-- generării devizului — nu se actualizează dacă `lucrari.incasare` s-ar
-- schimba ulterior (nu se schimbă în practică, dar păstrăm principiul
-- instantaneului deja folosit pentru cost_laborator/incasare/profit).
-- ---------------------------------------------------------------------------

create table if not exists devize (
  id uuid primary key default gen_random_uuid(),
  numar_deviz text not null unique, -- generat secvențial, format DZ-001
  medic text not null,
  clinica text,
  data_generare date not null default current_date,
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists deviz_lucrari (
  id uuid primary key default gen_random_uuid(),
  deviz_id uuid not null references devize (id) on delete cascade,
  lucrare_id uuid not null references lucrari (id) on delete cascade,
  suma numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists deviz_lucrari_deviz_idx on deviz_lucrari (deviz_id);
create index if not exists deviz_lucrari_lucrare_idx on deviz_lucrari (lucrare_id);

-- ---------------------------------------------------------------------------
-- Profiluri de utilizator — leagă un cont Supabase Auth (auth.users) de un
-- rol în aplicație și, dacă e tehnician, de rândul lui din `tehnicieni`.
-- Roluri: patron (un singur cont, acces complet), coordonator (tot, fără
-- financiar), tehnician (doar sarcinile, lucrările și salariul lui), medic
-- (doar pagina /medic, prin funcțiile de la „Note pe comandă + medici"). Conturile
-- de tehnician le creează patronul din aplicație (/api/creare-cont-tehnician);
-- patronul și coordonatorul se creează manual din Supabase.
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 'admin' = valoarea veche a contului principal (= patron), până la mutarea
  -- conturilor din sql/2026-10-15_roluri_faza2.sql.
  rol text not null check (rol in ('admin', 'patron', 'coordonator', 'tehnician', 'medic')),
  tehnician_id uuid references tehnicieni (id) on delete set null,
  nume text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Date inițiale de configurare (seed)
-- ---------------------------------------------------------------------------

insert into tipuri_lucrare (nume) values
  ('Coroană zirconiu'), ('Coroană metalo-ceramică'), ('Fațetă ceramică'),
  ('Punte'), ('Proteză totală'), ('Proteză scheletată'), ('Inlay/Onlay'), ('Machetă')
on conflict (nume) do nothing;

insert into culori (nume) values
  ('A1'),('A2'),('A3'),('A3.5'),('A4'),
  ('B1'),('B2'),('B3'),('B4'),
  ('C1'),('C2'),('C3'),('C4'),
  ('D2'),('D3'),('D4'),
  ('BL1'),('BL2'),('BL3'),('BL4')
on conflict (nume) do nothing;

insert into etape_productie (nume, ordine) values
  ('Model', 1), ('Design', 2), ('Frezare', 3), ('Sinter', 4),
  ('Stratificare', 5), ('Adaptare', 6), ('Ambalare', 7)
on conflict (nume) do nothing;

-- medici și clinici nu au valori implicite — se adaugă liber din formular.

-- ---------------------------------------------------------------------------
-- Securitate — Row Level Security, pe roluri (profiles.rol): patron,
-- coordonator, tehnician. Fără RLS, cheia "anon" ar da acces public la tot.
-- Toți utilizatorii logați au același rol de bază de date (`authenticated`),
-- deci diferența dintre roluri se face în politici, prin funcțiile de mai jos
-- (security definer, ca să poată citi `profiles` indiferent de politicile lui).
-- Pe o bază existentă se aplică prin sql/2026-10-15_roluri_faza1.sql și _faza2.sql.
-- ---------------------------------------------------------------------------

-- Rolurile permise + un singur patron (pentru baze create înainte de roluri).
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
  check (rol in ('admin', 'patron', 'coordonator', 'tehnician', 'medic'));

-- Al doilea cont de patron e refuzat de baza de date.
create unique index if not exists profiles_un_singur_patron on profiles ((true)) where rol in ('admin', 'patron');

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
create or replace function public.tehnicianul_meu()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tehnician_id from public.profiles where id = auth.uid() and rol = 'tehnician';
$$;

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

alter table tipuri_lucrare enable row level security;
alter table extra_uri enable row level security;
alter table culori enable row level security;
alter table medici enable row level security;
alter table clinici enable row level security;
alter table etape_productie enable row level security;
alter table tehnicieni enable row level security;
alter table comisioane enable row level security;
alter table setari_salarii enable row level security;
alter table lucrari enable row level security;
alter table productie_lucrare enable row level security;
alter table poze_lucrare enable row level security;
alter table linkuri_lucrare enable row level security;
alter table devize enable row level security;
alter table deviz_lucrari enable row level security;
alter table profiles enable row level security;

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

-- Instantaneul financiar al lucrării — calculat în baza de date.
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

-- Salariul tehnicianului logat — doar comisioanele LUI (auth.uid() →
-- profiles.tehnician_id), din etapele finalizate în luna cerută ('AAAA-LL'),
-- cu suma etapei respective din instantaneul lucrării. Nimic despre alți
-- tehnicieni sau alte etape nu iese din funcție.
-- DROP necesar: s-au adăugat coloane (dinti, model, adaosuri_design) la
-- rezultat, iar `create or replace` nu poate schimba tipul întors. Adaosurile
-- Design se calculează în aplicație (src/utils/adaosuriDesign.js) din aceste
-- câmpuri, ca să existe o singură implementare a regulilor, la admin și la tehnician.
drop function if exists public.salariul_meu(text);
create function public.salariul_meu(p_luna text)
returns table (
  lucrare_id uuid,
  nr_inregistrare text,
  medic text,
  pacient text,
  tip_lucrare text,
  nr_elemente integer,
  etapa_id uuid,
  etapa_nume text,
  etapa_ordine integer,
  data_finalizare date,
  suma numeric,
  dinti jsonb,
  model text,
  adaosuri_design jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id, l.nr_inregistrare, l.medic, l.pacient, l.tip_lucrare, l.nr_elemente,
    e.id, e.nume, e.ordine, p.data_finalizare,
    coalesce((
      select (c ->> 'suma')::numeric
      from jsonb_array_elements(l.comisioane) c
      where c ->> 'etapa_id' = p.etapa_id::text
      limit 1
    ), 0),
    l.dinti, l.model, l.adaosuri_design
  from public.productie_lucrare p
  join public.lucrari l on l.id = p.lucrare_id
  left join public.etape_productie e on e.id = p.etapa_id
  where p.tehnician_id = public.tehnicianul_meu()
    and p.finalizat
    and to_char(p.data_finalizare, 'YYYY-MM') = p_luna
  order by p.data_finalizare desc;
$$;

revoke all on function public.salariul_meu(text) from public, anon;
grant execute on function public.salariul_meu(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Etapa „Livrare" — planificată automat din termenul de predare. Sursa unică
-- de adevăr e `lucrari.termen_predare`: rândul din `productie_lucrare` pentru
-- Livrare primește mereu data = termen_predare și tehnicianul = singurul
-- tehnician cu rolul Livrare. Sincronizarea se face în baza de date (trigger),
-- ca să acopere orice cale de scriere (fișă, Import CSV, alte sesiuni).
-- Nu se aplică dacă nu există exact un tehnician cu rolul Livrare și nu
-- modifică niciodată un rând de Livrare deja bifat ca finalizat.
-- ---------------------------------------------------------------------------

create or replace function sincronizeaza_livrare(p_lucrare_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_etapa uuid;
  v_tehnician uuid;
  v_nr_tehnicieni integer;
  v_termen date;
  v_rand productie_lucrare%rowtype;
begin
  select id into v_etapa from etape_productie where lower(trim(nume)) = 'livrare' limit 1;
  if v_etapa is null then
    return false;
  end if;

  select count(*), min(id::text)::uuid into v_nr_tehnicieni, v_tehnician
  from tehnicieni
  where roluri ? v_etapa::text;
  if v_nr_tehnicieni <> 1 then
    return false;
  end if;

  select termen_predare into v_termen from lucrari where id = p_lucrare_id;
  if not found then
    return false;
  end if;

  select * into v_rand from productie_lucrare where lucrare_id = p_lucrare_id and etapa_id = v_etapa;
  if found then
    if v_rand.finalizat then
      return false;
    end if;
    if v_rand.tehnician_id is not distinct from v_tehnician
       and v_rand.data_planificata is not distinct from v_termen then
      return false;
    end if;
    update productie_lucrare
    set tehnician_id = v_tehnician, data_planificata = v_termen
    where id = v_rand.id;
  else
    insert into productie_lucrare (lucrare_id, etapa_id, tehnician_id, data_planificata)
    values (p_lucrare_id, v_etapa, v_tehnician, v_termen);
  end if;
  return true;
end;
$$;

-- Toate lucrările nearhivate cu termen de predare — întoarce câte au primit
-- sau și-au corectat alocarea de Livrare.
create or replace function sincronizeaza_livrare_toate()
returns integer
language plpgsql
as $$
declare
  v_id uuid;
  v_nr integer := 0;
begin
  for v_id in select id from lucrari where termen_predare is not null and not arhivat loop
    if sincronizeaza_livrare(v_id) then
      v_nr := v_nr + 1;
    end if;
  end loop;
  return v_nr;
end;
$$;

create or replace function trg_lucrari_sincronizeaza_livrare()
returns trigger
language plpgsql
as $$
begin
  perform sincronizeaza_livrare(new.id);
  return null;
end;
$$;

drop trigger if exists lucrari_sincronizeaza_livrare on lucrari;
create trigger lucrari_sincronizeaza_livrare
  after insert or update of termen_predare on lucrari
  for each row execute function trg_lucrari_sincronizeaza_livrare();

-- Dacă rolul Livrare trece la alt tehnician, alocările nefinalizate îl urmează.
create or replace function trg_tehnicieni_sincronizeaza_livrare()
returns trigger
language plpgsql
as $$
begin
  perform sincronizeaza_livrare_toate();
  return null;
end;
$$;

drop trigger if exists tehnicieni_sincronizeaza_livrare on tehnicieni;
create trigger tehnicieni_sincronizeaza_livrare
  after insert or update of roluri or delete on tehnicieni
  for each statement execute function trg_tehnicieni_sincronizeaza_livrare();

-- ---------------------------------------------------------------------------
-- Realtime — publică modificările (INSERT/UPDATE/DELETE) pe `lucrari` și
-- `productie_lucrare`, ca aplicația să reflecte automat bifarea unei etape
-- sau adăugarea/ștergerea unei lucrări, fără refresh manual (Kanban,
-- Dashboard). Blocul e sigur de rulat de mai multe ori — sare peste un tabel
-- deja adăugat la publicație, în loc să dea eroare.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lucrari'
  ) then
    alter publication supabase_realtime add table lucrari;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'productie_lucrare'
  ) then
    alter publication supabase_realtime add table productie_lucrare;
  end if;
end $$;

-- ===========================================================================
-- Note pe comandă + acces pentru medici (pe o bază existentă se aplică prin
-- sql/2026-10-16_note_medici.sql). Medicul nu are acces la tabelele
-- laboratorului — doar la funcțiile de la secțiunea 5.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Medici: email + telefon; profiles: rolul medic
-- ---------------------------------------------------------------------------
alter table medici add column if not exists email text;
alter table medici add column if not exists telefon text;

alter table profiles add column if not exists medic_id uuid references medici (id) on delete set null;
-- Accesul dezactivat din Setup → Medici (contul rămâne, dar nu mai vede nimic).
alter table profiles add column if not exists activ boolean not null default true;
-- Codul din linkul personal al medicului (/medic/acces/<cod>). Nu e o parolă —
-- autentificarea se face oricum cu codul primit pe email.
alter table profiles add column if not exists cod_acces text unique;

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
  check (rol in ('admin', 'patron', 'coordonator', 'tehnician', 'medic'));

-- ---------------------------------------------------------------------------
-- 2. Tabele noi: subiecte, setări, note
-- ---------------------------------------------------------------------------
create table if not exists subiecte_note (
  id uuid primary key default gen_random_uuid(),
  nume text not null unique,
  ordine integer not null default 0,
  activ boolean not null default true,
  created_at timestamptz not null default now()
);

insert into subiecte_note (nume, ordine) values
  ('Lipsă culoare', 1), ('Lipsă poze', 2), ('Lipsă scan/amprentă', 3),
  ('Întrebare', 4), ('Modificare cerință', 5), ('Informație', 6)
on conflict (nume) do nothing;

-- Un singur rând (id = 1): câte zile după livrare se mai pot adăuga note.
create table if not exists setari_note (
  id smallint primary key default 1 check (id = 1),
  zile_dupa_livrare integer not null default 7 check (zile_dupa_livrare >= 0)
);
insert into setari_note (id) values (1) on conflict do nothing;

-- Notele unei comenzi. Fără editare și ștergere din aplicație (nu există
-- politici de update/delete); se șterg doar odată cu comanda. Autorul, rolul,
-- numele, subiectul și data le completează triggerul de mai jos.
create table if not exists note_comanda (
  id uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references lucrari (id) on delete cascade,
  autor_id uuid references auth.users (id) on delete set null,
  autor_nume text not null default '',
  rol_autor text not null check (rol_autor in ('patron', 'coordonator', 'tehnician', 'medic')),
  subiect_id uuid references subiecte_note (id) on delete set null,
  subiect text not null,
  text text not null check (char_length(text) between 1 and 500),
  vizibilitate text not null default 'intern' check (vizibilitate in ('intern', 'medic')),
  created_at timestamptz not null default now(),
  citita_de_lab timestamptz,
  citita_de_medic timestamptz
);

create index if not exists note_comanda_comanda_idx on note_comanda (comanda_id, created_at);
create index if not exists note_comanda_necitite_lab_idx on note_comanda (comanda_id) where rol_autor = 'medic' and citita_de_lab is null;

-- ---------------------------------------------------------------------------
-- 3. Funcții de rol pentru medic
-- ---------------------------------------------------------------------------

-- Medicul logat (doar dacă accesul e activ).
create or replace function public.medicul_meu()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select medic_id from public.profiles where id = auth.uid() and rol = 'medic' and activ;
$$;

-- Patron, coordonator sau tehnician — oricine din laborator, nu medicii.
create or replace function public.este_din_laborator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rolul_meu() in ('patron', 'coordonator', 'tehnician'), false);
$$;

-- Sesiunea medicului e valabilă 90 de zile de la ultima autentificare cu cod
-- (data din `amr`, păstrată în token și la reîmprospătare).
create or replace function public.sesiune_medic_valida()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((
    select max((e ->> 'timestamp')::bigint)
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
  ), 0) > extract(epoch from now() - interval '90 days');
$$;

-- Comenzile medicului logat — după numele medicului de pe comandă.
create or replace function public.comenzile_medicului()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select l.id
  from public.lucrari l
  join public.medici m on lower(trim(m.nume)) = lower(trim(l.medic))
  where m.id = public.medicul_meu();
$$;

-- Comanda primește note până la bifarea etapei Livrare și încă N zile după.
create or replace function public.note_deschise(p_comanda uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.lucrari where id = p_comanda)
     and not exists (
       select 1
       from public.productie_lucrare p
       join public.etape_productie e on e.id = p.etapa_id
       where p.lucrare_id = p_comanda
         and lower(trim(e.nume)) = 'livrare'
         and p.finalizat
         and p.data_finalizare < current_date - coalesce((select zile_dupa_livrare from public.setari_note where id = 1), 7)
     );
$$;

-- Validare comună pentru funcțiile medicului.
create or replace function public.verifica_medic()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_medic uuid := public.medicul_meu();
begin
  if v_medic is null then
    raise exception 'Contul nu are acces de medic.' using errcode = '42501';
  end if;
  if not public.sesiune_medic_valida() then
    raise exception 'SESIUNE_EXPIRATA' using errcode = '42501';
  end if;
  return v_medic;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Politici RLS
-- ---------------------------------------------------------------------------
alter table subiecte_note enable row level security;
alter table setari_note enable row level security;
alter table note_comanda enable row level security;

-- Listele din laborator nu mai sunt „pentru toți cei logați": medicul nu
-- vede tehnicieni, etape, alți medici (cu telefoane), clinici, culori.
do $$
declare
  t text;
begin
  for t in select unnest(array['tehnicieni', 'etape_productie', 'culori', 'medici', 'clinici']) loop
    execute format(
      'drop policy if exists "citire_toti" on %I;
       drop policy if exists "citire_laborator" on %I;
       create policy "citire_laborator" on %I for select to authenticated using ((select public.este_din_laborator()));',
      t, t, t
    );
  end loop;
end $$;

-- Subiecte și setări note: citire pentru toți cei logați (și medicul, ca să
-- poată alege subiectul răspunsului); modificare patron + coordonator.
do $$
declare
  t text;
begin
  for t in select unnest(array['subiecte_note', 'setari_note']) loop
    execute format(
      'drop policy if exists "citire_toti" on %I;
       drop policy if exists "operational_all" on %I;
       create policy "citire_toti" on %I for select to authenticated using (true);
       create policy "operational_all" on %I for all to authenticated
         using ((select public.are_acces_operational())) with check ((select public.are_acces_operational()));',
      t, t, t, t
    );
  end loop;
end $$;

-- Note — laboratorul. Medicul NU are politici pe tabel: citește și scrie doar
-- prin funcțiile de la secțiunea 5.
drop policy if exists "note_citire" on note_comanda;
drop policy if exists "note_adaugare" on note_comanda;
create policy "note_citire" on note_comanda for select to authenticated using (
  (select public.are_acces_operational())
  or ((select public.tehnicianul_meu()) is not null and comanda_id in (select public.lucrarile_mele()))
);
create policy "note_adaugare" on note_comanda for insert to authenticated with check (
  public.note_deschise(comanda_id)
  and (
    (select public.are_acces_operational())
    or ((select public.tehnicianul_meu()) is not null and comanda_id in (select public.lucrarile_mele()))
  )
);

-- Patronul și coordonatorul văd conturile medicilor (starea accesului).
drop policy if exists "operational_citire_medici" on profiles;
create policy "operational_citire_medici" on profiles
  for select to authenticated
  using (rol = 'medic' and (select public.are_acces_operational()));

-- Autorul notei — completat din contul logat, nu din aplicație.
create or replace function public.note_comanda_completeaza()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.rolul_meu();
begin
  if auth.uid() is null or v_rol is null then
    raise exception 'Notele se adaugă doar din aplicație, de un utilizator logat.' using errcode = '42501';
  end if;
  new.autor_id := auth.uid();
  new.rol_autor := v_rol;
  new.autor_nume := case
    when v_rol = 'medic' then coalesce((select nume from public.medici where id = public.medicul_meu()), 'Medic')
    else coalesce(nullif((select nume from public.profiles where id = auth.uid()), ''), initcap(v_rol))
  end;
  select nume into new.subiect from public.subiecte_note where id = new.subiect_id and activ;
  if new.subiect is null then
    raise exception 'Alege un subiect din listă.';
  end if;
  new.text := trim(new.text);
  if v_rol = 'medic' then
    new.vizibilitate := 'medic';
  end if;
  new.created_at := now();
  new.citita_de_lab := case when v_rol <> 'medic' then now() end;
  new.citita_de_medic := case when v_rol = 'medic' then now() end;
  return new;
end;
$$;

drop trigger if exists note_comanda_completeaza on note_comanda;
create trigger note_comanda_completeaza
  before insert on note_comanda
  for each row execute function public.note_comanda_completeaza();

-- ---------------------------------------------------------------------------
-- 5. Funcții pentru medic (singura lui cale către date) + marcarea citirii
-- ---------------------------------------------------------------------------

-- Comenzile active ale medicului: fără prețuri, etape, tehnicieni.
-- Status simplificat: Primită / În lucru / Livrată.
create or replace function public.comenzile_mele_medic()
returns table (
  id uuid,
  nr_inregistrare text,
  pacient text,
  data_intrare date,
  termen_predare date,
  status text,
  note_necitite integer,
  ultima_nota timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.verifica_medic();
  return query
  select
    l.id, l.nr_inregistrare, l.pacient, l.data_intrare, l.termen_predare,
    case
      when exists (
        select 1 from public.productie_lucrare p join public.etape_productie e on e.id = p.etapa_id
        where p.lucrare_id = l.id and lower(trim(e.nume)) = 'livrare' and p.finalizat
      ) then 'Livrată'
      when exists (select 1 from public.productie_lucrare p where p.lucrare_id = l.id and p.finalizat) then 'În lucru'
      else 'Primită'
    end,
    (select count(*)::integer from public.note_comanda n
     where n.comanda_id = l.id and n.vizibilitate = 'medic' and n.rol_autor <> 'medic' and n.citita_de_medic is null),
    (select max(n.created_at) from public.note_comanda n where n.comanda_id = l.id and n.vizibilitate = 'medic')
  from public.lucrari l
  where l.id in (select public.comenzile_medicului())
    and public.note_deschise(l.id)
  order by l.termen_predare nulls last, l.data_intrare desc;
end;
$$;

-- Notele vizibile medicului pentru o comandă a lui. Autorul din laborator apare
-- mereu ca „Algorithm Lab" (fără numele tehnicienilor).
create or replace function public.notele_comenzii_medic(p_comanda uuid)
returns table (
  id uuid,
  de_la text,
  subiect text,
  text text,
  created_at timestamptz,
  citita_de_medic timestamptz,
  deschisa boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.verifica_medic();
  if p_comanda not in (select public.comenzile_medicului()) then
    raise exception 'Comanda nu există sau nu e a ta.' using errcode = '42501';
  end if;
  return query
  select n.id,
         case when n.rol_autor = 'medic' then 'medic' else 'laborator' end,
         n.subiect, n.text, n.created_at, n.citita_de_medic,
         public.note_deschise(p_comanda)
  from public.note_comanda n
  where n.comanda_id = p_comanda and n.vizibilitate = 'medic'
  order by n.created_at;
end;
$$;

-- Detaliile comenzii pentru antetul paginii medicului.
create or replace function public.comanda_medic(p_nr text)
returns table (id uuid, nr_inregistrare text, pacient text, data_intrare date, termen_predare date, deschisa boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.verifica_medic();
  return query
  select l.id, l.nr_inregistrare, l.pacient, l.data_intrare, l.termen_predare, public.note_deschise(l.id)
  from public.lucrari l
  where l.nr_inregistrare = p_nr and l.id in (select public.comenzile_medicului());
end;
$$;

create or replace function public.adauga_nota_medic(p_comanda uuid, p_subiect uuid, p_text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.verifica_medic();
  if p_comanda not in (select public.comenzile_medicului()) then
    raise exception 'Comanda nu există sau nu e a ta.' using errcode = '42501';
  end if;
  if not public.note_deschise(p_comanda) then
    raise exception 'Comanda e închisă pentru note.';
  end if;
  insert into public.note_comanda (comanda_id, subiect_id, subiect, text, vizibilitate, rol_autor)
  values (p_comanda, p_subiect, '', p_text, 'medic', 'medic')
  returning id into v_id;
  return v_id;
end;
$$;

-- „Citit": în laborator (patron/coordonator) — notele medicului; la medic —
-- notele laboratorului trimise lui. Singura modificare permisă pe note.
create or replace function public.marcheaza_note_citite(p_comanda uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nr integer := 0;
begin
  if public.are_acces_operational() then
    update public.note_comanda set citita_de_lab = now()
    where comanda_id = p_comanda and rol_autor = 'medic' and citita_de_lab is null;
    get diagnostics v_nr = row_count;
  elsif public.medicul_meu() is not null then
    perform public.verifica_medic();
    if p_comanda not in (select public.comenzile_medicului()) then
      raise exception 'Comanda nu există sau nu e a ta.' using errcode = '42501';
    end if;
    update public.note_comanda set citita_de_medic = now()
    where comanda_id = p_comanda and vizibilitate = 'medic' and rol_autor <> 'medic' and citita_de_medic is null;
    get diagnostics v_nr = row_count;
  end if;
  return v_nr;
end;
$$;

-- Pagina deschisă din linkul personal, înainte de autentificare: doar numele
-- medicului și emailul mascat (ex. d•••n@gmail.com).
create or replace function public.info_acces_medic(p_cod text)
returns table (medic text, email_mascat text)
language sql
stable
security definer
set search_path = public
as $$
  select m.nume,
         case when m.email is null then null
              else left(split_part(m.email, '@', 1), 1) || '•••' || right(split_part(m.email, '@', 1), 1) || '@' || split_part(m.email, '@', 2)
         end
  from public.profiles p
  join public.medici m on m.id = p.medic_id
  where p.cod_acces = p_cod and p.rol = 'medic' and p.activ and length(p_cod) >= 16;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.comenzile_mele_medic()', 'public.notele_comenzii_medic(uuid)', 'public.comanda_medic(text)',
    'public.adauga_nota_medic(uuid, uuid, text)', 'public.marcheaza_note_citite(uuid)',
    'public.note_deschise(uuid)', 'public.verifica_medic()', 'public.comenzile_medicului()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function public.info_acces_medic(text) from public;
grant execute on function public.info_acces_medic(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Realtime — indicatorul „notă nouă de la medic" se actualizează singur
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'note_comanda'
  ) then
    alter publication supabase_realtime add table note_comanda;
  end if;
end $$;
