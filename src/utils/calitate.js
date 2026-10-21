// Liste fixe pentru modulele Furnizori și Neconformități. Valorile (cheile)
// sunt cele salvate în baza de date — vezi constrângerile din schema.sql.

export const CATEGORII_FURNIZORI = [
  'Zirconiu',
  'Ceramică / disilicat',
  'Componente implant',
  'Consumabile',
  'Frezare externă',
  'Altele',
]

export const TIPURI_NC = [
  { id: 'productie', label: 'Producție internă' },
  { id: 'reclamatie_medic', label: 'Reclamație medic' },
  { id: 'furnizor', label: 'Material / furnizor' },
  { id: 'altele', label: 'Altele' },
]

export const GRAVITATI_NC = [
  { id: 'minora', label: 'Minoră', badge: 'badge-neutral' },
  { id: 'majora', label: 'Majoră', badge: 'badge-warning' },
  { id: 'critica', label: 'Critică', badge: 'badge-danger' },
]

export const STATUSURI_NC = [
  { id: 'deschisa', label: 'Deschisă', badge: 'badge-danger' },
  { id: 'in_lucru', label: 'În lucru', badge: 'badge-warning' },
  { id: 'inchisa', label: 'Închisă', badge: 'badge-success' },
]

const dupaId = (lista) => Object.fromEntries(lista.map((x) => [x.id, x]))
export const TIP_NC = dupaId(TIPURI_NC)
export const GRAVITATE_NC = dupaId(GRAVITATI_NC)
export const STATUS_NC = dupaId(STATUSURI_NC)
