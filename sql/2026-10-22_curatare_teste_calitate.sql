-- Curățarea datelor de test din modulele Furnizori / Neconformități
-- (create la testare pe 2026-10-21/22). Proiect: kuxcmmrxhppudbwiwmxv.
-- Șterge DOAR: NC-001 și NC-002 (de test), comanda de refacere AA-039 creată
-- din NC-001 și furnizorul „TEST Furnizor Zirconiu"; apoi repornește
-- numerotarea neconformităților de la NC-001. Nu atinge nimic altceva.

begin;

delete from neconformitati
where numar in ('NC-001', 'NC-002')
  and descriere like 'TEST%';

delete from lucrari
where nr_inregistrare = 'AA-039'
  and nota = 'Refacere pentru AA-037 (NC-001)';

delete from furnizori
where nume = 'TEST Furnizor Zirconiu';

-- Numerotarea pornește din nou de la NC-001 doar dacă registrul e gol.
do $$
begin
  if not exists (select 1 from neconformitati) then
    alter sequence neconformitati_nr_seq restart with 1;
  end if;
end $$;

commit;

-- Verificare: trebuie 0 / 0 / 0.
select
  (select count(*) from neconformitati where descriere like 'TEST%') as nc_test,
  (select count(*) from lucrari where nr_inregistrare = 'AA-039') as refacere_test,
  (select count(*) from furnizori where nume = 'TEST Furnizor Zirconiu') as furnizor_test;
