// Reine Logik ohne Oberfläche – lässt sich daher auch einzeln testen.

export const STATUS = { unread: 'Ungelesen', reading: 'Lese gerade', read: 'Gelesen' };

/* ---------- ISBN ---------- */
export function cleanIsbn(s) {
  return String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

// Wandelt ISBN-10 in ISBN-13 um, damit Duplikate zuverlässig erkannt werden.
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

/* ---------- Titel ---------- */
// Buchdienste (Goodreads, Amazon, Google) hängen gern Reihe, Ausgabe oder Werbung an den Titel, z. B.
// „Dornen und Rosen (Das Reich der sieben Höfe, #1)“ oder „The Deal - Roman | Demnächst als Serie …“.
// Klammern mit solchen Angaben fliegen raus, ebenso wie Klammern, die nur den Titel wiederholen.
const EXTRA_IN_BRACKETS = /#\s*\d|edition|ausgabe|reihe|serie|saga|trilogie|collection|book\s*\d|band\s*\d|teil\s*\d|\d$/i;
const GENRE_SUFFIX = /(?:\s*:|\s+[-–])\s+(?:[\p{L}-]+\s+){0,2}[\p{L}-]*(?:roman|thriller|krimi)$/iu;
const EDITION_SUFFIX = /\s*[:\-–]?\s*(?:(?:special|deluxe|limited|german)\s+)?[\p{L}-]*(?:edition|ausgabe)$/iu;

// Liefert den bereinigten Titel und die Reihe, falls sie im Titel stand („(Reihe, #2)“).
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

  // Lange Werbe-Untertitel nach dem letzten Doppelpunkt („Powerless: TikTok made me buy it! …“)
  const colon = t.lastIndexOf(': ');
  if (colon > 0 && t.slice(colon + 2).split(' ').length >= 10) t = t.slice(0, colon);

  t = t.replace(/[\s:\-–|]+$/, '').trim();
  return { title: t || original, series };
}

/* ---------- Reihen ---------- */
// Reihen werden über den Namen erkannt, Groß-/Kleinschreibung und Leerzeichen am Rand egal.
export function seriesKey(book) {
  const name = book.series && book.series.name;
  return name && name.trim() ? name.trim().toLowerCase() : '';
}

// Band-Nummer als Zahl; Bücher ohne Nummer kommen ans Ende der Reihe.
export function seriesNr(book) {
  const n = parseFloat(String(book.series && book.series.nr || '').replace(',', '.'));
  return isNaN(n) ? Infinity : n;
}

export function booksOfSeries(books, key) {
  return books
    .filter(b => seriesKey(b) === key)
    .sort((a, b) => seriesNr(a) - seriesNr(b) || a.title.localeCompare(b.title));
}

// Das nächste Buch einer Reihe = der niedrigste Band, der noch nicht gelesen ist.
export function nextOfSeries(books, key) {
  return booksOfSeries(books, key).find(b => b.status !== 'read') || null;
}

/* ---------- Zufallsgenerator ---------- */
// Alle Bücher, die gezogen werden dürfen:
// – ungelesene Einzelbücher
// – pro Reihe nur der nächste ungelesene Band
// – liest du gerade einen Band einer Reihe, kommt aus dieser Reihe nichts
// filter: '' (alle), 't:Tagname' oder 'l:Listen-ID'
export function drawCandidates(books, filter = '') {
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
  if (filter.startsWith('t:')) return out.filter(b => b.tags.includes(filter.slice(2)));
  if (filter.startsWith('l:')) return out.filter(b => b.lists.includes(filter.slice(2)));
  return out;
}
