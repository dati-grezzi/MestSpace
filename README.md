# MestSpace

App personale per la gestione degli spazi della scuola: settimana per piano, assegnazioni standard e variazioni, planimetrie con etichette, stampa e PDF.

## Uso

Apri `index.html` in un browser moderno. Per installarla come app sul telefono, servila da un hosting statico (GitHub Pages va bene) e usa "Aggiungi a schermata Home".

I dati restano nel browser del dispositivo. Esporta periodicamente un backup JSON dal tab Impostazioni.

## Struttura

- `index.html`, `app.js`: interfaccia e logica, senza dipendenze esterne
- `sw.js`, `manifest.json`: funzionamento offline e installazione
- `data/aule_mestica.csv`: elenco dei locali ricavato dalle planimetrie

## Licenza

GPL-3.0
