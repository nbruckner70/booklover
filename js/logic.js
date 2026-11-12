// Pure logic without UI – so it can be tested on its own.

export const STATUS = { unread: 'Ungelesen', reading: 'Lese gerade', read: 'Gelesen' };

/* ---------- ISBN ---------- */
export function cleanIsbn(s) {
  return String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

// Converts ISBN-10 to ISBN-13 so duplicates are detected reliably.
export function toIsbn13(s) {
  s = cleanIsbn(s);
  if (s.length === 10) {
    const core = '978' + s.slice(0, 9);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += (+core[i]) * (i % 2 ? 3 : 1);
    return core + ((10 - sum % 10) % 10);
  }
  return s;
}

/* ---------- Titles ---------- */
// Book services (Goodreads, Amazon, Google) like to append series, edition or advertising to the title, e.g.
// "Dornen und Rosen (Das Reich der sieben Höfe, #1)" or "The Deal - Roman | Demnächst als Serie …".
// Brackets with such details are removed, as are brackets that merely repeat the title.
const EXTRA_IN_BRACKETS = /#\s*\d|edition|ausgabe|reihe|serie|saga|trilogie|collection|book\s*\d|band\s*\d|teil\s*\d|\d$/i;
const GENRE_SUFFIX = /(?:\s*:|\s+[-–])\s+(?:[\p{L}-]+\s+){0,2}[\p{L}-]*(?:roman|thriller|krimi)$/iu;
const EDITION_SUFFIX = /\s*[:\-–]?\s*(?:(?:special|deluxe|limited|german)\s+)?[\p{L}-]*(?:edition|ausgabe)$/iu;

// Returns the cleaned title and the series if it was part of the title ("(Series, #2)").
export function cleanTitle(raw) {
  const original = String(raw || '').replace(/\s+/g, ' ').trim();
  let t = original.split(' | ')[0];
  let series = null;

  let before;
  do {
    before = t;
    t = t.replace(/\s*\(([^()]*)\)/g, (all, inner) => {
      const hash = inner.match(/^(.+?)[\s,]*#\s*(\d+(?:[.,]\d+)?)$/);
      if (hash) { series ||= { name: hash[1].trim(), nr: hash[2].replace(',', '.') }; return ''; }
      const rest = t.replace(all, '');
      return EXTRA_IN_BRACKETS.test(inner) || rest.toLowerCase().includes(inner.trim().toLowerCase()) ? '' : all;
    });
  } while (t !== before);

  t = t.replace(GENRE_SUFFIX, '').replace(EDITION_SUFFIX, '');

  // Long advertising subtitles after the last colon ("Powerless: TikTok made me buy it! …")
  const colon = t.lastIndexOf(': ');
  if (colon > 0 && t.slice(colon + 2).split(' ').length >= 10) t = t.slice(0, colon);

  t = t.replace(/[\s:\-–|]+$/, '').trim();
  return { title: t || original, series };
}

/* ---------- Series ---------- */
// Series are matched by name, ignoring case and surrounding spaces.
export function seriesKey(book) {
  const name = book.series && book.series.name;
  return name && name.trim() ? name.trim().toLowerCase() : '';
}

// Volume number as a number; books without a number go to the end of the series.
export function seriesNr(book) {
  const n = parseFloat(String(book.series && book.series.nr || '').replace(',', '.'));
  return isNaN(n) ? Infinity : n;
}

export function booksOfSeries(books, key) {
  return books
    .filter(b => seriesKey(b) === key)
    .sort((a, b) => seriesNr(a) - seriesNr(b) || a.title.localeCompare(b.title));
}

// The next book of a series = the lowest volume not read yet.
export function nextOfSeries(books, key) {
  return booksOfSeries(books, key).find(b => b.status !== 'read') || null;
}

/* ---------- Filters ---------- */
// label: '' (all), 't:tag name' or 'l:list ID'
export function matchesLabel(book, label) {
  if (label.startsWith('t:')) return book.tags.includes(label.slice(2));
  if (label.startsWith('l:')) return book.lists.includes(label.slice(2));
  return true;
}

// Genres are matched by name, ignoring case and surrounding spaces.
export const genreKey = book => String(book.genre || '').trim().toLowerCase();
export const NO_GENRE = '-';

// genre: '' (all), NO_GENRE (books without a genre) or a genre key
export function matchesGenre(book, genre) {
  if (!genre) return true;
  return genre === NO_GENRE ? !genreKey(book) : genreKey(book) === genre;
}

// genres: list of genre keys (see matchesGenre); the book must match one of them.
// An empty list means all genres.
export function matchesAnyGenre(book, genres) {
  if (!genres.length) return true;
  return genres.some(g => matchesGenre(book, g));
}

// All genres in use, sorted by name; shown in the spelling of the first book found.
export function genresOf(books) {
  const names = new Map();
  for (const b of books) {
    const key = genreKey(b);
    if (key && !names.has(key)) names.set(key, b.genre.trim());
  }
  return [...names].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/* ---------- Random pick ---------- */
// All books that may be drawn:
// – unread standalone books
// – per series only the next unread volume
// – while you are reading a volume of a series, nothing from that series
// label: see matchesLabel; genres: see matchesAnyGenre
export function drawCandidates(books, label = '', genres = []) {
  const out = [];
  const seen = new Set();
  for (const b of books) {
    if (b.status !== 'unread') continue;
    const key = seriesKey(b);
    if (!key) { out.push(b); continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    const next = nextOfSeries(books, key);
    if (next && next.status === 'unread') out.push(next);
  }
  return out.filter(b => matchesLabel(b, label) && matchesAnyGenre(b, genres));
}

/* ---------- Reading tracker ---------- */
// Days are stored as "YYYY-MM-DD" in local time so an entry at 23:30 does not end up on the next day.
export function isoDay(date = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

// Pages per day: { "2026-11-04": 85, … }
export function pagesByDay(entries) {
  const out = {};
  for (const e of entries) out[e.date] = (out[e.date] || 0) + e.pages;
  return out;
}

// All days of a month for a calendar grid starting on Monday; null = empty cell before the 1st.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const days = new Date(year, month + 1, 0).getDate();
  return [
    ...Array(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => isoDay(new Date(year, month, i + 1)))
  ];
}

// Consecutive days with reading. If nothing is logged today yet, the streak still counts up to yesterday.
export function readingStreak(byDay, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!byDay[isoDay(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (byDay[isoDay(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
