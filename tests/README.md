# Verificações

Sem dependências Node de produção:

```sh
node --test tests/argon-integrated.mjs
python -m unittest discover -s tests -p 'test_*.py'
python scripts/build_release.py --repository RicardoHuanJR/System-Fixes --tag v1.27.14
```

O workflow executa os dois primeiros comandos antes do build. O teste Python cria e remove apenas diretórios temporários sob `tests/`.

## Navegador simulado

Requer checkout externo do Argon CORE, Handlebars e Playwright/Chromium. Não copie fontes oficiais do sistema para o repositório. Exemplo em shell POSIX, ajustando caminhos locais:

```sh
export ARGON_CORE_DIR=/checkout/enhancedcombathud
export HANDLEBARS_DIR=/runtime/node_modules/handlebars
export PLAYWRIGHT_MODULE=/runtime/node_modules/playwright
mkdir -p .local-reference
node tests/argon-browser-server.cjs
# Em outro terminal:
node tests/argon-browser-check.cjs
```

Servidor restrito a localhost:4173, com classes/templates/CSS do CORE e documentos de teste falsos. As capturas ficam em `.local-reference/`. A suíte verifica tamanho da barra, busca vazia, identidade da atividade executada, F2, Escape, rolagem de perícia, botão de restaurar acessível ao minimizar e ausência de overflow horizontal em 390 px. Não prova execução no Foundry real.
