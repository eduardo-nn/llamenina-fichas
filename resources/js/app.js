/* ═══════════════════════════════════════════════════════════════
   LLAMENINA — Fichas Técnicas — App Module (Orquestrador)
   Inicialização, roteamento de views e controle global
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {
  'use strict';

  let currentView = 'list';
  let fichasCache = [];

  /**
   * Inicializa a aplicação
   */
  function init() {
    Config.init();
    FichaForm.init();
    setupEventListeners();
    setupConfigModal();

    // Verificar se há parâmetro ID na URL
    const urlParams = new URLSearchParams(window.location.search);
    const fichaId = urlParams.get('id');

    if (fichaId) {
      if (!Config.isConfigured()) {
        showConfigModal();
        showToast('Configuração necessária', 'Configure o endpoint para carregar a ficha técnica.', 'warning');
      } else {
        switchView('form');
        loadFichaForEdit(fichaId);
      }
    } else {
      // Se não configurado, mostrar modal de config
      if (!Config.isConfigured()) {
        showConfigModal();
      } else {
        switchView('list');
        loadFichas();
      }
    }
  }

  // ═══════════════ EVENT LISTENERS ═══════════════

  function setupEventListeners() {
    // Navegação
    const btnNewFicha = document.getElementById('btn-new-ficha');
    const btnBackToList = document.getElementById('btn-back-list');
    const btnConfig = document.getElementById('btn-config');

    if (btnNewFicha) {
      btnNewFicha.addEventListener('click', () => {
        FichaForm.clearForm();
        switchView('form');
        // Limpar parâmetros da URL ao criar nova ficha
        window.history.pushState({}, '', window.location.pathname);
      });
    }

    if (btnBackToList) {
      btnBackToList.addEventListener('click', () => {
        switchView('list');
        // Limpar parâmetros da URL ao voltar
        window.history.pushState({}, '', window.location.pathname);
      });
    }

    if (btnConfig) {
      btnConfig.addEventListener('click', showConfigModal);
    }

    // Ações do formulário
    const btnSave = document.getElementById('btn-save');
    const btnPrint = document.getElementById('btn-print');
    const btnClear = document.getElementById('btn-clear');

    if (btnSave) {
      btnSave.addEventListener('click', handleSave);
    }

    if (btnPrint) {
      btnPrint.addEventListener('click', handlePrint);
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('Limpar todos os campos do formulário?')) {
          FichaForm.clearForm();
          showToast('Formulário limpo', '', 'info');
        }
      });
    }

    // Busca
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      const debouncedSearch = Security.debounce(handleSearch, 400);
      searchInput.addEventListener('input', debouncedSearch);
    }

    // Refresh
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', loadFichas);
    }
  }

  // ═══════════════ VIEW MANAGEMENT ═══════════════

  /**
   * Alterna entre as views (list, form)
   * @param {string} view - 'list' ou 'form'
   */
  function switchView(view) {
    currentView = view;

    document.querySelectorAll('.view-container').forEach(el => {
      el.classList.remove('active');
    });

    const target = document.getElementById(`view-${view}`);
    if (target) {
      target.classList.add('active');
    }

    // Atualizar título do header
    const subtitle = document.querySelector('.app-header__subtitle');
    if (subtitle) {
      subtitle.textContent = view === 'form'
        ? (FichaForm.getCurrentId() ? 'Editando Ficha' : 'Nova Ficha Técnica')
        : 'Lista de Fichas Técnicas';
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ═══════════════ FICHAS LIST ═══════════════

  /**
   * Carrega a lista de fichas do backend
   */
  async function loadFichas() {
    if (!Config.isConfigured()) {
      renderFichasList([]);
      return;
    }

    const listContainer = document.getElementById('fichas-list-container');
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="skeleton skeleton--card"></div>
        <div class="skeleton skeleton--card"></div>
        <div class="skeleton skeleton--card"></div>
      `;
    }

    try {
      const result = await API.listFichas();
      fichasCache = result.fichas || [];
      renderFichasList(fichasCache);
    } catch (error) {
      console.error('[App] Erro ao carregar fichas:', error);
      renderFichasList([]);

      if (error.code !== 'CONFIG_MISSING') {
        showToast('Erro ao carregar', error.message, 'error');
      }
    }
  }

  /**
   * Renderiza a lista de fichas no DOM
   * @param {Array} fichas
   */
  function renderFichasList(fichas) {
    const container = document.getElementById('fichas-list-container');
    if (!container) return;

    // Atualizar contador
    const counter = document.getElementById('fichas-count');
    if (counter) counter.textContent = fichas.length;

    if (fichas.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 12h6M12 9v6M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/>
            </svg>
          </div>
          <div class="empty-state__title">Nenhuma ficha cadastrada</div>
          <div class="empty-state__desc">Clique em "Nova Ficha" para criar a primeira ficha técnica.</div>
          <button class="btn btn--primary" onclick="App.newFicha()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova Ficha
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = '<div class="fichas-list">' +
      fichas.map((ficha, index) => {
        const s = Security.sanitizeHTML;
        const statusClass = ficha.statusAprovacao === 'aprovada' ? 'success'
          : ficha.statusAprovacao === 'reprovada' ? 'error' : 'warning';
        const statusLabel = ficha.statusAprovacao === 'aprovada' ? 'Aprovada'
          : ficha.statusAprovacao === 'reprovada' ? 'Reprovada' : 'Pendente';

        return `
          <div class="ficha-card" data-ficha-id="${s(ficha.id)}" style="animation-delay: ${index * 0.05}s">
            <div class="ficha-card__header">
              <div>
                <div class="ficha-card__modelo">${s(ficha.modelo || 'Sem título')}</div>
                <div class="ficha-card__ref">${s(ficha.referencia || '—')}</div>
              </div>
              <span class="badge badge--${statusClass}">${statusLabel}</span>
            </div>
            <div class="ficha-card__meta">
              <span class="ficha-card__meta-item">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${s(ficha.modelista || '—')}
              </span>
              <span class="ficha-card__meta-item">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                OP: ${s(ficha.op || '—')}
              </span>
              ${ficha.tecido ? `
              <span class="ficha-card__meta-item">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                ${s(ficha.tecido)}
              </span>` : ''}
            </div>
          </div>
        `;
      }).join('') + '</div>';

    // Click handlers para cards
    container.querySelectorAll('.ficha-card').forEach(card => {
      card.addEventListener('click', () => {
        const fichaId = card.dataset.fichaId;
        loadFichaForEdit(fichaId);
      });
    });
  }

  /**
   * Carrega uma ficha para edição
   * @param {string} fichaId
   */
  async function loadFichaForEdit(fichaId) {
    try {
      // Tentar do cache primeiro
      let ficha = fichasCache.find(f => f.id === fichaId);

      if (!ficha) {
        const result = await API.getFicha(fichaId);
        ficha = result.ficha;
      }

      if (ficha) {
        FichaForm.fillForm(ficha);
        switchView('form');
        showToast('Ficha carregada', `${ficha.modelo} — ${ficha.referencia}`, 'success');
      }
    } catch (error) {
      showToast('Erro ao carregar ficha', error.message, 'error');
    }
  }

  // ═══════════════ HANDLERS ═══════════════

  /**
   * Handler do botão Salvar
   */
  async function handleSave() {
    // Validar
    const validation = FichaForm.validate();
    if (!validation.valid) {
      showToast('Campos obrigatórios', validation.errors[0], 'warning');
      return;
    }

    const data = FichaForm.collectData();
    const saveBtn = document.getElementById('btn-save');

    // UI feedback
    if (saveBtn) saveBtn.classList.add('loading');
    try {
      const isUpdate = !!FichaForm.getCurrentId();
      const result = await API.saveFicha(data, isUpdate);
      showToast(
        'Ficha salva!',
        `${data.modelo} — ${data.referencia}`,
        'success'
      );
      Config.clearDraft();

      // Se for uma criação nova, carregar a ficha salva para que o ID e QR Code fiquem ativos
      if (result.id) {
        try {
          const getResult = await API.getFicha(result.id);
          if (getResult && getResult.ficha) {
            FichaForm.fillForm(getResult.ficha);
          }
        } catch (err) {
          console.warn('[App] Erro ao carregar ficha recém-salva:', err);
        }
      }

      // Atualizar lista em background
      loadFichas();

    } catch (error) {
      showToast('Erro ao salvar', error.message, 'error');
    } finally {
      if (saveBtn) saveBtn.classList.remove('loading');
    }
  }

  /**
   * Handler do botão Imprimir
   */
  function handlePrint() {
    try {
      console.log('[App] handlePrint iniciado');
      const fichaId = FichaForm.getCurrentId();
      if (!fichaId) {
        if (confirm('A ficha técnica não foi salva no banco de dados. O QR Code único de consulta não estará ativo na impressão. Deseja imprimir mesmo assim?')) {
          PrintModule.print();
        }
      } else {
        PrintModule.print();
      }
    } catch (err) {
      alert('Erro ao processar impressão: ' + err.message);
      console.error('[App] Erro em handlePrint:', err);
    }
  }



  /**
   * Handler da busca
   */
  async function handleSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;

    const query = input.value.trim();

    if (query.length === 0) {
      renderFichasList(fichasCache);
      return;
    }

    // Busca local primeiro (performance)
    const localResults = fichasCache.filter(ficha => {
      const searchStr = [
        ficha.modelo, ficha.referencia, ficha.op,
        ficha.modelista, ficha.tecido
      ].join(' ').toLowerCase();
      return searchStr.includes(query.toLowerCase());
    });

    renderFichasList(localResults);

    // Se poucas resultados locais, buscar no backend
    if (localResults.length === 0 && Config.isConfigured()) {
      try {
        const result = await API.searchFichas(query);
        if (result.fichas && result.fichas.length > 0) {
          renderFichasList(result.fichas);
        }
      } catch (error) {
        console.warn('[App] Erro na busca remota:', error.message);
      }
    }
  }

  // ═══════════════ CONFIG MODAL ═══════════════

  function setupConfigModal() {
    const closeBtn = document.getElementById('config-modal-close');
    const overlay = document.getElementById('config-modal-overlay');
    const saveConfigBtn = document.getElementById('btn-save-config');
    const testBtn = document.getElementById('btn-test-connection');

    if (closeBtn) {
      closeBtn.addEventListener('click', hideConfigModal);
    }

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideConfigModal();
      });
    }

    if (saveConfigBtn) {
      saveConfigBtn.addEventListener('click', handleSaveConfig);
    }

    if (testBtn) {
      testBtn.addEventListener('click', handleTestConnection);
    }

    // Preencher campos se já configurado
    const endpointInput = document.getElementById('config-endpoint');
    const tokenInput = document.getElementById('config-token');
    const publicUrlInput = document.getElementById('config-public-url');

    if (endpointInput && Config.getEndpoint()) {
      endpointInput.value = Config.getEndpoint();
    }
    if (tokenInput && Config.getToken()) {
      tokenInput.value = Config.getToken();
    }
    if (publicUrlInput && Config.getPublicUrl()) {
      publicUrlInput.value = Config.getPublicUrl();
    }
  }

  function showConfigModal() {
    const overlay = document.getElementById('config-modal-overlay');
    if (overlay) overlay.classList.add('active');
  }

  function hideConfigModal() {
    const overlay = document.getElementById('config-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  async function handleSaveConfig() {
    const endpointInput = document.getElementById('config-endpoint');
    const tokenInput = document.getElementById('config-token');
    const publicUrlInput = document.getElementById('config-public-url');

    try {
      Config.setEndpoint(endpointInput.value);
      Config.setToken(tokenInput.value);
      if (publicUrlInput) {
        Config.setPublicUrl(publicUrlInput.value);
      }
      showToast('Configuração salva', 'Configurações salvas com sucesso.', 'success');
      hideConfigModal();
      loadFichas();
    } catch (error) {
      showToast('Erro na configuração', error.message, 'error');
    }
  }

  async function handleTestConnection() {
    const testBtn = document.getElementById('btn-test-connection');
    if (testBtn) testBtn.classList.add('loading');

    // Salvar temporariamente
    const endpointInput = document.getElementById('config-endpoint');
    const tokenInput = document.getElementById('config-token');
    const publicUrlInput = document.getElementById('config-public-url');

    try {
      Config.setEndpoint(endpointInput.value);
      Config.setToken(tokenInput.value);
      if (publicUrlInput) {
        Config.setPublicUrl(publicUrlInput.value);
      }

      const ok = await API.testConnection();
      if (ok) {
        showToast('Conexão OK', 'Endpoint respondeu corretamente!', 'success');
      } else {
        showToast('Falha na conexão', 'O endpoint não respondeu corretamente.', 'error');
      }
    } catch (error) {
      showToast('Erro', error.message, 'error');
    } finally {
      if (testBtn) testBtn.classList.remove('loading');
    }
  }

  // ═══════════════ TOAST NOTIFICATIONS ═══════════════

  /**
   * Exibe uma notificação toast
   * @param {string} title
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration - Duração em ms (default 4000)
   */
  function showToast(title, message = '', type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconMap = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <div class="toast__icon">${iconMap[type]}</div>
      <div class="toast__content">
        <div class="toast__title">${Security.sanitizeHTML(title)}</div>
        ${message ? `<div class="toast__message">${Security.sanitizeHTML(message)}</div>` : ''}
      </div>
      <button class="toast__close" title="Fechar">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    // Close handler
    toast.querySelector('.toast__close').addEventListener('click', () => removeToast(toast));

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => removeToast(toast), duration);
  }

  function removeToast(toast) {
    if (!toast || !toast.parentElement) return;
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 250);
  }

  // ═══════════════ PUBLIC API ═══════════════

  function newFicha() {
    FichaForm.clearForm();
    switchView('form');
  }

  return {
    init,
    switchView,
    newFicha,
    showToast,
    loadFichas
  };
})();

// ── Inicializar quando o DOM estiver pronto ──
document.addEventListener('DOMContentLoaded', App.init);
