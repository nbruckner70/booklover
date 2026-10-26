// Buchdaten zu einer ISBN holen: zuerst Deutsche Nationalbibliothek, dann Google Books, sonst Open Library.
// Google Books ohne eigenen Schlüssel ist oft ausgelastet (Fehler 429), deshalb nicht mehr an erster Stelle.
import { toIsbn13, cleanTitle } from './logic.js';

// Die DNB liefert MARC21-Datensätze; gebraucht werden nur wenige Felder.
async function fromDnb(isbn) {
  const r = await fetch(`https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=num%3D${isbn}&recordSchema=MARC21-xml`);
  if (!r.ok) return null;
  const xml = new DOMParser().parseFromString(await r.text(), 'application/xml');
  const rec = xml.querySelector('recordData record');
  if (!rec) return null;
  const sub = (tag, code) => {
    const f = rec.querySelector(`datafield[tag="${tag}"] subfield[code="${code}"]`);
    // Steuerzeichen markieren in DNB-Daten Artikel, die beim Sortieren übersprungen werden
    return f ? f.textContent.replace(/[\u0098\u009C¬]/g, '').trim() : '';
  };
  const title = [sub('245', 'a'), sub('245', 'n'), sub('245', 'p')].filter(Boolean).join(' – ');
  if (!title) return null;
  // „Fitzek, Sebastian“ → „Sebastian Fitzek“
  const authors = [...rec.querySelectorAll('datafield[tag="100"], datafield[tag="700"]')]
    .filter(f => !f.querySelector('subfield[code="4"]') || f.querySelector('subfield[code="4"]').textContent === 'aut')
    .map(f => (f.querySelector('subfield[code="a"]') || {}).textContent || '')
    .filter(Boolean)
    .map(n => n.split(', ').reverse().join(' '));
  const seriesName = sub('490', 'a');
  const seriesNr = (sub('490', 'v').match(/\d+(?:[.,]\d+)?/) || [''])[0].replace(',', '.');
  return {
    title,
    authors,
    year: (sub('264', 'c').match(/\d{4}/) || [''])[0],
    pages: (sub('300', 'a').match(/(\d+) Seiten/) || ['', ''])[1],
    cover: '', // findet die Anzeige über die ISBN, siehe coverSources in templates.js
    series: seriesName ? { name: seriesName, nr: seriesNr } : null
  };
}

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
  for (const source of [fromDnb, fromGoogle, fromOpenLibrary]) {
    try {
      const info = await source(isbn);
      if (!info) continue;
      const clean = cleanTitle(info.title);
      info.title = clean.title;
      info.series = info.series || clean.series;
      return info;
    } catch (e) { /* offline oder Dienst nicht erreichbar: nächste Quelle */ }
  }
  return null;
}
