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
