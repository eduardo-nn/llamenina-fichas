/* ═══════════════════════════════════════════════════════════════
   LLAMENINA — Fichas Técnicas — Google Apps Script (Code.gs)
   Backend para Google Sheets com autenticação e auditoria
   
   INSTRUÇÕES:
   1. Crie uma planilha no Google Sheets
   2. Vá em Extensões > Apps Script
   3. Cole todo este código no editor
   4. Configure o token em: Configurações do Projeto > Propriedades do Script
      - Adicione: API_TOKEN = <seu_token_secreto>
   5. Publique como Web App:
      - Executar como: Eu
      - Quem tem acesso: Qualquer pessoa
   6. Copie a URL gerada e insira no campo "Endpoint" do sistema
   ═══════════════════════════════════════════════════════════════ */

// ═══════════════ CONFIGURAÇÕES ═══════════════

const CONFIG = {
  SHEET_FICHAS: 'Fichas',
  SHEET_LOGS: 'Logs',
  RATE_LIMIT_MAX: 30,         // Máx requisições por minuto
  RATE_LIMIT_WINDOW: 60000,   // 1 minuto em ms
  MAX_PAYLOAD_SIZE: 153600,    // 150KB
};

// ═══════════════ COLUNAS DA PLANILHA ═══════════════

const COLUMNS = {
  ID: 1,
  TIMESTAMP_CRIACAO: 2,
  TIMESTAMP_ATUALIZACAO: 3,
  MODELO: 4,
  REFERENCIA: 5,
  OP: 6,
  MODELISTA: 7,
  PILOTISTA: 8,
  TECIDO: 9,
  COMPOSICAO: 10,
  COR_LINHA: 11,
  CORTE: 12,
  BORDADO_SILK: 13,
  CONFECCAO: 14,
  LAVANDERIA: 15,
  LACRE_LAVANDERIA: 16,
  ACABAMENTO: 17,
  FASE_FINAL: 18,
  FOTO: 19,
  MEDIDAS_PMG_TITULO: 20,
  MEDIDAS_PMG: 21,
  MEDIDAS_NUM_TITULO: 22,
  MEDIDAS_NUM: 23,
  OBS_COSTURA: 24,
  COMBINACOES_CORES: 25,
  QR_CORTE: 26,
  QR_ANEXOS: 27,
  QR_FEEDBACK: 28,
  STATUS: 29,
  RESPONSAVEL: 30,
  DATA_APROVACAO: 31,
  ATIVO: 32,
};

const TOTAL_COLUMNS = 32;

// ═══════════════ HANDLERS PRINCIPAIS ═══════════════

/**
 * Handler para requisições POST (Criar/Atualizar/Deletar)
 */
function doPost(e) {
  try {
    // 1. Parsear body
    const body = e.postData ? e.postData.contents : '';
    
    if (!body) {
      return jsonResponse({ error: 'Body vazio', code: 'EMPTY_BODY' });
    }
    
    // 2. Verificar tamanho
    if (body.length > CONFIG.MAX_PAYLOAD_SIZE) {
      return jsonResponse({ error: 'Payload excede 50KB', code: 'PAYLOAD_TOO_LARGE' });
    }
    
    let data;
    try {
      data = JSON.parse(body);
    } catch (err) {
      return jsonResponse({ error: 'JSON inválido', code: 'INVALID_JSON' });
    }
    
    // 3. Autenticação
    const token = data._token || '';
    if (!validateToken(token)) {
      logAudit('AUTH_FAIL', '', 'Token inválido');
      return jsonResponse({ error: 'Token de autenticação inválido', code: 'AUTH_FAILED' });
    }
    
    // 4. Rate limiting
    if (!rateLimitCheck()) {
      return jsonResponse({ error: 'Limite de requisições excedido', code: 'RATE_LIMITED' });
    }
    
    // 5. Remover campos internos
    delete data._token;
    delete data._timestamp;
    
    // 6. Processar ação
    const action = sanitize(data.action);
    
    switch (action) {
      case 'create':
        return handleCreate(data.ficha);
      case 'update':
        return handleUpdate(data.ficha);
      case 'delete':
        return handleDelete(data.id);
      case 'get':
        return handleGet(data.id);
      default:
        return jsonResponse({ error: 'Ação inválida', code: 'INVALID_ACTION' });
    }
    
  } catch (err) {
    logAudit('ERROR', '', err.message);
    return jsonResponse({ error: 'Erro interno do servidor', code: 'SERVER_ERROR' });
  }
}

/**
 * Handler para requisições GET (Listar/Buscar/Ping)
 */
function doGet(e) {
  try {
    const params = e.parameter || {};
    
    // Autenticação
    const token = params.token || '';
    if (!validateToken(token)) {
      logAudit('AUTH_FAIL', '', 'Token inválido (GET)');
      return jsonResponse({ error: 'Token de autenticação inválido', code: 'AUTH_FAILED' });
    }
    
    // Rate limiting
    if (!rateLimitCheck()) {
      return jsonResponse({ error: 'Limite de requisições excedido', code: 'RATE_LIMITED' });
    }
    
    const action = sanitize(params.action || 'list');
    
    switch (action) {
      case 'ping':
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      case 'list':
        return handleList();
      case 'search':
        return handleSearch(sanitize(params.q || ''));
      case 'get':
        return handleGet(sanitize(params.id || ''));
      default:
        return jsonResponse({ error: 'Ação inválida', code: 'INVALID_ACTION' });
    }
    
  } catch (err) {
    logAudit('ERROR', '', err.message);
    return jsonResponse({ error: 'Erro interno do servidor', code: 'SERVER_ERROR' });
  }
}

// ═══════════════ OPERAÇÕES CRUD ═══════════════

/**
 * Cria uma nova ficha
 */
function handleCreate(ficha) {
  if (!ficha || typeof ficha !== 'object') {
    return jsonResponse({ error: 'Dados da ficha inválidos', code: 'INVALID_DATA' });
  }
  
  // Validar campos obrigatórios
  if (!ficha.modelo || !ficha.referencia) {
    return jsonResponse({ error: 'Campos obrigatórios: modelo, referencia', code: 'VALIDATION_ERROR' });
  }
  
  const sheet = getOrCreateSheet(CONFIG.SHEET_FICHAS);
  const id = ficha.id || Utilities.getUuid();
  const now = new Date().toISOString();
  
  const row = buildRow(id, now, now, ficha);
  sheet.appendRow(row);
  
  logAudit('CREATE', id, 'Ficha criada: ' + sanitize(ficha.modelo));
  
  return jsonResponse({
    success: true,
    id: id,
    message: 'Ficha criada com sucesso'
  });
}

/**
 * Atualiza uma ficha existente
 */
function handleUpdate(ficha) {
  if (!ficha || !ficha.id) {
    return jsonResponse({ error: 'ID da ficha obrigatório para atualizar', code: 'MISSING_ID' });
  }
  
  const sheet = getOrCreateSheet(CONFIG.SHEET_FICHAS);
  const rowIndex = findRowById(sheet, ficha.id);
  
  if (rowIndex === -1) {
    return jsonResponse({ error: 'Ficha não encontrada', code: 'NOT_FOUND' });
  }
  
  const now = new Date().toISOString();
  const originalCreation = sheet.getRange(rowIndex, COLUMNS.TIMESTAMP_CRIACAO).getValue();
  
  const row = buildRow(ficha.id, originalCreation || now, now, ficha);
  sheet.getRange(rowIndex, 1, 1, TOTAL_COLUMNS).setValues([row]);
  
  logAudit('UPDATE', ficha.id, 'Ficha atualizada: ' + sanitize(ficha.modelo || ''));
  
  return jsonResponse({
    success: true,
    id: ficha.id,
    message: 'Ficha atualizada com sucesso'
  });
}

/**
 * Soft delete de uma ficha
 */
function handleDelete(id) {
  if (!id) {
    return jsonResponse({ error: 'ID obrigatório', code: 'MISSING_ID' });
  }
  
  const sheet = getOrCreateSheet(CONFIG.SHEET_FICHAS);
  const rowIndex = findRowById(sheet, sanitize(id));
  
  if (rowIndex === -1) {
    return jsonResponse({ error: 'Ficha não encontrada', code: 'NOT_FOUND' });
  }
  
  // Soft delete: marcar como inativa
  sheet.getRange(rowIndex, COLUMNS.ATIVO).setValue('FALSE');
  sheet.getRange(rowIndex, COLUMNS.TIMESTAMP_ATUALIZACAO).setValue(new Date().toISOString());
  
  logAudit('DELETE', id, 'Ficha desativada');
  
  return jsonResponse({
    success: true,
    message: 'Ficha removida com sucesso'
  });
}

/**
 * Lista todas as fichas ativas
 */
function handleList() {
  const sheet = getOrCreateSheet(CONFIG.SHEET_FICHAS);
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    logAudit('READ', '', 'Lista vazia');
    return jsonResponse({ fichas: [], total: 0 });
  }
  
  const fichas = data
    .filter(row => {
      // Ignorar linhas vazias (sem ID)
      if (!row[COLUMNS.ID - 1] || String(row[COLUMNS.ID - 1]).trim() === '') return false;
      return row[COLUMNS.ATIVO - 1] !== 'FALSE';
    })
    .map(rowToObject);
  
  logAudit('READ', '', 'Listou ' + fichas.length + ' fichas');
  
  return jsonResponse({ fichas: fichas, total: fichas.length });
}

/**
 * Busca fichas por texto
 */
function handleSearch(query) {
  if (!query) {
    return handleList();
  }
  
  const sheet = getOrCreateSheet(CONFIG.SHEET_FICHAS);
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return jsonResponse({ fichas: [], total: 0 });
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS).getValues();
  const q = query.toLowerCase();
  
  const fichas = data
    .filter(row => {
      // Ignorar linhas vazias (sem ID)
      if (!row[COLUMNS.ID - 1] || String(row[COLUMNS.ID - 1]).trim() === '') return false;
      if (row[COLUMNS.ATIVO - 1] === 'FALSE') return false;
      const searchable = [
        row[COLUMNS.MODELO - 1],
        row[COLUMNS.REFERENCIA - 1],
        row[COLUMNS.OP - 1],
        row[COLUMNS.MODELISTA - 1],
        row[COLUMNS.TECIDO - 1]
      ].join(' ').toLowerCase();
      return searchable.indexOf(q) !== -1;
    })
    .map(rowToObject);
  
  logAudit('SEARCH', '', 'Buscou "' + query + '": ' + fichas.length + ' resultados');
  
  return jsonResponse({ fichas: fichas, total: fichas.length });
}

/**
 * Busca uma ficha específica por ID
 */
function handleGet(id) {
  if (!id) {
    return jsonResponse({ error: 'ID obrigatório', code: 'MISSING_ID' });
  }
  
  const sheet = getOrCreateSheet(CONFIG.SHEET_FICHAS);
  const rowIndex = findRowById(sheet, id);
  
  if (rowIndex === -1) {
    return jsonResponse({ error: 'Ficha não encontrada', code: 'NOT_FOUND' });
  }
  
  const row = sheet.getRange(rowIndex, 1, 1, TOTAL_COLUMNS).getValues()[0];
  const ficha = rowToObject(row);
  
  logAudit('READ', id, 'Ficha consultada');
  
  return jsonResponse({ ficha: ficha });
}

// ═══════════════ FUNÇÕES AUXILIARES ═══════════════

/**
 * Constrói array da linha para a planilha
 */
function buildRow(id, createdAt, updatedAt, ficha) {
  const s = sanitize;
  return [
    id,
    createdAt,
    updatedAt,
    s(ficha.modelo || ''),
    s(ficha.referencia || ''),
    s(ficha.op || ''),
    s(ficha.modelista || ''),
    s(ficha.pilotista || ''),
    s(ficha.tecido || ''),
    s(ficha.composicao || ''),
    s(ficha.corLinha || ''),
    s(ficha.corte || ''),
    s(ficha.bordadoSilk || ''),
    s(ficha.confeccao || ''),
    s(ficha.lavanderia || ''),
    s(ficha.lacreLavanderia || ''),
    s(ficha.acabamento || ''),
    s(ficha.faseFinal || ''),
    ficha.foto || '',
    s(ficha.medidasPMGTitulo || ''),
    JSON.stringify(ficha.medidasPMG || []),
    s(ficha.medidasNumeracaoTitulo || ''),
    JSON.stringify(ficha.medidasNumeracao || []),
    s(ficha.obsCostura || ''),
    JSON.stringify(ficha.combinacoesCores || []),
    s(ficha.qrCorteUrl || ''),
    s(ficha.qrAnexosUrl || ''),
    s(ficha.qrFeedbackUrl || ''),
    s(ficha.statusAprovacao || 'pendente'),
    s(ficha.responsavelAprovacao || ''),
    s(ficha.dataAprovacao || ''),
    'TRUE'
  ];
}

/**
 * Converte uma linha da planilha em objeto JSON
 */
function rowToObject(row) {
  return {
    id: row[COLUMNS.ID - 1],
    timestampCriacao: row[COLUMNS.TIMESTAMP_CRIACAO - 1],
    timestampAtualizacao: row[COLUMNS.TIMESTAMP_ATUALIZACAO - 1],
    modelo: row[COLUMNS.MODELO - 1],
    referencia: row[COLUMNS.REFERENCIA - 1],
    op: row[COLUMNS.OP - 1],
    modelista: row[COLUMNS.MODELISTA - 1],
    pilotista: row[COLUMNS.PILOTISTA - 1],
    tecido: row[COLUMNS.TECIDO - 1],
    composicao: row[COLUMNS.COMPOSICAO - 1],
    corLinha: row[COLUMNS.COR_LINHA - 1],
    corte: row[COLUMNS.CORTE - 1],
    bordadoSilk: row[COLUMNS.BORDADO_SILK - 1],
    confeccao: row[COLUMNS.CONFECCAO - 1],
    lavanderia: row[COLUMNS.LAVANDERIA - 1],
    lacreLavanderia: row[COLUMNS.LACRE_LAVANDERIA - 1],
    acabamento: row[COLUMNS.ACABAMENTO - 1],
    faseFinal: row[COLUMNS.FASE_FINAL - 1],
    foto: row[COLUMNS.FOTO - 1],
    medidasPMGTitulo: row[COLUMNS.MEDIDAS_PMG_TITULO - 1],
    medidasPMG: safeJsonParse(row[COLUMNS.MEDIDAS_PMG - 1]),
    medidasNumeracaoTitulo: row[COLUMNS.MEDIDAS_NUM_TITULO - 1],
    medidasNumeracao: safeJsonParse(row[COLUMNS.MEDIDAS_NUM - 1]),
    obsCostura: row[COLUMNS.OBS_COSTURA - 1],
    combinacoesCores: safeJsonParse(row[COLUMNS.COMBINACOES_CORES - 1]),
    qrCorteUrl: row[COLUMNS.QR_CORTE - 1],
    qrAnexosUrl: row[COLUMNS.QR_ANEXOS - 1],
    qrFeedbackUrl: row[COLUMNS.QR_FEEDBACK - 1],
    statusAprovacao: row[COLUMNS.STATUS - 1],
    responsavelAprovacao: row[COLUMNS.RESPONSAVEL - 1],
    dataAprovacao: row[COLUMNS.DATA_APROVACAO - 1],
  };
}

/**
 * Parse JSON seguro
 */
function safeJsonParse(str) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : (str || []);
  } catch (e) {
    return [];
  }
}

/**
 * Encontra o índice da linha pelo ID
 * @returns {number} Índice da linha (1-based) ou -1
 */
function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  
  const ids = sheet.getRange(2, COLUMNS.ID, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return -1;
}

/**
 * Obtém ou cria uma aba da planilha
 */
function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  
  if (!sheet) {
    sheet = ss.insertSheet(name);
    
    if (name === CONFIG.SHEET_FICHAS) {
      // Criar cabeçalho
      const headers = [
        'ID', 'Criado Em', 'Atualizado Em', 'Modelo', 'Referência', 'OP',
        'Modelista', 'Pilotista', 'Tecido', 'Composição', 'Cor Linha',
        'Corte', 'Bordado/Silk', 'Confecção', 'Lavanderia', 'Lacre Lavanderia',
        'Acabamento', 'Fase Final', 'Link Acesso', 'Título Medidas PMG',
        'Medidas PMG (JSON)', 'Título Medidas Num', 'Medidas Num (JSON)',
        'Obs Costura', 'Combinações Cores (JSON)', 'QR Corte URL',
        'QR Anexos URL', 'QR Feedback URL', 'Status', 'Responsável',
        'Data Aprovação', 'Ativo'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    if (name === CONFIG.SHEET_LOGS) {
      const headers = ['Timestamp', 'Ação', 'ID Ficha', 'Detalhes'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }
  
  return sheet;
}

// ═══════════════ SEGURANÇA ═══════════════

/**
 * Valida o token de autenticação
 */
function validateToken(token) {
  if (!token || typeof token !== 'string') return false;
  
  const props = PropertiesService.getScriptProperties();
  const validToken = props.getProperty('API_TOKEN');
  
  if (!validToken) {
    // Se token não configurado, log de aviso
    Logger.log('AVISO: API_TOKEN não configurado nas Script Properties!');
    return false;
  }
  
  return token === validToken;
}

/**
 * Rate limiting por IP usando cache do script
 */
function rateLimitCheck() {
  const cache = CacheService.getScriptCache();
  const key = 'rate_limit_count';
  
  const current = parseInt(cache.get(key) || '0');
  
  if (current >= CONFIG.RATE_LIMIT_MAX) {
    return false;
  }
  
  cache.put(key, String(current + 1), 60); // Expira em 60 segundos
  return true;
}

/**
 * Sanitiza uma string removendo tags HTML
 */
function sanitize(value) {
  if (typeof value !== 'string') return String(value || '');
  return value.replace(/<[^>]*>/g, '').trim();
}

// ═══════════════ AUDITORIA ═══════════════

/**
 * Registra uma ação no log de auditoria
 */
function logAudit(action, fichaId, details) {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEET_LOGS);
    sheet.appendRow([
      new Date().toISOString(),
      action,
      fichaId || '',
      details || ''
    ]);
  } catch (e) {
    Logger.log('Erro ao gravar log: ' + e.message);
  }
}

// ═══════════════ RESPOSTA ═══════════════

/**
 * Retorna resposta JSON formatada
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
