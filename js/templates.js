// All HTML snippets generated at runtime.
// The fixed parts of the page (navigation, dialogs) are in index.html.
import { esc } from './ui.js';
import { STATUS, NO_GENRE, seriesKey, toIsbn13 } from './logic.js';
import { LOCAL, NO_COVER, localUrl } from './covers.js';

/* ---------- Colours and covers ---------- */
export function hue(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
export const spineColor = b => `hsl(${hue(b.title + (b.authors[0] || ''))} 32% 40%)`;
// Initials of the first two words; punctuation such as "–" or "»" does not count
const initials = t => String(t).split(/\s+/).map(w => w.replace(/^[^\p{L}\d]+/u, '')).filter(Boolean)
  .slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Cover URL for the ISBN at Open Library, whose covers may be used freely.
// The German National Library has covers too, but does not allow embedding them in other sites.
function isbnCovers(isbn) {
  const i13 = toIsbn13(isbn);
  return i13.length === 13 ? [`https://covers.openlibrary.org/b/isbn/${i13}-M.jpg?default=false`] : [];
}

// All images that could serve as cover: own photo, saved link, then the ISBN services
export function coverSources(b) {
  if (b.cover === NO_COVER) return [];
  if (b.cover === LOCAL) return [localUrl(b.id)].filter(Boolean);
  return [...new Set([b.cover, ...isbnCovers(b.isbn)])].filter(Boolean);
}

// Cover image; if a source fails to load, the next one is tried (see main.js),
// finally the initials appear on a coloured background.
export function cover(b, size = '') {
  const style = `background:${spineColor(b)}`;
  const [src, ...next] = coverSources(b);
  if (src) {
    return `<div class="cover has-img ${size}" style="${style}"><img src="${esc(src)}" alt="" loading="lazy" data-id="${esc(b.id)}" data-next="${esc(next.join(' '))}" data-fallback="${esc(initials(b.title))}"></div>`;
  }
  return `<div class="cover ${size}" style="${style}">${esc(initials(b.title))}</div>`;
}

/* ---------- Stars ---------- */
export const ratingText = r => r ? `${String(r).replace('.', ',')} von 5 Sternen` : 'Nicht bewertet';

export const emptyState = (title, text) => `<div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div>`;

/* ---------- Library ---------- */
// Grid tile: cover with the title in one line below
export function bookTile(b) {
  return `
    <li class="book" data-id="${b.id}">
      ${cover(b, 'fill')}
      <div class="t">${esc(b.title)}</div>
    </li>`;
}

// Select options with all lists and tags
export function labelOptions(lists, tags, allText) {
  return `<option value="">${esc(allText)}</option>` +
    (lists.length ? `<optgroup label="Listen">${lists.map(l => `<option value="l:${esc(l.id)}">${esc(l.name)}</option>`).join('')}</optgroup>` : '') +
    (tags.length ? `<optgroup label="Tags">${tags.map(t => `<option value="t:${esc(t)}">${esc(t)}</option>`).join('')}</optgroup>` : '');
}

// Select options for the genre filter; noneText adds an entry for books without a genre
export function genreOptions(genres, allText, noneText) {
  return `<option value="">${esc(allText)}</option>` +
    genres.map(g => `<option value="${esc(g.key)}">${esc(g.name)}</option>`).join('') +
    (noneText ? `<option value="${NO_GENRE}">${esc(noneText)}</option>` : '');
}

/* ---------- Series ---------- */
const readCount = vols => vols.filter(v => v.status === 'read').length;

// Grid tile: cover of the first volume, below it series name and progress
export function seriesTile(key, vols) {
  return `
    <li class="book" data-series="${esc(key)}">
      ${cover(vols[0], 'fill')}
      <div class="t">${esc(vols[0].series.name.trim())}</div>
      <div class="ts">${readCount(vols)} von ${vols.length} gelesen</div>
    </li>`;
}

// Series detail page: progress and all volumes with cover and status
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

/* ---------- Random pick ---------- */
const gift = () => `<div class="gift" aria-hidden="true"><span class="paper l"></span><span class="paper r"></span><span class="bow"><i class="tail l"></i><i class="tail r"></i><b class="knot"></b></span></div>`;

// Before drawing: only the wrapped gift
export function giftCard() {
  return `
    <p class="label">Dein nächstes Buch wartet schon</p>
    <div class="unwrap">${gift()}</div>`;
}

// After drawing: the gift lies over the cover and gets unwrapped
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

/* ---------- Settings ---------- */
export function settingsItem(name, count, kind, key) {
  return `
    <div class="set-item">
      <span>${esc(name)} <span class="hint">(${count})</span></span>
      <button class="icon-btn" data-rename-${kind}="${esc(key)}" aria-label="${esc(name)} umbenennen">✎</button>
      <button class="icon-btn" data-delete-${kind}="${esc(key)}" aria-label="${esc(name)} löschen">🗑</button>
    </div>`;
}

/* ---------- Edit ---------- */
// One entry of a multi-select dropdown (.multi)
export function checkOption(label, value, checked, cls = '') {
  return `<label class="opt ${cls}"><input type="checkbox" value="${esc(value)}"${checked ? ' checked' : ''}>${esc(label)}</label>`;
}

export function chip(label, attr, value, pressed) {
  return `<button class="chip" data-${attr}="${esc(value)}" aria-pressed="${pressed}">${esc(label)}</button>`;
}

/* ---------- Reading ---------- */
const bookLine = b => `${cover(b, 'sm')}
  <span class="grow"><strong>${esc(b.title)}</strong><small>${esc(b.authors.join(', ') || STATUS[b.status])}</small></span>`;

// Chosen book when logging, with a button to deselect it
export const pickedBook = b => `<div class="picked">${bookLine(b)}
  <button type="button" class="icon-btn" data-clear aria-label="Anderes Buch wählen">✕</button></div>`;

// Book search hits; heading is shown above them (e.g. "Lese gerade")
export function bookHits(books, heading, emptyText) {
  if (!books.length) return emptyText ? `<li class="hint">${esc(emptyText)}</li>` : '';
  return (heading ? `<li class="hl">${esc(heading)}</li>` : '') +
    books.map(b => `<li><button type="button" class="hit" data-pick="${esc(b.id)}">${bookLine(b)}</button></li>`).join('');
}

const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const longDay = s => fromIso(s).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
export const monthTitle = (year, month) => new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
const pagesText = n => `${n} ${n === 1 ? 'Seite' : 'Seiten'}`;

// Colour level of a day by number of pages
const level = n => !n ? 0 : n < 25 ? 1 : n < 50 ? 2 : n < 100 ? 3 : 4;

// Month calendar starting on Monday; days from monthGrid, byDay from pagesByDay
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

// Entries of one day; bookTitle returns the title of a book or ''
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
