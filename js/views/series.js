// Ansicht "Reihen": Raster aller Reihen; ein Tipp öffnet die Detailseite mit allen Bänden.
import { $ } from '../ui.js';
import { store } from '../store.js';
import { seriesKey, booksOfSeries, nextOfSeries } from '../logic.js';
import { seriesTile, seriesDetail, emptyState } from '../templates.js';
import { openEdit } from '../dialogs/edit.js';

let openKey = ''; // Reihe, deren Detailseite gerade offen ist

export function renderSeries() {
  const books = store.db.books;
  const keys = [...new Set(books.map(seriesKey).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  const wrap = $('#seriesWrap');

  if (!keys.length) {
    wrap.innerHTML = emptyState('Noch keine Reihen',
      'Öffne ein Buch und trage unter „Reihe“ den Namen und die Band-Nummer ein. Bücher mit gleichem Reihennamen werden hier zusammengefasst.');
    return;
  }
  if (!keys.includes(openKey)) openKey = ''; // z. B. weil die Reihe umbenannt wurde

  if (openKey) {
    $('#count').textContent = '';
    wrap.innerHTML = seriesDetail(booksOfSeries(books, openKey), nextOfSeries(books, openKey));
  } else {
    $('#count').textContent = `${keys.length} ${keys.length === 1 ? 'Reihe' : 'Reihen'}`;
    wrap.innerHTML = `<ul class="books">${keys.map(k => seriesTile(k, booksOfSeries(books, k))).join('')}</ul>`;
  }
}

// Die Detailseite bekommt einen Eintrag im Verlauf, damit die Zurück-Taste am Handy zum Raster führt.
function openSeries(key) {
  openKey = key;
  history.pushState({ series: key }, '');
  renderSeries();
  window.scrollTo(0, 0);
}

// Beim Wechsel in einen anderen Reiter wieder mit dem Raster beginnen
export function closeSeries() {
  if (!openKey) return;
  openKey = '';
  history.back();
}

export function initSeries() {
  const wrap = $('#seriesWrap');
  wrap.addEventListener('click', e => {
    if (e.target.closest('#seriesBack')) { history.back(); return; }
    const tile = e.target.closest('[data-series]');
    if (tile) { openSeries(tile.dataset.series); return; }
    const vol = e.target.closest('.vol');
    if (vol) openEdit(vol.dataset.id);
  });
  wrap.addEventListener('keydown', e => {
    const vol = e.target.closest('.vol');
    if (vol && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openEdit(vol.dataset.id); }
  });
  window.addEventListener('popstate', e => {
    openKey = (e.state && e.state.series) || '';
    if ($('#v-series').classList.contains('active')) renderSeries();
  });
}
