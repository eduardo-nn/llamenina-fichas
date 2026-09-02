/* ═══════════════════════════════════════════════════════════════
   LLAMENINA — Fichas Técnicas — API Module
   Comunicação segura com Google Apps Script
   ═══════════════════════════════════════════════════════════════ */

const API = (() => {
  'use strict';

  const REQUEST_TIMEOUT_MS = 45000; // 45 segundos (conservador para uploads de fotos ao Drive)
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1500;

  // Rate limiter: máx 10 requisições por minuto
  const rateLimiter = new Security.RateLimiter(10, 60000);

  /**
   * Faz uma requisição HTTP com tratamento de erros, timeout e autenticação
   * @param {string} method - 'GET' ou 'POST'
   * @param {Object} [body] - Corpo da requisição (para POST)
   * @param {Object} [params] - Parâmetros de query (para GET)
   * @param {number} [retryCount=0] - Contagem de retries
   * @returns {Promise<Object>}
   */
  async function request(method, body = null, params = null, retryCount = 0) {
    // Verificar configuração
    if (!Config.isConfigured()) {
      throw new APIError(
        'Sistema não configurado. Configure o endpoint e token nas Configurações.',
        'CONFIG_MISSING'
      );
    }

    // Rate limiting
    if (!rateLimiter.canMakeRequest()) {
      const retryAfter = Math.ceil(rateLimiter.getRetryAfter() / 1000);
      throw new APIError(
        `Limite de requisições atingido. Tente novamente em ${retryAfter}s.`,
        'RATE_LIMITED'
      );
    }

    // Montar URL
    let url = Config.getEndpoint();
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        searchParams.append(key, value);
      }
      // Incluir token como parâmetro para GET (Apps Script não suporta headers customizados em doGet)
      searchParams.append('token', Config.getToken());
      url += '?' + searchParams.toString();
    }

    // Configurar fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const fetchOptions = {
      method,
      signal: controller.signal,
      headers: {},
      redirect: 'follow'
    };

    if (method === 'POST' && body) {
      // Sanitizar dados antes de enviar
      const sanitizedBody = Security.sanitizeObject(body);

      // Google Apps Script não suporta headers customizados em CORS
      // Token enviado no body para POST
      sanitizedBody._token = Config.getToken();
      sanitizedBody._timestamp = new Date().toISOString();

      fetchOptions.headers['Content-Type'] = 'text/plain'; // Apps Script CORS workaround
      fetchOptions.body = JSON.stringify(sanitizedBody);
    }

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Apps Script retorna 200 mesmo para erros, então verificamos o body
      const text = await response.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new APIError('Resposta inválida do servidor.', 'INVALID_RESPONSE');
      }

      // Verificar erros retornados pelo Apps Script
      if (data.error) {
        // Se for erro de autenticação, não retry
        if (data.code === 'AUTH_FAILED') {
          throw new APIError('Token de API inválido.', 'AUTH_FAILED');
        }
        throw new APIError(data.error, data.code || 'SERVER_ERROR');
      }

      return data;

    } catch (error) {
      clearTimeout(timeoutId);

      // Se foi timeout ou erro de rede, tentar retry APENAS para GET
      // POST NÃO faz retry: o servidor pode ter processado com sucesso mas a
      // resposta não chegou — reenviar causaria duplicação de dados
      if (
        (error.name === 'AbortError' || error.name === 'TypeError') &&
        retryCount < MAX_RETRIES &&
        method === 'GET'
      ) {
        console.warn(`[API] Tentativa ${retryCount + 1} falhou. Retrying...`);
        await sleep(RETRY_DELAY_MS * (retryCount + 1));
        return request(method, body, params, retryCount + 1);
      }

      // Se for nosso erro customizado, propagar
      if (error instanceof APIError) {
        throw error;
      }

      // Erro de rede genérico
      if (error.name === 'AbortError') {
        throw new APIError('Tempo limite excedido. Verifique sua conexão.', 'TIMEOUT');
      }

      throw new APIError(
        'Erro de conexão. Verifique se o endpoint está correto.',
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Sleep helper
   * @param {number} ms
   * @returns {Promise<void>}
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Classe de erro customizada para erros de API
   */
  class APIError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'APIError';
      this.code = code;
    }
  }

  // ═══════════════ MÉTODOS PÚBLICOS ═══════════════

  /**
   * Salva uma ficha técnica (criar ou atualizar)
   * @param {Object} fichaData - Dados da ficha
   * @returns {Promise<Object>} Resposta com ID da ficha
   */
  async function saveFicha(fichaData, isUpdate) {
    // Validar schema antes de enviar
    const validation = Security.validateFichaSchema(fichaData);
    if (!validation.valid) {
      throw new APIError(
        'Dados inválidos: ' + validation.errors.join(', '),
        'VALIDATION_ERROR'
      );
    }

    return request('POST', {
      action: isUpdate ? 'update' : 'create',
      ficha: fichaData
    });
  }

  /**
   * Lista todas as fichas cadastradas
   * @returns {Promise<Object>} Lista de fichas
   */
  async function listFichas() {
    return request('GET', null, { action: 'list' });
  }

  /**
   * Busca ficha por referência ou OP
   * @param {string} query - Termo de busca
   * @returns {Promise<Object>} Fichas encontradas
   */
  async function searchFichas(query) {
    const sanitizedQuery = Security.stripHTML(query);
    return request('GET', null, {
      action: 'search',
      q: sanitizedQuery
    });
  }

  /**
   * Busca uma ficha específica por ID
   * @param {string} id - ID da ficha
   * @returns {Promise<Object>} Dados da ficha
   */
  async function getFicha(id) {
    return request('GET', null, {
      action: 'get',
      id: Security.stripHTML(id)
    });
  }

  /**
   * Marca uma ficha como excluída (soft delete)
   * @param {string} id - ID da ficha
   * @returns {Promise<Object>}
   */
  async function deleteFicha(id) {
    return request('POST', {
      action: 'delete',
      id: Security.stripHTML(id)
    });
  }

  /**
   * Testa a conexão com o endpoint
   * @returns {Promise<boolean>}
   */
  async function testConnection() {
    try {
      const result = await request('GET', null, { action: 'ping' });
      return result && result.status === 'ok';
    } catch {
      return false;
    }
  }

  // ═══════════════ MÉTODOS DE FEEDBACK ═══════════════

  /**
   * Lista todos os feedbacks registrados
   * @returns {Promise<Object>}
   */
  async function listFeedbacks() {
    return request('GET', null, { action: 'listFeedbacks' });
  }

  /**
   * Lista feedbacks de uma ficha específica
   * @param {string} fichaId
   * @returns {Promise<Object>}
   */
  async function getFeedbacksByFicha(fichaId) {
    return request('GET', null, {
      action: 'getFeedbacksByFicha',
      fichaId: Security.stripHTML(fichaId)
    });
  }

  /**
   * Atualiza o status e anotações internas de um feedback
   * @param {string} id
   * @param {string} status
   * @param {string} [obsInterna]
   * @returns {Promise<Object>}
   */
  async function updateFeedbackStatus(id, status, obsInterna = '') {
    return request('POST', {
      action: 'updateFeedbackStatus',
      id: Security.stripHTML(id),
      status: Security.stripHTML(status),
      obsInterna: Security.stripHTML(obsInterna)
    });
  }

  /**
   * Envia um novo feedback
   * @param {Object} feedbackData
   * @returns {Promise<Object>}
   */
  async function submitFeedback(feedbackData) {
    return request('POST', {
      action: 'submitFeedback',
      feedback: feedbackData
    });
  }

  /**
   * Exclui um feedback
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async function deleteFeedback(id) {
    return request('POST', {
      action: 'deleteFeedback',
      id: Security.stripHTML(id)
    });
  }

  return {
    saveFicha,
    listFichas,
    searchFichas,
    getFicha,
    deleteFicha,
    listFeedbacks,
    getFeedbacksByFicha,
    updateFeedbackStatus,
    submitFeedback,
    deleteFeedback,
    testConnection,
    APIError
  };
})();
