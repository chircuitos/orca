import { state } from './state.js';
import { api } from './api.js';
import { escHtml } from './utils.js';
import { openModal, closeModal, blockUI, unblockUI, toast } from './ui.js';

export async function carregarPropostas() {
  document.getElementById('tabela-propostas').innerHTML = '<tr><td colspan="6"><div class="loading"><div class="spinner"></div> Carregando…</div></td></tr>';
  try {
    state.todasPropostas = await api('propostas?select=id,prefixo,ano,numero,revisao,status,objetivo,criado_em,criado_por,emitentes(nome_fantasia,prefixo),pessoas(razao_social)&order=criado_em.desc') || [];
    atualizarStatsPropostas();
    renderPropostas();
    await carregarSelectsNovaProposta();
  } catch (e) {
    document.getElementById('tabela-propostas').innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro</div><div class="empty-sub">${escHtml(e.message)}</div></div></td></tr>`;
  }
}

export function atualizarStatsPropostas() {
  const c = s => state.todasPropostas.filter(p => p.status === s).length;
  [['elaboracao','em_elaboracao'],['emitida','emitida'],['followup','em_follow_up'],['revisao','em_revisao'],['suspensa','suspensa']].forEach(([k,s]) => document.getElementById('stat-'+k).textContent = c(s));
  document.getElementById('count-ativas').textContent = state.todasPropostas.filter(p => ['em_elaboracao','emitida','em_follow_up','em_revisao','suspensa'].includes(p.status)).length;
  document.getElementById('count-conquistadas').textContent = state.todasPropostas.filter(p => p.status === 'conquistada').length;
  document.getElementById('count-encerradas').textContent = state.todasPropostas.filter(p => ['perdida','cancelada'].includes(p.status)).length;
}

export function switchPropTab(tab) {
  state.currentPropTab = tab;
  ['ativas','conquistadas','encerradas'].forEach(t => document.getElementById('tab-'+t).classList.toggle('active', t === tab));
  document.getElementById('titulo-aba').textContent = {ativas:'Ativas',conquistadas:'Conquistadas',encerradas:'Encerradas'}[tab];
  document.getElementById('stats-bar').style.display = tab === 'ativas' ? 'flex' : 'none';
  document.getElementById('btn-nova-proposta').style.display = (tab === 'ativas' && (state.currentUser?.pode_criar_proposta || state.currentUser?.is_admin)) ? '' : 'none';
  renderPropostas();
}

export function renderPropostas() {
  const filtros = {
    ativas: ['em_elaboracao','emitida','em_follow_up','em_revisao','suspensa'],
    conquistadas: ['conquistada'],
    encerradas: ['perdida','cancelada'],
  };
  const STATUS = {
    em_elaboracao:'Em Elaboração', emitida:'Emitida', em_follow_up:'Follow-up',
    em_revisao:'Em Revisão', suspensa:'Suspensa', conquistada:'Conquistada',
    perdida:'Perdida', cancelada:'Cancelada',
  };
  const lista = state.todasPropostas.filter(p => filtros[state.currentPropTab].includes(p.status));
  const tbody = document.getElementById('tabela-propostas');
  if (!lista.length) {
    const msgs = {
      ativas: ['📋','Nenhuma proposta ativa','Crie uma nova proposta para começar.'],
      conquistadas: ['🏆','Nenhuma proposta conquistada',''],
      encerradas: ['📁','Nenhuma proposta encerrada',''],
    };
    const [icon,title,sub] = msgs[state.currentPropTab];
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><div class="empty-sub">${sub}</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(p => {
    const num = `${p.prefixo}-ORC-${String(p.ano).slice(-2)}${String(p.numero).padStart(3,'0')}`;
    const podeAgir = state.currentUser.is_admin || p.criado_por === state.currentUser.id;
    const statusSuspendivel = ['em_elaboracao','emitida','em_follow_up','em_revisao'].includes(p.status);
    let btnAcao = '';
    if (podeAgir && p.status === 'suspensa') {
      btnAcao = `<button class="btn-suspensao" title="Liberar suspensão" onclick="abrirModalSuspensao('${p.id}','liberar',event)">▶</button>`;
    } else if (podeAgir && statusSuspendivel) {
      btnAcao = `<button class="btn-suspensao" title="Suspender proposta" onclick="abrirModalSuspensao('${p.id}','suspender',event)">⏸</button>`;
    }
    return `<tr class="clickable${p.status === 'suspensa' ? ' suspensa' : ''}" onclick="abrirProposta('${p.id}')">
      <td><span class="prop-num">${num}</span><span class="prop-rev">REV${String(p.revisao).padStart(2,'0')}</span></td>
      <td><span class="emit-tag">${escHtml(p.emitentes?.nome_fantasia || p.emitentes?.prefixo || '—')}</span></td>
      <td style="font-weight:600">${escHtml(p.pessoas?.razao_social || '—')}</td>
      <td><div class="obj-text" title="${escHtml(p.objetivo || '')}">${escHtml(p.objetivo || '—')}</div></td>
      <td><span class="status-pill s-${p.status}">${STATUS[p.status] || p.status}</span></td>
      <td><span class="date-text">${new Date(p.criado_em).toLocaleDateString('pt-BR')}</span></td>
      <td style="text-align:center">${btnAcao}</td>
    </tr>`;
  }).join('');
}

export async function carregarSelectsNovaProposta() {
  try {
    let emits;
    if (state.currentUser.is_admin) {
      emits = await api('emitentes?ativo=eq.true&select=id,nome_fantasia,prefixo&order=nome_fantasia') || [];
    } else {
      const ids = state.emitentesDoUsuario.map(e => e.id);
      emits = ids.length
        ? await api('emitentes?ativo=eq.true&id=in.(' + ids.join(',') + ')&select=id,nome_fantasia,prefixo&order=nome_fantasia') || []
        : [];
    }
    if (emits.length) state.todosEmitentes = emits;
    const sel = document.getElementById('np-emitente');
    sel.innerHTML = '<option value="">— selecione —</option>';
    emits.forEach(e => {
      const o = document.createElement('option');
      o.value = e.id;
      o.textContent = e.nome_fantasia || e.prefixo;
      sel.appendChild(o);
    });
    document.getElementById('np-cliente').innerHTML = '<option value="">— selecione o emitente primeiro —</option>';
  } catch (e) {
    console.error('carregarSelectsNovaProposta:', e);
  }
}

export async function carregarClientesNovaProposta() {
  const eid = document.getElementById('np-emitente').value;
  const selC = document.getElementById('np-cliente');
  selC.innerHTML = '<option value="">— selecione —</option>';
  if (!eid) return;
  try {
    const cli = await api(`pessoas?is_cliente=eq.true&ativo=eq.true&emitente_id=eq.${eid}&select=id,razao_social,nome_fantasia&order=razao_social`) || [];
    if (!cli.length) {
      selC.innerHTML = '<option value="">— nenhum cliente cadastrado —</option>';
      return;
    }
    cli.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.razao_social + (c.nome_fantasia && c.nome_fantasia !== c.razao_social ? ' (' + c.nome_fantasia + ')' : '');
      selC.appendChild(o);
    });
  } catch (e) {
    console.error('carregarClientesNovaProposta:', e);
  }
}

export function abrirNovaPropostaModal() {
  if (!state.currentUser?.pode_criar_proposta && !state.currentUser?.is_admin) {
    toast('Você não tem permissão para criar propostas.', 'warn');
    return;
  }
  openModal('modal-nova-proposta');
}

export async function criarProposta() {
  const eid = document.getElementById('np-emitente').value;
  const cid = document.getElementById('np-cliente').value;
  if (!eid) { toast('Selecione o emitente', 'error'); return; }
  if (!cid) { toast('Selecione o cliente', 'error'); return; }
  blockUI('Criando proposta…');
  try {
    const num = await api('rpc/gerar_numero_proposta', { method: 'POST', body: JSON.stringify({ p_emitente_id: eid }) });
    const em = await api(`emitentes?id=eq.${eid}&select=prefixo`);
    const nova = await api('propostas', { method: 'POST', body: JSON.stringify({
      emitente_id: eid,
      cliente_id: cid,
      tipo_cliente: document.getElementById('np-tipo-cliente').value,
      prefixo: em[0].prefixo,
      ano: new Date().getFullYear(),
      numero: num,
      revisao: 0,
      status: 'em_elaboracao',
      objetivo: document.getElementById('np-objetivo').value.trim() || null,
      data_inicio_estimada: document.getElementById('np-data-inicio').value || null,
      prazo_vigencia_dias: parseInt(document.getElementById('np-prazo').value) || null,
      criado_por: state.currentUser.id,
    }) });
    await api('rpc/snapshot_parametros_emitente', { method: 'POST', body: JSON.stringify({ p_proposta_id: nova[0].id, p_emitente_id: eid, p_usuario_id: state.currentUser.id }) });
    closeModal('modal-nova-proposta');
    toast('Proposta criada ✓', 'success');
    await carregarPropostas();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
  unblockUI();
}

export function abrirProposta() {
  toast('Tela da proposta em desenvolvimento', 'warn');
}

export function abrirModalSuspensao(id, acao, event) {
  event.stopPropagation();
  const p = state.todasPropostas.find(x => x.id === id);
  if (!p) return;
  const num = `${p.prefixo}-ORC-${String(p.ano).slice(-2)}${String(p.numero).padStart(3,'0')}-REV${String(p.revisao).padStart(2,'0')}`;
  state.suspensaoAtual = { id, acao };
  document.getElementById('modal-suspensao-title').textContent = acao === 'suspender' ? 'Suspender Proposta' : 'Liberar Suspensão';
  document.getElementById('modal-suspensao-desc').textContent = acao === 'suspender'
    ? `A proposta ${num} será suspensa e não poderá ser editada até ser liberada. Informe a justificativa:`
    : `A proposta ${num} voltará ao status anterior à suspensão. Informe a justificativa:`;
  document.getElementById('suspensao-justificativa').value = '';
  document.getElementById('btn-confirmar-suspensao').textContent = acao === 'suspender' ? 'Suspender' : 'Liberar';
  document.getElementById('btn-confirmar-suspensao').className = 'btn ' + (acao === 'suspender' ? 'btn-danger' : 'btn-primary');
  openModal('modal-suspensao');
  setTimeout(() => document.getElementById('suspensao-justificativa').focus(), 150);
}

export async function confirmarAlteracaoSuspensao() {
  const just = document.getElementById('suspensao-justificativa').value.trim();
  if (!just) { toast('Informe a justificativa.', 'warn'); return; }
  blockUI('Processando…');
  try {
    await api('rpc/alterar_suspensao_proposta', { method: 'POST', body: JSON.stringify({
      p_proposta_id: state.suspensaoAtual.id,
      p_acao: state.suspensaoAtual.acao,
      p_justificativa: just,
    }) });
    closeModal('modal-suspensao');
    const msg = state.suspensaoAtual.acao === 'suspender' ? 'Proposta suspensa.' : 'Suspensão liberada.';
    toast(msg, 'success');
    await carregarPropostas();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  }
  unblockUI();
}
