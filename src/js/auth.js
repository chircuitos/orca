import { SUPA_URL, SUPA_KEY } from './config.js';
import { state } from './state.js';
import { api } from './api.js';
import { toast } from './ui.js';
import { carregarPropostas } from './propostas.js';
import { carregarPessoas } from './pessoas.js';
import { carregarEmitentesBase, switchAdminTab } from './admin.js';
import { switchCapTab } from './capilaridade.js';

export async function login() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!email || !senha) { showLoginError('Preencha e-mail e senha.'); return; }
  const btn = document.getElementById('btn-login');
  btn.textContent = 'Entrando…';
  btn.disabled = true;
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Falha no login');
    state.sessionToken = data.access_token;
    const u = await api(`usuarios?id=eq.${data.user.id}&select=id,nome,sigla,is_admin,pode_criar_proposta,ativo`);
    if (!u?.length) throw new Error('Usuário não cadastrado no sistema.');
    if (!u[0].ativo) throw new Error('Usuário inativo. Contate o administrador.');
    state.currentUser = null;
    state.todasPropostas = [];
    state.todasPessoas = [];
    state.emitentesDoUsuario = [];
    state.todosEmitentes = [];
    document.getElementById('nav-admin').style.display = 'none';
    state.currentUser = u[0];
    iniciarApp();
  } catch (e) {
    showLoginError(e.message);
    btn.textContent = 'Entrar';
    btn.disabled = false;
  }
}

export function showLoginError(msg) {
  const e = document.getElementById('login-error');
  e.textContent = msg;
  e.style.display = 'block';
}

export function logout() {
  state.sessionToken = null;
  state.currentUser = null;
  state.todasPropostas = [];
  state.todasPessoas = [];
  state.emitentesDoUsuario = [];
  state.todosEmitentes = [];
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('user-info').style.display = 'none';
  document.getElementById('header-nav').style.display = 'none';
  document.getElementById('nav-sep').style.display = 'none';
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('status-badge').textContent = '● Desconectado';
  document.getElementById('status-badge').style.color = '';
  const btnLogin = document.getElementById('btn-login');
  btnLogin.textContent = 'Entrar';
  btnLogin.disabled = false;
  document.getElementById('nav-admin').style.display = 'none';
  document.getElementById('user-role-badge').style.display = 'none';
  document.getElementById('btn-nova-proposta').style.display = 'none';
  ['propostas','cadastros','admin','capilaridade'].forEach(s => {
    const el = document.getElementById('section-'+s);
    if (el) el.style.display = s === 'propostas' ? 'block' : 'none';
    const nb = document.getElementById('nav-'+s);
    if (nb) nb.classList.toggle('active', s === 'propostas');
  });
  document.getElementById('nav-cadastros').style.display = 'none';
  document.getElementById('nav-capilaridade').style.display = 'none';
  state.currentAdminTab = 'usuarios';
}

export async function iniciarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('user-avatar').textContent = state.currentUser.sigla.trim();
  document.getElementById('user-name').textContent = state.currentUser.nome;
  document.getElementById('user-info').style.display = 'flex';
  document.getElementById('header-nav').style.display = 'flex';
  document.getElementById('nav-sep').style.display = 'block';
  document.getElementById('status-badge').textContent = '● Online';
  document.getElementById('status-badge').style.color = 'var(--azul)';
  ['propostas','cadastros','admin','capilaridade'].forEach(s => {
    const el = document.getElementById('section-'+s);
    if (el) el.style.display = s === 'propostas' ? 'block' : 'none';
    const nb = document.getElementById('nav-'+s);
    if (nb) nb.classList.toggle('active', s === 'propostas');
  });
  if (state.currentUser.is_admin) {
    document.getElementById('nav-admin').style.display = 'flex';
    document.getElementById('nav-cadastros').style.display = 'flex';
    document.getElementById('nav-capilaridade').style.display = 'flex';
    document.getElementById('user-role-badge').style.display = 'inline';
  } else if (state.currentUser.pode_criar_proposta) {
    document.getElementById('nav-cadastros').style.display = 'flex';
    document.getElementById('nav-capilaridade').style.display = 'flex';
  }
  document.getElementById('btn-nova-proposta').style.display = state.currentUser.pode_criar_proposta ? '' : 'none';
  try {
    if (state.currentUser.is_admin) {
      state.emitentesDoUsuario = await api('emitentes?ativo=eq.true&select=id,prefixo,nome_fantasia,compartilha_davila') || [];
    } else {
      const assoc = await api(`usuarios_emitentes?usuario_id=eq.${state.currentUser.id}&select=emitentes(id,prefixo,nome_fantasia,compartilha_davila)`) || [];
      state.emitentesDoUsuario = assoc.map(a => a.emitentes).filter(Boolean);
    }
  } catch (e) {
    state.emitentesDoUsuario = [];
  }
  await Promise.all([carregarPropostas(), carregarEmitentesBase()]);
}

export async function showSection(sec) {
  if (sec === 'admin' && !state.currentUser?.is_admin) {
    toast('Acesso restrito a administradores.', 'warn');
    return;
  }
  if (sec === 'cadastros' && !state.currentUser?.is_admin && !state.currentUser?.pode_criar_proposta) {
    toast('Acesso restrito.', 'warn');
    return;
  }
  if (sec === 'capilaridade' && !state.currentUser?.is_admin && !state.currentUser?.pode_criar_proposta) {
    toast('Acesso restrito.', 'warn');
    return;
  }
  ['propostas','cadastros','admin','capilaridade'].forEach(s => {
    const el = document.getElementById('section-'+s);
    if (el) el.style.display = s === sec ? 'block' : 'none';
    const nb = document.getElementById('nav-'+s);
    if (nb) nb.classList.toggle('active', s === sec);
  });
  if (sec === 'cadastros' && !state.todasPessoas.length) await carregarPessoas();
  if (sec === 'admin') switchAdminTab(state.currentAdminTab || 'usuarios');
  if (sec === 'capilaridade') switchCapTab('parametros');
}
