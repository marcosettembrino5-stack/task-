const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));

// ---- Percorsi ----
const PUBLIC_DIR = path.join(__dirname, "public");
const FOTO_DIR = path.join(PUBLIC_DIR, "foto");
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, "portale-data.json");

// ---- Persone di default e assegnazione equa ----
const DEFAULT_PEOPLE = ["Simonini", "Pagani", "Crea"];

// ---- Elenco foto (letto dalla cartella) ----
function listFoto() {
  try {
    return fs.readdirSync(FOTO_DIR)
      .filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f))
      .sort();
  } catch (e) {
    return [];
  }
}

// =====================================================================
//  STORAGE ASTRATTO
//  - Se esiste DATABASE_URL  -> Postgres (Neon): dati condivisi e persistenti ovunque.
//  - Altrimenti              -> file JSON locale (comodo per lo sviluppo sul PC).
// =====================================================================
const USE_PG = !!process.env.DATABASE_URL;
let storage;

// -------- Storage: file JSON (fallback locale) --------
function makeFileStorage() {
  let store = { people: [], photos: {} };
  function loadStore() {
    try {
      store = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      if (!Array.isArray(store.people)) store.people = [];
      if (!store.photos || typeof store.photos !== "object") store.photos = {};
    } catch (e) { store = { people: [], photos: {} }; }
  }
  let saveTimer = null;
  function persist() {
    const tmp = DB_PATH + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, DB_PATH);
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { persist(); } catch (e) { console.error("Errore salvataggio:", e); } }, 150);
  }
  return {
    async init() {
      loadStore();
      if (store.people.length === 0) store.people = DEFAULT_PEOPLE.slice();
      const files = listFoto();
      const rotation = store.people.length ? store.people : DEFAULT_PEOPLE;
      files.forEach((f, i) => {
        if (!store.photos[f]) store.photos[f] = { note: "", person: rotation[i % rotation.length], done: false, ord: i };
        else store.photos[f].ord = i;
      });
      persist();
    },
    async getState() {
      const photos = listFoto().map(f => {
        const p = store.photos[f] || { note: "", person: "", done: false };
        return { file: f, note: p.note || "", person: p.person || "", done: !!p.done };
      });
      return { photos, people: store.people.slice() };
    },
    async updatePhoto(file, patch) {
      if (!store.photos[file]) return false;
      if (patch.note !== undefined) store.photos[file].note = String(patch.note);
      if (patch.person !== undefined) store.photos[file].person = String(patch.person);
      if (patch.done !== undefined) store.photos[file].done = !!patch.done;
      scheduleSave();
      return true;
    },
    async addPerson(name) {
      if (!store.people.includes(name)) { store.people.push(name); scheduleSave(); }
      return store.people.slice();
    }
  };
}

// -------- Storage: Postgres (Neon) --------
function makePgStorage() {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Neon richiede SSL
  });
  // Attende che il database sia raggiungibile, con alcuni tentativi (utile quando il container parte).
  async function waitForDb(tries = 8) {
    for (let i = 1; i <= tries; i++) {
      try { await pool.query("SELECT 1"); return; }
      catch (e) {
        console.log(`Tentativo di connessione al DB ${i}/${tries} fallito: ${e.code || e.message}`);
        if (i === tries) throw e;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  return {
    async init() {
      await waitForDb();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS people ( name TEXT PRIMARY KEY );
        CREATE TABLE IF NOT EXISTS photos (
          file   TEXT PRIMARY KEY,
          note   TEXT NOT NULL DEFAULT '',
          person TEXT NOT NULL DEFAULT '',
          done   BOOLEAN NOT NULL DEFAULT false,
          ord    INTEGER NOT NULL DEFAULT 0
        );
      `);
      // persone di default se tabella vuota
      const pc = await pool.query("SELECT COUNT(*)::int AS c FROM people");
      if (pc.rows[0].c === 0) {
        for (const p of DEFAULT_PEOPLE) await pool.query("INSERT INTO people(name) VALUES ($1) ON CONFLICT DO NOTHING", [p]);
      }
      // sincronizza foto dal disco, assegnazione equa per le nuove
      const existing = new Set((await pool.query("SELECT file FROM photos")).rows.map(r => r.file));
      const people = (await pool.query("SELECT name FROM people ORDER BY name")).rows.map(r => r.name);
      const rotation = people.length ? people : DEFAULT_PEOPLE;
      const files = listFoto();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!existing.has(f)) {
          await pool.query("INSERT INTO photos(file, person, ord) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
            [f, rotation[i % rotation.length], i]);
        } else {
          await pool.query("UPDATE photos SET ord=$2 WHERE file=$1", [f, i]);
        }
      }
    },
    async getState() {
      const rows = (await pool.query("SELECT file, note, person, done FROM photos ORDER BY ord ASC")).rows;
      // ordina secondo la cartella (fonte di verità per l'ordine)
      const order = listFoto();
      const byFile = {}; rows.forEach(r => byFile[r.file] = r);
      const photos = order.map(f => {
        const r = byFile[f] || { note: "", person: "", done: false };
        return { file: f, note: r.note || "", person: r.person || "", done: !!r.done };
      });
      const people = (await pool.query("SELECT name FROM people ORDER BY name ASC")).rows.map(r => r.name);
      return { photos, people };
    },
    async updatePhoto(file, patch) {
      const ex = await pool.query("SELECT 1 FROM photos WHERE file=$1", [file]);
      if (ex.rowCount === 0) return false;
      if (patch.note !== undefined) await pool.query("UPDATE photos SET note=$2 WHERE file=$1", [file, String(patch.note)]);
      if (patch.person !== undefined) await pool.query("UPDATE photos SET person=$2 WHERE file=$1", [file, String(patch.person)]);
      if (patch.done !== undefined) await pool.query("UPDATE photos SET done=$2 WHERE file=$1", [file, !!patch.done]);
      return true;
    },
    async addPerson(name) {
      await pool.query("INSERT INTO people(name) VALUES ($1) ON CONFLICT DO NOTHING", [name]);
      return (await pool.query("SELECT name FROM people ORDER BY name ASC")).rows.map(r => r.name);
    }
  };
}

// ---- API ----
app.get("/api/state", async (req, res) => {
  try { res.json(await storage.getState()); }
  catch (e) { console.error(e); res.status(500).json({ error: "errore server" }); }
});

app.post("/api/photo", async (req, res) => {
  try {
    const { file, note, person, done } = req.body || {};
    if (!file || typeof file !== "string") return res.status(400).json({ error: "file mancante" });
    const ok = await storage.updatePhoto(file, { note, person, done });
    if (!ok) return res.status(404).json({ error: "foto non trovata" });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "errore server" }); }
});

app.post("/api/person", async (req, res) => {
  try {
    const n = ((req.body && req.body.name) || "").trim();
    if (!n) return res.status(400).json({ error: "nome mancante" });
    const people = await storage.addPerson(n);
    res.json({ ok: true, people });
  } catch (e) { console.error(e); res.status(500).json({ error: "errore server" }); }
});

app.get("/api/export.csv", async (req, res) => {
  try {
    const { photos } = await storage.getState();
    const q = s => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    let csv = "\ufeff" + ["N", "File", "Task da fare", "Assegnato a", "Fatto"].map(q).join(";") + "\n";
    photos.forEach((r, i) => {
      csv += [q(i + 1), q(r.file), q(r.note), q(r.person), q(r.done ? "SI" : "")].join(";") + "\n";
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="task-foto.csv"');
    res.send(csv);
  } catch (e) { console.error(e); res.status(500).send("errore"); }
});

// ---- File statici (pagina + foto) ----
app.use(express.static(PUBLIC_DIR));

// ---- Avvio ----
async function start() {
  storage = USE_PG ? makePgStorage() : makeFileStorage();
  try {
    await storage.init();
  } catch (e) {
    if (USE_PG) {
      // DATABASE_URL è impostata ma il DB non risponde: NON ripieghiamo sul file locale
      // (perderemmo i dati in silenzio). Meglio fermarsi con un errore chiaro e far
      // riprovare la piattaforma a riavviare, così i dati restano sempre su Neon.
      console.error("ERRORE: DATABASE_URL è impostata ma non riesco a connettermi al database.");
      console.error("Non parto in modalità file locale per non rischiare di perdere i dati.");
      console.error("Dettaglio:", e.message);
      process.exit(1);
    }
    throw e;
  }
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Portale task foto in ascolto sulla porta ${PORT}`);
    console.log(`Storage: ${USE_PG ? "Postgres (Neon) — dati persistenti e condivisi" : "file JSON locale (solo sviluppo)"}`);
    console.log(`Foto trovate: ${listFoto().length}`);
  });
}
start().catch(e => { console.error("Avvio fallito:", e); process.exit(1); });
