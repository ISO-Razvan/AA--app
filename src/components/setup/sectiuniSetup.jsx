import EtapeProductieList from '../EtapeProductieList.jsx'
import TehnicieniList from '../TehnicieniList.jsx'
import TipuriLucrareCosturi from '../TipuriLucrareCosturi.jsx'
import ExtraUriSetup from '../ExtraUriSetup.jsx'
import ComisioaneGrid from '../ComisioaneGrid.jsx'
import AdaosuriDesignSetup, { CAMPURI as CAMPURI_ADAOSURI } from '../AdaosuriDesignSetup.jsx'
import DateTestSection from '../DateTestSection.jsx'
import MediciSetup from '../MediciSetup.jsx'
import NoteSetup from '../NoteSetup.jsx'
import {
  getEtapeProductie,
  getTehnicieni,
  getTipuriLucrareDetaliate,
  getExtraUri,
  getMedici,
  getSubiecteNote,
} from '../../services/dataService'

// Secțiunile din Setup, în ordinea din meniu. Fiecare are ruta ei (/setup/<slug>),
// grupul din meniu și, unde are sens, o funcție care întoarce numărul de elemente.
// Secțiunile cu prețuri și sume (`doarPatron`) nu apar pentru coordonator.
// `randare(ctx)` primește contextul din SetupPage: profil, rol și semnalele prin
// care o secțiune anunță alta că și-a schimbat datele.
export const GRUPURI_SETUP = ['Producție', 'Echipă', 'Clienți', 'Bani', 'Avansat']

export const SECTIUNI_SETUP = [
  {
    slug: 'etape',
    label: 'Etape de producție',
    grup: 'Producție',
    numar: async () => (await getEtapeProductie()).length,
    randare: ({ semnale }) => <EtapeProductieList onChange={semnale.etapeSchimbate} />,
  },
  {
    slug: 'tipuri-lucrare',
    label: 'Tipuri de lucrare',
    grup: 'Producție',
    doarPatron: true,
    numar: async () => (await getTipuriLucrareDetaliate()).length,
    randare: ({ semnale }) => <TipuriLucrareCosturi onChange={semnale.tipuriSchimbate} />,
  },
  {
    slug: 'extra-uri',
    label: 'Extra-uri',
    grup: 'Producție',
    doarPatron: true,
    numar: async () => (await getExtraUri()).length,
    randare: () => <ExtraUriSetup />,
  },
  {
    slug: 'tehnicieni',
    label: 'Tehnicieni',
    grup: 'Echipă',
    numar: async () => (await getTehnicieni()).length,
    randare: ({ patron, semnale }) => <TehnicieniList etapeRefreshSignal={semnale.etape} gestioneazaConturi={patron} />,
  },
  {
    slug: 'medici',
    label: 'Medici',
    grup: 'Clienți',
    numar: async () => (await getMedici()).length,
    randare: () => <MediciSetup />,
  },
  {
    slug: 'note',
    label: 'Note',
    grup: 'Clienți',
    numar: async () => (await getSubiecteNote()).length,
    randare: () => <NoteSetup />,
  },
  {
    slug: 'comisioane',
    label: 'Comisioane',
    grup: 'Bani',
    doarPatron: true,
    // Grila are câte un rând pe tip de lucrare.
    numar: async () => (await getTipuriLucrareDetaliate()).length,
    randare: ({ semnale }) => <ComisioaneGrid etapeRefreshSignal={semnale.etape} tipuriRefreshSignal={semnale.tipuri} />,
  },
  {
    slug: 'adaosuri-design',
    label: 'Adaosuri Design',
    grup: 'Bani',
    doarPatron: true,
    numar: async () => CAMPURI_ADAOSURI.length,
    randare: () => <AdaosuriDesignSetup />,
  },
  {
    slug: 'date-test',
    label: 'Date de test',
    grup: 'Avansat',
    randare: ({ profile, onDataChanged }) => <DateTestSection profile={profile} onDataChanged={onDataChanged} />,
  },
]
