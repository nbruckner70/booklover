// "Zufall" (random) view: draws the next book, respecting series order.
import { $, toast, emit } from '../ui.js';
import { store, save } from '../store.js';
import { drawCandidates, seriesKey, seriesNr, booksOfSeries } from '../logic.js';
import { giftCard, pickCard } from '../templates.js';
import { fillLabelSelect, fillGenreSelect } from './library.js';
import { openEdit } from '../dialogs/edit.js';

let lastPickId = null;
let currentPick = null;

const candidates = () => drawCandidates(store.db.books, $('#randFilter').value, $('#randGenre').value);

export function resetPick() {
  $('#pick').hidden = true;
  currentPick = null;
}

export function renderRandom() {
  fillLabelSelect($('#randFilter'), 'Alle ungelesenen Bücher');
  fillGenreSelect($('#randGenre'), 'Alle Genres', '', $('#randGenreWrap'));
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
  $('#randGenre').addEventListener('change', () => { resetPick(); renderRandom(); });
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
