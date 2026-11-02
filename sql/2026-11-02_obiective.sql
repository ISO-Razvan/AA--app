-- Obiective (ISO 9001 pct. 6.2 și 9.1) — obiectivele companiei, măsurate
-- automat din aplicație și revizuite săptămânal. Doar patronul.
-- Proiect Supabase: kuxcmmrxhppudbwiwmxv. Idempotent; doar tabele și funcții
-- noi — nu modifică și nu șterge nimic existent. Singurele rânduri inserate
-- sunt cele 3 obiective de pornire (fără țintă; ținta se completează în aplicație).

-- ---------------------------------------------------------------------------
-- 1. Tabele
-- ---------------------------------------------------------------------------

-- Un obiectiv per indicator calculat automat. Ce cere 6.2: ce se face (titlu,
-- plan de acțiuni), resurse, responsabil, termen, cum se evaluează.
create table if not exists obiective (
  id uuid primary key default gen_random_uuid(),
  indicator text not null unique check (indicator in ('livrari_la_termen', 'refaceri', 'valoare_intrata')),
  titlu text not null,
  categorie text not null,                 -- eticheta de pe card: Livrare / Calitate / Financiar
  unitate text not null,                   -- '%' sau 'RON'
  sens text not null check (sens in ('min', 'max')),  -- min: valoarea ≥ țintă; max: valoarea ≤ țintă
  tinta numeric,                           -- null = țintă nesetată
  toleranta numeric check (toleranta is null or toleranta >= 0),  -- marja „La risc” (aceeași unitate)
  perioada text not null check (perioada in ('saptamana', 'luna')),
  responsabil text,
  resurse text,
  evaluare text,
  termen date,
  ordine integer not null default 0,
  activ boolean not null default true,
  created_at timestamptz not null default now()
);

insert into obiective (indicator, titlu, categorie, unitate, sens, perioada, ordine, toleranta, evaluare) values
  ('livrari_la_termen', 'Livrări la termen', 'Livrare', '%', 'min', 'saptamana', 1, 5,
   'Săptămânal: lucrările finalizate în laborator până la termenul de predare, din cele finalizate în săptămână'),
  ('refaceri', 'Refaceri și neconformități', 'Calitate', '%', 'max', 'saptamana', 2, 2,
   'Săptămânal: refacerile înregistrate, raportate la lucrările finalizate în aceeași săptămână'),
  ('valoare_intrata', 'Valoare comenzi intrate', 'Financiar', 'RON', 'min', 'luna', 3, null,
   'Săptămânal: valoarea cumulată a lunii (după data intrării) față de ținta lunară')
on conflict (indicator) do nothing;

-- Planul de acțiuni al fiecărui obiectiv.
create table if not exists obiective_actiuni (
  id uuid primary key default gen_random_uuid(),
  obiectiv_id uuid not null references obiective (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  responsabil text,
  termen date,                             -- null = continuu
  status text not null default 'de_facut' check (status in ('de_facut', 'in_curs', 'realizat')),
  data_realizare date,
  created_at timestamptz not null default now()
);
create index if not exists obiective_actiuni_obiectiv_idx on obiective_actiuni (obiectiv_id);

-- Revizuirea săptămânală — înregistrarea monitorizării (9.1). Una pe
-- săptămână (luni–duminică); nu se mai modifică după confirmare.
create table if not exists obiective_revizuiri (
  id uuid primary key default gen_random_uuid(),
  saptamana date not null unique check (extract(isodow from saptamana) = 1),  -- lunea săptămânii
  luna date not null,                      -- prima zi a lunii în care cade joia săptămânii
  observatii text,
  revizuita_de_id uuid references auth.users (id) on delete set null,
  revizuita_de text not null default '',
  created_at timestamptz not null default now()
);

-- Valorile înghețate la confirmare — nu se mai schimbă dacă datele din
-- aplicație se modifică ulterior (debifări, ștergeri, recalculări).
create table if not exists obiective_valori (
  id uuid primary key default gen_random_uuid(),
  revizuire_id uuid not null references obiective_revizuiri (id) on delete cascade,
  obiectiv_id uuid references obiective (id) on delete set null,
  indicator text not null,
  titlu text not null,
  unitate text not null,
  sens text not null,
  valoare numeric,
  numarator numeric,
  numitor numeric,
  tinta numeric,
  tinta_efectiva numeric,                  -- la RON: ținta lunară proporțională cu zilele scurse
  toleranta numeric,
  stare text not null,                     -- pe_drum / la_risc / sub_tinta / fara_tinta / fara_date
  detalii jsonb not null default '{}'::jsonb  -- ce s-a numărat (nr. comenzi), pentru audit
);
create index if not exists obiective_valori_revizuire_idx on obiective_valori (revizuire_id);

-- ---------------------------------------------------------------------------
-- 2. Acces — doar patronul. Revizuirile și valorile se scriu DOAR prin
-- funcția confirma_revizuire_obiective și nu se pot modifica sau șterge.
-- ---------------------------------------------------------------------------
alter table obiective enable row level security;
alter table obiective_actiuni enable row level security;
alter table obiective_revizuiri enable row level security;
alter table obiective_valori enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array['obiective_revizuiri', 'obiective_valori']) loop
    execute format(
      'drop policy if exists "patron_citire" on %I;
       create policy "patron_citire" on %I for select to authenticated using ((select public.este_patron()));',
      t, t
    );
  end loop;
end $$;

-- Acțiunile: patronul le adaugă, modifică și șterge.
drop policy if exists "patron_all" on obiective_actiuni;
create policy "patron_all" on obiective_actiuni for all to authenticated
  using ((select public.este_patron())) with check ((select public.este_patron()));

-- Obiectivele de pornire nu se adaugă și nu se șterg din aplicație (indicatorii
-- sunt ficși); se pot doar modifica (țintă, responsabil, resurse, termen…).
drop policy if exists "patron_all" on obiective;
drop policy if exists "patron_citire" on obiective;
drop policy if exists "patron_modificare" on obiective;
create policy "patron_citire" on obiective for select to authenticated using ((select public.este_patron()));
create policy "patron_modificare" on obiective for update to authenticated
  using ((select public.este_patron())) with check ((select public.este_patron()));

-- ---------------------------------------------------------------------------
-- 3. Calculul indicatorilor
-- ---------------------------------------------------------------------------

-- Ziua de azi în România (serverul rulează în UTC).
create or replace function public.azi_romania()
returns date
language sql
stable
as $$
  select (now() at time zone 'Europe/Bucharest')::date;
$$;

-- Starea unui obiectiv față de țintă. sens 'min': valoare ≥ țintă e bine;
-- 'max': valoare ≤ țintă e bine. „La risc” = în afara țintei, dar în toleranță.
create or replace function public.stare_obiectiv(p_valoare numeric, p_tinta numeric, p_toleranta numeric, p_sens text)
returns text
language sql
immutable
as $$
  select case
    when p_tinta is null then 'fara_tinta'
    when p_valoare is null then 'fara_date'
    when p_sens = 'min' and p_valoare >= p_tinta then 'pe_drum'
    when p_sens = 'max' and p_valoare <= p_tinta then 'pe_drum'
    when p_sens = 'min' and p_valoare >= p_tinta - coalesce(p_toleranta, 0) then 'la_risc'
    when p_sens = 'max' and p_valoare <= p_tinta + coalesce(p_toleranta, 0) then 'la_risc'
    else 'sub_tinta'
  end;
$$;

-- Lucrările finalizate în laborator, cu data finalizării: toate etapele de
-- producție bifate, FĂRĂ Livrare. Contează doar etapele care existau în Setup
-- la înregistrarea lucrării (o etapă adăugată ulterior nu „definalizează”
-- lucrările vechi). Data = cea mai recentă bifă dintre aceste etape.
-- Refacerile nu intră (au refacere_pentru).
create or replace function public.lucrari_finalizate_laborator(p_de_la date, p_pana_la date)
returns table (lucrare_id uuid, nr_inregistrare text, termen_predare date, data_finalizare date)
language sql
stable
security definer
set search_path = public
as $$
  with necesare as (
    select l.id as lucrare_id, e.id as etapa_id
    from public.lucrari l
    join public.etape_productie e
      on lower(trim(e.nume)) <> 'livrare' and e.created_at <= l.created_at
    where l.refacere_pentru is null
  ),
  stare as (
    select n.lucrare_id,
           count(*) as nr_necesare,
           count(*) filter (where p.finalizat and p.data_finalizare is not null) as nr_bifate,
           max(p.data_finalizare) filter (where p.finalizat) as ultima
    from necesare n
    left join public.productie_lucrare p on p.lucrare_id = n.lucrare_id and p.etapa_id = n.etapa_id
    group by n.lucrare_id
  )
  select s.lucrare_id, l.nr_inregistrare, l.termen_predare, s.ultima
  from stare s
  join public.lucrari l on l.id = s.lucrare_id
  where public.este_patron()
    and s.nr_necesare > 0
    and s.nr_bifate = s.nr_necesare
    and s.ultima between p_de_la and p_pana_la;
$$;

-- Indicatorii unei săptămâni (p_luni = lunea ei), câte un obiect per obiectiv
-- activ, cu valoare, țintă, stare și ce s-a numărat. Doar patronul.
create or replace function public.obiective_saptamana(p_luni date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_duminica date := p_luni + 6;
  v_luna date := date_trunc('month', (p_luni + 3)::timestamp)::date;          -- luna joii
  v_luna_sfarsit date := (date_trunc('month', (p_luni + 3)::timestamp) + interval '1 month - 1 day')::date;
  v_pana_la date;                                                 -- capătul cumulului lunar
  v_fin integer;
  v_la_termen integer;
  v_fara_termen integer;
  v_refaceri integer;
  v_lista_fin jsonb;
  v_lista_ref jsonb;
  v_valoare numeric;
  v_nr_intrate integer;
  v_rezultat jsonb := '[]'::jsonb;
  o public.obiective%rowtype;
  v_val numeric;
  v_num numeric;
  v_den numeric;
  v_tinta_ef numeric;
  v_tol numeric;
  v_det jsonb;
begin
  if not public.este_patron() then
    raise exception 'Doar patronul vede obiectivele.' using errcode = '42501';
  end if;
  if extract(isodow from p_luni) <> 1 then
    raise exception 'Săptămâna trebuie dată prin ziua ei de luni.';
  end if;
  v_pana_la := least(v_duminica, v_luna_sfarsit);

  -- 1. Livrări la termen (lucrările fără termen se numără separat).
  select count(*) filter (where termen_predare is not null),
         count(*) filter (where termen_predare is not null and data_finalizare <= termen_predare),
         count(*) filter (where termen_predare is null),
         coalesce(jsonb_agg(jsonb_build_object('nr', nr_inregistrare, 'finalizata', data_finalizare,
                  'termen', termen_predare) order by nr_inregistrare), '[]'::jsonb)
  into v_fin, v_la_termen, v_fara_termen, v_lista_fin
  from public.lucrari_finalizate_laborator(p_luni, v_duminica);

  -- 2. Refaceri înregistrate în săptămână (data creării, ora României).
  select count(*), coalesce(jsonb_agg(l.nr_inregistrare order by l.nr_inregistrare), '[]'::jsonb)
  into v_refaceri, v_lista_ref
  from public.lucrari l
  where l.refacere_pentru is not null
    and (l.created_at at time zone 'Europe/Bucharest')::date between p_luni and v_duminica;

  -- 3. Valoare comenzi intrate în luna joii, de la 1 până la duminică
  -- (sau la sfârșitul lunii, dacă săptămâna trece în luna următoare).
  select coalesce(sum(coalesce(l.incasare, 0)), 0), count(*)
  into v_valoare, v_nr_intrate
  from public.lucrari l
  where l.data_intrare between v_luna and v_pana_la;

  for o in select * from public.obiective where activ order by ordine loop
    v_tinta_ef := o.tinta;
    v_tol := o.toleranta;
    if o.indicator = 'livrari_la_termen' then
      v_num := v_la_termen;
      v_den := v_fin;
      v_val := case when v_fin > 0 then round(100.0 * v_la_termen / v_fin, 1) end;
      v_det := jsonb_build_object('finalizate_cu_termen', v_fin, 'la_termen', v_la_termen,
                                  'fara_termen', v_fara_termen, 'lucrari', v_lista_fin);
    elsif o.indicator = 'refaceri' then
      v_num := v_refaceri;
      v_den := (select count(*) from public.lucrari_finalizate_laborator(p_luni, v_duminica));
      v_val := case when v_den > 0 then round(100.0 * v_refaceri / v_den, 1) end;
      v_det := jsonb_build_object('refaceri', v_refaceri, 'finalizate', v_den, 'lucrari', v_lista_ref);
    else
      v_num := v_valoare;
      v_den := null;
      v_val := v_valoare;
      -- Ținta lunară, proporțional cu zilele scurse din lună până la v_pana_la.
      if o.tinta is not null then
        v_tinta_ef := round(o.tinta * (v_pana_la - v_luna + 1) / (v_luna_sfarsit - v_luna + 1), 0);
        v_tol := coalesce(o.toleranta, round(v_tinta_ef * 0.1, 0));
      end if;
      v_det := jsonb_build_object('luna', v_luna, 'pana_la', v_pana_la, 'comenzi', v_nr_intrate,
                                  'tinta_lunara', o.tinta);
    end if;

    v_rezultat := v_rezultat || jsonb_build_array(jsonb_build_object(
      'obiectiv_id', o.id, 'indicator', o.indicator, 'titlu', o.titlu, 'unitate', o.unitate,
      'sens', o.sens, 'valoare', v_val, 'numarator', v_num, 'numitor', v_den,
      'tinta', o.tinta, 'tinta_efectiva', v_tinta_ef, 'toleranta', v_tol,
      'stare', public.stare_obiectiv(v_val, v_tinta_ef, v_tol, o.sens), 'detalii', v_det
    ));
  end loop;

  return jsonb_build_object('saptamana', p_luni, 'luna', v_luna, 'pana_la', v_pana_la, 'obiective', v_rezultat);
end;
$$;

-- Evoluția pentru grafice: ultimele p_nr săptămâni (procente) și ultimele
-- 6 luni (valoarea întregii luni, iar pentru luna curentă până azi).
create or replace function public.obiective_evolutie(p_luni date, p_nr integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sapt jsonb := '[]'::jsonb;
  v_luni jsonb := '[]'::jsonb;
  v_s date;
  v_fin integer;
  v_la integer;
  v_total integer;
  v_l date;
  v_val numeric;
begin
  if not public.este_patron() then
    raise exception 'Doar patronul vede obiectivele.' using errcode = '42501';
  end if;
  for i in reverse (p_nr - 1)..0 loop
    v_s := p_luni - 7 * i;
    select count(*) filter (where termen_predare is not null),
           count(*) filter (where termen_predare is not null and data_finalizare <= termen_predare),
           count(*)
    into v_fin, v_la, v_total
    from public.lucrari_finalizate_laborator(v_s, v_s + 6);
    v_sapt := v_sapt || jsonb_build_array(jsonb_build_object(
      'saptamana', v_s,
      'livrari_la_termen', case when v_fin > 0 then round(100.0 * v_la / v_fin, 1) end,
      'refaceri', case when v_total > 0 then round(100.0 * (
          select count(*) from public.lucrari l
          where l.refacere_pentru is not null
            and (l.created_at at time zone 'Europe/Bucharest')::date between v_s and v_s + 6
        ) / v_total, 1) end
    ));
  end loop;
  for i in reverse 5..0 loop
    v_l := (date_trunc('month', (p_luni + 3)::timestamp) - make_interval(months => i))::date;
    select coalesce(sum(coalesce(incasare, 0)), 0) into v_val
    from public.lucrari
    where data_intrare between v_l and (v_l + interval '1 month - 1 day')::date;
    v_luni := v_luni || jsonb_build_array(jsonb_build_object('luna', v_l, 'valoare_intrata', v_val));
  end loop;
  return jsonb_build_object('saptamani', v_sapt, 'luni', v_luni);
end;
$$;

-- Confirmarea revizuirii: calculează și îngheață valorile săptămânii, cu
-- observațiile patronului. O singură dată pe săptămână, doar pentru o
-- săptămână încheiată.
create or replace function public.confirma_revizuire_obiective(p_luni date, p_observatii text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calc jsonb;
  v_id uuid;
  v jsonb;
begin
  if not public.este_patron() then
    raise exception 'Doar patronul poate confirma revizuirea.' using errcode = '42501';
  end if;
  if p_luni + 6 >= public.azi_romania() then
    raise exception 'Se pot revizui doar săptămânile încheiate.';
  end if;
  if exists (select 1 from public.obiective_revizuiri where saptamana = p_luni) then
    raise exception 'Săptămâna a fost deja revizuită.';
  end if;
  v_calc := public.obiective_saptamana(p_luni);
  insert into public.obiective_revizuiri (saptamana, luna, observatii, revizuita_de_id, revizuita_de)
  values (
    p_luni, (v_calc ->> 'luna')::date, nullif(trim(coalesce(p_observatii, '')), ''), auth.uid(),
    coalesce(nullif((select nume from public.profiles where id = auth.uid()), ''), 'Patron')
  )
  returning id into v_id;
  for v in select * from jsonb_array_elements(v_calc -> 'obiective') loop
    insert into public.obiective_valori (
      revizuire_id, obiectiv_id, indicator, titlu, unitate, sens, valoare, numarator, numitor,
      tinta, tinta_efectiva, toleranta, stare, detalii
    ) values (
      v_id, (v ->> 'obiectiv_id')::uuid, v ->> 'indicator', v ->> 'titlu', v ->> 'unitate', v ->> 'sens',
      (v ->> 'valoare')::numeric, (v ->> 'numarator')::numeric, (v ->> 'numitor')::numeric,
      (v ->> 'tinta')::numeric, (v ->> 'tinta_efectiva')::numeric, (v ->> 'toleranta')::numeric,
      v ->> 'stare', coalesce(v -> 'detalii', '{}'::jsonb)
    );
  end loop;
  return v_id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.lucrari_finalizate_laborator(date, date)', 'public.obiective_saptamana(date)',
    'public.obiective_evolutie(date, integer)', 'public.confirma_revizuire_obiective(date, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
