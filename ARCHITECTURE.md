# Arhitectura Algorithm Aesthetics

> Document de referință tehnică, generat 2026-09-09. Descrie aplicația **așa cum există acum** — nu un plan, ci starea reală a codului la acest moment. Actualizează-l manual când structura se schimbă semnificativ.

## 1. Prezentare generală

Algorithm Aesthetics e registrul digital al unui laborator de tehnică dentară — de la înregistrarea unei comenzi (lucrare) până la predare, cu urmărirea producției pe etape, alocare de tehnicieni, calcul de comisioane și autentificare pe rol.

- **Frontend**: React 18 + Vite (JavaScript, fără TypeScript), React Router v7 pentru navigare.
- **Backend**: Supabase (Postgres + Auth + Realtime), accesat prin `@supabase/supabase-js`.
- **Găzduire**: Netlify, build automat la fiecare `git push` pe branch-ul `main`.
- **Fără server propriu** — toată logica trăiește în client; Supabase e singura dependență externă.

## 2. Ecrane / secțiuni

| Ecran | Fișier principal | Rol |
|---|---|---|
| **Login** | `src/components/Login.jsx` | Autentificare email+parolă, bifă „Rămâi conectat" (alege localStorage vs. sessionStorage pentru sesiune). |
| **Dashboard** | `src/components/Dashboard.jsx` | Ecranul de start (admin). 4 KPI-uri (active/urgente/predau azi/întârziate), listă „Se predau azi", grafice „Lucrări pe etape" și „Lucrări pe tip". Realtime pe `productie_lucrare`. |
| **Listă lucrări** | `src/components/LucrariList.jsx` | Tabel/carduri cu toate lucrările, căutare, export/import CSV, ștergere. Comutator **Listă / Kanban**. |
| **Kanban** | `src/components/LucrariKanban.jsx` | Sub-vedere a Listei — coloane = etapele din Setup + „Finalizat"; fiecare card = o lucrare, plasată automat în coloana primei etape nefinalizate. Realtime pe `productie_lucrare`. |
| *„Calendar livrări"* | — | **Nu există ca ecran separat** — probabil o confuzie cu Dashboard (lista „Se predau azi") sau cu calendarul din Task-uri. Marcat explicit ca gol în acest audit. |
| **Setup** | `src/components/SetupPage.jsx` | 4 secțiuni pe aceeași pagină: Etape de producție, Tehnicieni, Tipuri de lucrare, Comisioane. |
| **Task-uri** (admin) | `src/components/TaskuriPage.jsx` → `TaskuriTehnicianModal.jsx` | Alegi un tehnician, se deschide un modal cu calendar lunar + sarcinile lui pe zi + bifare + print checklist. |
| **Task-urile mele** (tehnician) | `src/components/TaskurileMelePage.jsx` | Aceeași experiență ca modalul de mai sus, dar ca pagină, blocată pe tehnicianul contului logat. |
| **Capacitate** | `src/components/CapacitatePage.jsx` | Matrice tehnician × zi (săptămâna curentă, navigabilă) — nr. etape + ore estimate; click pe celulă deschide sarcinile zilei. |
| **Salarii** | `src/components/SalariiPage.jsx` → `SalariiDetaliuModal.jsx` | Comisioane pe lună, per tehnician, calculate din etapele finalizate; detaliu complet la click. |
| **Fișa de comandă** | `src/components/LucrareDetailPanel.jsx` | Modal cu 4 taburi (vezi mai jos), deschis la click pe orice lucrare sau prin URL `/comanda/:nrInregistrare`. |

### Fișa de comandă — cele 4 taburi

1. **Detalii comandă** — toate câmpurile lucrării, autosave pe blur/change; schemă dentară interactivă (FDI) în stânga.
2. **Producție** (`ProductieTimeline.jsx`) — cronologie verticală, o intrare per etapă. Etapa „Model" e un caz special: doar o bifă „Model finalizat" (fără tehnician/dată); restul etapelor au dropdown tehnician + selector dată.
3. **Galerie** (`GaleriePoze.jsx`) — upload poze (redimensionate client-side, stocate base64 direct în coloană) + listă de link-uri externe (Drive).
4. **Chat** — placeholder, „disponibil în curând", neimplementat.

## 3. Schema bazei de date

Sursa de adevăr: `schema.sql` (rădăcina proiectului) — de rulat integral în Supabase SQL Editor, idempotent.

```
tipuri_lucrare        id, nume (unique), cost_laborator, incasare, created_at
culori                id, nume (unique), created_at
medici                id, nume (unique), created_at
clinici               id, nume (unique), created_at

etape_productie       id, nume (unique), ordine, durata_minute, created_at

tehnicieni            id, nume, roluri (jsonb — array de id-uri din etape_productie), created_at

comisioane            id, tip_lucrare (text), etapa_id → etape_productie, suma,
                       created_at, UNIQUE(tip_lucrare, etapa_id)

lucrari                id, nr_inregistrare (unique, "AA-001"), clinica, medic, pacient,
                       tip_lucrare, dinti (jsonb: [{numar, grup}]), nr_elemente,
                       culoare, implant, try_in, model ('Gips'|'Print'),
                       data_intrare, termen_predare, ora_programare, next_date, nota,
                       cost_laborator, incasare, profit,      ← instantaneu, vezi §4
                       comisioane (jsonb: [{etapa_id, etapa_nume, suma}]),  ← instantaneu
                       created_at

productie_lucrare     id, lucrare_id → lucrari (cascade), etapa_id → etape_productie (cascade),
                       tehnician_id → tehnicieni (set null), data_planificata,
                       finalizat, data_finalizare, created_at,
                       UNIQUE(lucrare_id, etapa_id)

poze_lucrare           id, lucrare_id → lucrari (cascade), nume_fisier,
                       referinta_fisier (text — data URL base64, NU Supabase Storage),
                       data_incarcare

linkuri_lucrare        id, lucrare_id → lucrari (cascade), url, eticheta, data_adaugare

profiles               id → auth.users (cascade), rol ('admin'|'tehnician'),
                       tehnician_id → tehnicieni (set null), nume, created_at
```

**Securitate**: RLS activat pe toate tabelele. Politică `authenticated_all` (select/insert/update/delete pentru orice cont autentificat) pe toate tabelele operaționale — **fără restricții pe rol încă** (un cont „tehnician" are acces API identic cu „admin", diferă doar ce vede în interfață). `profiles` are politică separată: un cont își poate citi doar propriul rând.

## 4. Fluxuri de date cheie

### 4.1 Statusul unei lucrări

`src/utils/statusLucrare.js` — `statusDinRanduri(totalEtape, randuriProductie)`:
- 0 etape finalizate → **Neînceput**
- cel puțin una, dar nu toate → **În lucru**
- toate → **Finalizat**

Pur numeric — **nu ține cont de ordinea etapelor**. Vezi §5.1 pentru inconsistența pe care o creează asta cu Kanban.

### 4.2 Avansarea pe Kanban

`src/utils/etapaProductie.js` — `etapaCurentaPentru(etape, randuriLucrare)`: parcurge etapele **în ordinea din Setup** și întoarce prima fără rând `finalizat`. Dacă toate sunt finalizate → lucrarea merge în coloana „Finalizat".

Folosit identic în `LucrariKanban.jsx` (plasarea cardurilor) și `Dashboard.jsx` (graficul „Lucrări pe etape").

### 4.3 Instantaneul financiar („snapshot at creation")

La `addLucrare`/`importLucrari` (`supabaseAdapter.js` → `getSnapshotFinanciar`), se copiază pe lucrare, o singură dată:
- `cost_laborator`/`incasare` din `tipuri_lucrare` (după numele tipului)
- `comisioane` = toate rândurile din `comisioane` pentru acel tip, ca array `{etapa_id, etapa_nume, suma}`

Modificările ulterioare din Setup **nu ating** lucrările deja create — exact intenționat, dar are un efect secundar: dacă un tip de lucrare sau o sumă de comision nu există la momentul înregistrării, lucrarea rămâne cu 0/gol pentru totdeauna, indiferent ce se configurează după (vezi §5.3).

### 4.4 Comisionul/salariul unui tehnician

`SalariiPage.jsx`, per lună selectată:
1. Ia toate rândurile `productie_lucrare` cu `finalizat=true` și `data_finalizare` în luna aleasă.
2. Pentru fiecare, găsește lucrarea și caută în `lucrare.comisioane` (instantaneul de mai sus) suma pentru `etapa_id`-ul respectiv.
3. Sumează per tehnician (`tehnician_id`).

Deci suma unui comision **nu vine din grila curentă de Comisioane**, ci din instantaneul salvat pe lucrare la înregistrare — vezi §5.3 pentru ce înseamnă asta practic acum.

### 4.5 Autentificare și rutare pe rol

`src/services/auth.js` (Supabase Auth) + `src/App.jsx`:
1. La încărcare, `getSession()` + `onAuthStateChange` țin `session` sincronizat (cheie pe `session.user.id`, nu pe obiectul `session` întreg, ca reîmprospătarea automată a token-ului la revenirea pe tab să nu resetăze navigarea — bug reparat anterior).
2. Cu `session` valid, se citește `profiles` după `id` → `{rol, tehnician_id, nume}`.
3. `rol === 'admin'` → aplicația completă (sidebar cu toate secțiunile).
4. `rol === 'tehnician'` → sidebar restrâns (doar „Task-urile mele"), blocat pe `tehnician_id` din profil.
5. Fără rând `profiles` → ecran „cont fără rol asignat", cu opțiune de deconectare.

**Nu există restricții de acces la date financiare pentru tehnician** — un cont tehnician, dacă ar naviga manual la URL-uri din partea de admin, ar avea acces API identic (RLS nu diferențiază pe rol încă). Amânat explicit pentru o rundă viitoare.

## 5. Supabase Realtime — ce e live și ce nu

**Implementat** (`src/services/realtime.js` — `subscribeToTable`):
- `lucrari` → abonat în `App.jsx`; propagă la Dashboard (prin props), Listă lucrări, Kanban (membrii coloanelor).
- `productie_lucrare` → abonat separat în `Dashboard.jsx` și `LucrariKanban.jsx`; mută cardurile / recalculează KPI-urile fără refresh.

**Verificat live** (2026-09-09, cu 2 tab-uri): bifarea unei etape într-un tab a mutat cardul pe Kanban și a actualizat KPI-urile pe Dashboard, în celălalt tab, în ~1-3 secunde, fără nicio acțiune manuală.

**Neimplementat** (reîmprospătare doar la navigare/remount):
- `LucrareDetailPanel.jsx` / `ProductieTimeline.jsx` — fișa deschisă de altcineva nu se actualizează singură.
- `LucrariList.jsx` — coloana „Status" din tabelul simplu **nu** are Realtime (spre deosebire de Kanban, care are); rămâne cu valoarea de la ultimul mount. Vezi finding în `AUDIT_REPORT.md`.
- `CapacitatePage.jsx`, `SalariiPage.jsx`, `TaskuriTehnicianContent.jsx` — fără abonare live.

Ambele au fost lăsate deliberat pentru mai târziu, per decizia explicită din cererea care a introdus Realtime.

## 6. Componente de input proprii

Sistemul de design (Partea 14) a înlocuit toate widget-urile native ale browserului cu componente proprii, stilizate consecvent:
- `DatePicker.jsx` / `TimePicker.jsx` — popover-uri de tip calendar/oră.
- `Dropdown.jsx` — listă simplă (ex. „Alege tehnician").
- `SearchableSelect.jsx` — dropdown cu căutare + „adaugă valoare nouă" (clinică, medic, culoare, tip lucrare).
- `CalendarLunar.jsx` — calendar lunar complet (nu popover), cu indicator de activitate per zi; folosit în Task-uri (manager) și Task-urile mele (tehnician).

## 7. Ce nu există (confuzii de clarificat cu utilizatorul)

Câteva cereri anterioare au presupus funcționalități care nu au fost găsite în cod la verificare și au fost confirmate ca inexistente:
- „Calendar livrări" ca ecran separat.
- Un mod „Intru ca manager / Intru ca tehnician" anterior autentificării reale (înlocuit direct cu login-ul actual).

Dacă apar din nou în cereri viitoare, verifică mai întâi codul înainte de a presupune că există.
