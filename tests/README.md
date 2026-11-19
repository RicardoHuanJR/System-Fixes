# Verificações

Sem dependências Node de produção:

```sh
node --test tests/argon-integrated.mjs
python -m unittest discover -s tests -p 'test_*.py'
python scripts/build_release.py --repository RicardoHuanJR/System-Fixes --tag v1.27.15
```

O workflow executa Node/Python antes do build e exige que o job Chromium passe antes da publicação. O teste Python cria e remove apenas diretórios temporários sob `tests/`.

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

Servidor restrito a localhost:4173, com classes/templates/CSS do CORE e documentos de teste falsos. As capturas ficam em `.local-reference/`. A suíte verifica busca/filtros/foco após refresh, favoritos, flags de conjuntos sem equipar, identidade de atividade, cliques simultâneos, indisponibilidade e permissões, F2/Escape/setas, movimento excedido, minimizar e painéis nos tamanhos 1440×900, 900×700, 600×700, 390×844, 320×700 e 720×360. Verifica também a posição do painel com HUD deslocado para a direita. Não prova execução no Foundry real.

O CI fixa o checkout CORE em `dc0ea6b7bfba4dff5defe1b757104db20ebf5f1a` e usa Playwright 1.62.1/Handlebars 4.7.8 somente para testes. A simulação tem um contador de geração como o CORE para descartar renderizações antigas.
