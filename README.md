# LLAMENINA — Fichas Técnicas de Vestuário

Sistema web local para **preenchimento, gerenciamento e impressão** de Fichas Técnicas de Vestuário, integrado com **Google Sheets** para persistência de dados em tempo real.

---

## 🚀 Como Rodar Localmente

### Opção 1 — Via npx serve (Recomendado)
```bash
cd llamenina-fichas-tecnicas
npx -y serve .
```
Acesse: `http://localhost:3000`

### Opção 2 — Via VS Code Live Server
1. Instale a extensão **Live Server** no VS Code
2. Abra a pasta do projeto
3. Clique com botão direito no `index.html` > **Open with Live Server**

### Opção 3 — Via Python
```bash
cd llamenina-fichas-tecnicas
python -m http.server 3000
```

---

## ⚙️ Configuração Inicial

### 1. Configurar Google Apps Script
Siga o guia completo em: [`google-apps-script/setup-instructions.md`](google-apps-script/setup-instructions.md)

**Resumo:**
1. Crie uma planilha no Google Sheets
2. Abra o Editor do Apps Script
3. Cole o código de `google-apps-script/Code.gs`
4. Configure o token em Script Properties (`API_TOKEN`)
5. Publique como Web App
6. Copie a URL gerada

### 2. Configurar no Sistema
1. Abra o sistema no navegador
2. Clique em ⚙️ **Configurações**
3. Insira a URL do endpoint e o token
4. Teste a conexão e salve

---

## 📁 Estrutura do Projeto

```
llamenina-fichas-tecnicas/
├── index.html                          # Página principal
├── README.md                           # Este arquivo
├── css/
│   ├── variables.css                   # Design tokens / variáveis CSS
│   ├── base.css                        # Reset, layout, tipografia
│   ├── components.css                  # Componentes visuais
│   └── print.css                       # Estilos de impressão A5
├── js/
│   ├── security.js                     # Sanitização, validação, rate limiting
│   ├── config.js                       # Gerenciamento de configuração
│   ├── api.js                          # Comunicação com Google Apps Script
│   ├── form.js                         # Lógica do formulário
│   ├── print.js                        # Geração de layout e QR codes
│   └── app.js                          # Orquestrador principal
└── google-apps-script/
    ├── Code.gs                         # Código do Google Apps Script
    └── setup-instructions.md           # Guia de publicação
```

---

## 🔒 Segurança

O sistema implementa segurança em **3 camadas**:

| Camada | Medidas |
|--------|---------|
| **Frontend** | Sanitização XSS, validação de inputs, CSP, SRI para CDN |
| **Rede** | HTTPS obrigatório, token de autenticação, timeout de 15s |
| **Backend** | Validação de token, rate limiting, sanitização server-side, auditoria |

---

## 🖨️ Impressão

O módulo de impressão gera fichas otimizadas para **formato A5 (15×21cm)**:
- Layout compacto em 1 página
- QR Codes gerados automaticamente
- Tipografia legível (Arial 9pt)
- Bordas e tabelas otimizadas

Para imprimir:
1. Preencha a ficha no formulário
2. Clique em **Imprimir**
3. Na janela de impressão, selecione **tamanho A5** ou **15×21cm**
4. Margens: 6mm superior/inferior, 8mm lateral

---

## 📊 Estrutura da Planilha

A planilha Google Sheets terá 2 abas criadas automaticamente:

- **Fichas** — 32 colunas com todos os dados da ficha técnica
- **Logs** — Registro de auditoria (timestamp, ação, ID, detalhes)

---

## 🛠️ Tecnologias

- **HTML5** — Semântico, sem framework
- **CSS3** — Vanilla CSS com CSS Variables
- **JavaScript ES6+** — Módulos nativos
- **QRCode.js** — Geração de QR codes (via CDN com SRI)
- **Google Apps Script** — Backend gratuito
- **Google Sheets** — Persistência de dados
