// Kleine Hilfsfunktionen, die überall gebraucht werden.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// Einfacher Ereignis-Mechanismus, damit sich die Module nicht gegenseitig kennen müssen.
// "changed" bedeutet: Daten haben sich geändert, Ansicht neu zeichnen.
const listeners = {};
export function on(event, fn) { (listeners[event] ||= []).push(fn); }
export function emit(event, data) { (listeners[event] || []).forEach(fn => fn(data)); }
