// Alle HTML-Bausteine, die zur Laufzeit erzeugt werden.
// Die festen Teile der Seite (Navigation, Dialoge) stehen in index.html.
import { esc } from './ui.js';
import { STATUS, seriesKey, toIsbn13 } from './logic.js';
import { LOCAL, NO_COVER, localUrl } from './covers.js';

/* ---------- Farben und Cover ---------- */
export function hue(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
export const spineColor = b => `hsl(${hue(b.title + (b.authors[0] || ''))} 32% 40%)`;
// Anfangsbuchstaben der ersten zwei Wörter; Satzzeichen wie „–“ oder „»“ zählen nicht
const initials = t => String(t).split(/\s+/).map(w => w.replace(/^[^\p{L}\d]+/u, '')).filter(Boolean)
  .slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Cover-Adresse zur ISBN bei Open Library, deren Cover frei verwendet werden dürfen.
// Die Nationalbibliothek hat zwar Cover, lässt sie aber nicht in fremde Seiten einbinden.
function isbnCovers(isbn) {
  const i13 = toIsbn13(isbn);
  return i13.length === 13 ? [`https://covers.openlibrary.org/b/isbn/${i13}-M.jpg?default=false`] : [];
}

// Alle Bilder, die als Cover infrage kommen: eigenes Foto, gespeicherter Link, dann die ISBN-Dienste
export function coverSources(b) {
  if (b.cover === NO_COVER) return [];
  if (b.cover === LOCAL) return [localUrl(b.id)].filter(Boolean);
  return [...new Set([b.cover, ...isbnCovers(b.isbn)])].filter(Boolean);
}

// Cover-Bild; lädt eine Quelle nicht, wird die nächste probiert (siehe main.js),
// am Ende erscheinen die Initialen auf farbigem Grund.
export function cover(b, size = '') {
  const style = `background:${spineColor(b)}`;
  const [src, ...next] = coverSources(b);
  if (src) {
    return `<div class="cover has-img ${size}" style="${style}"><img src="${esc(src)}" alt="" loading="lazy" data-id="${esc(b.id)}" data-next="${esc(next.join(' '))}" data-fallback="${esc(initials(b.title))}"></div>`;
  }
  return `<div class="cover ${size}" style="${style}">${esc(initials(b.title))}</div>`;
}

/* ---------- Sterne ---------- */
export const ratingText = r => r ? `${String(r).replace('.', ',')} von 5 Sternen` : 'Nicht bewertet';

export const emptyState = (title, text) => `<div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div>`;

/* ---------- Bibliothek ---------- */
// Kachel im Raster: Cover und darunter der Titel in einer Zeile
export function bookTile(b) {
  return `
    <li class="book" data-id="${b.id}">
      ${cover(b, 'fill')}
      <div class="t">${esc(b.title)}</div>
    </li>`;
}

// Auswahlfeld mit allen Listen und Tags
export function labelOptions(lists, tags, allText) {
  return `<option value="">${esc(allText)}</option>` +
    (lists.length ? `<optgroup label="Listen">${lists.map(l => `<option value="l:${esc(l.id)}">${esc(l.name)}</option>`).join('')}</optgroup>` : '') +
    (tags.length ? `<optgroup label="Tags">${tags.map(t => `<option value="t:${esc(t)}">${esc(t)}</option>`).join('')}</optgroup>` : '');
}

/* ---------- Reihen ---------- */
const readCount = vols => vols.filter(v => v.status === 'read').length;

// Kachel im Raster: Cover des ersten Bandes, darunter Reihenname und Fortschritt
export function seriesTile(key, vols) {
  return `
    <li class="book" data-series="${esc(key)}">
      ${cover(vols[0], 'fill')}
      <div class="t">${esc(vols[0].series.name.trim())}</div>
      <div class="ts">${readCount(vols)} von ${vols.length} gelesen</div>
    </li>`;
}

// Detailseite einer Reihe: Fortschritt und alle Bände mit Cover und Status
export function seriesDetail(vols, next) {
  const read = readCount(vols);
  let sub = `${read} von ${vols.length} im Regal gelesen`;
  if (!next) sub += '. Reihe abgeschlossen';
  else if (next.status === 'reading') sub += `. Du liest gerade Band ${next.series.nr || '?'}`;

  const rows = vols.map(v => {
    const isNext = v === next;
    const state = isNext && v.status === 'unread' ? 'Als Nächstes dran' : STATUS[v.status];
    return `
      <div class="vol ${v.status} ${isNext ? 'next' : ''}" data-id="${v.id}" role="button" tabindex="0">
        ${cover(v)}
        <span class="vt">
          <span class="vn">Band ${esc(v.series.nr !== '' ? v.series.nr : '?')}</span>
          ${esc(v.title)}
          <span class="vs">${state}</span>
        </span>
        ${v.status === 'read' ? '<span class="check" aria-hidden="true">✓</span>' : ''}
      </div>`;
  }).join('');

  return `
    <div class="series-block">
      <button class="btn ghost back" id="seriesBack">‹ Alle Reihen</button>
      <h2>${esc(vols[0].series.name.trim())}</h2>
      <div class="sub">${sub}</div>
      <div class="progress"><span style="width:${Math.round(read / vols.length * 100)}%"></span></div>
      ${rows}
    </div>`;
}

/* ---------- Zufall ---------- */
const gift = () => `<div class="gift" aria-hidden="true"><span class="paper l"></span><span class="paper r"></span><span class="bow"><i class="tail l"></i><i class="tail r"></i><b class="knot"></b></span></div>`;

// Vor dem Ziehen: nur das verpackte Geschenk
export function giftCard() {
  return `
    <p class="label">Dein nächstes Buch wartet schon</p>
    <div class="unwrap">${gift()}</div>`;
}

// Nach dem Ziehen: das Geschenk liegt über dem Cover und wird ausgepackt
export function pickCard(b, why) {
  return `
    <p class="label">Heute dran</p>
    <div class="unwrap open">${cover(b, 'xl')}${gift()}</div>
    <div class="info">
      <h2>${esc(b.title)}</h2>
      <div class="a">${esc(b.authors.join(', '))}</div>
      ${why ? `<p class="why">${esc(why)}</p>` : ''}
      <div class="row">
        <button class="btn primary" data-action="start">Jetzt lesen</button>
        <button class="btn" data-action="details">Details</button>
      </div>
    </div>`;
}

/* ---------- Einstellungen ---------- */
export function settingsItem(name, count, kind, key) {
  return `
    <div class="set-item">
      <span>${esc(name)} <span class="hint">(${count})</span></span>
      <button class="icon-btn" data-rename-${kind}="${esc(key)}" aria-label="${esc(name)} umbenennen">✎</button>
      <button class="icon-btn" data-delete-${kind}="${esc(key)}" aria-label="${esc(name)} löschen">🗑</button>
    </div>`;
}

/* ---------- Bearbeiten ---------- */
export function chip(label, attr, value, pressed) {
  return `<button class="chip" data-${attr}="${esc(value)}" aria-pressed="${pressed}">${esc(label)}</button>`;
}

/* ---------- Lesen ---------- */
const bookLine = b => `${cover(b, 'sm')}
  <span class="grow"><strong>${esc(b.title)}</strong><small>${esc(b.authors.join(', ') || STATUS[b.status])}</small></span>`;

// Gewähltes Buch beim Eintragen, mit Knopf zum Abwählen
export const pickedBook = b => `<div class="picked">${bookLine(b)}
  <button type="button" class="icon-btn" data-clear aria-label="Anderes Buch wählen">✕</button></div>`;

// Treffer der Buchsuche; heading steht darüber (z. B. „Lese gerade“)
export function bookHits(books, heading, emptyText) {
  if (!books.length) return emptyText ? `<li class="hint">${esc(emptyText)}</li>` : '';
  return (heading ? `<li class="hl">${esc(heading)}</li>` : '') +
    books.map(b => `<li><button type="button" class="hit" data-pick="${esc(b.id)}">${bookLine(b)}</button></li>`).join('');
}

const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const longDay = s => fromIso(s).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
export const monthTitle = (year, month) => new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
const pagesText = n => `${n} ${n === 1 ? 'Seite' : 'Seiten'}`;

// Farbstufe eines Tages nach Seitenzahl
const level = n => !n ? 0 : n < 25 ? 1 : n < 50 ? 2 : n < 100 ? 3 : 4;

// Monatskalender ab Montag; days aus monthGrid, byDay aus pagesByDay
export function calendar(days, byDay, selected, today) {
  const head = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<span class="wd">${d}</span>`).join('');
  const cells = days.map(day => {
    if (!day) return '<span></span>';
    const n = byDay[day] || 0;
    const cls = ['day', `l${level(n)}`, day === today ? 'today' : '', day === selected ? 'sel' : ''].join(' ');
    return `
      <button class="${cls}" data-day="${day}" ${day > today ? 'disabled' : ''} aria-label="${longDay(day)}: ${n ? pagesText(n) : 'nichts gelesen'}">
        <span class="dn">${Number(day.slice(8))}</span>${n ? `<span class="dp">${n}</span>` : ''}
      </button>`;
  }).join('');
  return head + cells;
}

export function readingStats(monthPages, monthDays, streak) {
  const tile = (value, label) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`;
  return tile(monthPages, 'Seiten im Monat') +
    tile(monthDays, monthDays === 1 ? 'Lesetag' : 'Lesetage') +
    tile(streak, streak === 1 ? 'Tag in Folge' : 'Tage in Folge');
}

// Einträge eines Tages; bookTitle liefert zum Buch den Titel oder ''
export function dayEntries(day, entries, bookTitle) {
  const total = entries.reduce((s, e) => s + e.pages, 0);
  const rows = entries.map(e => `
    <li>
      <span class="grow"><strong>${pagesText(e.pages)}</strong>${e.from ? ` (S. ${e.from}–${e.to})` : ''}${bookTitle(e.book) ? ` · ${esc(bookTitle(e.book))}` : ''}</span>
      <button class="icon-btn" data-delete="${e.id}" aria-label="Eintrag löschen">✕</button>
    </li>`).join('');
  return `
    <h3>${longDay(day)}${total ? ` · ${pagesText(total)}` : ''}</h3>
    ${entries.length ? `<ul class="entries">${rows}</ul>` : '<p class="hint">An diesem Tag ist nichts eingetragen.</p>'}`;
}
