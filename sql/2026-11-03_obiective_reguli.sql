-- Obiective — regulile finale: pragul „La risc” unic (10%) și activarea doar
-- cu plan complet (ISO 9001 6.2). Se rulează DUPĂ sql/2026-11-02_obiective.sql.
-- Proiect Supabase: kuxcmmrxhppudbwiwmxv. Idempotent. Nu atinge lucrările,
-- salariile, comisioanele sau prețurile.
-- Date modificate: doar cele 3 obiective de pornire trec pe inactiv (nu au încă
-- acțiuni și resurse) și li se golește marja pusă implicit de SQL-ul anterior.

-- ---------------------------------------------------------------------------
-- 1. Pragul „La risc” — SINGURUL loc unde e definit: 10% față de țintă.
--    Aplicația îl primește din calcul (câmpul `prag_risc`), nu îl repetă.
-- ---------------------------------------------------------------------------
create or replace function public.prag_risc_obiective()
returns numeric
language sql
immutable
as $$
  select 0.10::numeric;
$$;

-- Starea față de țintă:
--   sens 'min' (mai mare e mai bine): Pe drum ≥ țintă; La risc ≥ țintă × (1 − 10%);
--   sens 'max' (mai mic e mai bine):  Pe drum ≤ țintă; La risc ≤ țintă × (1 + 10%);
--   altfel Sub țintă. Fără țintă → fara_tinta; fără date → fara_date.
drop function if exists public.stare_obiectiv(numeric, numeric, numeric, text);
create or replace function public.stare_obiectiv(p_valoare numeric, p_tinta numeric, p_sens text)
returns text
language sql
immutable
as $$
  select case
    when p_tinta is null then 'fara_tinta'
    when p_valoare is null then 'fara_date'
    when p_sens = 'min' and p_valoare >= p_tinta then 'pe_drum'
    when p_sens = 'max' and p_valoare <= p_tinta then 'pe_drum'
    when p_sens = 'min' and p_valoare >= p_tinta * (1 - public.prag_risc_obiective()) then 'la_risc'
    when p_sens = 'max' and p_valoare <= p_tinta * (1 + public.prag_risc_obiective()) then 'la_risc'
    else 'sub_tinta'
  end;
$$;

-- Marja pe obiectiv nu mai există (pragul e unic); în instantaneu se păstrează
-- pragul folosit la acel moment.
alter table obiective drop column if exists toleranta;
alter table obiective_valori drop column if exists toleranta;
alter table obiective_valori add column if not exists prag_risc numeric;
alter table obiective_valori add column if not exists activ boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Activarea — doar cu cel puțin o acțiune, resurse și metodă de evaluare.
-- ---------------------------------------------------------------------------
alter table obiective alter column activ set default false;

create or replace function public.obiective_verifica_activare()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.activ then
    if coalesce(trim(new.resurse), '') = '' then
      raise exception 'Obiectivul nu se poate activa fără resurse completate.';
    end if;
    if coalesce(trim(new.evaluare), '') = '' then
      raise exception 'Obiectivul nu se poate activa fără metoda de evaluare.';
    end if;
    if not exists (select 1 from public.obiective_actiuni where obiectiv_id = new.id) then
      raise exception 'Obiectivul nu se poate activa fără cel puțin o acțiune în plan.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists obiective_verifica_activare on obiective;
create trigger obiective_verifica_activare
  before insert or update on obiective
  for each row execute function public.obiective_verifica_activare();

-- Ultima acțiune a unui obiectiv activ nu se poate șterge (planul ar rămâne gol).
create or replace function public.obiective_pastreaza_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.obiective where id = old.obiectiv_id and activ)
     and not exists (select 1 from public.obiective_actiuni where obiectiv_id = old.obiectiv_id and id <> old.id) then
    raise exception 'Este singura acțiune a unui obiectiv activ. Adaugă alta sau dezactivează obiectivul înainte.';
  end if;
  return old;
end;
$$;

drop trigger if exists obiective_pastreaza_plan on obiective_actiuni;
create trigger obiective_pastreaza_plan
  before delete on obiective_actiuni
  for each row execute function public.obiective_pastreaza_plan();

-- Obiectivele de pornire nu au încă plan → inactive (până le completezi).
-- Trigger-ul de mai sus nu blochează dezactivarea.
update obiective o set activ = false
where o.activ
  and (coalesce(trim(o.resurse), '') = '' or coalesce(trim(o.evaluare), '') = ''
       or not exists (select 1 from obiective_actiuni a where a.obiectiv_id = o.id));

-- ---------------------------------------------------------------------------
-- 3. Calculul — pentru TOATE obiectivele (și cele inactive, ca să le vezi
--    valoarea cât le completezi planul), cu pragul unic. Definițiile
--    metricilor nu se schimbă.
-- ---------------------------------------------------------------------------
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
  v_pana_la date;                                                              -- capătul cumulului lunar
  v_fin integer;
  v_la_termen integer;
  v_fara_termen integer;
  v_total integer;
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
  v_det jsonb;
begin
  if not public.este_patron() then
    raise exception 'Doar patronul vede obiectivele.' using errcode = '42501';
  end if;
  if extract(isodow from p_luni) <> 1 then
    raise exception 'Săptămâna trebuie dată prin ziua ei de luni.';
  end if;
  v_pana_la := least(v_duminica, v_luna_sfarsit);

  -- 1. Livrări la termen: lucrările finalizate în laborator în săptămână (fără
  -- etapa Livrare, fără refaceri); cele fără termen se numără separat.
  select count(*) filter (where termen_predare is not null),
         count(*) filter (where termen_predare is not null and data_finalizare <= termen_predare),
         count(*) filter (where termen_predare is null),
         count(*),
         coalesce(jsonb_agg(jsonb_build_object('nr', nr_inregistrare, 'finalizata', data_finalizare,
                  'termen', termen_predare) order by nr_inregistrare), '[]'::jsonb)
  into v_fin, v_la_termen, v_fara_termen, v_total, v_lista_fin
  from public.lucrari_finalizate_laborator(p_luni, v_duminica);

  -- 2. Refaceri create în săptămână (ora României).
  select count(*), coalesce(jsonb_agg(l.nr_inregistrare order by l.nr_inregistrare), '[]'::jsonb)
  into v_refaceri, v_lista_ref
  from public.lucrari l
  where l.refacere_pentru is not null
    and (l.created_at at time zone 'Europe/Bucharest')::date between p_luni and v_duminica;

  -- 3. Valoare comenzi intrate în luna joii, de la 1 până la duminică (sau la
  -- sfârșitul lunii, dacă săptămâna trece în luna următoare).
  select coalesce(sum(coalesce(l.incasare, 0)), 0), count(*)
  into v_valoare, v_nr_intrate
  from public.lucrari l
  where l.data_intrare between v_luna and v_pana_la;

  for o in select * from public.obiective order by ordine loop
    v_tinta_ef := o.tinta;
    if o.indicator = 'livrari_la_termen' then
      v_num := v_la_termen;
      v_den := v_fin;
      v_val := case when v_fin > 0 then round(100.0 * v_la_termen / v_fin, 1) end;
      v_det := jsonb_build_object('finalizate_cu_termen', v_fin, 'la_termen', v_la_termen,
                                  'fara_termen', v_fara_termen, 'lucrari', v_lista_fin);
    elsif o.indicator = 'refaceri' then
      v_num := v_refaceri;
      v_den := v_total;
      v_val := case when v_total > 0 then round(100.0 * v_refaceri / v_total, 1) end;
      v_det := jsonb_build_object('refaceri', v_refaceri, 'finalizate', v_total, 'lucrari', v_lista_ref);
    else
      v_num := v_valoare;
      v_den := null;
      v_val := v_valoare;
      -- Ținta lunară, proporțional cu zilele scurse din lună până la v_pana_la.
      if o.tinta is not null then
        v_tinta_ef := round(o.tinta * (v_pana_la - v_luna + 1) / (v_luna_sfarsit - v_luna + 1), 0);
      end if;
      v_det := jsonb_build_object('luna', v_luna, 'pana_la', v_pana_la, 'comenzi', v_nr_intrate,
                                  'tinta_lunara', o.tinta);
    end if;

    v_rezultat := v_rezultat || jsonb_build_array(jsonb_build_object(
      'obiectiv_id', o.id, 'indicator', o.indicator, 'titlu', o.titlu, 'unitate', o.unitate,
      'sens', o.sens, 'activ', o.activ, 'valoare', v_val, 'numarator', v_num, 'numitor', v_den,
      'tinta', o.tinta, 'tinta_efectiva', v_tinta_ef, 'prag_risc', public.prag_risc_obiective(),
      'stare', public.stare_obiectiv(v_val, v_tinta_ef, o.sens), 'detalii', v_det
    ));
  end loop;

  return jsonb_build_object('saptamana', p_luni, 'luna', v_luna, 'pana_la', v_pana_la,
                            'prag_risc', public.prag_risc_obiective(), 'obiective', v_rezultat);
end;
$$;

-- Confirmarea revizuirii: îngheață valorile obiectivelor ACTIVE. O singură
-- dată pe săptămână, doar pentru o săptămână încheiată.
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
  if not exists (select 1 from public.obiective where activ) then
    raise exception 'Niciun obiectiv activ — activează cel puțin un obiectiv înainte de revizuire.';
  end if;
  v_calc := public.obiective_saptamana(p_luni);
  insert into public.obiective_revizuiri (saptamana, luna, observatii, revizuita_de_id, revizuita_de)
  values (
    p_luni, (v_calc ->> 'luna')::date, nullif(trim(coalesce(p_observatii, '')), ''), auth.uid(),
    coalesce(nullif((select nume from public.profiles where id = auth.uid()), ''), 'Patron')
  )
  returning id into v_id;
  for v in select * from jsonb_array_elements(v_calc -> 'obiective') loop
    continue when not coalesce((v ->> 'activ')::boolean, false);
    insert into public.obiective_valori (
      revizuire_id, obiectiv_id, indicator, titlu, unitate, sens, activ, valoare, numarator, numitor,
      tinta, tinta_efectiva, prag_risc, stare, detalii
    ) values (
      v_id, (v ->> 'obiectiv_id')::uuid, v ->> 'indicator', v ->> 'titlu', v ->> 'unitate', v ->> 'sens', true,
      (v ->> 'valoare')::numeric, (v ->> 'numarator')::numeric, (v ->> 'numitor')::numeric,
      (v ->> 'tinta')::numeric, (v ->> 'tinta_efectiva')::numeric, (v ->> 'prag_risc')::numeric,
      v ->> 'stare', coalesce(v -> 'detalii', '{}'::jsonb)
    );
  end loop;
  return v_id;
end;
$$;

-- Verificare: obiectivele (toate inactive până la completarea planului) și pragul.
select indicator, activ, tinta, public.prag_risc_obiective() as prag_risc from obiective order by ordine;
