// Valori inițiale pentru listele de configurare.
// Trebuie să rămână identice cu seed-ul din schema.sql (vezi acel fișier).

export const DEFAULT_TIPURI_LUCRARE = [
  'Coroană zirconiu',
  'Coroană metalo-ceramică',
  'Fațetă ceramică',
  'Punte',
  'Proteză totală',
  'Proteză scheletată',
  'Inlay/Onlay',
  'Machetă',
]

export const DEFAULT_CULORI = [
  'A1', 'A2', 'A3', 'A3.5', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D2', 'D3', 'D4',
  'BL1', 'BL2', 'BL3', 'BL4',
]

export const DEFAULT_MEDICI = []

export const DEFAULT_CLINICI = []

// Etape de producție implicite — devin rândurile inițiale ale tabelului
// editabil `etape_productie` (nume + ordine) la prima rulare.
export const DEFAULT_ETAPE_PRODUCTIE = [
  'Model',
  'Design',
  'Frezare',
  'Sinter',
  'Stratificare',
  'Adaptare',
  'Ambalare',
]

export const MODEL_OPTIONS = ['Gips', 'Print']

// Aproximări vizuale (non-clinice) pentru cheia VITA, folosite doar ca
// indicator de culoare lângă dintele central din formular — nu sunt valori
// de referință dentară exactă.
export const VITA_HEX = {
  A1: '#E4CFA8', A2: '#DEC49A', A3: '#D6B786', 'A3.5': '#CBA96D', A4: '#B8925A',
  B1: '#E9D9AE', B2: '#E0CB9A', B3: '#D3B87E', B4: '#C0A464',
  C1: '#D8CBB0', C2: '#C7B896', C3: '#B5A37E', C4: '#9C8A67',
  D2: '#D9CBAA', D3: '#CABB93', D4: '#B8A87E',
  BL1: '#EDE6D6', BL2: '#E6DCC4', BL3: '#DED2AE', BL4: '#D4C598',
}
