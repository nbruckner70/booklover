// Alle HTML-Bausteine, die zur Laufzeit erzeugt werden.
// Die festen Teile der Seite (Navigation, Dialoge) stehen in index.html.
import { esc } from './ui.js';
import { STATUS, seriesKey } from './logic.js';
import { listName } from './store.js';
import { LOCAL, localUrl } from './covers.js';

/* ---------- Farben und Cover ---------- */
export function hue(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
export const spineColor = b => `hsl(${hue(b.title + (b.authors[0] || ''))} 32% 40%)`;
const initials = t => String(t).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Cover-Bild; fehlt es oder lädt es nicht, erscheinen die Initialen auf farbigem Grund.
export function cover(b, size = '') {
  const style = `background:${spineColor(b)}`;
  const src = b.cover === LOCAL ? localUrl(b.id) : b.cover;
  if (src) {
    return `<div class="cover has-img ${size}" style="${style}"><img src="${esc(src)}" alt="" loading="lazy" data-fallback="${esc(initials(b.title))}"></div>`;
  }
  return `<div class="cover ${size}" style="${style}">${esc(initials(b.title))}</div>`;
}

export function seriesLabel(b) {
  if (!seriesKey(b)) return '';
  return b.series.nr !== '' ? `${b.series.name}, Band ${b.series.nr}` : b.series.name;
}

/* ---------- Sterne ---------- */
export const ratingText = r => r ? `${String(r).replace('.', ',')} von 5 Sternen` : 'Nicht bewertet';

// Anzeige mit halben Sternen: graue Sterne, darüber farbige, auf die passende Breite gekürzt
export function stars(rating) {
  return `<span class="stars" role="img" aria-label="${ratingText(rating)}"><span class="stars-base" aria-hidden="true">★★★★★</span><span class="stars-fill" aria-hidden="true" style="width:${rating / 5 * 100}%">★★★★★</span></span>`;
}

export const emptyState = (title, text) => `<div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div>`;

/* ---------- Bibliothek ---------- */
export function bookRow(b) {
  const badges = [];
  if (seriesKey(b)) badges.push(`<span class="badge series">${esc(seriesLabel(b))}</span>`);
  if (b.status !== 'unread') badges.push(`<span class="badge s-${b.status}">${STATUS[b.status]}</span>`);
  b.lists.forEach(id => { const n = listName(id); if (n) badges.push(`<span class="badge">${esc(n)}</span>`); });
  b.tags.forEach(t => badges.push(`<span class="badge">${esc(t)}</span>`));
  return `
    <li class="book" data-id="${b.id}">
      ${cover(b)}
      <div class="meta">
        <div class="t">${esc(b.title)}</div>
        <div class="a">${esc(b.authors.join(', ') || 'Autor unbekannt')}</div>
        ${b.rating ? `<div class="rating-line">${stars(b.rating)}</div>` : ''}
        ${badges.length ? `<div class="badges">${badges.join('')}</div>` : ''}
      </div>
    </li>`;
}

// Auswahlfeld mit allen Listen und Tags
export function labelOptions(lists, tags, allText) {
  return `<option value="">${esc(allText)}</option>` +
    (lists.length ? `<optgroup label="Listen">${lists.map(l => `<option value="l:${esc(l.id)}">${esc(l.name)}</option>`).join('')}</optgroup>` : '') +
    (tags.length ? `<optgroup label="Tags">${tags.map(t => `<option value="t:${esc(t)}">${esc(t)}</option>`).join('')}</optgroup>` : '');
}

/* ---------- Reihen ---------- */
export function seriesBlock(vols, next) {
  const read = vols.filter(v => v.status === 'read').length;
  let sub = `${read} von ${vols.length} im Regal gelesen`;
  if (!next) sub += '. Reihe abgeschlossen';
  else if (next.status === 'reading') sub += `. Du liest gerade Band ${next.series.nr || '?'}`;

  const rows = vols.map(v => {
    const isNext = v === next;
    const state = isNext && v.status === 'unread' ? 'Als Nächstes dran' : STATUS[v.status];
    return `
      <div class="vol ${v.status === 'read' ? 'read' : ''} ${isNext ? 'next' : ''}" data-id="${v.id}" role="button" tabindex="0">
        <span class="nr">${esc(v.series.nr !== '' ? v.series.nr : '?')}</span>
        <span class="vt">${esc(v.title)}<div class="vs">${state}</div></span>
      </div>`;
  }).join('');

  return `
    <div class="series-block">
      <h2>${esc(vols[0].series.name.trim())}</h2>
      <div class="sub">${sub}</div>
      <div class="progress"><span style="width:${Math.round(read / vols.length * 100)}%"></span></div>
      ${rows}
    </div>`;
}

/* ---------- Zufall ---------- */
export function spine(b, i) {
  const width = 62 + (hue(b.id) % 30);
  const offset = (hue(b.title) % 24) - 12;
  return `<div class="spine" data-i="${i}" style="width:${width}%;background:${spineColor(b)};transform:translateX(${offset}px)">${esc(b.title)}</div>`;
}

export function pickCard(b, why) {
  return `
    ${cover(b, 'xl')}
    <h2>${esc(b.title)}</h2>
    <div class="a">${esc(b.authors.join(', '))}</div>
    ${why ? `<p class="why">${esc(why)}</p>` : ''}
    <div class="row">
      <button class="btn primary" data-action="start">Jetzt lesen</button>
      <button class="btn" data-action="details">Details</button>
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
