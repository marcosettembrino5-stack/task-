const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));

// ---- Percorsi ----
const PUBLIC_DIR = path.join(__dirname, "public");
const FOTO_DIR = path.join(PUBLIC_DIR, "foto");
// Su Render il filesystem è effimero: se è impostato DATA_DIR (disco persistente) lo usiamo.
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

// ---- Storage su file JSON ----
// Struttura: { people: [..], photos: { "<file>": {note, person, done, ord} } }
let store = { people: [], photos: {} };

function loadStore() {
  try {
    store = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    if (!Array.isArray(store.people)) store.people = [];
    if (!store.photos || typeof store.photos !== "object") store.photos = {};
  } catch (e) {
    store = { people: [], photos: {} };
  }
}

// Scrittura atomica: scrive su file temporaneo e poi rinomina, per non corrompere i dati.
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

// ---- Inizializzazione ----
function init() {
  loadStore();
  if (store.people.length === 0) store.people = DEFAULT_PEOPLE.slice();

  // Sincronizza le foto sul disco con lo store, assegnando in modo equo le nuove.
  const files = listFoto();
  const rotation = store.people.length ? store.people : DEFAULT_PEOPLE;
  files.forEach((f, i) => {
    if (!store.photos[f]) {
      store.photos[f] = { note: "", person: rotation[i % rotation.length], done: false, ord: i };
    } else {
      store.photos[f].ord = i; // mantiene l'ordine coerente con la cartella
    }
  });
  persist();
}
init();

// Restituisce le foto ordinate come array
function photosOrdered() {
  return listFoto().map(f => {
    const p = store.photos[f] || { note: "", person: "", done: false };
    return { file: f, note: p.note || "", person: p.person || "", done: !!p.done };
  });
}

// ---- API ----

app.get("/api/state", (req, res) => {
  res.json({ photos: photosOrdered(), people: store.people.slice() });
});

app.post("/api/photo", (req, res) => {
  const { file, note, person, done } = req.body || {};
  if (!file || typeof file !== "string") return res.status(400).json({ error: "file mancante" });
  if (!store.photos[file]) return res.status(404).json({ error: "foto non trovata" });

  if (note !== undefined) store.photos[file].note = String(note);
  if (person !== undefined) store.photos[file].person = String(person);
  if (done !== undefined) store.photos[file].done = !!done;
  scheduleSave();
  res.json({ ok: true });
});

app.post("/api/person", (req, res) => {
  const { name } = req.body || {};
  const n = (name || "").trim();
  if (!n) return res.status(400).json({ error: "nome mancante" });
  if (!store.people.includes(n)) { store.people.push(n); scheduleSave(); }
  res.json({ ok: true, people: store.people.slice() });
});

app.get("/api/export.csv", (req, res) => {
  const rows = photosOrdered();
  const q = s => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
  let csv = "\ufeff" + ["N", "File", "Task da fare", "Assegnato a", "Fatto"].map(q).join(";") + "\n";
  rows.forEach((r, i) => {
    csv += [q(i + 1), q(r.file), q(r.note), q(r.person), q(r.done ? "SI" : "")].join(";") + "\n";
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="task-foto.csv"');
  res.send(csv);
});

// ---- File statici (pagina + foto) ----
app.use(express.static(PUBLIC_DIR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Portale task foto in ascolto sulla porta ${PORT}`);
  console.log(`Foto trovate: ${listFoto().length}`);
  console.log(`Dati salvati in: ${DB_PATH}`);
});
