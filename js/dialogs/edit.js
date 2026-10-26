// Dialog "Buch bearbeiten" (auch für neue Bücher).
import { $, $$, esc, toast, emit } from '../ui.js';
import { store, save, addList, addTag } from '../store.js';
import { cleanIsbn, seriesKey, seriesNr, booksOfSeries } from '../logic.js';
import { cover, coverSources, chip, ratingText } from '../templates.js';
import { LOCAL, NO_COVER, prepareImage, putCover, deleteCover } from '../covers.js';

let editing = null;   // das Buch-Objekt, das gerade bearbeitet wird
let isNew = false;
let selLists, selTags, selStatus, selRating;
// Cover-Änderung bis zum Speichern: null = keine, Blob = neues Foto, 'remove' = entfernen
let pendingCover = null, previewUrl = '';

const field = id => $('#' + id);

function refreshSeriesNames() {
  const names = [...new Set(store.db.books.filter(seriesKey).map(b => b.series.name.trim()))].sort();
  $('#seriesNames').innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
}

function renderStatus() {
  $$('#fStatus button').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === selStatus));
}

function renderRating() {
  $('#fRatingFill').style.width = `${selRating / 5 * 100}%`;
  $('#fRatingText').textContent = ratingText(selRating);
  $('#fRatingClear').hidden = !selRating;
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
  field('fCover').value = b.cover === LOCAL || b.cover === NO_COVER ? '' : b.cover;
  field('fNotes').value = b.notes;

  selLists = new Set(b.lists);
  selTags = new Set(b.tags);
  selStatus = b.status;
  selRating = b.rating || 0;
  $('#delBtn').hidden = isNew;
  pendingCover = null;
  clearPreviewUrl();
  $('#coverBtn').textContent = b.cover === LOCAL ? 'Foto ändern' : 'Eigenes Foto';
  $('#coverRemove').hidden = !coverSources(b).length;

  refreshSeriesNames();
  renderChips();
  renderStatus();
  renderRating();
  updateSeriesHint();
  $('#dlgEdit').showModal();
  $('#dlgEdit .sheet-body').scrollTop = 0;
}

function showCoverPreview(src) {
  $('#editCoverWrap').innerHTML = cover({ ...editing, title: field('fTitle').value || editing.title, cover: src }, 'lg');
  $('#coverBtn').textContent = src !== NO_COVER ? 'Foto ändern' : 'Eigenes Foto';
  $('#coverRemove').hidden = src === NO_COVER;
}

function clearPreviewUrl() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = '';
}

async function chooseCover(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    pendingCover = await prepareImage(file);
    clearPreviewUrl();
    previewUrl = URL.createObjectURL(pendingCover);
    field('fCover').value = '';
    showCoverPreview(previewUrl);
  } catch (err) {
    toast('Das Foto konnte nicht geladen werden.');
  }
}

function removeCover() {
  pendingCover = 'remove';
  clearPreviewUrl();
  field('fCover').value = '';
  showCoverPreview(NO_COVER);
}

// Ermittelt das Cover beim Speichern und räumt ein altes eigenes Foto weg, wenn es ersetzt wird.
async function resolveCover(b) {
  const hadLocal = b.cover === LOCAL;
  if (pendingCover instanceof Blob) { await putCover(b.id, pendingCover); return LOCAL; }
  if (pendingCover === 'remove') { if (hadLocal) await deleteCover(b.id); return NO_COVER; }
  const link = field('fCover').value.trim();
  if (b.cover === NO_COVER && !link) return NO_COVER; // bleibt ohne Cover
  if (hadLocal && !link) return LOCAL;          // eigenes Foto bleibt
  if (hadLocal && link) await deleteCover(b.id); // Link ersetzt das Foto
  return link;
}

async function saveBook() {
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
    notes: field('fNotes').value,
    status: selStatus,
    rating: selRating,
    lists: [...selLists],
    tags: [...selTags]
  });
  try { b.cover = await resolveCover(b); }
  catch (e) { toast('Das Foto konnte nicht gespeichert werden.'); }
  if (isNew) store.db.books.push(b);
  save();
  $('#dlgEdit').close();
  toast(isNew ? `„${b.title}“ hinzugefügt` : 'Gespeichert');
  emit('changed');
}

function deleteBook() {
  if (!confirm(`„${editing.title}“ wirklich löschen?`)) return;
  if (editing.cover === LOCAL) deleteCover(editing.id);
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
  // 10 unsichtbare Tippflächen über den Sternen: linke Hälfte = halber Stern, rechte = ganzer
  $('#fRatingHits').innerHTML = Array.from({ length: 10 }, (_, i) => {
    const v = (i + 1) / 2;
    return `<button type="button" data-v="${v}" aria-label="${ratingText(v)}"></button>`;
  }).join('');
  $('#fRatingHits').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const v = parseFloat(b.dataset.v);
    selRating = v === selRating ? 0 : v; // gleichen Wert nochmal tippen = entfernen
    renderRating();
  });
  $('#fRatingClear').addEventListener('click', () => { selRating = 0; renderRating(); });
  $('#coverBtn').addEventListener('click', () => $('#coverFile').click());
  $('#coverFile').addEventListener('change', chooseCover);
  $('#coverRemove').addEventListener('click', removeCover);
  $('#dlgEdit').addEventListener('close', clearPreviewUrl);
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
