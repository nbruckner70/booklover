// Dialog "Buch hinzufügen" und Kamera-Scanner.
import { $, toast, emit } from '../ui.js';
import { store, save, newBook, findByIsbn, QUICK_KEY } from '../store.js';
import { toIsbn13 } from '../logic.js';
import { lookup } from '../api.js';
import { openEdit } from './edit.js';

/* ---------- ISBN eingeben ---------- */
async function addByIsbn(raw) {
  const isbn = toIsbn13(raw);
  if (isbn.length !== 13) { toast('Das ist keine gültige ISBN (10 oder 13 Stellen).'); return; }

  const dupe = findByIsbn(isbn);
  if (dupe) {
    toast(`„${dupe.title}“ ist schon im Regal`);
    $('#dlgAdd').close();
    openEdit(dupe.id);
    return;
  }

  const btn = $('#isbnGo');
  btn.disabled = true; btn.textContent = 'Suche …';
  const info = await lookup(isbn);
  btn.disabled = false; btn.textContent = 'Suchen';

  $('#dlgAdd').close();
  if (!info) toast('Keine Buchdaten gefunden. Bitte Titel und Autor selbst eintragen.');
  openEdit(null, newBook({ isbn, ...(info || {}) }));
}

/* ---------- Scanner ---------- */
let stream = null, detector = null, scanning = false, busy = false;
let lastCode = '', lastTime = 0;

async function startScan() {
  if (!('BarcodeDetector' in window)) {
    toast('Dieser Browser kann keine Strichcodes lesen. Bitte die ISBN eintippen oder Chrome verwenden.');
    return;
  }
  try {
    detector = new BarcodeDetector({ formats: ['ean_13'] });
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
  } catch (e) {
    toast('Kein Kamerazugriff. Erlaube die Kamera in den Website-Einstellungen von Chrome.');
    return;
  }
  $('#dlgAdd').close();
  $('#scanLog').innerHTML = '';
  $('#scanStatus').textContent = 'Strichcode in den Rahmen halten';
  $('#dlgScan').showModal();
  const video = $('#video');
  video.srcObject = stream;
  await video.play();
  scanning = true;
  tick();
}

async function tick() {
  if (!scanning) return;
  if (!busy) {
    try {
      const codes = await detector.detect($('#video'));
      const hit = codes.find(c => /^97[89]\d{10}$/.test(c.rawValue));
      if (hit) handleCode(hit.rawValue);
    } catch (e) { /* einzelnes Bild nicht lesbar */ }
  }
  setTimeout(tick, 180);
}

function stopCamera() {
  scanning = false;
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
}

function logLine(text) {
  const li = document.createElement('li');
  li.textContent = text;
  $('#scanLog').prepend(li);
}

async function handleCode(isbn) {
  const now = Date.now();
  if (isbn === lastCode && now - lastTime < 4000) return; // gleiches Buch nicht doppelt
  lastCode = isbn; lastTime = now;
  if (navigator.vibrate) navigator.vibrate(50);

  // Normaler Modus: Scanner schließen und Buch zum Prüfen öffnen
  if (!$('#quickMode').checked) {
    $('#dlgScan').close();
    $('#isbnIn').value = isbn;
    $('#dlgAdd').showModal();
    addByIsbn(isbn);
    return;
  }

  // Schnell-Modus: direkt speichern und weiterscannen
  busy = true;
  const dupe = findByIsbn(isbn);
  if (dupe) {
    $('#scanStatus').textContent = 'Schon im Regal';
    logLine(`Schon da: ${dupe.title}`);
    busy = false;
    return;
  }
  $('#scanStatus').textContent = 'Suche Buchdaten …';
  const info = await lookup(isbn);
  const book = newBook({ isbn, ...(info || { title: `Unbekannt (ISBN ${isbn})` }) });
  store.db.books.push(book);
  save();
  $('#scanStatus').textContent = info ? 'Gespeichert. Nächstes Buch bitte.' : 'Ohne Daten gespeichert. Titel später ergänzen.';
  logLine(`${info ? '✓' : '?'} ${book.title}`);
  busy = false;
}

/* ---------- Verdrahtung ---------- */
export function initAdd() {
  $('#fab').addEventListener('click', () => { $('#isbnIn').value = ''; $('#dlgAdd').showModal(); });
  $('#manualBtn').addEventListener('click', () => { $('#dlgAdd').close(); openEdit(null, newBook()); });
  $('#isbnGo').addEventListener('click', () => addByIsbn($('#isbnIn').value));
  $('#isbnIn').addEventListener('keydown', e => { if (e.key === 'Enter') addByIsbn(e.target.value); });

  $('#scanBtn').addEventListener('click', startScan);
  $('#scanClose').addEventListener('click', () => $('#dlgScan').close());
  $('#dlgScan').addEventListener('close', () => { stopCamera(); emit('changed'); });

  const quick = $('#quickMode');
  try { quick.checked = localStorage.getItem(QUICK_KEY) === '1'; } catch (e) {}
  quick.addEventListener('change', () => {
    try { localStorage.setItem(QUICK_KEY, quick.checked ? '1' : '0'); } catch (e) {}
  });
}
