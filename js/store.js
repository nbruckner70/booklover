// Datenhaltung: alles liegt im Speicher von Chrome auf dem Handy (localStorage).
import { uid, toast } from './ui.js';
import { STATUS, toIsbn13 } from './logic.js';

// Bewusst unverändert seit der ersten Version, damit vorhandene Daten erhalten bleiben.
const KEY = 'lesestapel-v1';
export const QUICK_KEY = 'lesestapel-quick';

export const store = { db: null };

export function blankDb() {
  return { books: [], lists: [], tags: ['5 Star Read', 'English Book'] };
}

export function newBook(data = {}) {
  return {
    id: uid(), isbn: '', title: '', authors: [], cover: '', year: '', pages: '', notes: '',
    status: 'unread', lists: [], tags: [], series: null, added: Date.now(),
    ...data
  };
}

// Bringt Daten (auch aus alten Versionen oder Sicherungen) in die aktuelle Form.
export function normalize(d) {
  d = Object.assign(blankDb(), d || {});
  d.lists = (d.lists || []).filter(l => l && l.id && l.name);
  d.tags = (d.tags || []).filter(Boolean);
  d.books = (d.books || []).map(b => newBook({
    id: b.id || uid(),
    isbn: b.isbn || '',
    title: b.title || 'Ohne Titel',
    authors: Array.isArray(b.authors) ? b.authors : [],
    cover: b.cover || '',
    year: b.year || '',
    pages: b.pages || '',
    notes: b.notes || '',
    status: STATUS[b.status] ? b.status : 'unread',
    lists: b.lists || [],
    tags: b.tags || [],
    series: b.series && b.series.name ? { name: b.series.name, nr: b.series.nr ?? '' } : null,
    added: b.added || Date.now()
  }));
  return d;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* kaputte Daten: mit leerem Regal starten */ }
  return blankDb();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store.db)); }
  catch (e) { toast('Speichern fehlgeschlagen: ' + e.message); }
}

export function replaceDb(d) { store.db = normalize(d); save(); }
export function storedSizeKb() { return Math.round((localStorage.getItem(KEY) || '').length / 1024); }

/* ---------- Hilfen für Listen, Tags, Bücher ---------- */
export function listName(id) {
  const l = store.db.lists.find(x => x.id === id);
  return l ? l.name : '';
}

export function addList(name) {
  name = name.trim();
  if (!name) return null;
  let l = store.db.lists.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!l) { l = { id: uid(), name }; store.db.lists.push(l); save(); }
  return l;
}

export function addTag(name) {
  name = name.trim();
  if (!name) return null;
  const existing = store.db.tags.find(x => x.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  store.db.tags.push(name);
  save();
  return name;
}

export function findByIsbn(isbn) {
  const i = toIsbn13(isbn);
  return i ? store.db.books.find(b => toIsbn13(b.isbn) === i) : null;
}

store.db = load();
