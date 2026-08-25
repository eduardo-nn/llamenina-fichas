# Configuração do Google Apps Script — Passo a Passo

## 1. Criar a Planilha Google Sheets

1. Acesse [Google Sheets](https://sheets.google.com)
2. Crie uma nova planilha em branco
3. Nomeie como: **"LLAMENINA — Fichas Técnicas"**
4. As abas "Fichas" e "Logs" serão criadas automaticamente pelo script na primeira execução

---

## 2. Abrir o Editor de Apps Script

1. Na planilha, vá em **Extensões > Apps Script**
2. O editor será aberto em uma nova aba
3. Apague o conteúdo padrão do arquivo `Code.gs`

---

## 3. Colar o Código

1. Abra o arquivo `Code.gs` desta pasta
2. Copie todo o conteúdo
3. Cole no editor do Apps Script (substituindo o conteúdo existente)
4. Clique em **Ctrl+S** para salvar

---

## 4. Configurar o Token de API

> ⚠️ **Importante**: O token é a principal camada de segurança. Use um token forte!

1. No editor do Apps Script, clique no ícone de **engrenagem** (⚙️) na barra lateral esquerda — ou vá em **Configurações do projeto**
2. Role até **Propriedades do script**
3. Clique em **Adicionar propriedade do script**
4. Preencha:
   - **Propriedade**: `API_TOKEN`
   - **Valor**: Um token secreto forte (ex.: `meu-token-seguro-2024-LLM!@#`)
5. Clique em **Salvar propriedades do script**

### Como gerar um token seguro:
```
# No terminal / PowerShell:
[System.Guid]::NewGuid().ToString() + "-" + (Get-Random -Maximum 9999)

# Ou use qualquer gerador de senha online com 20+ caracteres
```

---

## 5. Publicar como Web App

1. No editor, clique em **Implantar > Nova implantação**
2. Clique no ícone de engrenagem ao lado de "Selecionar tipo" e escolha **App da Web**
3. Configure:
   - **Descrição**: "API Fichas Técnicas LLAMENINA"
   - **Executar como**: **Eu** (seu e-mail)
   - **Quem tem acesso**: **Qualquer pessoa**
4. Clique em **Implantar**
5. Autorize o acesso quando solicitado (revise as permissões)
6. **Copie a URL** gerada (algo como `https://script.google.com/macros/s/AKfycb.../exec`)

> ⚠️ A cada alteração no código, você precisa criar uma **nova implantação** para que as mudanças sejam aplicadas. 
> Vá em **Implantar > Gerenciar implantações** e crie uma nova versão.

---

## 6. Testar com cURL

### Teste de Ping:
```bash
curl "https://script.google.com/macros/s/SEU_ID/exec?action=ping&token=SEU_TOKEN"
```

Resposta esperada:
```json
{"status":"ok","timestamp":"2024-..."}
```

### Teste de Criação:
```bash
curl -X POST "https://script.google.com/macros/s/SEU_ID/exec" \
  -H "Content-Type: text/plain" \
  -d '{"action":"create","ficha":{"modelo":"Teste","referencia":"TST-001"},"_token":"SEU_TOKEN"}'
```

Resposta esperada:
```json
{"success":true,"id":"uuid-gerado","message":"Ficha criada com sucesso"}
```

---

## 7. Configurar no Sistema

1. Abra o sistema no navegador (http://localhost:3000 ou similar)
2. Clique no ícone de ⚙️ **Configurações** no canto superior direito
3. Cole a **URL do endpoint** e o **Token de API**
4. Clique em **Testar Conexão** para verificar
5. Se OK, clique em **Salvar Configuração**

---

## Solução de Problemas

| Problema | Solução |
|----------|---------|
| Erro CORS | O Apps Script publicado como "Qualquer pessoa" não deve ter CORS. Verifique se está usando `Content-Type: text/plain` |
| Token inválido | Verifique se o token nas Script Properties é exatamente igual ao inserido no sistema |
| "Erro interno" | Abra o Apps Script > Execuções para ver os logs de erro |
| Dados não aparecem | Verifique se a aba "Fichas" existe e tem o cabeçalho correto |
| Rate limit | Aguarde 1 minuto e tente novamente (máx 30 req/min) |

---

## Segurança

- ✅ Token de API para autenticação
- ✅ Rate limiting (30 req/min)
- ✅ Sanitização de todos os campos
- ✅ Log de auditoria completo
- ✅ Soft delete (dados nunca são apagados)
- ✅ Validação de campos obrigatórios
- ⚠️ O endpoint é público — a segurança depende do token secreto
- ⚠️ Não compartilhe o token com terceiros
