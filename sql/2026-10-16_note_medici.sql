-- Note pe comandă + acces pentru medici
-- Proiect Supabase: kuxcmmrxhppudbwiwmxv. Idempotent — se poate rula de mai
-- multe ori. Doar ALTER TABLE / tabele noi; nu șterge și nu recreează nimic.
-- Sursa de adevăr rămâne schema.sql (aceleași comenzi).

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

-- Verificare: subiectele + medicii de pe comenzi care NU se găsesc în lista de
-- medici (comenzile lor nu vor apărea în pagina niciunui medic).
select 'subiect' as tip, nume as valoare from subiecte_note
union all
select 'medic fără pereche', medic
from (select distinct trim(l.medic) as medic from lucrari l where coalesce(trim(l.medic), '') <> '') x
where not exists (select 1 from medici m where lower(trim(m.nume)) = lower(x.medic))
order by tip, valoare;
