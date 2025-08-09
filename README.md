# PEPEDOT 2 — final

- Stabilan PDF prikaz (react-pdf) + točke/oznake kao overlay
- Više PDF-ova po RN, preimenovanje i brisanje uz potvrdu (unesi naziv)
- Dodavanje fotografije (kamera ili galerija), pridruživanje točki i stranici
- Lista fotografija s ikonom pregleda (bez preview gridova)
- Excel izvoz: ID, NazivTocke, NazivFotografije, Datum
- PDF izvoz: snimka prikaza s točkama (html2canvas + jsPDF)
- Sesije: nakon reload-a prikazuje se samo nova sesija (preklopka za sve)

## Lokalno
```bash
npm install
npm start
```

## Build
```bash
npm run build
```

## Deploy (Vercel)
- Import GitHub repo
- Framework: Create React App
- Build Command: npm run build
- Output Directory: build
- Node: 22.x
