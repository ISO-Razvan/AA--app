-- Obiective — crearea din aplicație. Se rulează DUPĂ
-- sql/2026-11-03_obiective_reguli.sql. Proiect Supabase: kuxcmmrxhppudbwiwmxv.
-- Idempotent. Nu modifică și nu șterge date.

-- Pot exista mai multe obiective pe aceeași metrică (ex. alte ținte sau alți
-- responsabili); fiecare obiectiv are propriile valori în revizuire.
alter table obiective drop constraint if exists obiective_indicator_key;

-- Un obiectiv INACTIV se poate șterge (ex. unul creat din greșeală). Valorile
-- lui din revizuirile deja confirmate rămân (obiectiv_id devine gol).
drop policy if exists "patron_stergere_inactive" on obiective;
create policy "patron_stergere_inactive" on obiective for delete to authenticated
  using ((select public.este_patron()) and not activ);

-- Crearea: obiectivul, prima acțiune din plan și activarea, într-un singur pas
-- (planul e obligatoriu — fără acțiune, resurse și evaluare nu se creează nimic).
-- Categoria, unitatea, sensul și perioada vin din metrică.
create or replace function public.creeaza_obiectiv(
  p_indicator text,
  p_titlu text,
  p_tinta numeric,
  p_responsabil text,
  p_termen date,
  p_resurse text,
  p_evaluare text,
  p_actiune text,
  p_actiune_responsabil text,
  p_actiune_termen date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categorie text;
  v_unitate text;
  v_sens text;
  v_perioada text;
  v_id uuid;
begin
  if not public.este_patron() then
    raise exception 'Doar patronul poate crea obiective.' using errcode = '42501';
  end if;
  case p_indicator
    when 'livrari_la_termen' then v_categorie := 'Livrare'; v_unitate := '%'; v_sens := 'min'; v_perioada := 'saptamana';
    when 'refaceri' then v_categorie := 'Calitate'; v_unitate := '%'; v_sens := 'max'; v_perioada := 'saptamana';
    when 'valoare_intrata' then v_categorie := 'Financiar'; v_unitate := 'RON'; v_sens := 'min'; v_perioada := 'luna';
    else raise exception 'Alege una dintre cele 3 metrici.';
  end case;
  if coalesce(trim(p_titlu), '') = '' then
    raise exception 'Completează titlul obiectivului.';
  end if;
  if p_tinta is null or p_tinta < 0 then
    raise exception 'Completează ținta obiectivului.';
  end if;
  if coalesce(trim(p_actiune), '') = '' then
    raise exception 'Planul de acțiuni e obligatoriu: adaugă cel puțin o acțiune.';
  end if;

  insert into public.obiective (indicator, titlu, categorie, unitate, sens, perioada, tinta,
                                responsabil, termen, resurse, evaluare, ordine, activ)
  values (p_indicator, trim(p_titlu), v_categorie, v_unitate, v_sens, v_perioada, p_tinta,
          nullif(trim(coalesce(p_responsabil, '')), ''), p_termen,
          nullif(trim(coalesce(p_resurse, '')), ''), nullif(trim(coalesce(p_evaluare, '')), ''),
          coalesce((select max(ordine) from public.obiective), 0) + 1, false)
  returning id into v_id;

  insert into public.obiective_actiuni (obiectiv_id, text, responsabil, termen)
  values (v_id, trim(p_actiune), nullif(trim(coalesce(p_actiune_responsabil, '')), ''), p_actiune_termen);

  -- Activarea trece prin verificarea din obiective_verifica_activare
  -- (resurse + evaluare + acțiune); dacă lipsește ceva, nu rămâne nimic salvat.
  update public.obiective set activ = true where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.creeaza_obiectiv(text, text, numeric, text, date, text, text, text, text, date) from public, anon;
grant execute on function public.creeaza_obiectiv(text, text, numeric, text, date, text, text, text, text, date) to authenticated;
