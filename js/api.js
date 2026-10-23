// Buchdaten zu einer ISBN holen: zuerst Google Books, sonst Open Library.
import { toIsbn13 } from './logic.js';

async function fromGoogle(isbn) {
  const r = await fetch('https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn);
  if (!r.ok) return null;
  const j = await r.json();
  const v = j.items && j.items[0] && j.items[0].volumeInfo;
  if (!v || !v.title) return null;
  const img = v.imageLinks ? (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail || '') : '';
  return {
    title: v.title,
    authors: v.authors || [],
    year: (v.publishedDate || '').slice(0, 4),
    pages: v.pageCount || '',
    cover: img.replace(/^http:/, 'https:').replace('&edge=curl', '')
  };
}

async function fromOpenLibrary(isbn) {
  const r = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  if (!r.ok) return null;
  const v = (await r.json())['ISBN:' + isbn];
  if (!v || !v.title) return null;
  return {
    title: v.title,
    authors: (v.authors || []).map(a => a.name),
    year: (String(v.publish_date || '').match(/\d{4}/) || [''])[0],
    pages: v.number_of_pages || '',
    cover: v.cover ? (v.cover.medium || v.cover.small || '') : ''
  };
}

export async function lookup(rawIsbn) {
  const isbn = toIsbn13(rawIsbn);
  for (const source of [fromGoogle, fromOpenLibrary]) {
    try {
      const info = await source(isbn);
      if (info) return info;
    } catch (e) { /* offline oder Dienst nicht erreichbar: nächste Quelle */ }
  }
  return null;
}

/* ---------- Cover ---------- */
const GB = 'https://www.googleapis.com/books/v1/volumes?q=';

function gbThumb(v) {
  const l = v.imageLinks;
  if (!l) return '';
  return (l.thumbnail || l.smallThumbnail || '').replace(/^http:/, 'https:').replace('&edge=curl', '');
}

async function gbSearch(query, max) {
  const r = await fetch(`${GB}${encodeURIComponent(query)}&maxResults=${max}&printType=books`);
  if (r.status === 429) throw new Error('rate'); // Google bremst: zu viele Anfragen
  if (!r.ok) return [];
  const j = await r.json();
  return (j.items || []).map(i => i.volumeInfo);
}

// Titel ohne Zusätze wie "(Reihe, #1)" oder ": Roman"
export function cleanTitle(t) {
  return String(t || '').replace(/\s*\(.*?\)\s*/g, ' ').split(/[:|]/)[0].trim();
}

// Liefert mögliche Cover-Links, das wahrscheinlichste zuerst:
// zuerst exakt über die ISBN, danach über Titel und Nachname des Autors.
export async function findCovers(book) {
  const urls = [];
  const add = u => { if (u && !urls.includes(u)) urls.push(u); };
  const isbn = toIsbn13(book.isbn);
  if (isbn) (await gbSearch('isbn:' + isbn, 1)).forEach(v => add(gbThumb(v)));
  const title = cleanTitle(book.title);
  if (title) {
    const author = ((book.authors || [])[0] || '').trim().split(/\s+/).pop();
    (await gbSearch(`intitle:${title}` + (author ? ` inauthor:${author}` : ''), 6)).forEach(v => add(gbThumb(v)));
  }
  return urls;
}

// Prüft, ob ein Bild wirklich lädt (fehlende Open-Library-Cover liefern einen Fehler).
export function imageLoads(url, timeout = 8000) {
  return new Promise(resolve => {
    if (!url) return resolve(false);
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; resolve(false); }, timeout);
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 1); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}
