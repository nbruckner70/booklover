// Einstiegspunkt: verbindet alle Teile und startet die App.
import { $, $$, on } from './ui.js';
import { initLibrary, renderLibrary } from './views/library.js';
import { initSeries, renderSeries } from './views/series.js';
import { initRandom, renderRandom, resetPick } from './views/random.js';
import { initSettings, renderSettings } from './views/settings.js';
import { initEdit } from './dialogs/edit.js';
import { initAdd } from './dialogs/add.js';
import { loadAll as loadCovers } from './covers.js';

const VIEWS = {
  library:  { title: 'Bibliothek',    render: renderLibrary,  fab: true },
  series:   { title: 'Reihen',        render: renderSeries,   fab: true },
  random:   { title: 'Zufall',        render: renderRandom,   fab: false },
  settings: { title: 'Einstellungen', render: renderSettings, fab: false }
};
let current = 'library';

function renderAll() {
  $('#count').textContent = ''; // die Bibliothek setzt ihren Zähler selbst
  VIEWS[current].render();
}

function show(view) {
  current = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + view));
  $$('.tabs button').forEach(b => b.dataset.view === view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#viewTitle').textContent = VIEWS[view].title;
  $('#fab').hidden = !VIEWS[view].fab;
  if (view !== 'random') resetPick();
  renderAll();
  window.scrollTo(0, 0);
}

// Navigation
$$('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));

// Schließen-Buttons in allen Dialogen
$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

// Cover, die nicht laden, durch Initialen ersetzen
document.addEventListener('error', e => {
  const img = e.target;
  if (img.tagName !== 'IMG' || img.dataset.fallback === undefined) return;
  img.parentNode.classList.remove('has-img');
  img.replaceWith(document.createTextNode(img.dataset.fallback));
}, true);

// Nach jeder Datenänderung neu zeichnen
on('changed', () => { resetPick(); renderAll(); });

initLibrary();
initSeries();
initRandom();
initSettings();
initEdit();
initAdd();

// Chrome bitten, die Daten nicht automatisch zu löschen; Offline-Betrieb aktivieren
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

renderAll();
loadCovers().then(renderAll); // eigene Fotos nachladen und anzeigen
