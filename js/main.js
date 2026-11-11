// Entry point: wires up all parts and starts the app.
import { $, $$, on } from './ui.js';
import { initLibrary, renderLibrary } from './views/library.js';
import { initSeries, renderSeries, closeSeries } from './views/series.js';
import { initReading, renderReading } from './views/reading.js';
import { initRandom, renderRandom, resetPick } from './views/random.js';
import { initSettings, renderSettings } from './views/settings.js';
import { initEdit } from './dialogs/edit.js';
import { initAdd } from './dialogs/add.js';
import { loadAll as loadCovers, LOCAL, NO_COVER } from './covers.js';
import { store, save } from './store.js';

const VIEWS = {
  library:  { title: 'Bibliothek',    render: renderLibrary,  fab: true },
  series:   { title: 'Reihen',        render: renderSeries,   fab: true },
  reading:  { title: 'Lesen',         render: renderReading,  fab: false },
  random:   { title: 'Zufall',        render: renderRandom,   fab: false },
  settings: { title: 'Einstellungen', render: renderSettings, fab: false }
};
let current = 'library';

function renderAll() {
  $('#count').textContent = ''; // the library sets its own counter
  VIEWS[current].render();
}

function show(view) {
  current = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + view));
  $$('.tabs button').forEach(b => b.dataset.view === view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#viewTitle').textContent = VIEWS[view].title;
  $('#fab').hidden = !VIEWS[view].fab;
  if (view !== 'random') resetPick();
  closeSeries();
  renderAll();
  window.scrollTo(0, 0);
}

// Navigation
$$('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));

// Close buttons in all dialogs
$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

// Cover that fails to load: try the next source, finally replace it with the initials
function nextCover(img) {
  const [src, ...rest] = img.dataset.next.split(' ').filter(Boolean);
  if (src) {
    img.dataset.next = rest.join(' ');
    img.dataset.switched = '1';
    img.src = src;
    return;
  }
  img.parentNode.classList.remove('has-img');
  img.replaceWith(document.createTextNode(img.dataset.fallback));
}

// Remember the working source on the book so it is not searched again next time
let saveTimer;
function rememberCover(img) {
  const b = store.db.books.find(x => x.id === img.dataset.id);
  if (!b || b.cover === LOCAL || b.cover === NO_COVER) return;
  b.cover = img.getAttribute('src');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 1000);
}

document.addEventListener('error', e => {
  const img = e.target;
  if (img.tagName === 'IMG' && img.dataset.fallback !== undefined) nextCover(img);
}, true);

document.addEventListener('load', e => {
  const img = e.target;
  if (img.tagName === 'IMG' && img.dataset.fallback !== undefined && img.dataset.switched) rememberCover(img);
}, true);

// Redraw after every data change
on('changed', () => { resetPick(); renderAll(); });

initLibrary();
initSeries();
initReading();
initRandom();
initSettings();
initEdit();
initAdd();

// Ask Chrome not to clear the data automatically; enable offline use
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

renderAll();
loadCovers().then(renderAll); // load own photos and show them
