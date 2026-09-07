-- Algorithm Aesthetics — schema Supabase (Postgres) — v2
-- Rulează acest fișier în SQL editor-ul proiectului Supabase când este creat.
-- Structura este proiectată pentru a fi extinsă ulterior (ex. tabel `etape`,
-- câmpuri de programare producție/tehnician, modul financiar/stoc) fără a
-- rupe datele existente.

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
  incasare numeric not null default 0,
  created_at timestamptz not null default now()
);

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
-- Înlocuiește lista fixă folosită inițial (Model, Design, Frezare, Sinter,
-- Stratificare, Adaptare, Ambalare); acele valori devin rândurile inițiale.
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
-- executa). `roluri` e un array de id-uri din `etape_productie` — păstrat ca
-- jsonb (nu uuid[] cu foreign key), la fel ca `dinti` din `lucrari`, pentru
-- simplitate; validarea referințelor se face la nivel de aplicație.
create table if not exists tehnicieni (
  id uuid primary key default gen_random_uuid(),
  nume text not null,
  roluri jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Comisioane — sumă fixă per (tip de lucrare, etapă de producție), editabilă
-- din Setup ca grilă. La fel ca la cost_laborator/incasare: modificarea unei
-- sume NU afectează lucrările deja înregistrate, doar cele noi (vezi
-- `comisioane` din `lucrari`, care păstrează instantaneul de la înregistrare).
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
  -- array de obiecte { numar: <FDI 11-48>, grup: <id text> | null }.
  -- `grup` leagă între ei dinții selectați pentru aceeași punte/lucrare unitară.
  dinti jsonb not null default '[]'::jsonb,
  nr_elemente integer not null default 0,
  culoare text,
  implant boolean not null default false,
  try_in boolean not null default false,
  model text check (model in ('Gips', 'Print')),
  data_intrare date not null default current_date,
  termen_predare date,
  -- Ora la care e programat pacientul în ziua din `termen_predare` (ex.
  -- pentru try-in) — opțională, poate lipsi dacă nu există o programare de
  -- pacient pentru acea zi.
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
  -- pregătit pentru extensii viitoare (kanban pe etape), fără a fi folosit acum:
  -- etapa text,
  created_at timestamptz not null default now()
);

create index if not exists lucrari_data_intrare_idx on lucrari (data_intrare);
create index if not exists lucrari_termen_predare_idx on lucrari (termen_predare);
create index if not exists lucrari_next_date_idx on lucrari (next_date);
create index if not exists lucrari_created_at_idx on lucrari (created_at);

-- Programare producție per lucrare — un rând per (lucrare, etapă), cu
-- tehnicianul alocat și data planificată. Afișat ca tab „Producție" în
-- panoul de detaliu al lucrării, sub formă de cronologie verticală
-- (Data intrare → etape, în ordinea din `etape_productie` → Termen predare).
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

-- Poze asociate unei lucrări — tab „Galerie" din panoul de detaliu.
-- DEOCAMDATĂ `referinta_fisier` conține imaginea codificată base64 (data URL),
-- stocată direct în coloană/localStorage. Când proiectul Supabase real e
-- conectat, imaginile trebuie mutate în Supabase Storage (bucket dedicat, ex.
-- `poze-lucrari`), iar `referinta_fisier` va deveni un URL/path către acel
-- obiect din Storage, nu conținutul brut al imaginii — coloana rămâne text în
-- ambele cazuri, deci schema nu se schimbă la migrare, doar ce se scrie în ea.
create table if not exists poze_lucrare (
  id uuid primary key default gen_random_uuid(),
  lucrare_id uuid not null references lucrari (id) on delete cascade,
  nume_fisier text,
  referinta_fisier text not null,
  data_incarcare timestamptz not null default now()
);

create index if not exists poze_lucrare_lucrare_idx on poze_lucrare (lucrare_id);

-- Link-uri externe (ex. Google Drive) asociate unei lucrări — tab „Galerie",
-- listă separată de thumbnail-urile foto. Doar referință URL, nu conținut —
-- nu necesită nicio migrare la conectarea Supabase.
create table if not exists linkuri_lucrare (
  id uuid primary key default gen_random_uuid(),
  lucrare_id uuid not null references lucrari (id) on delete cascade,
  url text not null,
  eticheta text,
  data_adaugare timestamptz not null default now()
);

create index if not exists linkuri_lucrare_lucrare_idx on linkuri_lucrare (lucrare_id);

-- ---------------------------------------------------------------------------
-- Date inițiale de configurare (seed) — aceleași valori folosite acum în
-- implementarea locală (localStorage), ca cele două surse să rămână identice.
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
-- NOTĂ: fără RLS/politici de autentificare în această versiune —
-- ecranele de login se adaugă odată cu conectarea reală a proiectului Supabase.
-- ---------------------------------------------------------------------------
