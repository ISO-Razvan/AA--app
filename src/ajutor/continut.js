// Textele de ajutor ale aplicației — butonul „?" de pe fiecare pagină și
// pagina „Ghid". Un singur loc: când se schimbă o funcție, se actualizează
// și textul ei aici (în același commit).
//
// Fiecare intrare: { id, titlu, roluri, la, pasi, atentie }
//  - roluri: cine o vede (patron / coordonator / tehnician / medic). Același
//    `id` poate avea variante pe roluri (ex. fișa: editabilă vs. doar citire).
//  - pasi / atentie: liste; un element e text sau { text, sub: [text] }.
//  - **text** = îngroșat.
// Setup-ul nu are instrucțiuni (rămâne responsabilitatea patronului).

const LAB_ADMIN = ['patron', 'coordonator']
const LAB = ['patron', 'coordonator', 'tehnician']

// Ghidul general — doar în pagina „Ghid", în ordinea de mai jos.
export const GHID_GENERAL = [
  {
    id: 'g-flux',
    titlu: 'Drumul unei comenzi',
    roluri: LAB_ADMIN,
    la: 'Cum trece o comandă prin aplicație, de la intrare până la arhivă.',
    pasi: [
      '**Înregistrare** — *Listă lucrări* → **+ Înregistrare lucrare**. Numărul (AA-xxx) și prețul se calculează automat.',
      '**Planificare** — în *Task-uri* aloci fiecare etapă unui tehnician pe o zi (tragi lucrarea din „Lucrări neplanificate" pe zi). Livrarea se planifică singură din termenul de predare.',
      '**Producție** — tehnicienii bifează etapele terminate. Cardul lucrării avansează singur pe Kanban.',
      '**Comunicare** — întrebările și lipsurile (culoare, poze, scan) se trec în tabul **Note** al fișei; dacă e nevoie de medic, bifezi „Trimite și medicului".',
      '**Livrare** — când toate etapele sunt bifate, lucrarea apare ca „Finalizat".',
      '**Deviz și arhivă** — patronul generează devizul din *Financiar → Devize*; lucrările finalizate incluse se arhivează automat.',
    ],
    atentie: [
      'O problemă pe parcurs (greșeală, reclamație, material defect) se trece în **Neconformități**; de acolo se poate crea și refacerea.',
    ],
  },
  {
    id: 'g-zilnic-coordonator',
    titlu: 'Ce faci zilnic — coordonator',
    roluri: LAB_ADMIN,
    la: 'O rutină simplă, ca nimic să nu scape.',
    pasi: [
      'Deschide **Dashboard**: lucrările urgente, întârziate, ce se predă azi și **Note noi de la medici**.',
      'Răspunde la notele noi (clic pe rând → se deschide fișa direct pe Note).',
      'Înregistrează comenzile intrate.',
      'În **Task-uri**, golește „Lucrări neplanificate": fiecare etapă trebuie să aibă un tehnician și o zi.',
      'Verifică în **Capacitate** să nu fie cineva supraîncărcat.',
      'Uită-te în **Neconformități** la cele deschise.',
    ],
  },
  {
    id: 'g-zilnic-tehnician',
    titlu: 'Ce faci zilnic — tehnician',
    roluri: LAB,
    la: 'Ce are de făcut un tehnician în aplicație.',
    pasi: [
      'Deschide **Task-urile mele** și alege ziua de azi.',
      'Deschide fișa fiecărei lucrări ca să vezi schema dentară, culoarea și notele.',
      '**Bifează etapa în ziua în care ai terminat-o** — intră în salariul lunii respective.',
      'O problemă cu o lucrare? Raporteaz-o în **Neconformități**.',
      'Salariul lunii îl vezi oricând în **Salariul meu**.',
    ],
  },
  {
    id: 'g-probleme',
    titlu: 'Cum raportezi o problemă',
    roluri: LAB,
    la: 'Orice greșeală, reclamație sau material defect se trece în registrul de neconformități — ca să se rezolve și să nu se repete.',
    pasi: [
      '*Neconformități* → **+ Raportează neconformitate**.',
      'Alege tipul, gravitatea și comanda; scrie pe scurt ce s-a întâmplat și ce ai făcut imediat.',
      '**Înregistrează.** Patronul sau coordonatorul o analizează și o închid.',
    ],
    atentie: [
      'Raportează pe loc, chiar dacă problema s-a rezolvat — contează pentru statistici.',
      'Dacă reclamația vine de la medic printr-o notă, folosește butonul **„Înregistrează neconformitate"** de sub mesajul lui.',
    ],
  },
  {
    id: 'g-medici',
    titlu: 'Ghid pentru medici (de trimis medicului)',
    roluri: LAB_ADMIN,
    la: 'Textul de mai jos se poate tipări sau trimite medicului împreună cu linkul de acces (Setup → Medici).',
    pasi: [
      'Deschideți linkul primit de la laborator.',
      'Introduceți adresa de email și apăsați **Trimite-mi codul**. Codul (6 cifre) vine pe email — verificați și Spam.',
      'Introduceți codul. Telefonul sau calculatorul rămâne conectat; după 90 de zile vi se cere un cod nou.',
      'Vedeți comenzile dumneavoastră active. Apăsați pe o comandă pentru detalii (schema dentară, culoare, termene), galerie și note.',
      'În **Note** răspundeți direct pe mesajul laboratorului (**Răspunde**) sau trimiteți un **Mesaj nou către laborator**.',
    ],
    atentie: [
      'Când laboratorul vă scrie, primiți un mesaj pe WhatsApp cu linkul direct către comandă.',
      'Comanda primește mesaje până la 7 zile după livrare.',
    ],
  },
]

// Ajutorul paginilor — butonul „?" și secțiunea „Pe pagini" din Ghid.
export const AJUTOR_PAGINI = [
  {
    id: 'dashboard',
    titlu: 'Dashboard',
    roluri: LAB_ADMIN,
    la: 'Imaginea de ansamblu a laboratorului, la început de zi.',
    pasi: [
      'Sus: lucrări active, **urgente** (termen în următoarele 2 zile), ce se predă azi, **întârziate**.',
      '**Note noi de la medici** — clic pe rând deschide fișa direct pe Note.',
      '**Se predau azi** — clic deschide fișa.',
      'Jos: câte lucrări sunt la fiecare etapă și pe fiecare tip.',
    ],
    atentie: ['Lucrările arhivate nu mai apar aici.'],
  },
  {
    id: 'lista',
    titlu: 'Listă lucrări',
    roluri: LAB_ADMIN,
    la: 'Toate comenzile, ca tabel sau pe Kanban (coloane pe etape).',
    pasi: [
      'Caută după nr., pacient, medic, clinică, tip sau notă.',
      '**Active / Arhivate / Toate** — ce lucrări vezi.',
      '**Listă / Kanban** — pe Kanban, fiecare lucrare stă la prima etapă nebifată; poți trage cardul în altă coloană (etapele sărite se bifează sau debifează automat).',
      'Clic pe o lucrare deschide fișa.',
      '**Bulina mov** de lângă pacient = notă nouă de la medic.',
      '**Export CSV** salvează lista (copie de siguranță); **Import CSV** adaugă lucrări dintr-un fișier.',
    ],
    atentie: [
      'Ștergerea unei lucrări (coșul de pe rând) e definitivă — cu tot cu producție, poze și note.',
      'O lucrare arhivată se poate scoate din arhivă cu butonul de pe rândul ei (modul Arhivate).',
    ],
  },
  {
    id: 'lucrare-noua',
    titlu: 'Înregistrare lucrare nouă',
    roluri: LAB_ADMIN,
    la: 'Introduci o comandă nouă primită de la un medic. Numărul (AA-xxx) și prețul se calculează automat.',
    pasi: [
      '*Listă lucrări* → **+ Înregistrare lucrare**.',
      {
        text: '**Client** — clinica, medicul, pacientul.',
        sub: [
          'Medicul și clinica le alegi din listă; dacă nu există, scrii numele și apeși **„+ Adaugă"**.',
          '⚠️ Scrie numele medicului **la fel de fiecare dată** — altfel comanda nu apare în pagina medicului.',
        ],
      },
      '**Schema dentară** — **clic pe dinte** = selectat; **bulina dintre doi dinți** = punte; **șurubul de deasupra dintelui** = pe implant.',
      '**Culoarea** — din dintele din mijlocul schemei.',
      '**Lucrarea** — tipul (din listă), nr. de elemente (se completează din schemă, îl poți corecta), Try-in, model (Gips / Print), extra-uri.',
      '**Termene** — data intrării (azi), **termenul de predare** (planifică automat Livrarea), ora programării.',
      '**Înregistrează.**',
    ],
    atentie: [
      'Tipuri de lucrare noi adaugă doar patronul — dacă lipsește un tip, anunță-l.',
      'Câmpul **Notă** e intern — medicul nu îl vede.',
      'Totul se poate corecta ulterior din fișă; prețul se recalculează singur.',
    ],
  },
  {
    id: 'fisa-detalii',
    titlu: 'Fișa comenzii — Detalii',
    roluri: LAB_ADMIN,
    la: 'Toate datele comenzii; orice modificare se salvează automat (apare „Salvat automat").',
    pasi: [
      'Schema dentară, culoarea, clientul, tipul, termenele și nota se modifică direct aici.',
      'Schimbarea dinților, a numărului de elemente, a tipului, a Try-in-ului sau a extra-urilor **recalculează automat prețul**.',
      'Codul QR din colț deschide fișa de pe telefon (ex. lipit pe cutia lucrării).',
    ],
    atentie: [
      '**Șterge lucrarea** e definitiv.',
      'O lucrare arhivată e doar de citit — scoate-o din arhivă (din Listă) ca s-o modifici.',
    ],
  },
  {
    id: 'fisa-detalii',
    titlu: 'Fișa comenzii — Detalii',
    roluri: ['tehnician'],
    la: 'Datele comenzii la care lucrezi: schema dentară, culoarea, tipul, termenele. Doar de citit.',
    pasi: ['Ai nevoie de o lămurire? Scrie o notă în tabul **Note**.'],
  },
  {
    id: 'fisa-productie',
    titlu: 'Fișa comenzii — Producție',
    roluri: LAB_ADMIN,
    la: 'Etapele lucrării: cine o face, în ce zi, și dacă s-a terminat.',
    pasi: [
      'La fiecare etapă alegi **tehnicianul** și **data planificată** (la fel ca din Task-uri).',
      'Bifa **Finalizat** marchează etapa terminată. Etapa „Model" se bifează direct, fără alocare.',
      '**„Lucrarea este acum la etapa…"** — dacă lucrarea a avansat fără bife, alegi etapa curentă și cele dinainte se bifează automat.',
      'Când toate etapele sunt bifate, poți **arhiva** lucrarea (sau se arhivează singură la generarea devizului).',
    ],
    atentie: ['Livrarea se planifică singură din termenul de predare — schimbă termenul, nu data Livrării.'],
  },
  {
    id: 'fisa-productie',
    titlu: 'Fișa comenzii — Producție',
    roluri: ['tehnician'],
    la: 'Etapele lucrării și cine le face.',
    pasi: ['Poți bifa doar etapele alocate ție — la fel ca din Task-urile mele.'],
  },
  {
    id: 'fisa-galerie',
    titlu: 'Fișa comenzii — Galerie',
    roluri: LAB,
    la: 'Pozele lucrării și link-urile către fișiere mari (scanări, poze multe).',
    pasi: [
      '**Poze** — trage-le în chenar sau apasă **Alege fișiere**; se micșorează automat.',
      '**Link-uri** — pentru scanări și dosare: lipești linkul (Drive, WeTransfer…), opțional cu o etichetă.',
      'Clic pe o poză o mărește.',
    ],
    atentie: ['Medicul vede pozele și link-urile comenzii lui (doar de citit).'],
  },
  {
    id: 'fisa-note',
    titlu: 'Fișa comenzii — Note',
    roluri: LAB_ADMIN,
    la: 'Comunicare scurtă despre comandă — internă sau cu medicul. Nu e chat: fiecare notă are un subiect și rămâne în istoric.',
    pasi: [
      '**Notă nouă** — alegi subiectul (Lipsă culoare, Lipsă poze, Întrebare…) și scrii textul (max. 500 de caractere). Implicit e **internă**; bifează **„Trimite și medicului"** dacă trebuie să o vadă și el.',
      '**Răspunde** — răspunsul rămâne în aceeași discuție; dacă discuția e cu medicul, o vede și el.',
      '**Trimite pe WhatsApp** — deschide WhatsApp cu mesajul pregătit și linkul pentru medic; tu doar apeși Trimite.',
      '**Marchează rezolvată** când s-a lămurit; un răspuns nou o redeschide.',
    ],
    atentie: [
      '**Notele nu se pot modifica și nu se pot șterge** — citește înainte să trimiți.',
      '**Bulina mov** în listă / pe Kanban = notă nouă de la medic; dispare când deschizi Note.',
      'La 7 zile după livrare, comanda nu mai primește note noi.',
      'Mesajul medicului e o reclamație? **„Înregistrează neconformitate"**.',
    ],
  },
  {
    id: 'fisa-note',
    titlu: 'Fișa comenzii — Note',
    roluri: ['tehnician'],
    la: 'Întrebări și lămuriri despre comandă. Fiecare notă are un subiect și rămâne în istoric.',
    pasi: [
      '**Notă nouă** — alegi subiectul și scrii textul (max. 500 de caractere). Implicit e **internă**; bifează **„Trimite și medicului"** doar dacă trebuie să o vadă și medicul.',
      '**Răspunde** — rămâne în aceeași discuție.',
      '**Marchează rezolvată** când s-a lămurit.',
    ],
    atentie: ['**Notele nu se pot modifica și nu se pot șterge** — citește înainte să trimiți.'],
  },
  {
    id: 'taskuri',
    titlu: 'Task-uri',
    roluri: LAB_ADMIN,
    la: 'Planificarea producției pe tehnicieni și zile.',
    pasi: [
      'Alege **tehnicianul**. Vezi săptămâna lui și, separat, **Lucrări neplanificate** (etapele lui fără zi).',
      '**Trage** o lucrare din neplanificate pe o zi ca s-o aloci; trage-o pe altă zi ca s-o muți.',
      'Bifa de pe o căsuță finalizează etapele din ea.',
      'Clic pe o zi deschide lista zilei (cu **Printează**).',
    ],
    atentie: [
      'Mutarea unei **Livrări** pe altă zi mută **termenul de predare** al lucrării — se cere confirmare.',
      'Pe telefon, calendarul arată o zi; reprogramarea se face din lista zilei.',
    ],
  },
  {
    id: 'capacitate',
    titlu: 'Capacitate',
    roluri: LAB_ADMIN,
    la: 'Cât are de lucru fiecare tehnician, pe zile: numărul de etape și orele estimate.',
    pasi: [
      'Orele = nr. de elemente × durata etapei (din Setup).',
      'Folosește-o înainte de a aloca lucrări noi, ca să împarți munca echilibrat.',
    ],
  },
  {
    id: 'neconformitati',
    titlu: 'Neconformități',
    roluri: LAB_ADMIN,
    la: 'Registrul problemelor: greșeli în producție, reclamații, materiale defecte.',
    pasi: [
      '**+ Raportează neconformitate** — tip, gravitate, comandă, etapă, tehnician, furnizor, descriere, ce s-a făcut imediat.',
      'Clic pe un rând deschide fișa sub el. Completezi **Analiza** (cauza, ce faci ca să nu se repete, responsabil, termen) și **starea**; la „Închisă" se rețin data și cine a închis-o.',
      '**Creează refacere** — o comandă nouă cu aceleași date, legată de cea inițială. Alegi dacă **se facturează medicului** (implicit nu → încasare 0) și dacă **se plătesc comisioanele** (implicit da).',
      'Filtrele (stare, tip, perioadă) schimbă și totalurile de sus — pe tip, etapă, tehnician, furnizor.',
    ],
    atentie: [
      'Analiza nu e obligatorie — completeaz-o la problemele care o merită.',
      'Costul (material + manoperă) îl vede și îl completează doar patronul.',
      'Doar patronul poate șterge o neconformitate.',
    ],
  },
  {
    id: 'neconformitati',
    titlu: 'Neconformități',
    roluri: ['tehnician'],
    la: 'Raportezi o problemă constatată la o lucrare: greșeală, material defect, orice nu e în regulă.',
    pasi: [
      '**+ Raportează neconformitate**.',
      'Alege tipul, gravitatea și comanda (doar comenzile tale); scrie ce s-a întâmplat și ce ai făcut imediat.',
      '**Înregistrează.** O vezi apoi în listă; patronul sau coordonatorul o analizează.',
    ],
    atentie: ['După trimitere nu o mai poți modifica — dacă ai greșit ceva, anunță coordonatorul.'],
  },
  {
    id: 'furnizori',
    titlu: 'Furnizori',
    roluri: LAB_ADMIN,
    la: 'Agenda furnizorilor laboratorului.',
    pasi: [
      '**+ Furnizor nou** — nume, CUI, contact, ce livrează, termenul obișnuit de livrare.',
      'Clic pe un rând deschide fișa sub el, pentru modificare.',
      'Un furnizor cu care nu mai lucrați: debifează **Furnizor activ** (rămâne în istoric).',
    ],
    atentie: ['Furnizorii apar în neconformități, la problemele de material.'],
  },
  {
    id: 'financiar',
    titlu: 'Financiar',
    roluri: ['patron'],
    la: 'Valorile lunii și devizele către clinici.',
    pasi: [
      '**Prezentare** — alegi luna: valoarea lucrărilor intrate și finalizate, cheltuieli, salarii și profit estimat, plus tabelul lucrărilor (pe medic sau pe clinică).',
      '**Devize → Deviz nou** — alegi clinica, bifezi lucrările (finalizate sau în lucru) și generezi devizul; îl poți tipări sau descărca.',
    ],
    atentie: [
      'Lucrările **finalizate** incluse într-un deviz se arhivează automat.',
      'Lucrările deja facturate sunt ascunse la un deviz nou (le poți arăta cu bifa de jos).',
      'Refacerile nefacturate nu apar la devize.',
    ],
  },
  {
    id: 'salarii',
    titlu: 'Salarii',
    roluri: ['patron'],
    la: 'Comisioanele tehnicienilor pe lună, din etapele bifate în acea lună.',
    pasi: [
      'Alegi luna; vezi pentru fiecare tehnician etapele finalizate și totalul (comision + adaosuri Design).',
      'Clic pe un tehnician deschide detaliul, pe etape și lucrări.',
    ],
    atentie: ['Contează **data bifării** etapei, nu data intrării lucrării.'],
  },
  {
    id: 'taskurile-mele',
    titlu: 'Task-urile mele',
    roluri: ['tehnician'],
    la: 'Ce ai de lucru în fiecare zi; bifezi etapele terminate — bifele intră în salariu.',
    pasi: [
      'Alegi ziua din calendar; dedesubt apar lucrările și etapa ta la fiecare.',
      'Când termini o etapă, **bifeaz-o**. Ai bifat din greșeală? Debifează.',
      'Apasă pe o lucrare ca să vezi fișa — schema dentară, culoarea, notele.',
      '**Printează** lista zilei, dacă o vrei pe hârtie la masa de lucru.',
    ],
    atentie: [
      'Bifează **în ziua în care ai terminat** — etapa intră la salariul lunii în care e bifată.',
      'Nu poți muta lucrări pe alte zile și nici aloca etape — asta face coordonatorul.',
      'O problemă cu o lucrare? Raporteaz-o în **Neconformități**.',
    ],
  },
  {
    id: 'salariul-meu',
    titlu: 'Salariul meu',
    roluri: ['tehnician'],
    la: 'Comisioanele tale, pe lună, din etapele bifate în acea lună.',
    pasi: ['Alegi luna; vezi fiecare etapă finalizată, cu suma ei, și totalul.'],
    atentie: ['O etapă lipsă? Verifică în Task-urile mele dacă e bifată.'],
  },
  {
    id: 'medic',
    titlu: 'Cum folosiți pagina',
    roluri: ['medic'],
    la: 'Aici vedeți comenzile dumneavoastră active și mesajele laboratorului.',
    pasi: [
      'Apăsați pe o comandă pentru detalii (schema dentară, culoare, termene), galerie și note.',
      'În **Note** răspundeți direct pe mesajul laboratorului (**Răspunde**) sau trimiteți un **Mesaj nou către laborator**.',
      'O comandă cu **notă nouă** are eticheta mov în listă.',
    ],
    atentie: [
      'Comanda primește mesaje până la 7 zile după livrare.',
      'După 90 de zile vi se cere un cod nou pe email.',
    ],
  },
]

export function ajutorPentru(id, rol) {
  return AJUTOR_PAGINI.find((a) => a.id === id && a.roluri.includes(rol)) || null
}

export function ghidPentru(rol) {
  return {
    general: GHID_GENERAL.filter((g) => g.roluri.includes(rol)),
    pagini: AJUTOR_PAGINI.filter((a) => a.roluri.includes(rol)),
  }
}
