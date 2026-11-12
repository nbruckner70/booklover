// "Zufall" (random) view: draws the next book, respecting series order.
import { $, toast, emit } from '../ui.js';
import { store, save } from '../store.js';
import { drawCandidates, genresOf, seriesKey, seriesNr, booksOfSeries } from '../logic.js';
import { giftCard, pickCard, checkOption } from '../templates.js';
import { fillLabelSelect } from './library.js';
import { openEdit } from '../dialogs/edit.js';

let lastPickId = null;
let currentPick = null;
const selGenres = new Set(); // selected genre keys; empty = all genres

const candidates = () => drawCandidates(store.db.books, $('#randFilter').value, [...selGenres]);

// Genre dropdown with one checkbox per genre in use. Hidden while no book has a genre yet.
function renderGenreList() {
  const genres = genresOf(store.db.books);
  // Forget selected genres that no book has any more
  const inUse = new Set(genres.map(g => g.key));
  for (const key of selGenres) if (!inUse.has(key)) selGenres.delete(key);

  // Rebuilding the list would drop the keyboard focus, so put it back afterwards
  const list = $('#randGenre');
  const focused = list.contains(document.activeElement) ? document.activeElement.value : null;
  list.innerHTML = checkOption('Alle Genres', '', !selGenres.size, 'all')
    + genres.map(g => checkOption(g.name, g.key, selGenres.has(g.key))).join('');
  if (focused !== null) [...list.querySelectorAll('input')].find(i => i.value === focused)?.focus();

  // Closed dropdown: "Alle Genres", up to two names or the number of genres
  const names = genres.filter(g => selGenres.has(g.key)).map(g => g.name);
  $('#randGenreSum').textContent = !names.length ? 'Alle Genres'
    : names.length <= 2 ? names.join(', ')
    : `${names.length} Genres`;
  $('#randGenreWrap').hidden = !genres.length;
}

export function resetPick() {
  $('#pick').hidden = true;
  currentPick = null;
}

export function renderRandom() {
  fillLabelSelect($('#randFilter'), 'Alle ungelesenen Bücher');
  renderGenreList();
  const cands = candidates();
  const unread = store.db.books.filter(b => b.status === 'unread').length;
  $('#randInfo').textContent = unread
    ? `${cands.length} von ${unread} ungelesenen Büchern kommen infrage. Bei Reihen zählt immer nur der nächste ungelesene Band.`
    : 'Keine ungelesenen Bücher im Regal.';
  $('#drawBtn').disabled = !cands.length;

  // Until something is drawn, the wrapped gift is waiting
  if (!currentPick) {
    $('#pick').innerHTML = giftCard();
    $('#pick').hidden = !cands.length;
  }
}

// Explains why exactly this volume of a series was drawn.
function reason(b) {
  if (!seriesKey(b)) return '';
  const before = booksOfSeries(store.db.books, seriesKey(b))
    .filter(v => seriesNr(v) < seriesNr(b) && v.status === 'read').length;
  const intro = `Band ${b.series.nr || '?'} der Reihe „${b.series.name.trim()}“. `;
  if (before === 0) return intro + 'Damit fängt die Reihe für dich an.';
  if (before === 1) return intro + 'Den Band davor hast du schon gelesen.';
  return intro + `Die ${before} Bände davor hast du schon gelesen.`;
}

function showPick(b) {
  currentPick = b;
  const p = $('#pick');
  p.innerHTML = pickCard(b, reason(b)); // new gift that is unwrapped right away
  p.hidden = false;
}

function draw() {
  const cands = candidates();
  if (!cands.length) return;

  // Never the same book twice in a row
  const pool = cands.length > 1 ? cands.filter(b => b.id !== lastPickId) : cands;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  lastPickId = pick.id;
  showPick(pick);
}

export function initRandom() {
  $('#randFilter').addEventListener('change', () => { resetPick(); renderRandom(); });
  $('#randGenre').addEventListener('change', e => {
    const key = e.target.value;
    if (!key) selGenres.clear(); // "Alle Genres"
    else if (e.target.checked) selGenres.add(key);
    else selGenres.delete(key);
    resetPick();
    renderRandom();
  });
  // The dropdown stays open while ticking; it closes on a tap outside or with Escape
  const drop = $('#randGenreDrop');
  document.addEventListener('click', e => { if (drop.open && !drop.contains(e.target)) drop.open = false; });
  // The open list must end above the bottom navigation, so it may only be as tall as the space below it
  const fitList = () => {
    if (!drop.open) return;
    const list = $('#randGenre');
    const space = $('.tabs').getBoundingClientRect().top - list.getBoundingClientRect().top - 12;
    list.style.maxHeight = `${Math.max(space, 160)}px`;
  };
  drop.addEventListener('toggle', fitList);
  window.addEventListener('scroll', fitList, { passive: true });
  window.addEventListener('resize', fitList);
  drop.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drop.open) { drop.open = false; drop.querySelector('summary').focus(); }
  });
  $('#drawBtn').addEventListener('click', draw);
  $('#pick').addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action || !currentPick) return;
    if (action === 'start') {
      currentPick.status = 'reading';
      save();
      toast(`„${currentPick.title}“ steht jetzt auf „Lese gerade“`);
      emit('changed');
    }
    if (action === 'details') openEdit(currentPick.id);
  });
}
