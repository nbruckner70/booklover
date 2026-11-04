// Ansicht "Lesen": gelesene Seiten pro Tag eintragen und im Monatskalender ansehen.
import { $, esc, toast } from '../ui.js';
import { store, addReading, deleteReading } from '../store.js';
import { isoDay, pagesByDay, monthGrid, readingStreak } from '../logic.js';
import { calendar, readingStats, dayEntries, longDay, monthTitle } from '../templates.js';

let year = new Date().getFullYear(), month = new Date().getMonth(); // angezeigter Monat
let selected = isoDay();  // angetippter Tag
let chosenBook = null;    // zuletzt gewähltes Buch; null = noch nichts gewählt

const bookTitle = id => (store.db.books.find(b => b.id === id) || {}).title || '';

// Bücher zur Auswahl: zuerst die, die gerade gelesen werden.
// Vorausgewählt ist das zuletzt gewählte Buch, sonst das erste, das gerade gelesen wird.
function fillBookSelect() {
  const sel = $('#logBook');
  const byTitle = (a, b) => a.title.localeCompare(b.title, 'de');
  const reading = store.db.books.filter(b => b.status === 'reading').sort(byTitle);
  const others = store.db.books.filter(b => b.status !== 'reading').sort(byTitle);
  const opts = list => list.map(b => `<option value="${esc(b.id)}">${esc(b.title)}</option>`).join('');
  sel.innerHTML = '<option value="">Ohne bestimmtes Buch</option>' +
    (reading.length ? `<optgroup label="Lese gerade">${opts(reading)}</optgroup>` : '') +
    (others.length ? `<optgroup label="Weitere Bücher">${opts(others)}</optgroup>` : '');
  const known = chosenBook !== null && [...sel.options].some(o => o.value === chosenBook);
  sel.value = known ? chosenBook : (reading[0] ? reading[0].id : '');
}

export function renderReading() {
  const today = isoDay();
  const entries = store.db.reading;
  const byDay = pagesByDay(entries);
  const days = monthGrid(year, month);
  const inMonth = days.filter(d => d && byDay[d]);

  fillBookSelect();
  $('#logDate').max = today;
  if (!$('#logDate').value) $('#logDate').value = selected;

  $('#logStats').innerHTML = readingStats(inMonth.reduce((s, d) => s + byDay[d], 0), inMonth.length, readingStreak(byDay));
  $('#calTitle').textContent = monthTitle(year, month);
  const now = new Date();
  $('#calNext').disabled = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());
  $('#cal').innerHTML = calendar(days, byDay, selected, today);
  $('#dayDetail').innerHTML = dayEntries(selected, entries.filter(e => e.date === selected), bookTitle);
}

function shiftMonth(step) {
  const d = new Date(year, month + step, 1);
  year = d.getFullYear();
  month = d.getMonth();
  renderReading();
}

function selectDay(day) {
  selected = day;
  $('#logDate').value = day;
  const d = new Date(day + 'T00:00');
  year = d.getFullYear();
  month = d.getMonth();
  renderReading();
}

function submit(e) {
  e.preventDefault();
  const pages = parseInt($('#logPages').value);
  const date = $('#logDate').value;
  if (!(pages > 0)) { toast('Bitte eine Seitenzahl eintragen.'); $('#logPages').focus(); return; }
  if (!date || date > isoDay()) { toast('Bitte einen Tag bis heute wählen.'); return; }
  addReading(date, pages, $('#logBook').value);
  $('#logPages').value = '';
  $('#logPages').blur();
  toast(`${pages} ${pages === 1 ? 'Seite' : 'Seiten'} am ${longDay(date)} eingetragen`);
  selectDay(date);
}

export function initReading() {
  $('#logForm').addEventListener('submit', submit);
  $('#logBook').addEventListener('change', e => { chosenBook = e.target.value; });
  $('#calPrev').addEventListener('click', () => shiftMonth(-1));
  $('#calNext').addEventListener('click', () => shiftMonth(1));
  $('#cal').addEventListener('click', e => {
    const day = e.target.closest('[data-day]');
    if (day) selectDay(day.dataset.day);
  });
  $('#dayDetail').addEventListener('click', e => {
    const btn = e.target.closest('[data-delete]');
    if (!btn || !confirm('Diesen Eintrag löschen?')) return;
    deleteReading(btn.dataset.delete);
    toast('Eintrag gelöscht');
    renderReading();
  });
}
