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
-- Securitate — Row Level Security, pe roluri (profiles.rol). Fără RLS,
-- cheia "anon" ar da acces public la tot. Toți utilizatorii logați au același
-- rol de bază de date (`authenticated`), deci diferența admin/tehnician se
-- face în politici, prin funcțiile de mai jos (security definer, ca să poată
-- citi `profiles` indiferent de politicile acestuia).
-- ---------------------------------------------------------------------------

create or replace function public.este_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin');
$$;

create or replace function public.tehnicianul_meu()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tehnician_id from public.profiles where id = auth.uid() and rol = 'tehnician';
$$;

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

-- Date financiare sau de preț — doar admin (citire și scriere). Tehnicianul
-- citește lucrările prin view-ul `lucrari_vizibile` (mai jos), nu direct.
do $$
declare
  t text;
begin
  for t in
    select unnest(array['lucrari', 'comisioane', 'extra_uri', 'tipuri_lucrare', 'devize', 'deviz_lucrari'])
  loop
    execute format(
      'drop policy if exists "authenticated_all" on %I;
       drop policy if exists "admin_all" on %I;
       create policy "admin_all" on %I for all to authenticated
         using ((select public.este_admin())) with check ((select public.este_admin()));',
      t, t, t
    );
  end loop;
end $$;

-- Configurare fără prețuri — citire pentru toți cei logați, scriere doar admin.
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
       create policy "citire_toti" on %I for select to authenticated using (true);
       create policy "admin_all" on %I for all to authenticated
         using ((select public.este_admin())) with check ((select public.este_admin()));',
      t, t, t, t, t
    );
  end loop;
end $$;

-- Galerie (poze, link-uri) — fără date financiare, accesibilă tuturor celor logați.
do $$
declare
  t text;
begin
  for t in select unnest(array['poze_lucrare', 'linkuri_lucrare']) loop
    execute format(
      'drop policy if exists "authenticated_all" on %I;
       create policy "authenticated_all" on %I for all to authenticated using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

-- Producție — citire pentru toți; adminul modifică orice; tehnicianul poate
-- actualiza doar rândurile alocate lui, și doar bifa + data finalizării
-- (restul coloanelor sunt blocate de triggerul de mai jos).
drop policy if exists "authenticated_all" on productie_lucrare;
drop policy if exists "citire_toti" on productie_lucrare;
drop policy if exists "admin_all" on productie_lucrare;
drop policy if exists "tehnician_finalizare" on productie_lucrare;
create policy "citire_toti" on productie_lucrare for select to authenticated using (true);
create policy "admin_all" on productie_lucrare for all to authenticated
  using ((select public.este_admin())) with check ((select public.este_admin()));
create policy "tehnician_finalizare" on productie_lucrare for update to authenticated
  using (tehnician_id = (select public.tehnicianul_meu()))
  with check (tehnician_id = (select public.tehnicianul_meu()));

create or replace function public.protectie_productie_tehnician()
returns trigger
language plpgsql
as $$
begin
  -- auth.uid() null = SQL Editor / cheia de serviciu / triggerul Livrare rulat de server.
  if auth.uid() is null or public.este_admin() then
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

drop trigger if exists productie_protectie_tehnician on productie_lucrare;
create trigger productie_protectie_tehnician
  before update on productie_lucrare
  for each row execute function public.protectie_productie_tehnician();

-- profiles: fiecare își citește propriul rând (rolul la login); adminul le
-- vede pe toate (ca să știe ce tehnicieni au deja cont). Scrierea se face
-- doar din funcția de server /api/creare-cont-tehnician (cheia de serviciu).
drop policy if exists "select_own_profile" on profiles;
create policy "select_own_profile" on profiles
  for select to authenticated
  using (auth.uid() = id);
drop policy if exists "admin_citire" on profiles;
create policy "admin_citire" on profiles
  for select to authenticated
  using ((select public.este_admin()));

-- Lucrările pentru citire — toate coloanele pentru admin; pentru tehnician
-- coloanele financiare vin goale, comisioanele ca listă goală, iar
-- extra-urile doar cu nume + cantitate (fără prețuri și fără Try-in, afișat
-- separat ca bifă). View-ul rulează cu drepturile proprietarului (ocolește
-- politica admin-only de pe `lucrari`) și e doar de citit.
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
  case when r.admin then l.cost_laborator end as cost_laborator,
  case when r.admin then l.incasare end as incasare,
  case when r.admin then l.profit end as profit,
  case when r.admin then l.pret_dinte_simplu end as pret_dinte_simplu,
  case when r.admin then l.pret_dinte_implant end as pret_dinte_implant,
  case when r.admin then l.comisioane else '[]'::jsonb end as comisioane,
  case
    when r.admin then l.extra_uri
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
  end as extra_uri
from public.lucrari l
cross join (select public.este_admin() as admin, public.tehnicianul_meu() as tehnician) r
where r.admin or r.tehnician is not null;

revoke all on public.lucrari_vizibile from anon, authenticated;
grant select on public.lucrari_vizibile to authenticated;

-- Salariul tehnicianului logat — doar comisioanele LUI (auth.uid() →
-- profiles.tehnician_id), din etapele finalizate în luna cerută ('AAAA-LL'),
-- cu suma etapei respective din instantaneul lucrării. Nimic despre alți
-- tehnicieni sau alte etape nu iese din funcție.
create or replace function public.salariul_meu(p_luna text)
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
  suma numeric
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
    ), 0)
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
