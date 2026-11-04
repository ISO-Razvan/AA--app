-- Tipuri de lucrare care se printează (ex. „Wax up"): bifă în Setup → Tipuri de lucrare.
-- Lucrările de acest tip primesc semnul „PRINTARE" pe casete (Task-uri, Kanban),
-- ca cineva nou să știe că nu se frezează, ci se printează. Idempotent — se poate rula repetat.

alter table public.tipuri_lucrare add column if not exists se_printeaza boolean not null default false;

-- Numele tipurilor care se printează — vizibile oricărui utilizator logat (și tehnicianului,
-- care nu are acces la tabelul cu prețuri). Fără prețuri, doar nume.
create or replace view public.tipuri_lucrare_printate
with (security_barrier = true)
as
select t.nume
from public.tipuri_lucrare t
where t.se_printeaza and public.rolul_meu() is not null;

revoke all on public.tipuri_lucrare_printate from anon, authenticated;
grant select on public.tipuri_lucrare_printate to authenticated;
