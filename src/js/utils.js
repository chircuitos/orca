export function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function formatCNPJ(v) {
  if (!v || v.length !== 14) return v || '—';
  return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function formatCPF(v) {
  if (!v || v.length !== 11) return v || '—';
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatCEP(v) {
  if (!v || v.length !== 8) return v || '—';
  return v.replace(/(\d{5})(\d{3})/, '$1-$2');
}

export function panelField(label, value) {
  return `<div class="panel-field"><div class="panel-label">${escHtml(label)}</div><div class="panel-value${value ? '' : ' empty'}">${value ? escHtml(String(value)) : '—'}</div></div>`;
}
