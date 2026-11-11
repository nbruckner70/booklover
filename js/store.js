// Data storage: everything lives in Chrome's storage on the phone (localStorage).
import { uid, toast } from './ui.js';
import { STATUS, toIsbn13 } from './logic.js';

// Deliberately unchanged since the first version so existing data is kept.
const KEY = 'lesestapel-v1';
export const QUICK_KEY = 'lesestapel-quick';

export const store = { db: null };

// Rating: 0 = none, otherwise 0.5 to 5 in half steps
export function clampRating(r) {
  const n = Math.round(parseFloat(r) * 2) / 2;
  return n >= 0.5 && n <= 5 ? n : 0;
}

export function blankDb() {
  // reading: reading tracker, one entry per reading session
  // { id, date: "YYYY-MM-DD", pages, book: book ID or '', from, to: page range (missing in old entries) }
  return { books: [], lists: [], tags: ['5 Star Read', 'English Book'], reading: [] };
}

export function newBook(data = {}) {
  return {
    id: uid(), isbn: '', title: '', authors: [], genre: '', cover: '', year: '', pages: '', notes: '',
    status: 'unread', rating: 0, lists: [], tags: [], series: null, added: Date.now(),
    ...data
  };
}

// Brings data (also from old versions or backups) into the current shape.
export function normalize(d) {
  d = Object.assign(blankDb(), d || {});
  delete d.localCovers; // photos from backups belong in the photo store, not here
  d.lists = (d.lists || []).filter(l => l && l.id && l.name);
  d.tags = (d.tags || []).filter(Boolean);
  d.books = (d.books || []).map(b => newBook({
    id: b.id || uid(),
    isbn: b.isbn || '',
    title: b.title || 'Ohne Titel',
    authors: Array.isArray(b.authors) ? b.authors : [],
    genre: String(b.genre || '').trim(),
    cover: b.cover || '',
    year: b.year || '',
    pages: b.pages || '',
    notes: b.notes || '',
    status: STATUS[b.status] ? b.status : 'unread',
    rating: clampRating(b.rating),
    lists: b.lists || [],
    tags: b.tags || [],
    series: b.series && b.series.name ? { name: b.series.name, nr: b.series.nr ?? '' } : null,
    added: b.added || Date.now()
  }));
  d.reading = (d.reading || [])
    .filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && parseInt(e.pages) > 0)
    .map(e => {
      const entry = { id: e.id || uid(), date: e.date, pages: parseInt(e.pages), book: e.book || '' };
      const from = parseInt(e.from), to = parseInt(e.to);
      if (from > 0 && to >= from) Object.assign(entry, { from, to });
      return entry;
    });
  return d;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* broken data: start with an empty shelf */ }
  return blankDb();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store.db)); }
  catch (e) { toast('Speichern fehlgeschlagen: ' + e.message); }
}

export function replaceDb(d) { store.db = normalize(d); save(); }
export function storedSizeKb() { return Math.round((localStorage.getItem(KEY) || '').length / 1024); }

/* ---------- Helpers for lists, tags, books ---------- */
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

// Page range from–to, both pages included: 41 to 80 = 40 pages
export function addReading(date, from, to, book) {
  store.db.reading.push({ id: uid(), date, pages: to - from + 1, book, from, to });
  save();
}

export function deleteReading(id) {
  store.db.reading = store.db.reading.filter(e => e.id !== id);
  save();
}

store.db = load();
