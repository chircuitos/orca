import { state } from './state.js';
import { api } from './api.js';
import { escHtml, formatCNPJ, formatCPF, formatCEP, panelField } from './utils.js';
import { openModal, closeModal, blockUI, unblockUI, toast } from './ui.js';

export async function carregarPessoas() {
  const sel = document.getElementById('pessoas-emitente-sel');
  if (sel && sel.options.length <= 1) {
    const emitentes = state.emitentesDoUsuario || [];
    if (state.currentUser.is_admin) {
      sel.innerHTML = '<option value="">Todos os emitentes</option>' +
        emitentes.map(e => `<option value="${e.id}">${escHtml(e.nome_fantasia || e.prefixo)}</option>`).join('');
    } else {
      sel.innerHTML = emitentes.map(e =>
        `<option value="${e.id}">${escHtml(e.nome_fantasia || e.prefixo)}</option>`
      ).join('');
    }
  }
  const emitId = sel?.value || '';
  document.getElementById('tabela-pessoas').innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spinner"></div> Carregando…</div></td></tr>';
  try {
    let filtro = emitId ? `&emitente_id=eq.${emitId}` : '';
    if (!filtro && !state.currentUser.is_admin) {
      state.todasPessoas = [];
      renderPessoas();
      return;
    }
    state.todasPessoas = await api('pessoas?select=id,tipo_pessoa,documento,razao_social,nome_fantasia,bairro,cidade,uf,logradouro,numero,complemento,cep,is_cliente,is_fornecedor,ativo,emitente_id&order=razao_social' + filtro) || [];
    renderPessoas();
  } catch (e) {
    document.getElementById('tabela-pessoas').innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><div class="empty-sub">${escHtml(e.message)}</div></div></td></tr>`;
  }
}

export function renderPessoas() {
  const txt = document.getElementById('filtro-pessoa-texto').value.toLowerCase();
  const tipo = document.getElementById('filtro-pessoa-tipo').value;
  const ativo = document.getElementById('filtro-pessoa-ativo').value;
  let lista = state.todasPessoas;
  if (txt) lista = lista.filter(p => p.razao_social.toLowerCase().includes(txt) || (p.documento || '').includes(txt));
  if (tipo === 'cliente') lista = lista.filter(p => p.is_cliente && !p.is_fornecedor);
  else if (tipo === 'fornecedor') lista = lista.filter(p => p.is_fornecedor && !p.is_cliente);
  else if (tipo === 'ambos') lista = lista.filter(p => p.is_cliente && p.is_fornecedor);
  if (ativo !== '') lista = lista.filter(p => String(p.ativo) === ativo);
  const tbody = document.getElementById('tabela-pessoas');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏢</div><div class="empty-title">Nenhum resultado</div><div class="empty-sub">Ajuste os filtros ou cadastre uma nova pessoa.</div></div></td></tr>';
    return;
  }
  const thEmit = document.getElementById('th-emitente-pessoa');
  if (thEmit) thEmit.style.display = state.currentUser.is_admin ? '' : 'none';
  tbody.innerHTML = lista.map(p => {
    const classe = (p.is_cliente && p.is_fornecedor)
      ? '<span class="class-tag class-cliente">Cliente</span><span class="class-tag class-fornecedor">Fornecedor</span>'
      : p.is_cliente
        ? '<span class="class-tag class-cliente">Cliente</span>'
        : '<span class="class-tag class-fornecedor">Fornecedor</span>';
    const sel = p.id === state.pessoaSelecionadaId ? ' row-selected' : '';
    let tdEmit = '';
    if (state.currentUser.is_admin) {
      const emitObj = p.emitente_id ? state.todosEmitentes.find(e => e.id === p.emitente_id) : null;
      const sigla = emitObj ? emitObj.prefixo : 'AMB';
      tdEmit = `<td style="font-size:11px;font-weight:700;color:var(--text2)">${sigla}</td>`;
    }
    return `<tr class="clickable${sel}" onclick="selecionarPessoa('${p.id}')">
      <td><span class="tipo-${p.tipo_pessoa.toLowerCase()}">${p.tipo_pessoa}</span></td>
      <td><div style="font-weight:700">${escHtml(p.razao_social)}</div>${p.nome_fantasia && p.nome_fantasia !== p.razao_social ? `<div style="font-size:11px;color:var(--text2)">${escHtml(p.nome_fantasia)}</div>` : ''}</td>
      <td style="font-family:monospace;font-size:12px;color:var(--text2)">${p.tipo_pessoa === 'PJ' ? formatCNPJ(p.documento) : formatCPF(p.documento)}</td>
      ${tdEmit}
      <td>${classe}</td>
      <td>${p.ativo ? '<span class="pill-ativo">Ativo</span>' : '<span class="pill-inativo">Inativo</span>'}</td>
      <td><div class="row-actions">
        <button class="icon-btn btn-sm" onclick="event.stopPropagation();abrirModalPessoa('${p.id}')" title="Editar">✏️</button>
      </div></td>
    </tr>`;
  }).join('');
}

export async function selecionarPessoa(id) {
  state.pessoaSelecionadaId = id;
  renderPessoas();
  const painel = document.getElementById('painel-pessoa');
  painel.classList.remove('hidden');
  document.getElementById('painel-pessoa-body').innerHTML = '<div class="loading" style="padding:20px"><div class="spinner"></div></div>';
  try {
    const res = await api(`pessoas?id=eq.${id}&select=*,pessoas_contatos(id,nome,cargo,email,telefone,ativo)`);
    const p = res[0];
    document.getElementById('painel-pessoa-nome').textContent = p.razao_social;
    document.getElementById('painel-pessoa-doc').textContent = (p.tipo_pessoa === 'PJ' ? 'CNPJ: ' + formatCNPJ(p.documento) : 'CPF: ' + formatCPF(p.documento));
    const btnToggle = document.getElementById('btn-toggle-ativo-pessoa');
    if (p.ativo) { btnToggle.textContent = '🚫 Inativar'; btnToggle.className = 'btn btn-danger btn-sm'; }
    else { btnToggle.textContent = '✅ Reativar'; btnToggle.className = 'btn btn-success btn-sm'; }
    let html = '<div class="panel-section">Dados Gerais</div>';
    html += panelField('Tipo', p.tipo_pessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física');
    html += panelField('Classificação', (p.is_cliente && p.is_fornecedor) ? 'Cliente e Fornecedor' : p.is_cliente ? 'Cliente' : 'Fornecedor');
    if (p.telefone) html += panelField('Telefone', p.telefone);
    if (p.nome_fantasia && p.nome_fantasia !== p.razao_social) html += panelField('Nome Fantasia', p.nome_fantasia);
    const end = [p.logradouro, p.numero ? 'nº ' + p.numero : '', p.complemento, p.bairro, p.cidade && p.uf ? p.cidade + ' — ' + p.uf : p.cidade || p.uf || ''].filter(Boolean).join(', ');
    if (end) html += panelField('Endereço', end);
    if (p.cep) html += panelField('CEP', formatCEP(p.cep));
    html += '<div class="panel-section">Contatos</div>';
    const contatos = (p.pessoas_contatos || []).filter(c => c.ativo);
    if (!contatos.length) {
      html += '<div style="color:var(--text3);font-size:12px;padding:4px 0">Nenhum contato. Use <strong>+ Contato</strong> abaixo.</div>';
    } else {
      contatos.forEach(c => {
        html += `<div class="contato-item">
          <div class="contato-nome">${escHtml(c.nome)}</div>
          ${c.cargo ? `<div class="contato-cargo">${escHtml(c.cargo)}</div>` : ''}
          ${c.email ? `<div class="contato-email">✉️ ${escHtml(c.email)}</div>` : ''}
          ${c.telefone ? `<div class="contato-tel">📞 ${escHtml(c.telefone)}</div>` : ''}
          <div class="contato-actions">
            <button class="icon-btn" onclick="editarContato('${c.id}','${id}')" title="Editar">✏️</button>
            <button class="icon-btn del" onclick="inativarContato('${c.id}','${id}')" title="Remover">🗑</button>
          </div>
        </div>`;
      });
    }
    document.getElementById('painel-pessoa-body').innerHTML = html;
  } catch (e) {
    document.getElementById('painel-pessoa-body').innerHTML = `<div style="color:var(--red);padding:16px;font-size:12px">${escHtml(e.message)}</div>`;
  }
}

export function fecharPainel() {
  state.pessoaSelecionadaId = null;
  document.getElementById('painel-pessoa').classList.add('hidden');
  renderPessoas();
}

export function editarPessoaSelecionada() {
  if (!state.pessoaSelecionadaId) { toast('Selecione uma pessoa primeiro', 'warn'); return; }
  abrirModalPessoa(state.pessoaSelecionadaId);
}

export async function toggleAtivoPessoa() {
  if (!state.pessoaSelecionadaId) return;
  const p = state.todasPessoas.find(x => x.id === state.pessoaSelecionadaId);
  if (!confirm(`Deseja ${p.ativo ? 'inativar' : 'reativar'} "${p.razao_social}"?`)) return;
  blockUI('Atualizando…');
  try {
    await api(`pessoas?id=eq.${state.pessoaSelecionadaId}`, { method: 'PATCH', body: JSON.stringify({ ativo: !p.ativo }) });
    toast(`Registro ${p.ativo ? 'inativado' : 'reativado'} ✓`, 'success');
    await carregarPessoas();
    fecharPainel();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
  unblockUI();
}

export function atualizarDocLabel() {
  const tipo = document.getElementById('pe-tipo').value;
  document.getElementById('pe-doc-label').textContent = tipo === 'PJ' ? 'CNPJ (14 dígitos)' : 'CPF (11 dígitos)';
  document.getElementById('pe-doc').placeholder = tipo === 'PJ' ? '00000000000000' : '00000000000';
  document.getElementById('pe-doc').maxLength = tipo === 'PJ' ? 14 : 11;
  document.getElementById('pe-nome-label').textContent = tipo === 'PJ' ? 'Razão Social' : 'Nome Completo';
}

export function abrirModalPessoa(id = null) {
  state.editandoPessoaId = id;
  document.getElementById('modal-pessoa-title').textContent = id ? 'Editar Pessoa' : 'Nova Pessoa';
  const campos = ['pe-doc','pe-nome','pe-logradouro','pe-numero','pe-complemento','pe-bairro','pe-cidade','pe-uf','pe-cep'];
  if (!id) {
    campos.forEach(f => document.getElementById(f).value = '');
    document.getElementById('pe-telefone').value = '';
    document.getElementById('pe-nome-fantasia').value = '';
    document.getElementById('pe-tipo').value = 'PJ';
    document.getElementById('pe-cliente').checked = true;
    document.getElementById('pe-fornecedor').checked = false;
    atualizarDocLabel();
    openModal('modal-pessoa');
    return;
  }
  const p = state.todasPessoas.find(x => x.id === id);
  if (!p) return;
  document.getElementById('pe-tipo').value = p.tipo_pessoa;
  document.getElementById('pe-doc').value = p.documento;
  document.getElementById('pe-nome').value = p.razao_social;
  document.getElementById('pe-cliente').checked = p.is_cliente;
  document.getElementById('pe-fornecedor').checked = p.is_fornecedor;
  document.getElementById('pe-telefone').value = p.telefone || '';
  document.getElementById('pe-nome-fantasia').value = p.nome_fantasia || '';
  document.getElementById('pe-logradouro').value = p.logradouro || '';
  document.getElementById('pe-numero').value = p.numero || '';
  document.getElementById('pe-complemento').value = p.complemento || '';
  document.getElementById('pe-bairro').value = p.bairro || '';
  document.getElementById('pe-cidade').value = p.cidade || '';
  document.getElementById('pe-uf').value = p.uf || '';
  document.getElementById('pe-cep').value = p.cep || '';
  atualizarDocLabel();
  openModal('modal-pessoa');
}

export async function salvarPessoa() {
  const tipo = document.getElementById('pe-tipo').value;
  const doc = document.getElementById('pe-doc').value.trim().replace(/\D/g, '');
  const nome = document.getElementById('pe-nome').value.trim();
  const isCliente = document.getElementById('pe-cliente').checked;
  const isFornecedor = document.getElementById('pe-fornecedor').checked;
  if (!doc) { toast('Informe o documento', 'error'); return; }
  if (!nome) { toast('Informe o nome / razão social', 'error'); return; }
  if (!isCliente && !isFornecedor) { toast('Marque ao menos Cliente ou Fornecedor', 'error'); return; }
  let emitenteIdPessoa = null;
  if (!state.currentUser.is_admin && state.emitentesDoUsuario.length > 0) {
    const naoCompartilha = state.emitentesDoUsuario.find(e => !e.compartilha_davila);
    if (naoCompartilha) emitenteIdPessoa = naoCompartilha.id;
  }
  const payload = {
    tipo_pessoa: tipo,
    documento: doc,
    razao_social: nome,
    is_cliente: isCliente,
    is_fornecedor: isFornecedor,
    emitente_id: emitenteIdPessoa,
    logradouro: document.getElementById('pe-logradouro').value.trim() || null,
    numero: document.getElementById('pe-numero').value.trim() || null,
    complemento: document.getElementById('pe-complemento').value.trim() || null,
    bairro: document.getElementById('pe-bairro').value.trim() || null,
    cidade: document.getElementById('pe-cidade').value.trim() || null,
    uf: document.getElementById('pe-uf').value.trim().toUpperCase() || null,
    cep: document.getElementById('pe-cep').value.trim().replace(/\D/g, '') || null,
    telefone: document.getElementById('pe-telefone').value.trim() || null,
    nome_fantasia: document.getElementById('pe-nome-fantasia').value.trim() || null,
  };
  blockUI('Salvando…');
  try {
    if (state.editandoPessoaId) {
      const { emitente_id: _, ...payloadEdicao } = payload;
      await api(`pessoas?id=eq.${state.editandoPessoaId}`, { method: 'PATCH', body: JSON.stringify(payloadEdicao) });
      toast('Registro atualizado ✓', 'success');
    } else {
      await api('pessoas', { method: 'POST', body: JSON.stringify({ ...payload, criado_por: state.currentUser.id }) });
      toast('Registro criado ✓', 'success');
    }
    closeModal('modal-pessoa');
    await carregarPessoas();
    if (state.editandoPessoaId) selecionarPessoa(state.editandoPessoaId);
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
  unblockUI();
}

export function abrirModalContato() {
  if (!state.pessoaSelecionadaId) { toast('Selecione uma pessoa primeiro', 'warn'); return; }
  state.editandoContatoId = null;
  document.getElementById('modal-contato-title').textContent = 'Novo Contato';
  ['co-nome','co-cargo','co-email','co-telefone'].forEach(f => document.getElementById(f).value = '');
  openModal('modal-contato');
}

export async function editarContato(cid, pid) {
  state.pessoaSelecionadaId = pid;
  state.editandoContatoId = cid;
  try {
    const res = await api(`pessoas_contatos?id=eq.${cid}&select=*`);
    const c = res[0];
    document.getElementById('modal-contato-title').textContent = 'Editar Contato';
    document.getElementById('co-nome').value = c.nome || '';
    document.getElementById('co-cargo').value = c.cargo || '';
    document.getElementById('co-email').value = c.email || '';
    document.getElementById('co-telefone').value = c.telefone || '';
    openModal('modal-contato');
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
}

export async function salvarContato() {
  const nome = document.getElementById('co-nome').value.trim();
  if (!nome) { toast('Informe o nome do contato', 'error'); return; }
  const payload = {
    nome,
    cargo: document.getElementById('co-cargo').value.trim() || null,
    email: document.getElementById('co-email').value.trim() || null,
    telefone: document.getElementById('co-telefone').value.trim() || null,
  };
  blockUI('Salvando contato…');
  try {
    if (state.editandoContatoId) {
      await api(`pessoas_contatos?id=eq.${state.editandoContatoId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast('Contato atualizado ✓', 'success');
    } else {
      await api('pessoas_contatos', { method: 'POST', body: JSON.stringify({ ...payload, pessoa_id: state.pessoaSelecionadaId, criado_por: state.currentUser.id }) });
      toast('Contato adicionado ✓', 'success');
    }
    closeModal('modal-contato');
    await selecionarPessoa(state.pessoaSelecionadaId);
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
  unblockUI();
}

export async function inativarContato(cid, pid) {
  if (!confirm('Remover este contato?')) return;
  blockUI('Removendo…');
  try {
    await api(`pessoas_contatos?id=eq.${cid}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ ativo: false }) });
    toast('Contato removido', 'success');
    await selecionarPessoa(pid);
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
  unblockUI();
}
