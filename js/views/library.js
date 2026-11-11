// "Bibliothek" (library) view: search, filters, sorting and book list.
import { $, $$ } from '../ui.js';
import { store } from '../store.js';
import { seriesKey, seriesNr, matchesLabel, matchesGenre, genresOf } from '../logic.js';
import { bookTile, emptyState, labelOptions, genreOptions } from '../templates.js';
import { openEdit } from '../dialogs/edit.js';

let statusFilter = 'all';

// Keeps the current choice of a select if it still exists, otherwise falls back to "all".
function keepValue(select, current) {
  select.value = [...select.options].some(o => o.value === current) ? current : '';
}

// Fills a select with all lists and tags and keeps the current choice.
export function fillLabelSelect(select, allText) {
  const current = select.value;
  select.innerHTML = labelOptions(store.db.lists, store.db.tags, allText);
  keepValue(select, current);
}

// Fills a select with all genres in use and keeps the current choice.
// Hides the select while no book has a genre yet.
export function fillGenreSelect(select, allText, noneText = '', wrap = select) {
  const current = select.value;
  const genres = genresOf(store.db.books);
  select.innerHTML = genreOptions(genres, allText, genres.length ? noneText : '');
  keepValue(select, current);
  wrap.hidden = !genres.length;
}

const cmp = (a, b) => a.localeCompare(b, 'de');
const lastName = b => (b.authors[0] || '').split(/\s+/).pop().toLowerCase();

const SORTERS = {
  added: (a, b) => b.added - a.added,
  title: (a, b) => cmp(a.title, b.title),
  author: (a, b) => cmp(lastName(a), lastName(b)) || cmp(a.title, b.title),
  rating: (a, b) => (b.rating || 0) - (a.rating || 0) || cmp(a.title, b.title),
  series: (a, b) => {
    const ka = seriesKey(a), kb = seriesKey(b);
    if (ka && !kb) return -1;
    if (!ka && kb) return 1;
    return cmp(ka, kb) || seriesNr(a) - seriesNr(b) || cmp(a.title, b.title);
  }
};

function matches(b, query, label, genre) {
  if (statusFilter !== 'all' && b.status !== statusFilter) return false;
  if (!matchesLabel(b, label) || !matchesGenre(b, genre)) return false;
  if (query) {
    const hay = [b.title, b.authors.join(' '), b.series ? b.series.name : '', b.genre, b.isbn, b.tags.join(' ')].join(' ').toLowerCase();
    if (!hay.includes(query)) return false;
  }
  return true;
}

export function renderLibrary() {
  fillLabelSelect($('#labelFilter'), 'Alle Listen und Tags');
  fillGenreSelect($('#genreFilter'), 'Alle Genres', 'Ohne Genre', $('#genreFilterWrap'));
  const query = $('#q').value.trim().toLowerCase();
  const label = $('#labelFilter').value;
  const genre = $('#genreFilter').value;
  const list = store.db.books.filter(b => matches(b, query, label, genre)).sort(SORTERS[$('#sortSel').value]);

  $('#bookList').innerHTML = list.map(bookTile).join('');

  // Filter button: number of active filters (sorting does not count)
  const active = [statusFilter !== 'all', label, genre].filter(Boolean).length;
  $('#filterBtn').classList.toggle('on', active > 0);
  $('#filterBadge').textContent = active;
  $('#filterBadge').hidden = !active;
  $('#filterBtn').setAttribute('aria-label', active ? `Filtern und sortieren, ${active} aktiv` : 'Filtern und sortieren');

  // Counter at the top: with an active filter or search only the books shown
  const total = store.db.books.length;
  const filtered = statusFilter !== 'all' || query || label || genre;
  $('#count').textContent = filtered
    ? `${list.length} von ${total} Büchern`
    : `${total} ${total === 1 ? 'Buch' : 'Bücher'}`;

  const empty = $('#emptyLib');
  if (!store.db.books.length) {
    empty.innerHTML = emptyState('Dein Regal ist noch leer', 'Tippe auf + und scanne die ISBN auf der Rückseite eines Buches.');
  } else if (!list.length) {
    empty.innerHTML = emptyState('Keine Treffer', 'Ändere die Suche oder die Filter.');
  }
  empty.hidden = list.length > 0;
}

function setStatus(status) {
  statusFilter = status;
  $$('#statusFilter button').forEach(x => x.setAttribute('aria-pressed', x.dataset.s === status));
}

// Back to all books, newest first
function resetFilters() {
  setStatus('all');
  $('#genreFilter').value = '';
  $('#labelFilter').value = '';
  $('#sortSel').value = 'added';
  renderLibrary();
}

export function initLibrary() {
  // Changes in the filter sheet apply right away, so the list behind it updates live
  $('#filterBtn').addEventListener('click', () => $('#dlgFilter').showModal());
  $('#filterReset').addEventListener('click', resetFilters);
  $('#statusFilter').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    setStatus(btn.dataset.s);
    renderLibrary();
  });
  $('#q').addEventListener('input', renderLibrary);
  $('#labelFilter').addEventListener('change', renderLibrary);
  $('#genreFilter').addEventListener('change', renderLibrary);
  $('#sortSel').addEventListener('change', renderLibrary);
  $('#bookList').addEventListener('click', e => {
    const row = e.target.closest('.book');
    if (row) openEdit(row.dataset.id);
  });
}
