// Eigene Coverfotos. Sie liegen in IndexedDB, weil localStorage für Bilder zu klein ist.
// Ein Buch mit eigenem Foto hat als cover den Wert LOCAL, das Bild selbst liegt hier unter der Buch-ID.

export const LOCAL = 'local';

const DB_NAME = 'booklover-covers';
const STORE = 'covers';
const MAX_W = 360, MAX_H = 540, QUALITY = 0.8;

const urls = new Map(); // Buch-ID → Objekt-URL zum Anzeigen
let dbPromise = null;

function openDb() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Führt eine Aktion im Speicher aus und wartet, bis sie abgeschlossen ist.
async function run(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = action(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

function setUrl(id, blob) {
  const old = urls.get(id);
  if (old) URL.revokeObjectURL(old);
  urls.set(id, URL.createObjectURL(blob));
}

export const localUrl = id => urls.get(id) || '';
export const localCount = () => urls.size;

// Beim Start alle Fotos laden
export async function loadAll() {
  try {
    const [keys, blobs] = await Promise.all([
      run('readonly', s => s.getAllKeys()),
      run('readonly', s => s.getAll())
    ]);
    keys.forEach((id, i) => setUrl(id, blobs[i]));
  } catch (e) { /* kein IndexedDB: dann eben ohne eigene Fotos */ }
}

export async function putCover(id, blob) {
  await run('readwrite', s => s.put(blob, id));
  setUrl(id, blob);
}

export async function deleteCover(id) {
  try { await run('readwrite', s => s.delete(id)); } catch (e) {}
  const old = urls.get(id);
  if (old) { URL.revokeObjectURL(old); urls.delete(id); }
}

export async function clearCovers() {
  try { await run('readwrite', s => s.clear()); } catch (e) {}
  urls.forEach(u => URL.revokeObjectURL(u));
  urls.clear();
}

// Verkleinert ein Foto auf Cover-Größe und speichert es als JPEG.
export async function prepareImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_W / bmp.width, MAX_H / bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close && bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden')), 'image/jpeg', QUALITY));
}

/* ---------- Für die Sicherung ---------- */
const toDataUrl = blob => new Promise(resolve => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.readAsDataURL(blob);
});

// { Buch-ID: "data:image/jpeg;base64,…" }
export async function exportCovers() {
  const out = {};
  try {
    const [keys, blobs] = await Promise.all([
      run('readonly', s => s.getAllKeys()),
      run('readonly', s => s.getAll())
    ]);
    for (let i = 0; i < keys.length; i++) out[keys[i]] = await toDataUrl(blobs[i]);
  } catch (e) {}
  return out;
}

export async function importCovers(map) {
  await clearCovers();
  for (const [id, dataUrl] of Object.entries(map || {})) {
    try { await putCover(id, await (await fetch(dataUrl)).blob()); } catch (e) {}
  }
}
