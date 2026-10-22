// Dialog "Buch bearbeiten" (auch für neue Bücher).
import { $, $$, esc, toast, emit } from '../ui.js';
import { store, save, addList, addTag } from '../store.js';
import { cleanIsbn, seriesKey, seriesNr, booksOfSeries } from '../logic.js';
import { cover, chip } from '../templates.js';

let editing = null;   // das Buch-Objekt, das gerade bearbeitet wird
let isNew = false;
let selLists, selTags, selStatus;

const field = id => $('#' + id);

function refreshSeriesNames() {
  const names = [...new Set(store.db.books.filter(seriesKey).map(b => b.series.name.trim()))].sort();
  $('#seriesNames').innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
}

function renderStatus() {
  $$('#fStatus button').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === selStatus));
}

function renderChips() {
  const { lists, tags } = store.db;
  $('#fLists').innerHTML = lists.length
    ? lists.map(l => chip(l.name, 'list', l.id, selLists.has(l.id))).join('')
    : '<span class="hint">Noch keine Listen</span>';
  $('#fTags').innerHTML = tags.length
    ? tags.map(t => chip(t, 'tag', t, selTags.has(t))).join('')
    : '<span class="hint">Noch keine Tags</span>';
}

function updateSeriesHint() {
  const key = field('fSeries').value.trim().toLowerCase();
  const hint = $('#seriesHint');
  field('fNr').placeholder = 'Band';
  if (!key) { hint.textContent = 'Gib allen Büchern einer Reihe denselben Namen und eine Band-Nummer.'; return; }
  const vols = booksOfSeries(store.db.books, key).filter(v => v !== editing);
  if (!vols.length) { hint.textContent = 'Neue Reihe.'; return; }
  hint.textContent = 'Schon im Regal: ' + vols.map(v => `Band ${v.series.nr || '?'}${v.status === 'read' ? ' (gelesen)' : ''}`).join(', ');
  const max = Math.max(0, ...vols.map(seriesNr).filter(isFinite));
  field('fNr').placeholder = `Band, z. B. ${max + 1}`;
}

// id: bestehendes Buch öffnen; fresh: neues (noch nicht gespeichertes) Buch-Objekt
export function openEdit(id, fresh) {
  isNew = !!fresh;
  editing = fresh || store.db.books.find(b => b.id === id);
  if (!editing) return;
  const b = editing;

  $('#editHead').textContent = isNew ? 'Neues Buch' : 'Buch bearbeiten';
  $('#editCoverWrap').innerHTML = cover(b, 'lg');
  field('fTitle').value = b.title;
  field('fAuthors').value = b.authors.join(', ');
  field('fSeries').value = b.series ? b.series.name : '';
  field('fNr').value = b.series ? b.series.nr : '';
  field('fIsbn').value = b.isbn;
  field('fYear').value = b.year;
  field('fPages').value = b.pages;
  field('fCover').value = b.cover;
  field('fNotes').value = b.notes;

  selLists = new Set(b.lists);
  selTags = new Set(b.tags);
  selStatus = b.status;
  $('#delBtn').hidden = isNew;

  refreshSeriesNames();
  renderChips();
  renderStatus();
  updateSeriesHint();
  $('#dlgEdit').showModal();
  $('#dlgEdit .sheet-body').scrollTop = 0;
}

function saveBook() {
  const b = editing;
  const title = field('fTitle').value.trim();
  if (!title) { toast('Bitte einen Titel eintragen.'); field('fTitle').focus(); return; }

  const seriesName = field('fSeries').value.trim();
  Object.assign(b, {
    title,
    authors: field('fAuthors').value.split(',').map(s => s.trim()).filter(Boolean),
    series: seriesName ? { name: seriesName, nr: field('fNr').value.trim().replace(',', '.') } : null,
    isbn: cleanIsbn(field('fIsbn').value),
    year: field('fYear').value.trim(),
    pages: field('fPages').value.trim(),
    cover: field('fCover').value.trim(),
    notes: field('fNotes').value,
    status: selStatus,
    lists: [...selLists],
    tags: [...selTags]
  });
  if (isNew) store.db.books.push(b);
  save();
  $('#dlgEdit').close();
  toast(isNew ? `„${b.title}“ hinzugefügt` : 'Gespeichert');
  emit('changed');
}

function deleteBook() {
  if (!confirm(`„${editing.title}“ wirklich löschen?`)) return;
  store.db.books = store.db.books.filter(b => b !== editing);
  save();
  $('#dlgEdit').close();
  toast('Buch gelöscht');
  emit('changed');
}

function toggleIn(set, value, chipEl) {
  set.has(value) ? set.delete(value) : set.add(value);
  chipEl.setAttribute('aria-pressed', set.has(value));
}

export function initEdit() {
  $('#fStatus').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) { selStatus = b.dataset.s; renderStatus(); }
  });
  $('#fLists').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (c) toggleIn(selLists, c.dataset.list, c);
  });
  $('#fTags').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (c) toggleIn(selTags, c.dataset.tag, c);
  });
  $('#fNewListBtn').addEventListener('click', () => {
    const l = addList(field('fNewList').value);
    if (l) { selLists.add(l.id); field('fNewList').value = ''; renderChips(); }
  });
  $('#fNewTagBtn').addEventListener('click', () => {
    const t = addTag(field('fNewTag').value);
    if (t) { selTags.add(t); field('fNewTag').value = ''; renderChips(); }
  });
  field('fSeries').addEventListener('input', updateSeriesHint);
  $('#saveBtn').addEventListener('click', saveBook);
  $('#delBtn').addEventListener('click', deleteBook);
}
