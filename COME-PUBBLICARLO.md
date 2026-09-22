# Come pubblicare il Portale Task Foto online (gratis)

Questo progetto è un sito web condiviso: tu e i colleghi (Simonini, Pagani, Crea)
lavorate tutti sugli **stessi** dati. Ognuno apre lo stesso link, scrive i task,
assegna le persone, spunta "Fatto" — e le modifiche le vedono tutti.

Le foto sono servite dal server, quindi **niente più problemi di caricamento**.

Lo pubblichiamo su **Render.com**, che ha un piano gratuito.

---

## Cosa ti serve
- Un account gratuito su https://render.com (puoi registrarti con Google/GitHub)
- Un account gratuito su https://github.com (per caricare il codice)

Se non hai voglia di usare GitHub, più sotto trovi anche il **metodo senza GitHub**.

---

## METODO 1 — Con GitHub (consigliato, aggiornamenti facili)

### 1. Metti il codice su GitHub
1. Crea un account su https://github.com se non ce l'hai.
2. Clicca su **New repository**, dagli un nome (es. `portale-task-foto`), lascialo **Private**, crea.
3. Carica **tutto il contenuto di questa cartella `server`** nel repository.
   - Il modo più semplice: nella pagina del repo vuoto, clicca **"uploading an existing file"**
     e trascina i file e le cartelle di `server` (compresa la cartella `public` con le foto).
   - NON serve caricare `node_modules` (viene ricostruito da Render).

### 2. Crea il servizio su Render
1. Vai su https://render.com e accedi.
2. Clicca **New +** → **Web Service**.
3. Collega il tuo account GitHub e seleziona il repository `portale-task-foto`.
4. Render legge da solo il file `render.yaml`. Se ti chiede i parametri, imposta:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
5. Clicca **Create Web Service**.
6. Aspetta qualche minuto: quando in alto compare **"Live"**, è online.

### 3. Prendi il link e mandalo ai colleghi
In alto trovi l'indirizzo, tipo `https://portale-task-foto.onrender.com`.
Quello è il link da mandare a Simonini, Pagani e Crea. Aprono, lavorano, fine.

---

## METODO 2 — Senza GitHub (caricamento diretto)

Alcune piattaforme permettono di trascinare direttamente una cartella. In alternativa
puoi usare **Render** installando il loro strumento a riga di comando, ma è più tecnico.
Se preferisci questo metodo dimmelo e ti preparo i passaggi esatti.

---

## Note importanti

- **Dati condivisi e persistenti**: il file `render.yaml` aggiunge un disco da 1 GB,
  così i task e le assegnazioni restano salvati anche se il server si riavvia.
  Senza quel disco, sul piano gratuito i dati si azzererebbero a ogni riavvio.

- **Piano gratuito di Render**: dopo ~15 minuti di inattività il server "va a dormire".
  Alla prima apertura dopo la pausa ci mette ~30 secondi a svegliarsi, poi va veloce.
  Per uso interno è normale. Se dà fastidio, si passa al piano a pagamento (pochi $/mese).

- **Aggiungere/togliere foto**: metti o togli i file dalla cartella `public/foto`,
  ricarica su GitHub, e Render si aggiorna da solo. Le nuove foto vengono assegnate
  in automatico in modo equo tra le persone presenti.

- **Password**: al momento chiunque abbia il link può vedere e modificare. Se vuoi una
  password d'accesso, chiedimelo e la aggiungo.

- **Esportare il riepilogo**: dal portale, il pulsante "Esporta CSV" scarica la tabella
  completa (foto, task, persona, fatto) apribile con Excel.
