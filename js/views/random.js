// Ansicht "Zufall": zieht das nächste Buch unter Beachtung der Reihen.
import { $, $$, sleep, reduceMotion, toast, emit } from '../ui.js';
import { store, save } from '../store.js';
import { drawCandidates, seriesKey, seriesNr, booksOfSeries } from '../logic.js';
import { spine, pickCard } from '../templates.js';
import { fillLabelSelect } from './library.js';
import { openEdit } from '../dialogs/edit.js';

let lastPickId = null;
let currentPick = null;

const candidates = () => drawCandidates(store.db.books, $('#randFilter').value);

export function resetPick() {
  $('#pick').hidden = true;
  currentPick = null;
}

function renderPile(books) {
  $('#pile').innerHTML = books.map(spine).join('');
}

export function renderRandom() {
  fillLabelSelect($('#randFilter'), 'Alle ungelesenen Bücher');
  const cands = candidates();
  const unread = store.db.books.filter(b => b.status === 'unread').length;
  $('#randInfo').textContent = unread
    ? `${cands.length} von ${unread} ungelesenen Büchern kommen infrage. Bei Reihen zählt immer nur der nächste ungelesene Band.`
    : 'Keine ungelesenen Bücher im Regal.';
  $('#drawBtn').disabled = !cands.length;
  if ($('#pick').hidden) renderPile(cands.slice(0, 12));
}

// Erklärt, warum genau dieser Band einer Reihe gezogen wurde.
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
  p.innerHTML = pickCard(b, reason(b));
  p.hidden = false;
  p.classList.remove('show');
  void p.offsetWidth; // Animation neu starten
  p.classList.add('show');
  $('#pile').innerHTML = '';
}

async function draw() {
  const cands = candidates();
  if (!cands.length) return;

  // Nicht zweimal hintereinander dasselbe Buch
  const pool = cands.length > 1 ? cands.filter(b => b.id !== lastPickId) : cands;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  lastPickId = pick.id;

  // Stapel mit dem gezogenen Buch an zufälliger Stelle aufbauen
  resetPick();
  const pile = cands.filter(b => b !== pick).sort(() => Math.random() - .5).slice(0, 10);
  const pos = Math.floor(Math.random() * (pile.length + 1));
  pile.splice(pos, 0, pick);
  renderPile(pile);
  $('#drawBtn').disabled = true;

  if (!reduceMotion()) {
    const spines = $$('#pile .spine');
    for (let i = 0; i < 12; i++) {
      const s = spines[Math.floor(Math.random() * spines.length)];
      s.classList.add('flash');
      await sleep(60 + i * 8);
      s.classList.remove('flash');
    }
    const chosen = spines[pos];
    chosen.classList.add('flash');
    await sleep(350);
    chosen.classList.add('pulled');
    await sleep(450);
  }
  showPick(pick);
  $('#drawBtn').disabled = false;
}

export function initRandom() {
  $('#randFilter').addEventListener('change', () => { resetPick(); renderRandom(); });
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
