# Come pubblicare il Portale Task Foto online (gratis, senza carta)

Sito web condiviso: tu e i colleghi (Simonini, Pagani, Crea) lavorate sugli **stessi**
dati. Le foto le serve il server. I dati (task, assegnazioni, "Fatto") sono salvati in un
database online, quindi **non si perdono mai**, nemmeno ai riavvii.

- Database: **Neon** (Postgres gratuito, senza carta)
- Hosting: **Koyeb** (Node.js gratuito, senza carta)
- Codice: già su GitHub (`marcosettembrino5-stack/task-`)

---

## PASSO 1 — Crea il database gratuito su Neon

1. Vai su https://neon.tech e fai **Sign up** (puoi usare l'account GitHub).
2. Crea un nuovo progetto (Create project). Nome a piacere, es. `task-foto`. Lascia le impostazioni di default.
3. A progetto creato, cerca la **Connection string** (stringa di connessione).
   È un indirizzo che inizia con `postgresql://...`. Copiala tutta.
   - Se ti chiede "Pooled" o "Direct", va bene la **Pooled connection**.
4. Tienila da parte: ti servirà nel Passo 2 (è il valore di `DATABASE_URL`).

> La connection string contiene una password: trattala come una password, non condividerla.

---

## PASSO 2 — Pubblica l'app su Koyeb

1. Vai su https://www.koyeb.com e fai **Sign up** (accedi con GitHub, così vede subito i tuoi repo).
2. Clicca **Create Web Service** (o **Create App**).
3. Scegli **GitHub** come sorgente e seleziona il repository **`task-`**.
4. Koyeb rileva Node.js. Verifica/imposta:
   - **Build command**: `npm install`
   - **Run command**: `node server.js`
   - **Port**: `3000` (o lascia che usi la variabile PORT: il codice la gestisce)
5. Apri la sezione **Environment variables** e aggiungi UNA variabile:
   - **Nome**: `DATABASE_URL`
   - **Valore**: la connection string di Neon copiata al Passo 1
6. Scegli il piano/istanza **Free** e clicca **Deploy**.
7. Attendi qualche minuto. Quando lo stato è **Healthy/Running**, in alto trovi l'indirizzo
   pubblico, tipo `https://task-xxxx.koyeb.app`.

Quel link è quello da mandare a **Simonini, Pagani e Crea**.

---

## Come funziona per i colleghi
Aprono il link, vedono le 48 foto già assegnate 16 a testa, scrivono cosa va fatto,
spuntano "Fatto". Tutto si salva sul database condiviso: le modifiche di uno le vedono
tutti (la pagina si aggiorna da sola ogni pochi secondi).

Il pulsante **Esporta CSV** scarica la tabella completa (foto, task, persona, fatto) per Excel.

---

## Note
- **Aggiungere/togliere foto**: metti/togli i file in `public/foto`, poi ricarica su GitHub.
  Koyeb ridistribuisce da solo; le nuove foto vengono assegnate in modo equo.
- **Password d'accesso**: ora chiunque abbia il link può modificare. Se serve una password,
  si può aggiungere.
- **Senza DATABASE_URL** l'app funziona lo stesso (salva su file locale): utile solo per
  provarla sul PC. In cloud usa SEMPRE Neon impostando `DATABASE_URL`.
