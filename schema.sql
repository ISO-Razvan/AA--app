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
-- Rândurile din acest tabel NU se creează din aplicație — administratorul le
-- creează manual din Supabase (vezi instrucțiunile de la finalul mesajului).
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol text not null check (rol in ('admin', 'tehnician')),
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
-- Securitate — Row Level Security. Doar utilizatorii autentificați (orice
-- rol) pot citi/scrie datele operaționale în această rundă — restricțiile
-- fine pe rol (ex. tehnicianul nu vede sumele financiare) se adaugă separat,
-- la runda următoare. Fără RLS, cheia "anon" ar da acces public la tot.
-- ---------------------------------------------------------------------------

alter table tipuri_lucrare enable row level security;
alter table extra_uri enable row level security;
alter table culori enable row level security;
alter table medici enable row level security;
alter table clinici enable row level security;
alter table etape_productie enable row level security;
alter table tehnicieni enable row level security;
alter table comisioane enable row level security;
alter table lucrari enable row level security;
alter table productie_lucrare enable row level security;
alter table poze_lucrare enable row level security;
alter table linkuri_lucrare enable row level security;
alter table devize enable row level security;
alter table deviz_lucrari enable row level security;
alter table profiles enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'tipuri_lucrare', 'extra_uri', 'culori', 'medici', 'clinici', 'etape_productie',
      'tehnicieni', 'comisioane', 'lucrari', 'productie_lucrare',
      'poze_lucrare', 'linkuri_lucrare', 'devize', 'deviz_lucrari'
    ])
  loop
    execute format(
      'drop policy if exists "authenticated_all" on %I;
       create policy "authenticated_all" on %I for all to authenticated using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

-- profiles: un utilizator își poate citi doar propriul rând (suficient ca
-- aplicația să afle rolul la login); scrierea se face manual, din Supabase.
drop policy if exists "select_own_profile" on profiles;
create policy "select_own_profile" on profiles
  for select to authenticated
  using (auth.uid() = id);

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
