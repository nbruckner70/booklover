// Ansicht "Bibliothek": Suche, Filter, Sortierung und Bücherliste.
import { $, $$ } from '../ui.js';
import { store } from '../store.js';
import { seriesKey, seriesNr } from '../logic.js';
import { bookRow, emptyState, labelOptions } from '../templates.js';
import { openEdit } from '../dialogs/edit.js';

let statusFilter = 'all';

// Füllt ein Auswahlfeld mit Listen und Tags und behält die aktuelle Auswahl bei.
export function fillLabelSelect(select, allText) {
  const current = select.value;
  select.innerHTML = labelOptions(store.db.lists, store.db.tags, allText);
  select.value = [...select.options].some(o => o.value === current) ? current : '';
}

const cmp = (a, b) => a.localeCompare(b, 'de');
const lastName = b => (b.authors[0] || '').split(/\s+/).pop().toLowerCase();

const SORTERS = {
  added: (a, b) => b.added - a.added,
  title: (a, b) => cmp(a.title, b.title),
  author: (a, b) => cmp(lastName(a), lastName(b)) || cmp(a.title, b.title),
  series: (a, b) => {
    const ka = seriesKey(a), kb = seriesKey(b);
    if (ka && !kb) return -1;
    if (!ka && kb) return 1;
    return cmp(ka, kb) || seriesNr(a) - seriesNr(b) || cmp(a.title, b.title);
  }
};

function matches(b, query, label) {
  if (statusFilter !== 'all' && b.status !== statusFilter) return false;
  if (label.startsWith('t:') && !b.tags.includes(label.slice(2))) return false;
  if (label.startsWith('l:') && !b.lists.includes(label.slice(2))) return false;
  if (query) {
    const hay = [b.title, b.authors.join(' '), b.series ? b.series.name : '', b.isbn, b.tags.join(' ')].join(' ').toLowerCase();
    if (!hay.includes(query)) return false;
  }
  return true;
}

export function renderLibrary() {
  fillLabelSelect($('#labelFilter'), 'Alle Listen und Tags');
  const query = $('#q').value.trim().toLowerCase();
  const label = $('#labelFilter').value;
  const list = store.db.books.filter(b => matches(b, query, label)).sort(SORTERS[$('#sortSel').value]);

  $('#bookList').innerHTML = list.map(bookRow).join('');

  const empty = $('#emptyLib');
  if (!store.db.books.length) {
    empty.innerHTML = emptyState('Dein Regal ist noch leer', 'Tippe auf + und scanne die ISBN auf der Rückseite eines Buchs.');
  } else if (!list.length) {
    empty.innerHTML = emptyState('Keine Treffer', 'Ändere die Suche oder die Filter.');
  }
  empty.hidden = list.length > 0;
}

export function initLibrary() {
  $('#statusFilter').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    statusFilter = btn.dataset.s;
    $$('#statusFilter button').forEach(x => x.setAttribute('aria-pressed', x === btn));
    renderLibrary();
  });
  $('#q').addEventListener('input', renderLibrary);
  $('#labelFilter').addEventListener('change', renderLibrary);
  $('#sortSel').addEventListener('change', renderLibrary);
  $('#bookList').addEventListener('click', e => {
    const row = e.target.closest('.book');
    if (row) openEdit(row.dataset.id);
  });
}
