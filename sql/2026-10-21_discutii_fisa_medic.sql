-- Note ca discuții (răspuns pe aceeași notă + „Rezolvat") și fișa comenzii
-- pentru medic (Detalii + Galerie, doar de citit).
-- Proiect Supabase: kuxcmmrxhppudbwiwmxv. Idempotent; doar ALTER TABLE și
-- funcții — nu șterge date. Se rulează DUPĂ sql/2026-10-16_note_medici.sql.

-- ---------------------------------------------------------------------------
-- 1. Discuții: răspunsul ține de nota inițială; o discuție se poate închide
-- ---------------------------------------------------------------------------
alter table note_comanda add column if not exists raspuns_la uuid references note_comanda (id) on delete cascade;
alter table note_comanda add column if not exists rezolvata_la timestamptz;
alter table note_comanda add column if not exists rezolvata_de text;
create index if not exists note_comanda_raspuns_idx on note_comanda (raspuns_la);

-- Completarea automată a notei (autor, rol, subiect, citit). Un răspuns:
--  - se leagă mereu de nota inițială (un singur nivel de răspunsuri);
--  - preia subiectul și vizibilitatea discuției (intern rămâne intern);
--  - redeschide discuția, dacă era marcată rezolvată.
create or replace function public.note_comanda_completeaza()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.rolul_meu();
  v_parinte public.note_comanda%rowtype;
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
  new.text := trim(new.text);
  new.rezolvata_la := null;
  new.rezolvata_de := null;

  if new.raspuns_la is not null then
    select * into v_parinte from public.note_comanda where id = new.raspuns_la;
    if not found or v_parinte.comanda_id <> new.comanda_id then
      raise exception 'Nota la care răspunzi nu există pe această comandă.';
    end if;
    if v_parinte.raspuns_la is not null then
      select * into v_parinte from public.note_comanda where id = v_parinte.raspuns_la;
    end if;
    if v_rol = 'medic' and v_parinte.vizibilitate <> 'medic' then
      raise exception 'Nota nu există sau nu e a ta.' using errcode = '42501';
    end if;
    new.raspuns_la := v_parinte.id;
    new.subiect_id := v_parinte.subiect_id;
    new.subiect := v_parinte.subiect;
    new.vizibilitate := v_parinte.vizibilitate;
    update public.note_comanda set rezolvata_la = null, rezolvata_de = null
    where id = v_parinte.id and rezolvata_la is not null;
  else
    select nume into new.subiect from public.subiecte_note where id = new.subiect_id and activ;
    if new.subiect is null then
      raise exception 'Alege un subiect din listă.';
    end if;
  end if;

  if v_rol = 'medic' then
    new.vizibilitate := 'medic';
  end if;
  new.created_at := now();
  new.citita_de_lab := case when v_rol <> 'medic' then now() end;
  new.citita_de_medic := case when v_rol = 'medic' then now() end;
  return new;
end;
$$;

-- „Rezolvat" / „Redeschide" pe o discuție — cei din laborator care o văd.
create or replace function public.marcheaza_discutie_rezolvata(p_nota uuid, p_rezolvata boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nota public.note_comanda%rowtype;
begin
  select * into v_nota from public.note_comanda where id = p_nota;
  if not found or v_nota.raspuns_la is not null then
    raise exception 'Discuția nu există.';
  end if;
  if not (
    public.are_acces_operational()
    or (public.tehnicianul_meu() is not null and v_nota.comanda_id in (select public.lucrarile_mele()))
  ) then
    raise exception 'Nu ai acces la această discuție.' using errcode = '42501';
  end if;
  update public.note_comanda
  set rezolvata_la = case when p_rezolvata then now() end,
      rezolvata_de = case when p_rezolvata
        then coalesce(nullif((select nume from public.profiles where id = auth.uid()), ''), initcap(public.rolul_meu()))
      end
  where id = p_nota;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Funcțiile medicului — răspuns pe notă, discuții
-- ---------------------------------------------------------------------------
drop function if exists public.adauga_nota_medic(uuid, uuid, text);
create or replace function public.adauga_nota_medic(p_comanda uuid, p_subiect uuid, p_text text, p_raspuns_la uuid default null)
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
  insert into public.note_comanda (comanda_id, subiect_id, subiect, text, vizibilitate, rol_autor, raspuns_la)
  values (p_comanda, p_subiect, '', p_text, 'medic', 'medic', p_raspuns_la)
  returning id into v_id;
  return v_id;
end;
$$;

drop function if exists public.notele_comenzii_medic(uuid);
create function public.notele_comenzii_medic(p_comanda uuid)
returns table (
  id uuid,
  raspuns_la uuid,
  de_la text,
  subiect text,
  text text,
  created_at timestamptz,
  citita_de_medic timestamptz,
  rezolvata boolean,
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
  select n.id, n.raspuns_la,
         case when n.rol_autor = 'medic' then 'medic' else 'laborator' end,
         n.subiect, n.text, n.created_at, n.citita_de_medic,
         n.rezolvata_la is not null,
         public.note_deschise(p_comanda)
  from public.note_comanda n
  where n.comanda_id = p_comanda and n.vizibilitate = 'medic'
  order by n.created_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Fișa comenzii pentru medic — doar câmpurile permise, fără prețuri,
-- etape, tehnicieni și fără nota internă a laboratorului (`lucrari.nota`).
-- Extra-urile apar doar cu nume + cantitate; Try-in e bifa separată.
-- ---------------------------------------------------------------------------
create or replace function public.fisa_comanda_medic(p_nr text)
returns table (
  id uuid,
  nr_inregistrare text,
  clinica text,
  medic text,
  pacient text,
  tip_lucrare text,
  dinti jsonb,
  nr_elemente integer,
  culoare text,
  implant boolean,
  try_in boolean,
  model text,
  extra_uri jsonb,
  data_intrare date,
  termen_predare date,
  ora_programare time,
  next_date date,
  status text,
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
  return query
  select
    l.id, l.nr_inregistrare, l.clinica, l.medic, l.pacient, l.tip_lucrare, l.dinti, l.nr_elemente,
    l.culoare, l.implant, l.try_in, l.model,
    coalesce((
      select jsonb_agg(jsonb_build_object('extra_id', x.e -> 'extra_id', 'nume', x.e -> 'nume', 'cantitate', x.e -> 'cantitate', 'mod_taxare', x.e -> 'mod_taxare') order by x.ord)
      from jsonb_array_elements(l.extra_uri) with ordinality as x(e, ord)
      where not exists (select 1 from public.extra_uri s where s.id::text = x.e ->> 'extra_id' and s.sistem is not null)
    ), '[]'::jsonb),
    l.data_intrare, l.termen_predare, l.ora_programare, l.next_date,
    case
      when exists (
        select 1 from public.productie_lucrare p join public.etape_productie e on e.id = p.etapa_id
        where p.lucrare_id = l.id and lower(trim(e.nume)) = 'livrare' and p.finalizat
      ) then 'Livrată'
      when exists (select 1 from public.productie_lucrare p where p.lucrare_id = l.id and p.finalizat) then 'În lucru'
      else 'Primită'
    end,
    public.note_deschise(l.id)
  from public.lucrari l
  where l.nr_inregistrare = p_nr and l.id in (select public.comenzile_medicului());
end;
$$;

-- Galeria comenzii (poze + link-uri), doar de citit.
create or replace function public.galerie_comanda_medic(p_comanda uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.verifica_medic();
  if p_comanda not in (select public.comenzile_medicului()) then
    raise exception 'Comanda nu există sau nu e a ta.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'poze', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nume_fisier', p.nume_fisier, 'referinta_fisier', p.referinta_fisier, 'data_incarcare', p.data_incarcare) order by p.data_incarcare desc)
      from public.poze_lucrare p where p.lucrare_id = p_comanda
    ), '[]'::jsonb),
    'linkuri', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.id, 'url', k.url, 'eticheta', k.eticheta, 'data_adaugare', k.data_adaugare) order by k.data_adaugare desc)
      from public.linkuri_lucrare k where k.lucrare_id = p_comanda
    ), '[]'::jsonb)
  );
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.adauga_nota_medic(uuid, uuid, text, uuid)', 'public.notele_comenzii_medic(uuid)',
    'public.fisa_comanda_medic(text)', 'public.galerie_comanda_medic(uuid)',
    'public.marcheaza_discutie_rezolvata(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Verificare: coloanele noi și funcțiile medicului.
select 'coloana' as tip, column_name as nume from information_schema.columns
where table_schema = 'public' and table_name = 'note_comanda' and column_name in ('raspuns_la', 'rezolvata_la', 'rezolvata_de')
union all
select 'functie', p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('adauga_nota_medic', 'notele_comenzii_medic', 'fisa_comanda_medic', 'galerie_comanda_medic', 'marcheaza_discutie_rezolvata')
order by tip, nume;
