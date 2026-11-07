// Pembantu dialog dan isian formulir yang dipakai halaman Bestie Space.
import { el } from '../utils.js';

let seq = 0;

export function field(label, control, hint) {
  control.id = `fld-${++seq}`;
  return el('div', { className: 'field' },
    el('label', { htmlFor: control.id }, label), control,
    ...(hint ? [el('small', { className: 'field-hint' }, hint)] : []));
}

export function makeDialog(className, label, ...children) {
  const dialog = el('dialog', { className: `sheet ${className}`.trim() }, ...children);
  dialog.setAttribute('aria-label', label);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
