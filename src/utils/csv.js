// Export/import CSV pentru tabela `lucrari`, cu aceleași coloane ca baza de date.

export const CSV_COLUMNS = [
  'nr_inregistrare',
  'clinica',
  'medic',
  'pacient',
  'tip_lucrare',
  'dinti',
  'nr_elemente',
  'culoare',
  'implant',
  'try_in',
  'model',
  'data_intrare',
  'termen_predare',
  'ora_programare',
  'next_date',
  'nota',
]

function escapeCell(value) {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function lucrariToCSV(lucrari) {
  const header = CSV_COLUMNS.join(',')
  const rows = lucrari.map((l) =>
    CSV_COLUMNS.map((col) => {
      if (col === 'dinti') return escapeCell(JSON.stringify(l.dinti || []))
      return escapeCell(l[col])
    }).join(',')
  )
  return [header, ...rows].join('\n')
}

// Parser CSV minimal, cu suport pentru câmpuri între ghilimele (inclusiv
// virgule/ghilimele/newline-uri escapate) — suficient pentru fișiere generate
// de export-ul propriu sau din Excel/Google Sheets.
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char === '\r') {
      // ignorat, tratat de \n
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim())
  return rows
    .slice(1)
    .filter((r) => r.some((cell) => cell !== ''))
    .map((r) => {
      const obj = {}
      header.forEach((col, idx) => {
        obj[col] = r[idx] !== undefined ? r[idx] : ''
      })
      return obj
    })
}

export function downloadCSV(filename, csvText) {
  const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
