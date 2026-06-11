import { login, logout, showSection } from './auth.js';
import { openModal, closeModal } from './ui.js';
import {
  switchPropTab, abrirNovaPropostaModal, criarProposta, abrirProposta,
  abrirModalSuspensao, confirmarAlteracaoSuspensao, carregarClientesNovaProposta,
} from './propostas.js';
import {
  carregarPessoas, renderPessoas, selecionarPessoa, fecharPainel, editarPessoaSelecionada,
  toggleAtivoPessoa, atualizarDocLabel, abrirModalPessoa, salvarPessoa,
  abrirModalContato, editarContato, salvarContato, inativarContato,
} from './pessoas.js';
import {
  switchAdminTab, abrirModalNovoAdmin, salvarNumeracao, abrirModalNumeracaoIdx,
  carregarUsuariosAdmin, abrirModalNovoUsuario, abrirModalEditarUsuario,
  salvarUsuario, toggleAtivoUsuario,
  carregarEmitentesAdmin, abrirModalNovoEmitente, abrirModalEditarEmitente,
  previewLogo, removerLogo, salvarEmitente,
} from './admin.js';
import {
  switchCapTab,
  carregarParametros, onChangeParamEmitente, abrirModalEditarParam, abrirModalAdicionarParam, salvarParam,
  carregarFuncoes, abrirModalFuncao, abrirModalFuncaoId, salvarFuncao, toggleFuncaoAtivo,
  carregarProfissionais, abrirModalProfissional, abrirModalProfissionalId, salvarProfissional, toggleProfissionalAtivo,
  carregarSolucoes, abrirModalSolucao, abrirModalSolucaoId, salvarSolucao, toggleSolucaoAtivo,
  carregarTabelaPrecos, filtrarTabelaPrecos, abrirModalItemTabela, abrirModalItemTabelaId, salvarItemTabela, toggleItemTabelaAtivo,
  carregarServicosTerceiros, abrirModalServico, abrirModalServicoId, salvarServico, toggleServicoAtivo,
} from './capilaridade.js';

// Expose all functions called from inline onclick attributes
Object.assign(window, {
  login, logout, showSection,
  openModal, closeModal,
  switchPropTab, abrirNovaPropostaModal, criarProposta, abrirProposta,
  abrirModalSuspensao, confirmarAlteracaoSuspensao, carregarClientesNovaProposta,
  carregarPessoas, renderPessoas, selecionarPessoa, fecharPainel, editarPessoaSelecionada,
  toggleAtivoPessoa, atualizarDocLabel, abrirModalPessoa, salvarPessoa,
  abrirModalContato, editarContato, salvarContato, inativarContato,
  switchAdminTab, abrirModalNovoAdmin, salvarNumeracao, abrirModalNumeracaoIdx,
  carregarUsuariosAdmin, abrirModalNovoUsuario, abrirModalEditarUsuario,
  salvarUsuario, toggleAtivoUsuario,
  carregarEmitentesAdmin, abrirModalNovoEmitente, abrirModalEditarEmitente,
  previewLogo, removerLogo, salvarEmitente,
  switchCapTab,
  carregarParametros, onChangeParamEmitente, abrirModalEditarParam, abrirModalAdicionarParam, salvarParam,
  carregarFuncoes, abrirModalFuncao, abrirModalFuncaoId, salvarFuncao, toggleFuncaoAtivo,
  carregarProfissionais, abrirModalProfissional, abrirModalProfissionalId, salvarProfissional, toggleProfissionalAtivo,
  carregarSolucoes, abrirModalSolucao, abrirModalSolucaoId, salvarSolucao, toggleSolucaoAtivo,
  carregarTabelaPrecos, filtrarTabelaPrecos, abrirModalItemTabela, abrirModalItemTabelaId, salvarItemTabela, toggleItemTabelaAtivo,
  carregarServicosTerceiros, abrirModalServico, abrirModalServicoId, salvarServico, toggleServicoAtivo,
});

// Close modal when clicking the overlay background
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

// Login keyboard shortcuts
document.getElementById('login-senha').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
document.getElementById('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-senha').focus(); });
