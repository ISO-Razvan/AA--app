# Raport de audit — Algorithm Aesthetics

**Data**: 2026-09-09
**Metodă**: navigare live pe `https://labadm.netlify.app/` (cont admin real), cu 2 tab-uri simultan pentru testul de Realtime, plus analiză statică a codului sursă. Nicio modificare de cod nu a fost făcută în această rundă — doar cele câteva bifări de etape descrise explicit mai jos, ca parte din testul cerut.

**Notă despre datele modificate în timpul auditului**: pentru a verifica fluxul cap-coadă, am bifat live, pe baza de date reală: „Model" pentru **AA-001** și **AA-003**, și „Frezare" pentru **AA-004**. Sunt modificări reale, pe date deja demo (vezi 1.1) — nu le-am revenit, ca să rămână dovadă vizibilă că fluxul funcționează. Spune-mi dacă vrei să le anulez.

---

## Critic (blochează folosirea reală)

Niciun bug găsit în această categorie. Aplicația e funcțională pe fluxul principal (înregistrare → bifare → Kanban → Dashboard), fără erori de consolă pe niciun ecran vizitat, cu Realtime confirmat funcțional cross-tab.

---

## Important (funcționează, dar deranjant sau induce în eroare)

### 1.1 — Date demo încă prezente în baza de date reală
Toate cele 10 lucrări din producție (`AA-001`…`AA-010`) sunt exact setul de date demo generat de butonul „+ 10 lucrări demo" (Ion Marinescu, DentalPlus, Smile Studio, OrtoCenter etc.) — nu date reale de laborator. Dacă asta nu e intenționat, trebuie șterse manual (Listă lucrări → iconița de coș, per rând) înainte de folosirea reală, ca să nu se amestece cu comenzi adevărate în rapoarte/Salarii.

### 1.2 — Grila de Comisioane e complet negolită → Salarii arată mereu 0 lei
Setup → Comisioane are toate celulele pe `0` pentru cele 34 de tipuri de lucrare reale configurate (Zirconiu monolit, Disilicat litiu etc.) × cele 5 etape. Confirmat live: tehnicianul **Andrada Covaci** are 5 etape finalizate luna asta, dar **0,00 lei** comision — nu pentru că ceva e stricat, ci pentru că nu există nicio sumă de comision configurată. Recomandare: completează grila din Setup → Comisioane **înainte** să te bazezi pe Salarii pentru plăți reale.

### 1.3 — Statusul din tabelul „Listă lucrări" nu se actualizează live (spre deosebire de Kanban)
Kanban și Dashboard au Realtime (§5 din `ARCHITECTURE.md`), dar coloana „Status" din tabelul simplu de la Listă lucrări e calculată dintr-o încărcare făcută o singură dată, la montarea paginii. Confirmat live: după ce am bifat „Model" pentru AA-001 chiar din fișa ei (deschisă direct din acest tabel) și am închis fișa, rândul AA-001 a rămas afișat cu „Neînceput" până la o navigare nouă (schimbare de pagină și revenire). Nu e o eroare de date — doar un ecran care nu reflectă imediat o modificare făcută chiar de tine, în timp ce alte ecrane (Kanban) o fac.

### 1.4 — Status „În lucru" poate coexista cu poziția „Model" pe Kanban, fără explicație vizibilă
Statusul general (`Neînceput`/`În lucru`/`Finalizat`) se calculează din *câte* etape sunt bifate, indiferent de ordine; poziția pe Kanban se calculează din *prima* etapă nebifată, în ordine. Cele două pot intra în conflict vizual: **AA-002** are Design, Frezare și Ceramica bifate, dar nu și Model (introdus recent ca bifă separată, needitabilă din Task-uri) — rezultat: eticheta de status spune „În lucru", dar cardul stă în continuare în prima coloană („Model") pe Kanban. Pentru un utilizator care se uită doar pe Kanban, o lucrare aproape gata pare „neatinsă". Nu recomand o reparație automată acum (ar însemna o decizie de design — ex. Model ar trebui să blocheze avansarea sau nu?), doar semnalez inconsistența.

### 1.5 — Datele demo (existente și viitoare, din buton) nu se potrivesc cu configurarea reală
Cele 10 lucrări demo (și orice lucrare nouă creată cu „+ 10 lucrări demo" de acum înainte) folosesc nume de tip lucrare generice („Coroană zirconiu", „Punte" etc.) care nu mai există în lista reală configurată în Setup → Tipuri de lucrare (acum sunt „Zirconiu monolit - standard" etc.). Efect: orice lucrare demo are instantaneul financiar (cost/încasare/comisioane) gol — nu doar Comisioane (1.2), ci indiferent de asta, demo-urile nu vor genera niciodată comision, pentru că `tip_lucrare` nu se potrivește cu nimic din grilă. Dacă butonul de demo rămâne util pentru testare vizuală, ține minte că nu poate fi folosit pentru a testa calculul de salarii.

---

## Cosmetic (mic, poate aștepta)

### 2.1 — Câmpuri scrise, dar niciodată afișate: `lucrari.cost_laborator`, `lucrari.incasare`, `lucrari.profit`
Instantaneul financiar per-lucrare (diferit de grila din Setup) se scrie la fiecare înregistrare/import, dar nu apare nicăieri în interfață — nici în fișa lucrării, nici în Listă, nici în Dashboard. Doar valorile din Setup → Tipuri de lucrare (nu instantaneul per-lucrare) sunt afișate undeva. Probabil pregătit pentru un ecran de raportare financiară care nu există încă. Nu produce erori — doar date „moarte" din perspectiva interfeței curente.

### 2.2 — „Calendar livrări" nu există ca ecran separat
Menționat în cereri anterioare ca funcționalitate presupusă existentă — verificat explicit în cod, nu există (nici ca nume de fișier, nici ca text în interfață). Cel mai apropiat echivalent funcțional e lista „Se predau azi" de pe Dashboard. Dacă ai nevoie de un calendar dedicat cu toate termenele de predare (nu doar cele de azi), e o cerere nouă, nu o reparație.

### 2.3 — Tehnician „ADM" fără rol util
În Setup → Tehnicieni există un tehnician numit „ADM" cu rolul „Livrare" — pare un cont de test/administrativ, nu un tehnician real. Dacă nu e intenționat, poate fi șters din Setup.

---

## Ce am verificat și funcționează corect

- **Fluxul complet cap-coadă**: bifare etapă (din fișă sau din Task-uri) → avansare automată pe Kanban → actualizare KPI-uri pe Dashboard — testat live, cu 2 tab-uri, fără reîncărcare manuală, propagat în câteva secunde.
- **Calendarul lunar din Task-uri** — navigare între luni, indicator de activitate pe zi (badge cu număr), deschidere corectă a listei zilei.
- **Autentificare** — login/logout funcțional, sesiune persistentă („Rămâi conectat") păstrată corect între tab-uri pe același browser.
- **Niciun cont de tehnician nu a fost disponibil pentru testare** — „Task-urile mele" (vederea restrânsă) există în cod și a fost verificată doar static, nu live. Recomand un cont de test cu rol `tehnician` pentru o verificare completă la runda următoare.
- **Zero erori de consolă** pe Dashboard, Listă lucrări, Kanban, Setup, Task-uri, Capacitate, Salarii, fișa de comandă (Detalii comandă + Producție).
- Nu am testat live tabul **Galerie** (upload poze/link-uri) și **Chat** (placeholder cunoscut, neimplementat intenționat) — las asta pentru o rundă viitoare dacă vrei acoperire completă.

---

## Recomandare de prioritizare

Dacă vrei să acționezi pe acest raport, ordinea sugerată: **1.1** (curăță datele demo) → **1.2** (completează Comisioane) → **1.5** (decide ce faci cu butonul de demo) → **1.4** (decide dacă Model ar trebui să blocheze avansarea) → restul, quando ai timp. Toate sunt descrise, niciuna nu a fost reparată — aștept decizia ta pentru runda următoare.
