/* ═══════════════════════════════════════════════════════════════
   LLAMENINA — Fichas Técnicas — Print Module
   Geração de layout de impressão A5 e QR Codes
   ═══════════════════════════════════════════════════════════════ */

const PrintModule = (() => {
  'use strict';

  /**
   * Gera e exibe o layout de impressão
   * @param {Object} data - Dados da ficha coletados do formulário
   * @param {HTMLElement} [container] - Container de destino
   */
  function generatePrintLayout(data, container) {
    const target = container || document.getElementById('print-area');
    if (!target) return;

    const s = Security.sanitizeHTML; // Alias para brevidade

    let printFotos = [];
    if (data.foto) {
      try {
        const parsed = JSON.parse(data.foto);
        if (Array.isArray(parsed)) {
          printFotos = parsed;
        } else {
          printFotos = [data.foto];
        }
      } catch (e) {
        printFotos = [data.foto];
      }
    }

    target.innerHTML = `
      <!-- ═══ HEADER ═══ -->
      <div class="print-header print-no-break">
        <div class="print-header__brand">
          <div class="print-header__logo">L</div>
          <div>
            <div class="print-header__title">LLAMENINA</div>
            <div class="print-header__subtitle">Ficha Técnica de Vestuário</div>
          </div>
        </div>
        <div class="print-header__meta">
          <div class="print-header__ref">Ref: ${s(data.referencia || '—')}</div>
          <div>OP: ${s(data.op || '—')}</div>
          <div>${new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </div>

      <!-- ═══ CABEÇALHO ═══ -->
      <div class="print-section print-no-break">
        <div class="print-section__title">Identificação</div>
        <div class="print-grid">
          <div class="print-field">
            <span class="print-field__label">Modelo:</span>
            <span class="print-field__value">${s(data.modelo || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">Ref:</span>
            <span class="print-field__value">${s(data.referencia || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">Tecido:</span>
            <span class="print-field__value">${s(data.tecido || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">Composição:</span>
            <span class="print-field__value">${s(data.composicao || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">OP:</span>
            <span class="print-field__value">${s(data.op || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">Modelista:</span>
            <span class="print-field__value">${s(data.modelista || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">Pilotista:</span>
            <span class="print-field__value">${s(data.pilotista || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">Cor Linha:</span>
            <span class="print-field__value">${s(data.corLinha || '—')}</span>
          </div>
        </div>
      </div>

      <!-- ═══ FLUXO DE PRODUÇÃO ═══ -->
      <div class="print-section print-no-break">
        <div class="print-section__title">Fluxo de Produção</div>
        <div class="print-grid print-grid--3cols">
          <div class="print-field">
            <span class="print-field__label">1. Corte:</span>
            <span class="print-field__value">${s(data.corte || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">2. Bordado/Silk:</span>
            <span class="print-field__value">${s(data.bordadoSilk || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">3. Confecção:</span>
            <span class="print-field__value">${s(data.confeccao || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">4. Lavanderia:</span>
            <span class="print-field__value">${s(data.lavanderia || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">Lacre:</span>
            <span class="print-field__value">${s(data.lacreLavanderia || '—')}</span>
          </div>
          <div class="print-field">
            <span class="print-field__label">5. Acabamento:</span>
            <span class="print-field__value">${s(data.acabamento || '—')}</span>
          </div>
          <div class="print-field print-field--full">
            <span class="print-field__label">6. Fase Final:</span>
            <span class="print-field__value">${s(data.faseFinal || '—')}</span>
          </div>
        </div>
      </div>



      <!-- ═══ TABELA MEDIDAS P/M/G ═══ -->
      ${generateMeasureTableHTML('Medidas (P ao G)', data.medidasPMGTitulo, data.medidasPMG, ['P', 'M', 'G'])}

      <!-- ═══ TABELA MEDIDAS NUMERAÇÃO ═══ -->
      ${generateMeasureTableHTML('Medidas (Numeração)', data.medidasNumeracaoTitulo, data.medidasNumeracao, ['34', '36', '38', '40', '42', '44', '46'])}

      <!-- ═══ OBSERVAÇÕES ═══ -->
      ${data.obsCostura ? `
      <div class="print-section print-no-break">
        <div class="print-section__title">Observações</div>
        <div class="print-obs">
          <span class="print-obs__label">Costura:</span>
          ${s(data.obsCostura)}
        </div>
      </div>
      ` : ''}

      <!-- ═══ COMBINAÇÕES DE CORES ═══ -->
      ${data.combinacoesCores && data.combinacoesCores.length > 0 ? `
      <div class="print-section print-no-break">
        <div class="print-section__title">Bordado / Silk — Combinação de Cores</div>
        <div class="print-combos">
          ${data.combinacoesCores.map(c =>
            `<span class="print-combo">Peça ${s(c.peca)} → Bordado ${s(c.bordado)}</span>`
          ).join('')}
        </div>
      </div>
      ` : ''}

      <!-- ═══ STATUS ═══ -->
      <div class="print-status print-no-break">
        <div class="print-status__approval" style="display: flex; flex-direction: column; gap: 0.5mm; align-items: flex-start;">
          <span style="font-weight: bold; font-size: 6.5pt; text-transform: uppercase;">Aprovado:</span>
          <div style="display: flex; align-items: center;">
            <span class="print-status__check ${data.statusAprovacao === 'aprovada' ? 'checked' : ''}"></span>&nbsp;SIM
            &nbsp;&nbsp;&nbsp;&nbsp;
            <span class="print-status__check ${data.statusAprovacao === 'reprovada' ? 'checked' : ''}"></span>&nbsp;NÃO
            &nbsp;&nbsp;&nbsp;&nbsp;
            <span>Resp: ${s(data.responsavelAprovacao || '_______________')}</span>
          </div>
        </div>
        <div class="print-status__meta" style="align-self: flex-end;">
          Data: ${s(data.dataAprovacao || new Date().toLocaleDateString('pt-BR'))}
        </div>
      </div>

      <!-- ═══ QR CODES ═══ -->
      <div class="print-qr-section print-no-break">
        ${data.qrCorteUrl ? `
        <div class="print-qr-item">
          <div class="print-qr-item__label">QR da Peça</div>
          <div class="print-qr-peca-el"></div>
        </div>
        ` : ''}
      </div>
    `;

    // Gerar QR codes no container
    generatePrintQRCodes(data, target);
  }

  /**
   * Gera HTML de uma tabela de medidas para impressão
   */
  function generateMeasureTableHTML(sectionTitle, tableTitle, data, columns) {
    if (!data || data.length === 0) return '';

    const s = Security.sanitizeHTML;

    return `
      <div class="print-section print-no-break">
        <div class="print-section__title">${s(sectionTitle)}${tableTitle ? ' — ' + s(tableTitle) : ''}</div>
        <table class="print-table">
          <thead>
            <tr>
              <th>Descrição</th>
              ${columns.map(col => `<th>${s(col)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                <td>${s(row.descricao || '')}</td>
                ${columns.map(col => `<td>${s(row.valores?.[col] || '—')}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Gera os QR codes no container
   */
  function generatePrintQRCodes(data, parent) {
    if (typeof QRCode === 'undefined') {
      console.warn('[Print] Biblioteca QRCode não está disponível. Pulando geração de QR.');
      return;
    }

    const qrConfig = {
      width: 68,
      height: 68,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    };

    const qrMap = [
      { classSelector: '.print-qr-peca-el', url: data.qrCorteUrl }
    ];

    qrMap.forEach(({ classSelector, url }) => {
      const el = parent.querySelector(classSelector);
      if (el && url && Security.validateURL(url)) {
        try {
          new QRCode(el, { ...qrConfig, text: url });
        } catch (e) {
          console.warn(`[Print] Falha ao gerar QR code para ${classSelector}:`, e);
        }
      }
    });
  }

  /**
   * Executa a impressão
   * @param {Object} [data] - Dados da ficha (se não fornecido, coleta do formulário)
   */
  function print(data) {
    try {
      console.log('[Print] print() chamado', data);
      const fichaData = data || FichaForm.collectData();
      console.log('[Print] Dados da ficha coletados', fichaData);

      // Gerar layout
      generatePrintLayout(fichaData);
      console.log('[Print] Layout gerado no DOM');

      // Imprimir de forma síncrona para evitar bloqueio do navegador
      window.print();
      console.log('[Print] window.print() executado');
    } catch (err) {
      alert('Erro no módulo de impressão: ' + err.message);
      console.error('[Print] Erro ao imprimir:', err);
    }
  }

  return {
    generatePrintLayout,
    print
  };
})();
