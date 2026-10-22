// Ansicht "Einstellungen": Listen, Tags, Sicherung.
import { $, toast, emit } from '../ui.js';
import { store, save, addList, addTag, replaceDb, normalize, blankDb, storedSizeKb } from '../store.js';
import { settingsItem } from '../templates.js';

export function renderSettings() {
  const { books, lists, tags } = store.db;
  $('#setLists').innerHTML = lists.length
    ? lists.map(l => settingsItem(l.name, books.filter(b => b.lists.includes(l.id)).length, 'list', l.id)).join('')
    : '<p class="hint">Noch keine eigenen Listen.</p>';
  $('#setTags').innerHTML = tags.length
    ? tags.map(t => settingsItem(t, books.filter(b => b.tags.includes(t)).length, 'tag', t)).join('')
    : '<p class="hint">Noch keine Tags.</p>';
  $('#storeInfo').textContent = `${books.length} Bücher, etwa ${storedSizeKb()} KB Daten.`;
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

function exportBackup() {
  const blob = new Blob([JSON.stringify(store.db, null, 1)], { type: 'application/json' });
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
    const data = normalize(JSON.parse(await file.text()));
    if (confirm(`Sicherung mit ${data.books.length} Büchern importieren? Die aktuellen Daten werden dabei ersetzt.`)) {
      replaceDb(data);
      toast('Sicherung importiert');
      emit('changed');
    }
  } catch (err) {
    toast('Die Datei ist keine gültige Booklover-Sicherung.');
  }
  e.target.value = '';
}

export function initSettings() {
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

  $('#exportBtn').addEventListener('click', exportBackup);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', importBackup);

  $('#wipeBtn').addEventListener('click', () => {
    if (confirm('Wirklich alle Bücher, Listen und Tags löschen?') &&
        confirm('Sicher? Das lässt sich ohne Sicherung nicht rückgängig machen.')) {
      replaceDb(blankDb());
      toast('Alle Daten gelöscht');
      emit('changed');
    }
  });
}
