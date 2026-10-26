// Ansicht "Einstellungen": Darstellung, Listen, Tags, Sicherung.
import { $, $$, toast, emit } from '../ui.js';
import { store, save, addList, addTag, replaceDb, normalize, blankDb, storedSizeKb } from '../store.js';
import { settingsItem } from '../templates.js';
import { exportCovers, importCovers, clearCovers, localCount } from '../covers.js';
import { cleanTitle, seriesKey } from '../logic.js';
import { VERSION } from '../version.js';

export function renderSettings() {
  const { books, lists, tags } = store.db;
  $('#setLists').innerHTML = lists.length
    ? lists.map(l => settingsItem(l.name, books.filter(b => b.lists.includes(l.id)).length, 'list', l.id)).join('')
    : '<p class="hint">Noch keine eigenen Listen.</p>';
  $('#setTags').innerHTML = tags.length
    ? tags.map(t => settingsItem(t, books.filter(b => b.tags.includes(t)).length, 'tag', t)).join('')
    : '<p class="hint">Noch keine Tags.</p>';
  const photos = localCount();
  $('#storeInfo').textContent = `${books.length} Bücher, etwa ${storedSizeKb()} KB Daten` +
    (photos ? `, dazu ${photos} ${photos === 1 ? 'eigenes Coverfoto' : 'eigene Coverfotos'}.` : '.');
}

/* ---------- Darstellung ---------- */
// Gleicher Schlüssel wie im Skript im <head> von index.html
const THEME_KEY = 'booklover-theme';

// '' = wie am Handy, 'light' oder 'dark' = fest gewählt
const currentTheme = () => document.documentElement.dataset.theme || '';

function renderTheme() {
  $$('#themeSel button').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === currentTheme()));
}

function setTheme(theme) {
  const root = document.documentElement;
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  try { theme ? localStorage.setItem(THEME_KEY, theme) : localStorage.removeItem(THEME_KEY); } catch (e) {}
  renderTheme();
}

function renameList(id) {
  const l = store.db.lists.find(x => x.id === id);
  const name = prompt('Neuer Name der Liste', l.name);
  if (name && name.trim()) { l.name = name.trim(); save(); emit('changed'); }
}

function deleteList(id) {
  const l = store.db.lists.find(x => x.id === id);
  if (!confirm(`Liste „${l.name}“ löschen? Die Bücher bleiben erhalten.`)) return;
  store.db.lists = store.db.lists.filter(x => x !== l);
  store.db.books.forEach(b => { b.lists = b.lists.filter(i => i !== id); });
  save(); emit('changed');
}

function renameTag(old) {
  const name = prompt('Neuer Name des Tags', old);
  if (!name || !name.trim() || name.trim() === old) return;
  const nn = name.trim();
  const swap = arr => [...new Set(arr.map(x => x === old ? nn : x))];
  store.db.tags = swap(store.db.tags);
  store.db.books.forEach(b => { b.tags = swap(b.tags); });
  save(); emit('changed');
}

function deleteTag(old) {
  if (!confirm(`Tag „${old}“ löschen? Die Bücher bleiben erhalten.`)) return;
  store.db.tags = store.db.tags.filter(x => x !== old);
  store.db.books.forEach(b => { b.tags = b.tags.filter(x => x !== old); });
  save(); emit('changed');
}

// Kürzt Titel aus Importen und übernimmt die Reihe aus dem Titel, wenn noch keine eingetragen ist.
function tidyTitles() {
  const changes = store.db.books
    .map(b => {
      const clean = cleanTitle(b.title);
      return { b, title: clean.title, series: seriesKey(b) ? null : clean.series };
    })
    .filter(c => c.title !== c.b.title || c.series);
  if (!changes.length) { toast('Alle Titel sind schon aufgeräumt.'); return; }
  const ex = changes.find(c => c.title !== c.b.title) || changes[0];
  const n = changes.length;
  const what = `${n} ${n === 1 ? 'Buch' : 'Bücher'}`;
  if (!confirm(`${what} aufräumen?\n\nZum Beispiel wird aus „${ex.b.title}“ der Titel „${ex.title}“.`)) return;
  changes.forEach(c => {
    c.b.title = c.title;
    if (c.series) c.b.series = c.series;
  });
  save();
  toast(`${what} aufgeräumt`);
  emit('changed');
}

async function exportBackup() {
  const data = { ...store.db, localCovers: await exportCovers() };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `booklover-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Sicherung exportiert');
}

async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    const photos = raw.localCovers || {};
    const data = normalize(raw);
    if (confirm(`Sicherung mit ${data.books.length} Büchern importieren? Die aktuellen Daten werden dabei ersetzt.`)) {
      replaceDb(data);
      await importCovers(photos);
      toast('Sicherung importiert');
      emit('changed');
    }
  } catch (err) {
    toast('Die Datei ist keine gültige Booklover-Sicherung.');
  }
  e.target.value = '';
}

export function initSettings() {
  $('#appVersion').textContent = VERSION;
  renderTheme();
  $('#themeSel').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) setTheme(btn.dataset.theme);
  });

  $('#v-settings').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const d = btn.dataset;
    if (d.renameList) renameList(d.renameList);
    if (d.deleteList) deleteList(d.deleteList);
    if (d.renameTag) renameTag(d.renameTag);
    if (d.deleteTag) deleteTag(d.deleteTag);
  });

  $('#newListBtn').addEventListener('click', () => {
    if (addList($('#newList').value)) { $('#newList').value = ''; renderSettings(); }
  });
  $('#newTagSetBtn').addEventListener('click', () => {
    if (addTag($('#newTagSet').value)) { $('#newTagSet').value = ''; renderSettings(); }
  });

  $('#tidyBtn').addEventListener('click', tidyTitles);
  $('#exportBtn').addEventListener('click', exportBackup);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', importBackup);

  $('#wipeBtn').addEventListener('click', () => {
    if (confirm('Wirklich alle Bücher, Listen und Tags löschen?') &&
        confirm('Sicher? Das lässt sich ohne Sicherung nicht rückgängig machen.')) {
      replaceDb(blankDb());
      clearCovers();
      toast('Alle Daten gelöscht');
      emit('changed');
    }
  });
}
