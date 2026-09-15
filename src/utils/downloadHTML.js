// Descarcă un fragment de conținut ca fișier .html de sine stătător, gata de
// tipărit — același principiu ca downloadCSV din utils/csv.js, dar pentru
// documente printabile (devize). Nu introduce nicio bibliotecă de PDF: fișierul
// se deschide în orice browser și se printează/salvează ca PDF din dialogul
// nativ de printare, la fel ca butonul „Printează" din aplicație.
export function downloadHTML(filename, title, bodyHTML) {
  const document_ = `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #1E2233; max-width: 720px; margin: 40px auto; padding: 0 24px; }
  h1, h2, h3 { margin: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #DFE3F1; font-size: 0.9rem; }
  th { text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.04em; color: #6B7089; }
  .total-row td { font-weight: 700; border-top: 2px solid #1E2233; border-bottom: none; }
</style>
</head>
<body>
${bodyHTML}
</body>
</html>`

  const blob = new Blob([document_], { type: 'text/html;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
