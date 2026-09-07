// Redimensionează/comprimă o imagine în browser înainte de a o stoca ca
// base64 — fără asta, poze de la telefon (4000+px) ar umple rapid limita de
// ~5-10MB a localStorage. Rezultatul e mereu JPEG (pierde transparența unui
// eventual PNG, acceptabil pentru o galerie foto de lucrări dentare).
export function redimensioneazaImagine(file, maxDimensiune = 1600, calitate = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Nu s-a putut citi fișierul „${file.name}”`))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error(`Fișierul „${file.name}” nu pare o imagine validă`))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDimensiune || height > maxDimensiune) {
          const scara = maxDimensiune / Math.max(width, height)
          width = Math.round(width * scara)
          height = Math.round(height * scara)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', calitate))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
