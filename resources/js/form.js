/* ═══════════════════════════════════════════════════════════════
   LLAMENINA — Fichas Técnicas — Form Module
   Gerenciamento do formulário de fichas técnicas
   ═══════════════════════════════════════════════════════════════ */

const FichaForm = (() => {
  'use strict';

  let currentFichaId = null;
  let autoSaveTimer = null;
  let currentFotos = [];

  // ── IDs dos campos do formulário ──
  const FIELDS = {
    // Cabeçalho
    modelo: 'field-modelo',
    referencia: 'field-referencia',
    op: 'field-op',
    modelista: 'field-modelista',
    pilotista: 'field-pilotista',
    tecido: 'field-tecido',
    composicao: 'field-composicao',
    corLinha: 'field-cor-linha',
    // Fluxo de Produção
    corte: 'field-corte',
    bordadoSilk: 'field-bordado-silk',
    confeccao: 'field-confeccao',
    lavanderia: 'field-lavanderia',
    lacreLavanderia: 'field-lacre-lavanderia',
    acabamento: 'field-acabamento',
    faseFinal: 'field-fase-final',
    // Observações
    obsCostura: 'field-obs-costura',
    // Aprovação
    responsavelAprovacao: 'field-responsavel',
    dataAprovacao: 'field-data-aprovacao'
  };

  /**
   * Inicializa o módulo de formulário
   */
  function init() {
    setupMeasureTableEvents();
    setupColorComboEvents();
    setupAutoSave();
    setupFieldValidation();
    setupQRPreview();
    setupPhotoUploadEvents();
    loadDraft();
  }

  /**
   * Coleta todos os dados do formulário em um objeto JSON
   * @returns {Object}
   */
  function collectData() {
    const data = {};

    // ID existente (para update) ou gerar um novo se for criação
    if (currentFichaId) {
      data.id = currentFichaId;
    } else {
      data.id = Security.generateId();
    }

    // Campos simples
    for (const [key, elementId] of Object.entries(FIELDS)) {
      const el = document.getElementById(elementId);
      if (el) {
        data[key] = el.value.trim();
      }
    }

    // Gerar SEMPRE a URL do QR Code apontando para a página de FOTOS
    if (data.id) {
      let baseUrl = Config.getPublicUrl();
      if (!baseUrl || baseUrl.trim() === '') {
        baseUrl = window.location.href.split('?')[0];
      }
      // Apontar para fotos.html (página exclusiva de visualização de fotos)
      baseUrl = baseUrl.replace(/index\.html$/, 'fotos.html');
      if (!baseUrl.endsWith('fotos.html')) {
        // Se a URL não termina com fotos.html, adicionar
        if (baseUrl.endsWith('/')) {
          baseUrl += 'fotos.html';
        } else {
          baseUrl += '/fotos.html';
        }
      }
      data.qrCorteUrl = baseUrl + '?id=' + data.id;
    }

    // Status de aprovação
    const statusRadio = document.querySelector('input[name="status-aprovacao"]:checked');
    data.statusAprovacao = statusRadio ? statusRadio.value : 'pendente';

    // Tabela de medidas P/M/G
    data.medidasPMG = collectMeasureTable('measure-table-pmg');

    // Tabela de medidas numeração
    data.medidasNumeracao = collectMeasureTable('measure-table-num');

    // Título das tabelas
    const titlePMG = document.getElementById('measure-title-pmg');
    const titleNum = document.getElementById('measure-title-num');
    data.medidasPMGTitulo = titlePMG ? titlePMG.value.trim() : '';
    data.medidasNumeracaoTitulo = titleNum ? titleNum.value.trim() : '';

    // Combinações de cores
    data.combinacoesCores = collectColorCombos();

    // Fotos (Salva como string JSON do array de fotos)
    data.foto = JSON.stringify(currentFotos);

    return data;
  }

  /**
   * Coleta dados de uma tabela de medidas
   * @param {string} tableId - ID da tabela
   * @returns {Array}
   */
  function collectMeasureTable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return [];

    const rows = table.querySelectorAll('tbody tr');
    const headers = Array.from(table.querySelectorAll('thead th'))
      .map(th => th.textContent.trim())
      .filter(h => h && h !== 'Descrição' && h !== '');

    const data = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length === 0) return;

      const descInput = cells[0]?.querySelector('input');
      const desc = descInput ? descInput.value.trim() : '';

      if (!desc) return; // Pular linhas sem descrição

      const values = {};
      for (let i = 1; i < cells.length; i++) {
        const input = cells[i]?.querySelector('input');
        if (input && headers[i - 1]) {
          values[headers[i - 1]] = input.value.trim();
        }
      }

      data.push({ descricao: desc, valores: values });
    });

    return data;
  }

  /**
   * Coleta combinações de cores do bordado
   * @returns {Array}
   */
  function collectColorCombos() {
    const container = document.getElementById('color-combos-container');
    if (!container) return [];

    const rows = container.querySelectorAll('.color-combo-row');
    const combos = [];

    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      if (inputs.length >= 2) {
        const peca = inputs[0].value.trim();
        const bordado = inputs[1].value.trim();
        if (peca || bordado) {
          combos.push({ peca, bordado });
        }
      }
    });

    return combos;
  }

  /**
   * Preenche o formulário com dados de uma ficha existente
   * @param {Object} data - Dados da ficha
   */
  function fillForm(data) {
    if (!data) return;

    currentFichaId = data.id || null;

    // Campos simples
    for (const [key, elementId] of Object.entries(FIELDS)) {
      const el = document.getElementById(elementId);
      if (el && data[key] !== undefined) {
        el.value = Security.sanitizeHTML(String(data[key]));
      }
    }

    // Status de aprovação
    if (data.statusAprovacao) {
      const radio = document.querySelector(`input[name="status-aprovacao"][value="${Security.sanitizeHTML(data.statusAprovacao)}"]`);
      if (radio) radio.checked = true;
    }

    // Tabela P/M/G
    if (data.medidasPMGTitulo) {
      const titleEl = document.getElementById('measure-title-pmg');
      if (titleEl) titleEl.value = Security.sanitizeHTML(data.medidasPMGTitulo);
    }
    if (data.medidasPMG && Array.isArray(data.medidasPMG)) {
      fillMeasureTable('measure-table-pmg', data.medidasPMG);
    }

    // Tabela Numeração
    if (data.medidasNumeracaoTitulo) {
      const titleEl = document.getElementById('measure-title-num');
      if (titleEl) titleEl.value = Security.sanitizeHTML(data.medidasNumeracaoTitulo);
    }
    if (data.medidasNumeracao && Array.isArray(data.medidasNumeracao)) {
      fillMeasureTable('measure-table-num', data.medidasNumeracao);
    }

    // Combinações de cores
    if (data.combinacoesCores && Array.isArray(data.combinacoesCores)) {
      fillColorCombos(data.combinacoesCores);
    }

    // Carregar fotos
    if (data.foto) {
      try {
        const parsed = JSON.parse(data.foto);
        if (Array.isArray(parsed)) {
          setPhotos(parsed);
        } else {
          setPhotos([data.foto]);
        }
      } catch (e) {
        setPhotos([data.foto]); // Fallback se for base64 único antigo (não-JSON)
      }
    } else {
      clearPhotos();
    }

    // Atualizar previews de QR
    updateAllQRPreviews();
  }

  /**
   * Preenche uma tabela de medidas com dados
   * @param {string} tableId
   * @param {Array} data
   */
  function fillMeasureTable(tableId, data) {
    const table = document.getElementById(tableId);
    if (!table || !data.length) return;

    const tbody = table.querySelector('tbody');
    const headers = Array.from(table.querySelectorAll('thead th'))
      .map(th => th.textContent.trim())
      .filter(h => h && h !== 'Descrição' && h !== '');

    // Limpar e recriar linhas
    tbody.innerHTML = '';
    data.forEach(item => {
      const row = createMeasureRow(headers, item.descricao, item.valores);
      tbody.appendChild(row);
    });

    // Adicionar linha vazia extra
    tbody.appendChild(createMeasureRow(headers));
  }

  /**
   * Cria uma linha de tabela de medidas
   * @param {string[]} headers
   * @param {string} [desc='']
   * @param {Object} [values={}]
   * @returns {HTMLTableRowElement}
   */
  function createMeasureRow(headers, desc = '', values = {}) {
    const row = document.createElement('tr');

    // Célula de descrição
    const descCell = document.createElement('td');
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'form-input';
    descInput.placeholder = 'Ex.: Comprimento';
    descInput.value = Security.sanitizeHTML(desc);
    descCell.appendChild(descInput);
    row.appendChild(descCell);

    // Células de valores
    headers.forEach(header => {
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input';
      input.placeholder = '—';
      input.value = values[header] ? Security.sanitizeHTML(String(values[header])) : '';
      cell.appendChild(input);
      row.appendChild(cell);
    });

    return row;
  }

  /**
   * Preenche as combinações de cores
   * @param {Array} combos
   */
  function fillColorCombos(combos) {
    const container = document.getElementById('color-combos-container');
    if (!container) return;

    container.innerHTML = '';
    combos.forEach(combo => {
      addColorCombo(combo.peca, combo.bordado);
    });
    // Adicionar uma linha vazia extra
    addColorCombo();
  }

  /**
   * Adiciona uma nova linha de combinação de cores
   * @param {string} [peca='']
   * @param {string} [bordado='']
   */
  function addColorCombo(peca = '', bordado = '') {
    const container = document.getElementById('color-combos-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'color-combo-row';
    row.innerHTML = `
      <input type="text" class="form-input" placeholder="Cor da Peça" value="${Security.sanitizeHTML(peca)}">
      <span class="color-combo-row__separator">→</span>
      <input type="text" class="form-input" placeholder="Cor do Bordado" value="${Security.sanitizeHTML(bordado)}">
      <button type="button" class="btn btn--ghost btn--icon color-combo-remove" data-tooltip="Remover">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    // Event listener para remover
    row.querySelector('.color-combo-remove').addEventListener('click', () => {
      row.classList.add('removing');
      setTimeout(() => row.remove(), 250);
    });

    container.appendChild(row);
  }

  /**
   * Configura eventos das tabelas de medidas
   */
  function setupMeasureTableEvents() {
    // Botões "Adicionar Linha"
    document.querySelectorAll('[data-add-measure-row]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tableId = btn.dataset.addMeasureRow;
        const table = document.getElementById(tableId);
        if (!table) return;

        const headers = Array.from(table.querySelectorAll('thead th'))
          .map(th => th.textContent.trim())
          .filter(h => h && h !== 'Descrição' && h !== '');

        const tbody = table.querySelector('tbody');
        tbody.appendChild(createMeasureRow(headers));
      });
    });
  }

  /**
   * Configura eventos para combinações de cores
   */
  function setupColorComboEvents() {
    const addBtn = document.getElementById('add-color-combo');
    if (addBtn) {
      addBtn.addEventListener('click', () => addColorCombo());
    }
  }

  /**
   * Configura auto-save de rascunho (debounced)
   */
  function setupAutoSave() {
    const formContainer = document.getElementById('view-form');
    if (!formContainer) return;

    const debouncedSave = Security.debounce(() => {
      const data = collectData();
      Config.saveDraft(data);
    }, 5000); // Salva rascunho a cada 5s de inatividade

    formContainer.addEventListener('input', debouncedSave);
  }

  /**
   * Configura validação em tempo real dos campos
   */
  function setupFieldValidation() {
    // Campos obrigatórios
    const requiredFields = ['field-modelo', 'field-referencia'];

    requiredFields.forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (!el) return;

      el.addEventListener('blur', () => {
        const errorEl = el.parentElement.querySelector('.form-error');
        if (el.value.trim() === '') {
          el.classList.add('error');
          if (errorEl) errorEl.classList.add('visible');
        } else {
          el.classList.remove('error');
          if (errorEl) errorEl.classList.remove('visible');
        }
      });

      el.addEventListener('input', () => {
        if (el.value.trim() !== '') {
          el.classList.remove('error');
          const errorEl = el.parentElement.querySelector('.form-error');
          if (errorEl) errorEl.classList.remove('visible');
        }
      });
    });

    // Campos URL
    const urlFields = ['field-link-acesso', 'field-qr-corte', 'field-qr-anexos', 'field-qr-feedback'];
    urlFields.forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (!el) return;

      el.addEventListener('blur', () => {
        const val = el.value.trim();
        if (val && !Security.validateURL(val)) {
          el.classList.add('error');
        } else {
          el.classList.remove('error');
        }
      });
    });
  }

  /**
   * Configura eventos do QR Code automático
   */
  function setupQRPreview() {
    const copyBtn = document.getElementById('btn-copy-qr-url');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const urlInput = document.getElementById('qr-auto-url');
        if (urlInput && urlInput.value) {
          navigator.clipboard.writeText(urlInput.value)
            .then(() => App.showToast('Link copiado', 'URL copiada para a área de transferência', 'success'))
            .catch(() => App.showToast('Erro ao copiar', 'Falha ao copiar link', 'error'));
        }
      });
    }
  }

  /**
   * Atualiza o QR code automático da peça
   */
  function updateAllQRPreviews() {
    const pendingDiv = document.getElementById('qr-auto-pending');
    const generatedDiv = document.getElementById('qr-auto-generated');
    const previewDiv = document.getElementById('qr-auto-preview');
    const urlInput = document.getElementById('qr-auto-url');

    if (!pendingDiv || !generatedDiv || !previewDiv || !urlInput) return;

    previewDiv.innerHTML = '';

    if (currentFichaId) {
      // Gerar a URL única baseada na origem e no ID da ficha
      const baseUrl = window.location.href.split('?')[0];
      const uniqueUrl = baseUrl + '?id=' + currentFichaId;
      urlInput.value = uniqueUrl;

      if (typeof QRCode === 'undefined') {
        previewDiv.innerHTML = '<span class="qr-preview--empty" style="color: var(--color-error); font-size: var(--font-size-xs);">Biblioteca QRCode não carregada</span>';
        pendingDiv.style.display = 'none';
        generatedDiv.style.display = 'flex';
        return;
      }

      try {
        new QRCode(previewDiv, {
          text: uniqueUrl,
          width: 120,
          height: 120,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
        pendingDiv.style.display = 'none';
        generatedDiv.style.display = 'flex';
      } catch (e) {
        console.error('Erro ao gerar QR Code automático:', e);
        previewDiv.innerHTML = '<span class="qr-preview--empty">Erro</span>';
      }
    } else {
      urlInput.value = '';
      pendingDiv.style.display = 'flex';
      generatedDiv.style.display = 'none';
    }
  }

  /**
   * Tenta carregar rascunho salvo
   */
  function loadDraft() {
    const draft = Config.loadDraft();
    if (draft) {
      fillForm(draft);
    }
  }

  /**
   * Limpa o formulário completamente
   */
  function clearForm() {
    currentFichaId = null;

    // Limpar campos de texto
    for (const elementId of Object.values(FIELDS)) {
      const el = document.getElementById(elementId);
      if (el) {
        el.value = '';
        el.classList.remove('error');
      }
    }

    // Limpar status
    const radios = document.querySelectorAll('input[name="status-aprovacao"]');
    radios.forEach(r => r.checked = false);
    const pendente = document.querySelector('input[name="status-aprovacao"][value="pendente"]');
    if (pendente) pendente.checked = true;

    // Limpar tabelas (restaurar 3 linhas vazias)
    ['measure-table-pmg', 'measure-table-num'].forEach(tableId => {
      const table = document.getElementById(tableId);
      if (!table) return;
      const headers = Array.from(table.querySelectorAll('thead th'))
        .map(th => th.textContent.trim())
        .filter(h => h && h !== 'Descrição' && h !== '');
      const tbody = table.querySelector('tbody');
      tbody.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        tbody.appendChild(createMeasureRow(headers));
      }
    });

    // Limpar títulos de tabelas
    const titles = ['measure-title-pmg', 'measure-title-num'];
    titles.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Limpar combinações de cores
    const combosContainer = document.getElementById('color-combos-container');
    if (combosContainer) {
      combosContainer.innerHTML = '';
      addColorCombo();
    }

    // Limpar previews QR
    const pendingDiv = document.getElementById('qr-auto-pending');
    const generatedDiv = document.getElementById('qr-auto-generated');
    const urlInput = document.getElementById('qr-auto-url');
    if (pendingDiv && generatedDiv && urlInput) {
      urlInput.value = '';
      pendingDiv.style.display = 'flex';
      generatedDiv.style.display = 'none';
    }

    // Limpar erros visuais
    document.querySelectorAll('.form-error.visible').forEach(el => el.classList.remove('visible'));

    // Limpar fotos
    clearPhotos();

    // Limpar rascunho
    Config.clearDraft();
  }

  /**
   * Valida o formulário completo
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validate() {
    const data = collectData();
    const result = Security.validateFichaSchema(data);

    // Marcar campos com erro visual
    if (!result.valid) {
      result.errors.forEach(error => {
        const fieldName = error.replace('Campo obrigatório: ', '');
        const elementId = FIELDS[fieldName];
        if (elementId) {
          const el = document.getElementById(elementId);
          if (el) {
            el.classList.add('error');
            const errorEl = el.parentElement.querySelector('.form-error');
            if (errorEl) errorEl.classList.add('visible');
          }
        }
      });
    }

    return result;
  }

  /**
   * Retorna o ID da ficha atual (se editando)
   * @returns {string|null}
   */
  /**
   * Configura os eventos de upload e arrastar-e-soltar de foto
   */
  function setupPhotoUploadEvents() {
    const zone = document.getElementById('photo-upload-zone');
    const fileInput = document.getElementById('field-photo-file');

    if (!zone || !fileInput) return;

    // Clicar na zona abre o seletor de arquivos
    zone.addEventListener('click', (e) => {
      if (e.target.closest('.photo-preview-item__remove')) {
        return;
      }
      fileInput.click();
    });

    // Alteração no input file
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      handleMultiplePhotosUpload(files);
    });

    // Eventos de arrastar e soltar
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files);
      handleMultiplePhotosUpload(files);
    });
  }

  /**
   * Processa, redimensiona e comprime as fotos selecionadas
   */
  function handleMultiplePhotosUpload(files) {
    if (!files || files.length === 0) return;

    if (currentFotos.length + files.length > 3) {
      alert('Limite atingido: você pode carregar no máximo 3 fotos por ficha técnica.');
      return;
    }

    let loadedCount = 0;
    const filesToProcess = files.slice(0, 3 - currentFotos.length);

    filesToProcess.forEach(file => {
      if (file.type && !file.type.startsWith('image/')) {
        alert(`Arquivo "${file.name}" inválido. Selecione apenas imagens.`);
        loadedCount++;
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          // Redimensionar no Canvas para garantir peso super baixo (máx 300px, JPEG 0.5)
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const MAX_DIM = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round(height * (MAX_DIM / width));
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round(width * (MAX_DIM / height));
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Exportar como JPEG super comprimido para acomodar até 3 fotos sob 30KB
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);

          currentFotos.push(compressedBase64);
          loadedCount++;

          if (loadedCount === filesToProcess.length) {
            renderPhotosPreviews();
            triggerAutoSave();
          }
        };

        img.onerror = function() {
          alert(`Falha ao processar o arquivo "${file.name}". Certifique-se de que é uma imagem válida.`);
          loadedCount++;
          if (loadedCount === filesToProcess.length) {
            renderPhotosPreviews();
            triggerAutoSave();
          }
        };

        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Renderiza os previews das fotos no grid
   */
  function renderPhotosPreviews() {
    const grid = document.getElementById('photos-preview-grid');
    const placeholder = document.getElementById('photo-upload-placeholder');
    const fileInput = document.getElementById('field-photo-file');

    if (!grid) return;

    if (fileInput) fileInput.value = '';

    if (currentFotos.length === 0) {
      grid.innerHTML = '';
      grid.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';
      return;
    }

    if (placeholder) {
      if (currentFotos.length >= 3) {
        placeholder.style.display = 'none';
      } else {
        placeholder.style.display = 'flex';
      }
    }

    grid.style.display = 'grid';
    grid.innerHTML = currentFotos.map((base64, index) => `
      <div class="photo-preview-item">
        <img src="${base64}" alt="Foto ${index + 1}">
        <button type="button" class="photo-preview-item__remove" data-index="${index}" title="Remover Foto">
          ✕
        </button>
      </div>
    `).join('');

    // Adicionar eventos para remover fotos
    const removeButtons = grid.querySelectorAll('.photo-preview-item__remove');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.getAttribute('data-index'));
        if (confirm('Deseja remover esta foto?')) {
          currentFotos.splice(index, 1);
          renderPhotosPreviews();
          triggerAutoSave();
        }
      });
    });
  }

  /**
   * Define o estado das fotos carregadas
   */
  function setPhotos(fotosArray) {
    currentFotos = Array.isArray(fotosArray) ? [...fotosArray] : [];
    renderPhotosPreviews();
  }

  /**
   * Limpa todas as fotos atuais
   */
  function clearPhotos() {
    currentFotos = [];
    renderPhotosPreviews();
  }

  function triggerAutoSave() {
    try {
      const data = collectData();
      Config.saveDraft(data);
    } catch (e) {
      console.warn('[Form] Falha ao disparar auto-save:', e);
    }
  }

  function getCurrentId() {
    return currentFichaId;
  }

  return {
    init,
    collectData,
    fillForm,
    clearForm,
    validate,
    getCurrentId,
    addColorCombo,
    updateAllQRPreviews
  };
})();
