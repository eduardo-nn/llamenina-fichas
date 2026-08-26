# Script de automação de compilação do executável (.exe) da LLAMENINA
Write-Host "Iniciando compilação do executável (.exe) da LLAMENINA..." -ForegroundColor Cyan

# Verificar se Node.js está instalado
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js não foi encontrado. Por favor, instale o Node.js (com NPM) antes de continuar."
    exit 1
}

# Baixar binários do NeutralinoJS
Write-Host "Baixando/atualizando os binários do NeutralinoJS..." -ForegroundColor Yellow
npx -y @neutralinojs/neu update

# Compilar o executável
Write-Host "Empacotando a aplicação em um executável (.exe)..." -ForegroundColor Yellow
npx -y @neutralinojs/neu build

Write-Host "Compilação concluída com sucesso!" -ForegroundColor Green
Write-Host "Verifique a pasta 'dist/llamenina-fichas/' para encontrar seu executável Windows (.exe)." -ForegroundColor Green
