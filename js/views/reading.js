// Ansicht "Lesen": gelesene Seiten pro Tag eintragen und im Monatskalender ansehen.
import { $, toast } from '../ui.js';
import { store, addReading, deleteReading } from '../store.js';
import { isoDay, pagesByDay, monthGrid, readingStreak } from '../logic.js';
import { calendar, readingStats, dayEntries, longDay, monthTitle, pickedBook, bookHits } from '../templates.js';

let year = new Date().getFullYear(), month = new Date().getMonth(); // angezeigter Monat
let selected = isoDay();  // angetippter Tag
let chosenBook = null;    // null = noch nichts gewählt, '' = bewusst ohne Buch, sonst Buch-ID

const findBook = id => store.db.books.find(b => b.id === id);
const bookTitle = id => (findBook(id) || {}).title || '';
const byTitle = (a, b) => a.title.localeCompare(b.title, 'de');
const readingNow = () => store.db.books.filter(b => b.status === 'reading').sort(byTitle);

// Ohne eigene Wahl ist das erste Buch vorausgewählt, das gerade gelesen wird.
function currentBook() {
  if (chosenBook === null) return readingNow()[0] || null;
  return chosenBook ? findBook(chosenBook) || null : null;
}

// Suche nach Titel, Autor oder Reihe; alle eingegebenen Wörter müssen vorkommen.
// Bücher, die gerade gelesen werden, und Titel mit passendem Anfang stehen oben.
function searchBooks(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = b => [b.title, b.authors.join(' '), b.series ? b.series.name : ''].join(' ').toLowerCase();
  const starts = b => b.title.toLowerCase().startsWith(words[0]);
  return store.db.books.filter(b => words.every(w => hay(b).includes(w)))
    .sort((a, b) => (b.status === 'reading') - (a.status === 'reading') || starts(b) - starts(a) || byTitle(a, b))
    .slice(0, 8);
}

// Gewähltes Buch anzeigen, sonst Suchfeld mit Treffern (ohne Suchwort: die Bücher, die gerade gelesen werden)
function renderBookPick() {
  const book = currentBook();
  const q = $('#logBookQ');
  const query = q.value.trim();
  $('#logBookChosen').innerHTML = book ? pickedBook(book) : '';
  q.hidden = !!book;
  $('#logBookHits').innerHTML = book ? ''
    : query ? bookHits(searchBooks(query), '', 'Kein passendes Buch gefunden.')
    : bookHits(readingNow(), 'Lese gerade', '');
}

function pickBook(id) {
  chosenBook = id;
  $('#logBookQ').value = '';
  renderBookPick();
}

export function renderReading() {
  const today = isoDay();
  const entries = store.db.reading;
  const byDay = pagesByDay(entries);
  const days = monthGrid(year, month);
  const inMonth = days.filter(d => d && byDay[d]);

  renderBookPick();
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
  addReading(date, pages, (currentBook() || {}).id || '');
  $('#logPages').value = '';
  $('#logPages').blur();
  toast(`${pages} ${pages === 1 ? 'Seite' : 'Seiten'} am ${longDay(date)} eingetragen`);
  selectDay(date);
}

export function initReading() {
  $('#logForm').addEventListener('submit', submit);
  $('#logBookQ').addEventListener('input', renderBookPick);
  $('#logBookQ').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // Enter wählt den ersten Treffer, statt das Formular abzuschicken
    const first = $('#logBookHits [data-pick]');
    if (first) pickBook(first.dataset.pick);
  });
  $('#logBookHits').addEventListener('click', e => {
    const hit = e.target.closest('[data-pick]');
    if (hit) pickBook(hit.dataset.pick);
  });
  $('#logBookChosen').addEventListener('click', e => {
    if (!e.target.closest('[data-clear]')) return;
    pickBook('');
    $('#logBookQ').focus();
  });
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
