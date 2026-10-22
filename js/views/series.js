// Ansicht "Reihen": alle Reihen mit Fortschritt und nächstem Band.
import { $ } from '../ui.js';
import { store } from '../store.js';
import { seriesKey, booksOfSeries, nextOfSeries } from '../logic.js';
import { seriesBlock, emptyState } from '../templates.js';
import { openEdit } from '../dialogs/edit.js';

export function renderSeries() {
  const books = store.db.books;
  const keys = [...new Set(books.map(seriesKey).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));

  if (!keys.length) {
    $('#seriesWrap').innerHTML = emptyState('Noch keine Reihen',
      'Öffne ein Buch und trage unter „Reihe“ den Namen und die Band-Nummer ein. Bücher mit gleichem Reihennamen werden hier zusammengefasst.');
    return;
  }
  $('#seriesWrap').innerHTML = keys.map(k => seriesBlock(booksOfSeries(books, k), nextOfSeries(books, k))).join('');
}

export function initSeries() {
  const wrap = $('#seriesWrap');
  wrap.addEventListener('click', e => {
    const vol = e.target.closest('.vol');
    if (vol) openEdit(vol.dataset.id);
  });
  wrap.addEventListener('keydown', e => {
    const vol = e.target.closest('.vol');
    if (vol && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openEdit(vol.dataset.id); }
  });
}
