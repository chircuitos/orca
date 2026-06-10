export function openModal(id) {
  document.getElementById(id).classList.add('open');
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

export function blockUI(msg = 'Processando…') {
  document.getElementById('block-msg').textContent = msg;
  document.getElementById('block-overlay').classList.add('active');
}

export function unblockUI() {
  document.getElementById('block-overlay').classList.remove('active');
}

export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
