import { state } from './state.js';
import { api } from './api.js';
import { escHtml, formatCPF, formatCNPJ } from './utils.js';
import { openModal, closeModal, blockUI, unblockUI, toast } from './ui.js';

let _funcoes = [];
let _funcaoEditandoId = null;
let _tabelaPrecos = [];
let _tabelaItemEditandoId = null;
let _servicosTerceiros = [];
let _servicoEditandoId = null;
let _solucoes = [];
let _solucaoEditandoId = null;
let _profissionais = [];
let _profEditandoId = null;

const ENCARGOS_CATS = [
  { key: 'EPI_UNIFORMES',        label: 'EPI / Uniformes' },
  { key: 'EXAMES_OCUPACIONAIS',  label: 'Exames Ocupacionais' },
  { key: 'ALIMENTACAO',          label: 'Alimentação' },
  { key: 'ASSIST_MEDICA_ODONTO', label: 'Assist. Médica e Odontológica' },
  { key: 'FERRAMENTAS_MATERIAIS',label: 'Ferramentas e Materiais' },
  { key: 'AUXILIO_TRANSPORTE',   label: 'Auxílio Transporte' },
  { key: 'TREINAMENTOS',         label: 'Treinamentos' },
  { key: 'SEGURO_VIDA',          label: 'Seguro de Vida' },
  { key: 'VIAGENS_HOSPEDAGENS',  label: 'Viagens e Hospedagens' },
  { key: 'COMUNICACAO_MOVEL',    label: 'Comunicação Móvel' },
  { key: 'OUTROS',               label: 'Outros' },
];

// ============================================================
// TAB MANAGEMENT
// ============================================================

export function switchCapTab(tab) {
  const tabs = ['parametros','funcoes','profissionais','solucoes','tabela-precos','servicos-terceiros'];
  const subtitulos = {
    'parametros':         'Parâmetros Financeiros',
    'funcoes':            'Funções / Cargos',
    'profissionais':      'Profissionais',
    'solucoes':           'Soluções',
    'tabela-precos':      'Itens Tabelados',
    'servicos-terceiros': 'Terceiros',
  };
  const btnTextos = {
    'parametros':         null,
    'funcoes':            '+ Nova Função',
    'profissionais':      '+ Novo Profissional',
    'solucoes':           '+ Nova Solução',
    'tabela-precos':      '+ Novo Item',
    'servicos-terceiros': '+ Novo Serviço',
  };
  tabs.forEach(t => {
    document.getElementById('captab-'+t).classList.toggle('active', t === tab);
    document.getElementById('capsec-'+t).style.display = t === tab ? 'block' : 'none';
  });
  document.getElementById('cap-subtitulo').textContent = subtitulos[tab];
  const btnNovo = document.getElementById('btn-novo-cap');
  if (btnTextos[tab]) {
    btnNovo.style.display = '';
    btnNovo.textContent = btnTextos[tab];
    btnNovo.onclick = () => abrirModalNovoCap(tab);
  } else {
    btnNovo.style.display = 'none';
  }
  if (tab === 'parametros') carregarParametros();
  else if (tab === 'funcoes') carregarFuncoes();
  else if (tab === 'profissionais') carregarProfissionais();
  else if (tab === 'solucoes') carregarSolucoes();
  else if (tab === 'tabela-precos') carregarTabelaPrecos();
  else if (tab === 'servicos-terceiros') carregarServicosTerceiros();
}

function abrirModalNovoCap(tab) {
  if (tab === 'funcoes') abrirModalFuncao();
  else if (tab === 'profissionais') abrirModalProfissional();
  else if (tab === 'solucoes') abrirModalSolucao();
  else if (tab === 'tabela-precos') abrirModalItemTabela();
  else if (tab === 'servicos-terceiros') abrirModalServico();
}

// ============================================================
// PARÂMETROS FINANCEIROS
// ============================================================

const PARAM_LABELS = {
  ISS: 'ISS', PIS: 'PIS', COFINS: 'COFINS', IR: 'IR (Imposto de Renda)',
  CSLL: 'CSLL', CPP: 'CPP / Previdência',
  MS: 'Mensalista', HR: 'Horista', AT: 'Autônomo / PJ',
  ADM_CENTRAL: 'Administração Central', RISCOS: 'Riscos',
  SEGUROS_GARANTIAS: 'Seguros e Garantias', DESP_FINANCEIRAS: 'Despesas Financeiras',
  LUCRO: 'Lucro',
};

let _paramEditando = {};

export async function carregarParametros() {
  const emitentes = state.emitentesDoUsuario || [];
  const sel = document.getElementById('param-emitente-sel');
  if (sel.options.length <= 1 && emitentes.length) {
    sel.innerHTML = emitentes.map(e =>
      `<option value="${e.id}">${escHtml(e.nome_fantasia || e.prefixo)}</option>`
    ).join('');
  }
  const emitId = sel.value;
  if (!emitId) {
    document.getElementById('cap-params-body').innerHTML = '<div class="empty-state"><div class="empty-icon">🏛️</div><div class="empty-title">Nenhum emitente disponível</div></div>';
    return;
  }
  await _carregarParamsEmitente(emitId);
}

export async function onChangeParamEmitente() {
  await _carregarParamsEmitente(document.getElementById('param-emitente-sel').value);
}

async function _carregarParamsEmitente(emitId) {
  document.getElementById('cap-params-body').innerHTML = '<div class="loading"><div class="spinner"></div> Carregando…</div>';
  try {
    const params = await api(`emitentes_parametros_historico?emitente_id=eq.${emitId}&vigente_ate=is.null&order=tipo.asc,codigo.asc`) || [];
    _renderParametros(params, emitId);
  } catch (e) {
    document.getElementById('cap-params-body').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro ao carregar</div><div class="empty-sub">${escHtml(e.message)}</div></div>`;
  }
}

function _renderParametros(params, emitId) {
  const sections = [
    { tipo: 'tributo',        label: 'Tributos',           icon: '🏦' },
    { tipo: 'encargo_social', label: 'Encargos Sociais',   icon: '👷' },
    { tipo: 'bdi_parcela',    label: 'Parcelas do BDI',    icon: '📊' },
  ];
  let html = '';
  sections.forEach(s => {
    const list = params.filter(p => p.tipo === s.tipo);
    const total = s.tipo !== 'encargo_social'
      ? list.reduce((sum, p) => sum + parseFloat(p.percentual), 0)
      : null;
    html += `<div class="param-section">
      <div class="param-section-header">
        <span>${s.icon} ${s.label}</span>
        <button class="btn btn-ghost btn-sm" onclick="abrirModalAdicionarParam('${s.tipo}','${emitId}')">+ Adicionar</button>
      </div>
      <table class="data-table compact">
        <thead><tr><th>Código</th><th>Descrição</th><th style="text-align:right">%</th><th style="width:48px"></th></tr></thead>
        <tbody>`;
    if (!list.length) {
      html += `<tr><td colspan="4" style="color:var(--text3);font-size:12px;padding:12px">Nenhum parâmetro cadastrado.</td></tr>`;
    } else {
      list.forEach(p => {
        const desc = p.descricao || PARAM_LABELS[p.codigo] || p.codigo;
        html += `<tr>
          <td style="font-family:monospace;font-weight:700;font-size:12px">${escHtml(p.codigo)}</td>
          <td>${escHtml(desc)}</td>
          <td style="text-align:right;font-weight:700">${parseFloat(p.percentual).toFixed(4).replace('.',',')}%</td>
          <td><button class="icon-btn btn-sm" onclick="abrirModalEditarParam('${p.emitente_id}','${p.tipo}','${escHtml(p.codigo)}','${escHtml(desc)}',${p.percentual})" title="Editar">✏️</button></td>
        </tr>`;
      });
      if (total !== null) {
        html += `<tr style="border-top:2px solid var(--border);background:var(--surface2)">
          <td colspan="2" style="font-weight:700;font-size:12px;color:var(--text2)">TOTAL</td>
          <td style="text-align:right;font-weight:800;font-family:monospace">${total.toFixed(4).replace('.',',')}%</td>
          <td></td>
        </tr>`;
      }
    }
    html += `</tbody></table></div>`;

    if (s.tipo === 'bdi_parcela') {
      html += _renderBdiTcu(params);
    }
  });
  document.getElementById('cap-params-body').innerHTML = html;
}

function _renderBdiTcu(params) {
  const get = (tipo, codigo) => {
    const p = params.find(x => x.tipo === tipo && x.codigo === codigo);
    return p ? parseFloat(p.percentual) / 100 : 0;
  };

  const AC = get('bdi_parcela', 'ADM_CENTRAL');
  const SG = get('bdi_parcela', 'SEGUROS');
  const R  = get('bdi_parcela', 'RISCOS');
  const DF = get('bdi_parcela', 'DESP_FINANC');
  const L  = get('bdi_parcela', 'LUCRO');
  const I  = params.filter(p => p.tipo === 'tributo').reduce((s, p) => s + parseFloat(p.percentual) / 100, 0);

  if (I >= 1) return '';
  const bdi = ((1 + AC + SG + R) * (1 + DF) * (1 + L)) / (1 - I) - 1;
  const bdiPct = (bdi * 100).toFixed(4).replace('.', ',');

  const s2 = 'style="font-size:12px;color:var(--text2)"';
  const sm = 'style="font-size:12px;font-family:monospace;font-weight:700;color:var(--text2);width:40px"';
  const sr = 'style="text-align:right;font-family:monospace;font-size:12px;color:var(--text2)"';
  return `<div class="param-section" style="border:2px solid var(--azul);background:var(--azul-light)">
    <div class="param-section-header" style="color:var(--azul)">
      <span>📐 BDI Calculado — Fórmula TCU</span>
    </div>
    <table class="data-table compact">
      <tbody>
        <tr><td ${sm}>AC</td><td ${s2}>Administração Central</td><td ${sr}>${(AC*100).toFixed(4).replace('.',',')}%</td></tr>
        <tr><td ${sm}>S+G</td><td ${s2}>Seguros e Garantias</td><td ${sr}>${(SG*100).toFixed(4).replace('.',',')}%</td></tr>
        <tr><td ${sm}>R</td><td ${s2}>Riscos</td><td ${sr}>${(R*100).toFixed(4).replace('.',',')}%</td></tr>
        <tr><td ${sm}>DF</td><td ${s2}>Despesas Financeiras</td><td ${sr}>${(DF*100).toFixed(4).replace('.',',')}%</td></tr>
        <tr><td ${sm}>L</td><td ${s2}>Lucro</td><td ${sr}>${(L*100).toFixed(4).replace('.',',')}%</td></tr>
        <tr><td ${sm}>I</td><td ${s2}>Impostos (soma dos Tributos)</td><td ${sr}>${(I*100).toFixed(4).replace('.',',')}%</td></tr>
        <tr style="border-top:2px solid var(--azul)">
          <td colspan="2" style="font-weight:800;color:var(--azul);font-size:12px">BDI = ((1 + AC + S + R + G) × (1 + DF) × (1 + L)) / (1 − I) − 1</td>
          <td style="text-align:right;font-weight:800;font-family:monospace;font-size:16px;color:var(--azul)">${bdiPct}%</td>
        </tr>
      </tbody>
    </table>
  </div>`;
}

export function abrirModalEditarParam(emitente_id, tipo, codigo, descricao, percentual) {
  _paramEditando = { emitente_id, tipo, codigo, descricao, percentual, isNew: false };
  document.getElementById('modal-param-title').textContent = `Editar — ${codigo}`;
  document.getElementById('param-codigo').value = codigo;
  document.getElementById('param-codigo').disabled = true;
  document.getElementById('param-descricao').value = descricao;
  document.getElementById('param-percentual').value = percentual;
  document.getElementById('param-tipo-hidden').value = tipo;
  document.getElementById('param-emitente-hidden').value = emitente_id;
  openModal('modal-param');
}

export function abrirModalAdicionarParam(tipo, emitente_id) {
  const eid = emitente_id || document.getElementById('param-emitente-sel').value;
  const tipoLabel = { tributo: 'Tributo', encargo_social: 'Encargo Social', bdi_parcela: 'Parcela do BDI' }[tipo];
  _paramEditando = { emitente_id: eid, tipo, isNew: true };
  document.getElementById('modal-param-title').textContent = `Adicionar ${tipoLabel}`;
  document.getElementById('param-codigo').value = '';
  document.getElementById('param-codigo').disabled = false;
  document.getElementById('param-descricao').value = '';
  document.getElementById('param-percentual').value = '';
  document.getElementById('param-tipo-hidden').value = tipo;
  document.getElementById('param-emitente-hidden').value = eid;
  openModal('modal-param');
}

export async function salvarParam() {
  const emitente_id = document.getElementById('param-emitente-hidden').value;
  const tipo = document.getElementById('param-tipo-hidden').value;
  const codigo = document.getElementById('param-codigo').value.trim().toUpperCase();
  const descricao = document.getElementById('param-descricao').value.trim();
  const pct = document.getElementById('param-percentual').value;
  const percentual = parseFloat(pct.replace(',','.'));
  if (!codigo || isNaN(percentual)) { toast('Preencha código e percentual.', 'error'); return; }
  blockUI('Salvando parâmetro…');
  try {
    if (!_paramEditando.isNew) {
      await api(`emitentes_parametros_historico?emitente_id=eq.${emitente_id}&tipo=eq.${tipo}&codigo=eq.${codigo}&vigente_ate=is.null`, {
        method: 'PATCH',
        body: JSON.stringify({ vigente_ate: new Date().toISOString() }),
      });
    }
    await api('emitentes_parametros_historico', {
      method: 'POST',
      body: JSON.stringify({ emitente_id, tipo, codigo, descricao, percentual, alterado_por: state.currentUser.id }),
    });
    closeModal('modal-param');
    toast('Parâmetro salvo.', 'success');
    await _carregarParamsEmitente(emitente_id);
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  } finally {
    unblockUI();
  }
}

// ============================================================
// FUNÇÕES / CARGOS
// ============================================================

export async function carregarFuncoes() {
  document.getElementById('cap-funcoes-body').innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    _funcoes = await api('funcoes?select=*,funcoes_encargos_complementares(categoria,valor_mensal,valor_hora,horas_mensais)&order=nome.asc') || [];
    const ativoFiltro = document.getElementById('funcoes-filtro-ativo')?.value ?? 'true';
    const lista = ativoFiltro === '' ? _funcoes : _funcoes.filter(f => String(f.ativo) === ativoFiltro);
    let html = '';
    lista.forEach(f => {
      const encs = f.funcoes_encargos_complementares || [];
      const totalCompl = encs.reduce((s, e) => s + (parseFloat(e.valor_hora) || 0), 0);
      const valorBase = parseFloat(f.valor_hora_padrao || 0);
      const valorHora = valorBase + totalCompl;
      const isPool = !f.emitente_id;
      html += `<tr>
        <td>${escHtml(f.nome)}</td>
        <td style="text-align:center">${f.requer_pessoa ? '<span class="pill-ativo" style="font-size:10px">Sim</span>' : '<span style="color:var(--text3)">—</span>'}</td>
        <td style="text-align:right;font-family:monospace">${valorBase.toFixed(2).replace('.',',')}</td>
        <td style="text-align:right;font-family:monospace;font-size:12px;color:var(--text2)">${totalCompl > 0 ? totalCompl.toFixed(2).replace('.',',') : '—'}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700">${valorHora > 0 ? valorHora.toFixed(2).replace('.',',') : '—'}</td>
        <td>${isPool ? '<span class="pill-ativo" style="background:var(--azul-light);color:var(--azul)">Pool</span>' : '<span style="color:var(--text3);font-size:12px">Exclusivo</span>'}</td>
        <td><span class="${f.ativo ? 'pill-ativo' : 'pill-inativo'}">${f.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td><div class="row-actions"><button class="icon-btn btn-sm" onclick="abrirModalFuncaoId('${f.id}')" title="Editar">✏️</button></div></td>
      </tr>`;
    });
    document.getElementById('cap-funcoes-body').innerHTML = html ||
      '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">👷</div><div class="empty-title">Nenhuma função cadastrada</div></div></td></tr>';
  } catch (e) {
    document.getElementById('cap-funcoes-body').innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><div class="empty-sub">${escHtml(e.message)}</div></div></td></tr>`;
  }
}

export function abrirModalFuncao() {
  _funcaoEditandoId = null;
  document.getElementById('modal-funcao-title').textContent = 'Nova Função';
  document.getElementById('fn-nome').value = '';
  document.getElementById('fn-requer-pessoa').checked = false;
  document.getElementById('fn-valor-hora').value = '';
  document.getElementById('fn-horas-mensais').value = 220;
  document.getElementById('fn-ativo').checked = true;
  document.getElementById('fn-pool').checked = true;
  ENCARGOS_CATS.forEach(c => {
    const inp = document.getElementById('fn-enc-'+c.key);
    if (inp) inp.value = '';
  });
  openModal('modal-funcao');
}

export function abrirModalFuncaoId(id) {
  const f = _funcoes.find(x => x.id === id);
  if (!f) return;
  _funcaoEditandoId = id;
  document.getElementById('modal-funcao-title').textContent = 'Editar Função';
  document.getElementById('fn-nome').value = f.nome;
  document.getElementById('fn-requer-pessoa').checked = f.requer_pessoa;
  document.getElementById('fn-valor-hora').value = f.valor_hora_padrao || '';
  document.getElementById('fn-ativo').checked = f.ativo;
  document.getElementById('fn-pool').checked = !f.emitente_id;
  const encs = f.funcoes_encargos_complementares || [];
  document.getElementById('fn-horas-mensais').value = encs.length > 0 ? (encs[0].horas_mensais || 220) : 220;
  ENCARGOS_CATS.forEach(c => {
    const e = encs.find(x => x.categoria === c.key);
    const inp = document.getElementById('fn-enc-'+c.key);
    if (inp) inp.value = e ? e.valor_mensal : '';
  });
  openModal('modal-funcao');
}

export async function salvarFuncao() {
  const nome = document.getElementById('fn-nome').value.trim();
  const requer_pessoa = document.getElementById('fn-requer-pessoa').checked;
  const vhRaw = document.getElementById('fn-valor-hora').value.replace(',','.');
  const valor_hora_padrao = vhRaw ? parseFloat(vhRaw) : null;
  const ativo = document.getElementById('fn-ativo').checked;
  const isPool = document.getElementById('fn-pool').checked;
  const emitente_id = isPool ? null : (state.emitentesDoUsuario[0]?.id || null);
  if (!nome) { toast('Informe o nome da função.', 'error'); return; }
  blockUI('Salvando função…');
  try {
    let funcao_id;
    if (_funcaoEditandoId) {
      await api(`funcoes?id=eq.${_funcaoEditandoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ nome, requer_pessoa, valor_hora_padrao, ativo }),
      });
      funcao_id = _funcaoEditandoId;
    } else {
      const res = await api('funcoes', {
        method: 'POST',
        body: JSON.stringify({ nome, requer_pessoa, valor_hora_padrao, ativo, emitente_id, criado_por: state.currentUser.id }),
      });
      funcao_id = res[0].id;
    }
    // Substituir encargos: deletar os existentes e reinserir os preenchidos
    await api(`funcoes_encargos_complementares?funcao_id=eq.${funcao_id}`, { method: 'DELETE' });
    const horas_mensais = parseInt(document.getElementById('fn-horas-mensais').value) || 220;
    const encargos = ENCARGOS_CATS
      .map(c => {
        const raw = document.getElementById('fn-enc-'+c.key)?.value?.replace(',','.') || '';
        const valor_mensal = raw ? parseFloat(raw) : 0;
        return { funcao_id, categoria: c.key, valor_mensal, horas_mensais };
      })
      .filter(e => e.valor_mensal > 0);
    if (encargos.length > 0) {
      await api('funcoes_encargos_complementares', {
        method: 'POST',
        body: JSON.stringify(encargos),
      });
    }
    closeModal('modal-funcao');
    toast('Função salva.', 'success');
    await carregarFuncoes();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  } finally {
    unblockUI();
  }
}

// ============================================================
// PROFISSIONAIS
// ============================================================

export async function carregarProfissionais() {
  document.getElementById('cap-profissionais-body').innerHTML = '<tr><td colspan="6"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    _profissionais = await api('profissionais?select=*&order=nome.asc') || [];
    const ativoFiltro = document.getElementById('prof-filtro-ativo')?.value ?? 'true';
    const lista = ativoFiltro === '' ? _profissionais : _profissionais.filter(p => String(p.ativo) === ativoFiltro);
    const tipoLabel = { colaborador: 'Colaborador', terceiro_pj: 'Terceiro PJ', freelancer: 'Freelancer' };
    let html = '';
    lista.forEach(p => {
      const doc = p.cpf_cnpj ? (p.cpf_cnpj.length === 11 ? formatCPF(p.cpf_cnpj) : formatCNPJ(p.cpf_cnpj)) : '—';
      html += `<tr>
        <td>${escHtml(p.nome)}</td>
        <td style="font-family:monospace;font-size:12px">${escHtml(doc)}</td>
        <td>${tipoLabel[p.tipo] || p.tipo}</td>
        <td>${p.emitente_id ? '<span style="color:var(--text3);font-size:12px">Exclusivo</span>' : '<span class="pill-ativo" style="background:var(--azul-light);color:var(--azul)">Pool</span>'}</td>
        <td><span class="${p.ativo ? 'pill-ativo' : 'pill-inativo'}">${p.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td><div class="row-actions">
          <button class="icon-btn btn-sm" onclick="abrirModalProfissionalId('${p.id}')" title="Editar">✏️</button>
          <button class="icon-btn btn-sm" onclick="toggleProfissionalAtivo('${p.id}',${p.ativo})" title="${p.ativo ? 'Desativar' : 'Ativar'}">${p.ativo ? '🔴' : '🟢'}</button>
        </div></td>
      </tr>`;
    });
    document.getElementById('cap-profissionais-body').innerHTML = html ||
      '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👤</div><div class="empty-title">Nenhum profissional cadastrado</div></div></td></tr>';
  } catch (e) {
    document.getElementById('cap-profissionais-body').innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><div class="empty-sub">${escHtml(e.message)}</div></div></td></tr>`;
  }
}

export function abrirModalProfissional() {
  _profEditandoId = null;
  document.getElementById('modal-prof-title').textContent = 'Novo Profissional';
  document.getElementById('prof-nome').value = '';
  document.getElementById('prof-cpf-cnpj').value = '';
  document.getElementById('prof-tipo').value = 'colaborador';
  document.getElementById('prof-ativo').checked = true;
  document.getElementById('prof-pool').checked = true;
  openModal('modal-profissional');
}

export function abrirModalProfissionalId(id) {
  const p = _profissionais.find(x => x.id === id);
  if (!p) return;
  _profEditandoId = id;
  document.getElementById('modal-prof-title').textContent = 'Editar Profissional';
  document.getElementById('prof-nome').value = p.nome;
  document.getElementById('prof-cpf-cnpj').value = p.cpf_cnpj || '';
  document.getElementById('prof-tipo').value = p.tipo;
  document.getElementById('prof-ativo').checked = p.ativo;
  document.getElementById('prof-pool').checked = !p.emitente_id;
  openModal('modal-profissional');
}

export async function salvarProfissional() {
  const nome = document.getElementById('prof-nome').value.trim();
  const cpf_cnpj = document.getElementById('prof-cpf-cnpj').value.replace(/\D/g, '') || null;
  const tipo = document.getElementById('prof-tipo').value;
  const ativo = document.getElementById('prof-ativo').checked;
  const isPool = document.getElementById('prof-pool').checked;
  const emitente_id = isPool ? null : (state.emitentesDoUsuario[0]?.id || null);
  if (!nome) { toast('Informe o nome do profissional.', 'error'); return; }
  if (cpf_cnpj && cpf_cnpj.length !== 11 && cpf_cnpj.length !== 14) {
    toast('CPF deve ter 11 dígitos e CNPJ 14 dígitos.', 'error'); return;
  }
  blockUI('Salvando profissional…');
  try {
    if (_profEditandoId) {
      await api(`profissionais?id=eq.${_profEditandoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ nome, cpf_cnpj, tipo, ativo }),
      });
    } else {
      await api('profissionais', {
        method: 'POST',
        body: JSON.stringify({ nome, cpf_cnpj, tipo, ativo, emitente_id, criado_por: state.currentUser.id }),
      });
    }
    closeModal('modal-profissional');
    toast('Profissional salvo.', 'success');
    await carregarProfissionais();
  } catch (e) {
    const msg = e.message.includes('profissionais_cpf_cnpj_unique')
      ? 'Este CPF/CNPJ já está cadastrado.' : 'Erro: ' + e.message;
    toast(msg, 'error');
  } finally {
    unblockUI();
  }
}

export async function toggleProfissionalAtivo(id, ativo) {
  const novoAtivo = !ativo;
  blockUI(novoAtivo ? 'Ativando profissional…' : 'Desativando profissional…');
  try {
    await api(`profissionais?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo: novoAtivo }),
    });
    toast(novoAtivo ? 'Profissional ativado.' : 'Profissional desativado.', 'success');
    await carregarProfissionais();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  } finally {
    unblockUI();
  }
}

// ============================================================
// SOLUÇÕES
// ============================================================

export async function carregarSolucoes() {
  document.getElementById('cap-solucoes-body').innerHTML = '<tr><td colspan="5"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    _solucoes = await api('solucoes?select=*&order=codigo.asc') || [];
    const ativoFiltro = document.getElementById('sol-filtro-ativo')?.value ?? 'true';
    const lista = ativoFiltro === '' ? _solucoes : _solucoes.filter(s => String(s.ativo) === ativoFiltro);
    let html = '';
    lista.forEach(s => {
      html += `<tr>
        <td style="font-family:monospace;font-weight:700;font-size:12px">${escHtml(s.codigo)}</td>
        <td>${escHtml(s.nome)}</td>
        <td style="color:var(--text2);font-size:12px">${escHtml(s.descricao || '—')}</td>
        <td><span class="${s.ativo ? 'pill-ativo' : 'pill-inativo'}">${s.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td><div class="row-actions"><button class="icon-btn btn-sm" onclick="abrirModalSolucaoId('${s.id}')" title="Editar">✏️</button></div></td>
      </tr>`;
    });
    document.getElementById('cap-solucoes-body').innerHTML = html ||
      '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💡</div><div class="empty-title">Nenhuma solução cadastrada</div></div></td></tr>';
  } catch (e) {
    document.getElementById('cap-solucoes-body').innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><div class="empty-sub">${escHtml(e.message)}</div></div></td></tr>`;
  }
}

export function abrirModalSolucao() {
  _solucaoEditandoId = null;
  document.getElementById('modal-solucao-title').textContent = 'Nova Solução';
  document.getElementById('sol-codigo').value = '';
  document.getElementById('sol-nome').value = '';
  document.getElementById('sol-descricao').value = '';
  document.getElementById('sol-ativo').checked = true;
  openModal('modal-solucao');
}

export function abrirModalSolucaoId(id) {
  const s = _solucoes.find(x => x.id === id);
  if (!s) return;
  _solucaoEditandoId = id;
  document.getElementById('modal-solucao-title').textContent = 'Editar Solução';
  document.getElementById('sol-codigo').value = s.codigo;
  document.getElementById('sol-nome').value = s.nome;
  document.getElementById('sol-descricao').value = s.descricao || '';
  document.getElementById('sol-ativo').checked = s.ativo;
  openModal('modal-solucao');
}

export async function salvarSolucao() {
  const codigo = document.getElementById('sol-codigo').value.trim().toUpperCase();
  const nome = document.getElementById('sol-nome').value.trim();
  const descricao = document.getElementById('sol-descricao').value.trim();
  const ativo = document.getElementById('sol-ativo').checked;
  if (!codigo || !nome) { toast('Código e nome são obrigatórios.', 'error'); return; }
  blockUI('Salvando solução…');
  try {
    if (_solucaoEditandoId) {
      await api(`solucoes?id=eq.${_solucaoEditandoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ codigo, nome, descricao, ativo }),
      });
    } else {
      await api('solucoes', {
        method: 'POST',
        body: JSON.stringify({ codigo, nome, descricao, ativo }),
      });
    }
    closeModal('modal-solucao');
    toast('Solução salva.', 'success');
    await carregarSolucoes();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  } finally {
    unblockUI();
  }
}

// ============================================================
// TABELA DE PREÇOS
// ============================================================

export async function carregarTabelaPrecos() {
  document.getElementById('cap-tabela-body').innerHTML = '<tr><td colspan="6"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    _tabelaPrecos = await api('tabela_precos?select=*,tabela_precos_historico(preco,vigente_ate,alterado_em)&order=categoria.asc,descricao.asc') || [];
    _tabelaPrecos.forEach(i => {
      const hist = (i.tabela_precos_historico || []);
      const current = hist.filter(h => !h.vigente_ate).sort((a,b) => b.alterado_em.localeCompare(a.alterado_em))[0];
      i.preco_atual = current?.preco ?? null;
    });
    _renderTabelaPrecos();
  } catch (e) {
    document.getElementById('cap-tabela-body').innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><div class="empty-sub">${escHtml(e.message)}</div></div></td></tr>`;
  }
}

function _renderTabelaPrecos() {
  const catFiltro = document.getElementById('tabela-filtro-cat')?.value || '';
  const ativoFiltro = document.getElementById('tabela-filtro-ativo')?.value ?? 'true';
  let lista = _tabelaPrecos;
  if (catFiltro) lista = lista.filter(i => i.categoria === catFiltro);
  if (ativoFiltro !== '') lista = lista.filter(i => String(i.ativo) === ativoFiltro);
  const catLabel = { material: 'Material', ferramenta: 'Ferramenta', equipamento: 'Equipamento' };
  let html = '';
  lista.forEach(i => {
    const preco = i.preco_atual !== null ? 'R$ '+parseFloat(i.preco_atual).toFixed(2).replace('.',',') : '<span style="color:var(--text3)">—</span>';
    html += `<tr>
      <td>${escHtml(i.descricao)}</td>
      <td>${escHtml(i.unidade || '—')}</td>
      <td>${catLabel[i.categoria] || i.categoria}</td>
      <td style="font-family:monospace;font-size:11px">${i.tp || '—'}</td>
      <td style="text-align:right;font-weight:700;font-family:monospace">${preco}</td>
      <td><span class="${i.ativo ? 'pill-ativo' : 'pill-inativo'}">${i.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td><div class="row-actions"><button class="icon-btn btn-sm" onclick="abrirModalItemTabelaId('${i.id}')" title="Editar">✏️</button></div></td>
    </tr>`;
  });
  document.getElementById('cap-tabela-body').innerHTML = html ||
    '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">💲</div><div class="empty-title">Nenhum item cadastrado</div></div></td></tr>';
}

export function filtrarTabelaPrecos() { _renderTabelaPrecos(); }

export function abrirModalItemTabela() {
  _tabelaItemEditandoId = null;
  document.getElementById('modal-tabela-title').textContent = 'Novo Item';
  document.getElementById('tab-descricao').value = '';
  document.getElementById('tab-unidade').value = '';
  document.getElementById('tab-categoria').value = 'material';
  document.getElementById('tab-tp').value = '';
  document.getElementById('tab-preco').value = '';
  document.getElementById('tab-ativo').checked = true;
  document.getElementById('tab-pool').checked = true;
  openModal('modal-tabela-item');
}

export function abrirModalItemTabelaId(id) {
  const item = _tabelaPrecos.find(x => x.id === id);
  if (!item) return;
  _tabelaItemEditandoId = id;
  document.getElementById('modal-tabela-title').textContent = 'Editar Item';
  document.getElementById('tab-descricao').value = item.descricao;
  document.getElementById('tab-unidade').value = item.unidade || '';
  document.getElementById('tab-categoria').value = item.categoria;
  document.getElementById('tab-tp').value = item.tp || '';
  document.getElementById('tab-preco').value = item.preco_atual !== null ? item.preco_atual : '';
  document.getElementById('tab-ativo').checked = item.ativo;
  document.getElementById('tab-pool').checked = !item.emitente_id;
  openModal('modal-tabela-item');
}

export async function salvarItemTabela() {
  const descricao = document.getElementById('tab-descricao').value.trim();
  const unidade = document.getElementById('tab-unidade').value.trim();
  const categoria = document.getElementById('tab-categoria').value;
  const tp = document.getElementById('tab-tp').value.trim() || null;
  const precoRaw = document.getElementById('tab-preco').value.replace(',','.');
  const preco = parseFloat(precoRaw);
  const ativo = document.getElementById('tab-ativo').checked;
  const isPool = document.getElementById('tab-pool').checked;
  const emitente_id = isPool ? null : (state.emitentesDoUsuario[0]?.id || null);
  if (!descricao || !unidade || isNaN(preco)) { toast('Descrição, unidade e preço são obrigatórios.', 'error'); return; }
  blockUI('Salvando item…');
  try {
    let item_id;
    if (_tabelaItemEditandoId) {
      await api(`tabela_precos?id=eq.${_tabelaItemEditandoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ descricao, unidade, categoria, tp, ativo }),
      });
      item_id = _tabelaItemEditandoId;
    } else {
      const res = await api('tabela_precos', {
        method: 'POST',
        body: JSON.stringify({ descricao, unidade, categoria, tp, ativo, emitente_id, criado_por: state.currentUser.id }),
      });
      item_id = res[0].id;
    }
    // Close current price record and insert new one
    const existing = _tabelaItemEditandoId
      ? (_tabelaPrecos.find(x => x.id === item_id)?.tabela_precos_historico || []).filter(h => !h.vigente_ate)
      : [];
    for (const h of existing) {
      await api(`tabela_precos_historico?item_id=eq.${item_id}&alterado_em=eq.${encodeURIComponent(h.alterado_em)}`, {
        method: 'PATCH',
        body: JSON.stringify({ vigente_ate: new Date().toISOString() }),
      });
    }
    await api('tabela_precos_historico', {
      method: 'POST',
      body: JSON.stringify({ item_id, preco, alterado_por: state.currentUser.id }),
    });
    closeModal('modal-tabela-item');
    toast('Item salvo.', 'success');
    await carregarTabelaPrecos();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  } finally {
    unblockUI();
  }
}

// ============================================================
// SERVIÇOS DE TERCEIROS
// ============================================================

export async function carregarServicosTerceiros() {
  document.getElementById('cap-servicos-body').innerHTML = '<tr><td colspan="5"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    _servicosTerceiros = await api('servicos_terceiros?select=*,servicos_terceiros_historico(preco,vigente_ate,alterado_em)&order=descricao.asc') || [];
    _servicosTerceiros.forEach(s => {
      const hist = s.servicos_terceiros_historico || [];
      const current = hist.filter(h => !h.vigente_ate).sort((a,b) => b.alterado_em.localeCompare(a.alterado_em))[0];
      s.preco_atual = current?.preco ?? null;
    });
    const ativoFiltro = document.getElementById('serv-filtro-ativo')?.value ?? 'true';
    const lista = ativoFiltro === '' ? _servicosTerceiros : _servicosTerceiros.filter(s => String(s.ativo) === ativoFiltro);
    let html = '';
    lista.forEach(s => {
      const preco = s.preco_atual !== null ? 'R$ '+parseFloat(s.preco_atual).toFixed(2).replace('.',',') : '<span style="color:var(--text3)">—</span>';
      html += `<tr>
        <td>${escHtml(s.descricao)}</td>
        <td>${escHtml(s.unidade || '—')}</td>
        <td>${s.emitente_id ? '<span style="color:var(--text3);font-size:12px">Exclusivo</span>' : '<span class="pill-ativo" style="background:var(--azul-light);color:var(--azul)">Pool</span>'}</td>
        <td style="text-align:right;font-weight:700;font-family:monospace">${preco}</td>
        <td><span class="${s.ativo ? 'pill-ativo' : 'pill-inativo'}">${s.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td><div class="row-actions"><button class="icon-btn btn-sm" onclick="abrirModalServicoId('${s.id}')" title="Editar">✏️</button></div></td>
      </tr>`;
    });
    document.getElementById('cap-servicos-body').innerHTML = html ||
      '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🤝</div><div class="empty-title">Nenhum serviço cadastrado</div></div></td></tr>';
  } catch (e) {
    document.getElementById('cap-servicos-body').innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><div class="empty-sub">${escHtml(e.message)}</div></div></td></tr>`;
  }
}

export function abrirModalServico() {
  _servicoEditandoId = null;
  document.getElementById('modal-servico-title').textContent = 'Novo Serviço de Terceiro';
  document.getElementById('sv-descricao').value = '';
  document.getElementById('sv-unidade').value = '';
  document.getElementById('sv-preco').value = '';
  document.getElementById('sv-ativo').checked = true;
  document.getElementById('sv-pool').checked = true;
  openModal('modal-servico');
}

export function abrirModalServicoId(id) {
  const s = _servicosTerceiros.find(x => x.id === id);
  if (!s) return;
  _servicoEditandoId = id;
  document.getElementById('modal-servico-title').textContent = 'Editar Serviço de Terceiro';
  document.getElementById('sv-descricao').value = s.descricao;
  document.getElementById('sv-unidade').value = s.unidade || '';
  document.getElementById('sv-preco').value = s.preco_atual !== null ? s.preco_atual : '';
  document.getElementById('sv-ativo').checked = s.ativo;
  document.getElementById('sv-pool').checked = !s.emitente_id;
  openModal('modal-servico');
}

export async function salvarServico() {
  const descricao = document.getElementById('sv-descricao').value.trim();
  const unidade = document.getElementById('sv-unidade').value.trim();
  const precoRaw = document.getElementById('sv-preco').value.replace(',','.');
  const preco = parseFloat(precoRaw);
  const ativo = document.getElementById('sv-ativo').checked;
  const isPool = document.getElementById('sv-pool').checked;
  const emitente_id = isPool ? null : (state.emitentesDoUsuario[0]?.id || null);
  if (!descricao || !unidade || isNaN(preco)) { toast('Descrição, unidade e preço são obrigatórios.', 'error'); return; }
  blockUI('Salvando serviço…');
  try {
    let servico_id;
    if (_servicoEditandoId) {
      await api(`servicos_terceiros?id=eq.${_servicoEditandoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ descricao, unidade, ativo }),
      });
      servico_id = _servicoEditandoId;
    } else {
      const res = await api('servicos_terceiros', {
        method: 'POST',
        body: JSON.stringify({ descricao, unidade, ativo, emitente_id, criado_por: state.currentUser.id }),
      });
      servico_id = res[0].id;
    }
    // Close current price and insert new
    const existing = _servicoEditandoId
      ? (_servicosTerceiros.find(x => x.id === servico_id)?.servicos_terceiros_historico || []).filter(h => !h.vigente_ate)
      : [];
    for (const h of existing) {
      await api(`servicos_terceiros_historico?servico_id=eq.${servico_id}&alterado_em=eq.${encodeURIComponent(h.alterado_em)}`, {
        method: 'PATCH',
        body: JSON.stringify({ vigente_ate: new Date().toISOString() }),
      });
    }
    await api('servicos_terceiros_historico', {
      method: 'POST',
      body: JSON.stringify({ servico_id, preco, alterado_por: state.currentUser.id }),
    });
    closeModal('modal-servico');
    toast('Serviço salvo.', 'success');
    await carregarServicosTerceiros();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  } finally {
    unblockUI();
  }
}
