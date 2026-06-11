import { state } from './state.js';
import { api } from './api.js';
import { escHtml, formatCNPJ } from './utils.js';
import { openModal, closeModal, blockUI, unblockUI, toast } from './ui.js';

// Module-level cache for numeracao table rows (avoids apostrophes in onclick)
let _gruposNumeracao = [];

export function switchAdminTab(tab) {
  state.currentAdminTab = tab;
  ['usuarios','emitentes','numeracao'].forEach(t => {
    document.getElementById('admtab-'+t).classList.toggle('active', t === tab);
    document.getElementById('admin-'+t).style.display = t === tab ? 'block' : 'none';
  });
  const subtitulos = { usuarios: 'Usuários', emitentes: 'Emitentes', numeracao: 'Numeração de Propostas' };
  document.getElementById('admin-subtitulo').textContent = subtitulos[tab];
  const btnTextos = { usuarios: '+ Novo Usuário', emitentes: '+ Novo Emitente', numeracao: '+ Configurar Grupo' };
  document.getElementById('btn-novo-admin').textContent = btnTextos[tab];
  document.getElementById('btn-novo-admin').onclick =
    tab === 'usuarios' ? abrirModalNovoUsuario :
    tab === 'numeracao' ? () => abrirModalNumeracao() :
    () => abrirModalNovoEmitente();
  if (tab === 'usuarios') carregarUsuariosAdmin();
  else if (tab === 'emitentes') carregarEmitentesAdmin();
  else carregarNumeracaoAdmin();
}

export function abrirModalNovoAdmin() {
  if (state.currentAdminTab === 'usuarios') abrirModalNovoUsuario();
  else if (state.currentAdminTab === 'numeracao') abrirModalNumeracao();
  else abrirModalNovoEmitente();
}

export async function carregarNumeracaoAdmin() {
  document.getElementById('admin-numeracao-body').innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    const anoAtual = new Date().getFullYear();
    const grupos = await api('grupos_numeracao?select=id,nome,prefixo') || [];
    const emitentes = await api('emitentes?select=id,nome_fantasia,prefixo,grupo_numeracao_id') || [];
    const configs = await api('contadores_numeracao_config?select=*') || [];
    const contadores = await api('contadores_numeracao?select=*') || [];
    const props = await api(`propostas?select=id,emitente_id,ano&ano=eq.${anoAtual}`) || [];

    _gruposNumeracao = grupos.map(g => {
      const emitsDoGrupo = emitentes.filter(e => e.grupo_numeracao_id === g.id);
      const emitIds = emitsDoGrupo.map(e => e.id);
      const cfg = configs.find(c => c.grupo_id === g.id && c.ano === anoAtual);
      const cnt = contadores.find(c => c.grupo_id === g.id && c.ano === anoAtual);
      const numInicial = cfg ? cfg.numero_inicial : 0;
      const ultimoContador = cnt ? cnt.ultimo_numero : 0;
      const propsGrupo = props.filter(p => emitIds.includes(p.emitente_id));
      return {
        id: g.id, nome: g.nome, prefixo: g.prefixo,
        emitNomes: emitsDoGrupo.map(e => e.nome_fantasia || e.prefixo).join(', ') || '—',
        numInicial, ultimoContador,
        temPropostas: propsGrupo.length > 0,
        qtdPropostas: propsGrupo.length,
      };
    });

    const tbody = document.getElementById('admin-numeracao-body');
    let html = '';
    _gruposNumeracao.forEach((g, idx) => {
      const proxNum = g.ultimoContador > 0 ? g.ultimoContador + 1 : g.numInicial + 1;
      const proxFormatado = `${g.prefixo}-ORC-${String(anoAtual).slice(-2)}${String(proxNum).padStart(3,'0')}`;
      html += `<tr>
        <td style="font-weight:700">${escHtml(g.nome)}</td>
        <td style="font-size:12px;color:var(--text2)">${escHtml(g.emitNomes)}</td>
        <td style="font-family:monospace;font-weight:700">${anoAtual}</td>
        <td style="font-family:monospace;font-size:14px;font-weight:800;color:var(--azul)">${g.numInicial || '—'}</td>
        <td><span class="prop-num">${proxFormatado}</span></td>
        <td style="text-align:center">${g.temPropostas ? `<span class="pill-ativo">${g.qtdPropostas}</span>` : '<span style="color:var(--text3);font-size:12px">Nenhuma</span>'}</td>
        <td><div class="row-actions">
          <button class="icon-btn btn-sm" onclick="abrirModalNumeracaoIdx(${idx},${anoAtual})" title="${g.temPropostas ? 'Contador já iniciado — cuidado ao alterar' : 'Configurar número inicial'}">
            ${g.temPropostas ? '⚠️' : '✏️'}
          </button>
        </div></td>
      </tr>`;
    });
    tbody.innerHTML = html || '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🔢</div><div class="empty-title">Nenhum grupo</div></div></td></tr>';
  } catch (e) {
    document.getElementById('admin-numeracao-body').innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><div class="empty-sub">${escHtml(e.message)}</div></div></td></tr>`;
  }
}

export function abrirModalNumeracaoIdx(idx, ano) {
  const g = _gruposNumeracao[idx];
  if (!g) return;
  abrirModalNumeracao(g.id, g.nome, g.prefixo, g.numInicial, ano, g.temPropostas);
}

export function abrirModalNumeracao(grupoId = null, grupoNome = '', prefixo = '', numInicial = 0, ano = new Date().getFullYear(), temPropostas = false) {
  state.editandoNumeracaoGrupoId = grupoId;
  document.getElementById('modal-numeracao-title').textContent = grupoId ? `Configurar — ${grupoNome}` : 'Configurar Numeração';
  document.getElementById('num-grupo').value = grupoNome;
  document.getElementById('num-ano').value = ano;
  document.getElementById('num-inicial').value = numInicial || '';
  document.getElementById('num-obs').value = '';
  atualizarPreviewNumeracao(prefixo, ano, numInicial);
  document.getElementById('num-inicial').oninput = () => {
    atualizarPreviewNumeracao(prefixo, parseInt(document.getElementById('num-ano').value) || ano, parseInt(document.getElementById('num-inicial').value) || 0);
  };
  document.getElementById('num-ano').oninput = () => {
    atualizarPreviewNumeracao(prefixo, parseInt(document.getElementById('num-ano').value) || ano, parseInt(document.getElementById('num-inicial').value) || 0);
  };
  if (temPropostas) {
    document.getElementById('num-preview').style.background = '#fff8e1';
    document.getElementById('num-preview').style.borderColor = '#f5c842';
    document.getElementById('num-preview').innerHTML = '⚠️ <strong>Atenção:</strong> este grupo já possui propostas no Orca para este ano. Alterar o número inicial pode gerar conflitos de numeração. Prossiga somente se souber o que está fazendo.<br><br>Próxima proposta: <strong id="num-preview-text">—</strong>';
  } else {
    document.getElementById('num-preview').style.background = '';
    document.getElementById('num-preview').style.borderColor = '';
    document.getElementById('num-preview').innerHTML = 'A próxima proposta será: <strong id="num-preview-text">—</strong>';
  }
  atualizarPreviewNumeracao(prefixo, ano, numInicial);
  openModal('modal-numeracao');
}

export function atualizarPreviewNumeracao(prefixo, ano, numInicial) {
  const prox = numInicial + 1;
  const txt = document.getElementById('num-preview-text');
  if (txt) txt.textContent = `${prefixo}-ORC-${String(ano).slice(-2)}${String(prox).padStart(3,'0')}`;
}

export async function salvarNumeracao() {
  if (!state.editandoNumeracaoGrupoId) { toast('Selecione um grupo', 'error'); return; }
  const ano = parseInt(document.getElementById('num-ano').value);
  const numInicial = parseInt(document.getElementById('num-inicial').value) || 0;
  const obs = document.getElementById('num-obs').value.trim() || null;
  if (!ano || ano < 2020 || ano > 2099) { toast('Ano inválido', 'error'); return; }
  if (numInicial < 0 || numInicial > 998) { toast('Número deve estar entre 0 e 998', 'error'); return; }
  blockUI('Salvando configuração…');
  try {
    const existingCfg = await api(`contadores_numeracao_config?grupo_id=eq.${state.editandoNumeracaoGrupoId}&ano=eq.${ano}&select=id`);
    if (existingCfg && existingCfg.length) {
      await api(`contadores_numeracao_config?id=eq.${existingCfg[0].id}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body: JSON.stringify({ numero_inicial: numInicial, observacao: obs }),
      });
    } else {
      await api('contadores_numeracao_config', {
        method: 'POST', prefer: 'return=minimal',
        body: JSON.stringify({ grupo_id: state.editandoNumeracaoGrupoId, ano, numero_inicial: numInicial, observacao: obs, criado_por: state.currentUser.id }),
      });
    }
    const cnt = await api(`contadores_numeracao?grupo_id=eq.${state.editandoNumeracaoGrupoId}&ano=eq.${ano}&select=id,ultimo_numero`);
    if (cnt && cnt.length && cnt[0].ultimo_numero <= numInicial) {
      await api(`contadores_numeracao?id=eq.${cnt[0].id}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body: JSON.stringify({ ultimo_numero: numInicial }),
      });
    }
    toast('Configuração salva ✓', 'success');
    closeModal('modal-numeracao');
    await carregarNumeracaoAdmin();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
  unblockUI();
}

export async function carregarUsuariosAdmin() {
  document.getElementById('admin-usuarios-body').innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    const us = await api('usuarios?select=id,nome,sigla,email,is_admin,pode_criar_proposta,ativo,usuarios_emitentes!usuarios_emitentes_usuario_id_fkey(emitente_id,emitentes(nome_fantasia,prefixo))&order=nome') || [];
    const tbody = document.getElementById('admin-usuarios-body');
    if (!us.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Nenhum usuário</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = us.map(u => {
      const emits = (u.usuarios_emitentes || []).map(ue => `<span class="emit-tag" style="margin:1px">${escHtml(ue.emitentes?.nome_fantasia || ue.emitentes?.prefixo || '?')}</span>`).join(' ') || '<span style="color:var(--text3);font-size:12px">—</span>';
      const isMe = u.id === state.currentUser.id;
      return `<tr>
        <td><span class="pill-sigla">${escHtml(u.sigla.trim())}</span></td>
        <td style="font-weight:700">${escHtml(u.nome)}${isMe ? ' <span style="font-size:10px;color:var(--azul);font-weight:800">(você)</span>' : ''}</td>
        <td style="font-size:12px;color:var(--text2)">${escHtml(u.email)}</td>
        <td>${u.is_admin ? '<span class="pill-admin">Admin</span> ' : ''}<span style="font-size:11px;color:var(--text2)">${u.pode_criar_proposta ? 'Criador' : ''}</span></td>
        <td>${emits}</td>
        <td>${u.ativo ? '<span class="pill-ativo">Ativo</span>' : '<span class="pill-inativo">Inativo</span>'}</td>
        <td><div class="row-actions">
          <button class="icon-btn btn-sm" onclick="abrirModalEditarUsuario('${u.id}')">✏️</button>
          ${!isMe ? `<button class="icon-btn btn-sm del" onclick="toggleAtivoUsuario('${u.id}',${u.ativo},'${escHtml(u.nome)}')">${u.ativo ? '🚫' : '✅'}</button>` : ''}
        </div></td>
      </tr>`;
    }).join('');
  } catch (e) {
    document.getElementById('admin-usuarios-body').innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><div class="empty-sub">${escHtml(e.message)}</div></div></td></tr>`;
  }
}

export async function abrirModalNovoUsuario() {
  state.editandoUsuarioId = null;
  document.getElementById('modal-usuario-title').textContent = 'Novo Usuário';
  ['u-uuid','u-nome','u-sigla','u-email'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('u-uuid').disabled = false;
  document.getElementById('u-admin').checked = false;
  document.getElementById('u-criador').checked = true;
  await carregarEmitentesModalUsuario([]);
  openModal('modal-usuario');
}

export async function abrirModalEditarUsuario(id) {
  state.editandoUsuarioId = id;
  document.getElementById('modal-usuario-title').textContent = 'Editar Usuário';
  try {
    const res = await api(`usuarios?id=eq.${id}&select=id,nome,sigla,email,is_admin,pode_criar_proposta,usuarios_emitentes!usuarios_emitentes_usuario_id_fkey(emitente_id)`);
    const u = res[0];
    document.getElementById('u-uuid').value = u.id;
    document.getElementById('u-uuid').disabled = true;
    document.getElementById('u-nome').value = u.nome;
    document.getElementById('u-sigla').value = u.sigla.trim();
    document.getElementById('u-email').value = u.email;
    document.getElementById('u-admin').checked = u.is_admin;
    document.getElementById('u-criador').checked = u.pode_criar_proposta;
    await carregarEmitentesModalUsuario((u.usuarios_emitentes || []).map(ue => ue.emitente_id));
    openModal('modal-usuario');
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
}

export async function carregarEmitentesModalUsuario(selecionados) {
  const lista = document.getElementById('u-emitentes-list');
  lista.innerHTML = state.todosEmitentes.map(e => `<label class="emit-check-item"><input type="checkbox" name="u-emit" value="${e.id}" ${selecionados.includes(e.id) ? 'checked' : ''}>${escHtml(e.nome_fantasia || e.prefixo)}</label>`).join('') || '<span style="color:var(--text3);font-size:12px">Nenhum emitente</span>';
}

export async function salvarUsuario() {
  const uuid = document.getElementById('u-uuid').value.trim();
  const nome = document.getElementById('u-nome').value.trim();
  const sigla = document.getElementById('u-sigla').value.trim().toUpperCase();
  const email = document.getElementById('u-email').value.trim().toLowerCase();
  const isAdm = document.getElementById('u-admin').checked;
  const isCri = document.getElementById('u-criador').checked;
  if (!nome) { toast('Informe o nome', 'error'); return; }
  if (sigla.length < 2 || sigla.length > 3) { toast('A sigla deve ter 2 ou 3 caracteres', 'error'); return; }
  if (!email) { toast('Informe o e-mail', 'error'); return; }
  const emitsSel = [...document.querySelectorAll('input[name="u-emit"]:checked')].map(i => i.value);
  blockUI('Salvando usuário…');
  try {
    if (!state.editandoUsuarioId) {
      if (!uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) throw new Error('UUID inválido.');
      await api('usuarios', { method: 'POST', body: JSON.stringify({ id: uuid, nome, sigla, email, is_admin: isAdm, pode_criar_proposta: isCri, criado_por: state.currentUser.id }) });
      if (emitsSel.length) await api('usuarios_emitentes', { method: 'POST', body: JSON.stringify(emitsSel.map(eid => ({ usuario_id: uuid, emitente_id: eid, criado_por: state.currentUser.id }))) });
    } else {
      await api(`usuarios?id=eq.${state.editandoUsuarioId}`, { method: 'PATCH', body: JSON.stringify({ nome, sigla, email, is_admin: isAdm, pode_criar_proposta: isCri }) });
      await api(`usuarios_emitentes?usuario_id=eq.${state.editandoUsuarioId}`, { method: 'DELETE', prefer: 'return=minimal' });
      if (emitsSel.length) await api('usuarios_emitentes', { method: 'POST', body: JSON.stringify(emitsSel.map(eid => ({ usuario_id: state.editandoUsuarioId, emitente_id: eid, criado_por: state.currentUser.id }))) });
    }
    toast('Usuário salvo ✓', 'success');
    closeModal('modal-usuario');
    await carregarUsuariosAdmin();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
  unblockUI();
}

export async function toggleAtivoUsuario(id, ativo, nome) {
  if (!confirm(`Deseja ${ativo ? 'inativar' : 'reativar'} "${nome}"?`)) return;
  blockUI('Atualizando…');
  try {
    await api(`usuarios?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !ativo }) });
    toast(`Usuário ${ativo ? 'inativado' : 'reativado'} ✓`, 'success');
    await carregarUsuariosAdmin();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
  unblockUI();
}

export async function carregarEmitentesBase() {
  try {
    state.todosEmitentes = await api('emitentes?ativo=eq.true&select=id,nome_fantasia,prefixo&order=nome_fantasia') || [];
  } catch (e) {}
}

export async function carregarEmitentesAdmin() {
  document.getElementById('admin-emitentes-body').innerHTML = '<tr><td colspan="8"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    const em = await api('emitentes?select=id,cnpj,razao_social,nome_fantasia,prefixo,regime_tributario,compartilha_davila,compartilha_travado,ativo,logo,grupos_numeracao(nome)&order=nome_fantasia') || [];
    const tbody = document.getElementById('admin-emitentes-body');
    if (!em.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🏛️</div><div class="empty-title">Nenhum emitente</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = em.map(e => {
      const logoHtml = e.logo
        ? `<img src="${e.logo}" class="logo-preview" alt="logo">`
        : `<div class="logo-preview-empty">🏛️</div>`;
      return `<tr>
        <td>${logoHtml}</td>
        <td><span class="prop-num">${escHtml(e.prefixo)}</span></td>
        <td style="font-weight:700">${escHtml(e.nome_fantasia || e.razao_social)}</td>
        <td style="font-family:monospace;font-size:12px;color:var(--text2)">${formatCNPJ(e.cnpj)}</td>
        <td><span class="pill-regime">${escHtml(e.regime_tributario)}</span></td>
        <td>${e.compartilha_davila ? '<span class="pill-ativo">Sim</span>' : '<span class="pill-inativo">Não</span>'}${e.compartilha_travado ? ' <span style="font-size:10px;color:var(--text3)">🔒</span>' : ''}</td>
        <td>${e.ativo ? '<span class="pill-ativo">Ativo</span>' : '<span class="pill-inativo">Inativo</span>'}</td>
        <td><div class="row-actions"><button class="icon-btn btn-sm" onclick="abrirModalEditarEmitente('${e.id}')">✏️</button></div></td>
      </tr>`;
    }).join('');
  } catch (e) {
    document.getElementById('admin-emitentes-body').innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><div class="empty-sub">${escHtml(e.message)}</div></div></td></tr>`;
  }
}

export function abrirModalNovoEmitente() {
  state.editandoEmitenteId = null;
  state.emLogoBase64 = null;
  state.emLogoRemovido = false;
  document.getElementById('modal-emitente-title').textContent = 'Novo Emitente';
  ['em-cnpj','em-razao','em-fantasia','em-logradouro','em-numero','em-complemento','em-bairro','em-cidade','em-uf','em-cep'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('em-prefixo').value = '';
  document.getElementById('em-prefixo').disabled = false;
  document.getElementById('em-prefixo-obrig').style.display = 'inline';
  document.getElementById('em-prefixo-hint').style.display = 'block';
  document.getElementById('em-regime').value = 'Simples Nacional';
  document.getElementById('em-ativo').checked = true;
  document.getElementById('em-logo-file').value = '';
  document.getElementById('em-logo-preview-wrap').innerHTML = '<div class="logo-preview-empty">🏛️</div>';
  document.getElementById('btn-remover-logo').style.display = 'none';
  const chk = document.getElementById('em-compartilha');
  chk.checked = false;
  chk.disabled = false;
  document.getElementById('em-compartilha-aviso').style.display = 'block';
  document.getElementById('em-compartilha-travado').style.display = 'none';
  chk.onchange = () => { document.getElementById('em-compartilha-aviso').style.display = chk.checked ? 'none' : 'block'; };
  openModal('modal-emitente');
}

export async function abrirModalEditarEmitente(id) {
  state.editandoEmitenteId = id;
  state.emLogoBase64 = null;
  state.emLogoRemovido = false;
  try {
    const res = await api(`emitentes?id=eq.${id}&select=*`);
    const e = res[0];
    document.getElementById('modal-emitente-title').textContent = `Editar — ${e.nome_fantasia || e.prefixo}`;
    document.getElementById('em-cnpj').value = e.cnpj || '';
    document.getElementById('em-prefixo').value = e.prefixo || '';
    document.getElementById('em-prefixo').disabled = true;
    document.getElementById('em-prefixo-obrig').style.display = 'none';
    document.getElementById('em-prefixo-hint').style.display = 'none';
    document.getElementById('em-razao').value = e.razao_social || '';
    document.getElementById('em-fantasia').value = e.nome_fantasia || '';
    document.getElementById('em-regime').value = e.regime_tributario || 'Simples Nacional';
    document.getElementById('em-cidade').value = e.cidade || '';
    document.getElementById('em-uf').value = e.uf || '';
    document.getElementById('em-logradouro').value = e.logradouro || '';
    document.getElementById('em-numero').value = e.numero || '';
    document.getElementById('em-complemento').value = e.complemento || '';
    document.getElementById('em-bairro').value = e.bairro || '';
    document.getElementById('em-cep').value = e.cep || '';
    document.getElementById('em-ativo').checked = e.ativo;
    document.getElementById('em-logo-file').value = '';
    const wrap = document.getElementById('em-logo-preview-wrap');
    wrap.innerHTML = e.logo ? `<img src="${e.logo}" class="logo-preview" alt="logo">` : `<div class="logo-preview-empty">🏛️</div>`;
    document.getElementById('btn-remover-logo').style.display = e.logo ? 'inline-flex' : 'none';
    const chk = document.getElementById('em-compartilha');
    const aviso = document.getElementById('em-compartilha-aviso');
    const travado = document.getElementById('em-compartilha-travado');
    chk.checked = e.compartilha_davila;
    if (e.compartilha_travado) {
      chk.disabled = true; aviso.style.display = 'none'; travado.style.display = 'block';
    } else {
      chk.disabled = false; travado.style.display = 'none';
      aviso.style.display = e.compartilha_davila ? 'none' : 'block';
      chk.onchange = () => { aviso.style.display = chk.checked ? 'none' : 'block'; };
    }
    openModal('modal-emitente');
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
}

export function previewLogo(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 300 * 1024) { toast('Imagem muito grande. Máximo 300KB.', 'error'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = ev => {
    state.emLogoBase64 = ev.target.result;
    state.emLogoRemovido = false;
    document.getElementById('em-logo-preview-wrap').innerHTML = `<img src="${state.emLogoBase64}" class="logo-preview" alt="logo">`;
    document.getElementById('btn-remover-logo').style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
}

export function removerLogo() {
  state.emLogoBase64 = null;
  state.emLogoRemovido = true;
  document.getElementById('em-logo-preview-wrap').innerHTML = '<div class="logo-preview-empty">🏛️</div>';
  document.getElementById('em-logo-file').value = '';
  document.getElementById('btn-remover-logo').style.display = 'none';
}

export async function salvarEmitente() {
  const cnpj = document.getElementById('em-cnpj').value.trim().replace(/\D/g, '');
  const razao = document.getElementById('em-razao').value.trim();
  const prefixo = document.getElementById('em-prefixo').value.trim().toUpperCase();
  const compartilha = document.getElementById('em-compartilha').checked;
  if (!cnpj || cnpj.length !== 14) { toast('CNPJ deve ter 14 dígitos', 'error'); return; }
  if (!razao) { toast('Informe a Razão Social', 'error'); return; }
  if (!state.editandoEmitenteId && prefixo.length !== 3) { toast('O prefixo deve ter exatamente 3 letras', 'error'); return; }
  const payload = {
    cnpj, razao_social: razao,
    nome_fantasia: document.getElementById('em-fantasia').value.trim() || null,
    regime_tributario: document.getElementById('em-regime').value,
    cidade: document.getElementById('em-cidade').value.trim() || null,
    uf: document.getElementById('em-uf').value.trim().toUpperCase() || null,
    logradouro: document.getElementById('em-logradouro').value.trim() || null,
    numero: document.getElementById('em-numero').value.trim() || null,
    complemento: document.getElementById('em-complemento').value.trim() || null,
    bairro: document.getElementById('em-bairro').value.trim() || null,
    cep: document.getElementById('em-cep').value.trim().replace(/\D/g, '') || null,
    ativo: document.getElementById('em-ativo').checked,
    compartilha_davila: compartilha,
  };
  if (state.emLogoBase64) payload.logo = state.emLogoBase64;
  else if (state.emLogoRemovido) payload.logo = null;
  blockUI('Salvando emitente…');
  try {
    if (state.editandoEmitenteId) {
      await api(`emitentes?id=eq.${state.editandoEmitenteId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast('Emitente atualizado ✓', 'success');
    } else {
      let grupoId;
      if (compartilha) {
        const grpAmb = await api('grupos_numeracao?prefixo=eq.AMB&select=id');
        if (!grpAmb?.length) throw new Error('Grupo AMB não encontrado.');
        grupoId = grpAmb[0].id;
      } else {
        const novoGrupo = await api('grupos_numeracao', { method: 'POST', body: JSON.stringify({
          nome: `Grupo ${prefixo} — ${document.getElementById('em-fantasia').value.trim() || razao}`,
          prefixo,
          criado_por: state.currentUser.id,
        }) });
        grupoId = novoGrupo[0].id;
      }
      payload.prefixo = prefixo;
      payload.grupo_numeracao_id = grupoId;
      payload.compartilha_travado = false;
      payload.criado_por = state.currentUser.id;
      const novoEmitente = await api('emitentes', { method: 'POST', body: JSON.stringify(payload) });
      const novoId = novoEmitente[0].id;
      const agora = new Date().toISOString();
      const uid = state.currentUser.id;
      const paramsDefault = [
        { emitente_id: novoId, tipo: 'tributo',        codigo: 'ISS',        descricao: 'ISS',                   percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'tributo',        codigo: 'PIS',        descricao: 'PIS',                   percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'tributo',        codigo: 'COFINS',     descricao: 'COFINS',                percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'tributo',        codigo: 'IR',         descricao: 'IRPJ',                  percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'tributo',        codigo: 'CSLL',       descricao: 'CSLL',                  percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'tributo',        codigo: 'CPP',        descricao: 'CPP',                   percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'encargo_social', codigo: 'AT',         descricao: 'Autônomo/Terceiros',    percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'encargo_social', codigo: 'HR',         descricao: 'Encargos Horista',      percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'encargo_social', codigo: 'MS',         descricao: 'Encargos Mensalista',   percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'bdi_parcela',    codigo: 'ADM_CENTRAL',descricao: 'Administração Central', percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'bdi_parcela',    codigo: 'DESP_FINANC',descricao: 'Despesas Financeiras',  percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'bdi_parcela',    codigo: 'LUCRO',      descricao: 'Lucro',                 percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'bdi_parcela',    codigo: 'RISCOS',     descricao: 'Riscos e Imprevistos',  percentual: 0, vigente_de: agora, alterado_por: uid },
        { emitente_id: novoId, tipo: 'bdi_parcela',    codigo: 'SEGUROS',    descricao: 'Seguros e Garantias',   percentual: 0, vigente_de: agora, alterado_por: uid },
      ];
      await api('emitentes_parametros_historico', { method: 'POST', body: JSON.stringify(paramsDefault) });
      toast('Emitente criado ✓', 'success');
    }
    closeModal('modal-emitente');
    await carregarEmitentesAdmin();
    await carregarEmitentesBase();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
  unblockUI();
}
