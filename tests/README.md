# Verificações

Sem dependências Node de produção:

```sh
node --test tests/argon-integrated.mjs
python -m unittest discover -s tests -p 'test_*.py'
python scripts/build_release.py --repository RicardoHuanJR/System-Fixes --tag v1.27.27
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

A regressão 1.27.16 acrescenta 867×453 px com `playerDetailsBottom=true`: verifica padding de 6 px, ordem dos detalhes, máscara removida, ausência de sobreposição com atributos, faixa de movimento de até 22 px e cabeçalhos antigos ocultos. A captura correspondente é `hud-regression-user-capture.png`.

A 1.27.17 acrescenta detalhes da atividade sem executar, restauração do detalhe/foco, controles separados de execução, seleção individual nos atalhos de armas/favoritos e ausência de duplicação após atualizar só o retrato. Verifica seis controles no retrato móvel com Haki e o fallback de favoritos de perícia. O helper de detalhes tem testes de alcance herdado, múltiplas parcelas, cura, dados ausentes e identificação. Capturas: `hud-activity-details.png` e `hud-quick-weapons.png`. Os testes de execução selecionam somente resultados visíveis.

A 1.27.18 cobre visão por defensor e nível V14, alvos mistos, expiração fora do turno, supressão, cancelamento da Reação, concentração nativa e transferência da duração sem duplicar uso. O navegador confere o resumo de PP gerado/escudo, painel de recursos por teclado, limites da viewport e retrato com 122 px. Capturas: hud-resources-867.png e hud-resources-390.png.

A 1.27.19 verifica miniaturas nas cinco economias, fotos específicas versus ícones preparados genéricos, fallback de imagem, custo/alcance, abas sem sobrepor os atalhos em 867×453, e versão móvel em 390×844. O teste Node reproduz performModuleCheck antes de argonInit, verificando o registro interno e a preservação do aviso quando desabilitado. Capturas hud-images-actions.png, hud-images-reactions.png e hud-images-mobile.png.

A 1.27.20 verifica fontes locais, ícones próprios decorativos, fallback fechado, cinco controles de 60×48 px sem recorte/rotação/itálico, alinhamento horizontal e fotos nativas preservadas no tema integrado. O teste aguarda os cinco lançadores efetivamente montados.

A 1.27.21 verifica imagem explícita com opacidade 1 e sem filtro, origem real do ator, identidade sem sobreposição, nome acessível, abertura da ficha via teclado, fallback, efeitos temporários em coluna separada, minimizar e salvaguarda de morte nativa. Capturas: hud-portrait-867.png e hud-portrait-390.png.

A 1.27.22 mede foto e painel em Full HD, janela baixa e celular; também verifica o nome de 16 px em telas grandes. Captura adicional: hud-portrait-fullhd.png. A faixa de ações mantém seu tamanho e os atalhos respeitam a altura adaptativa.

A 1.27.23 verifica enquadramento integral com imagens de proporção 1:3 e 3:1, ícones de 22/20/18 px, os seis botões dentro da faixa e indicadores separados. Capturas adicionais: hud-portrait-tall.png e hud-portrait-wide.png.

Na mesma 1.27.23, a antiga linha de recursos e a abertura permanente são removidas. O navegador testa atributos clicáveis, execução exata de teste/salvaguarda/perícia, ausência de rolagem ao abrir, perícia com atributo personalizado, macros, teclado, foco após atualizar, permissões e troca de ator para NPC sem atributos. Capturas atuais: hud-attributes-1920.png, hud-attributes-867.png e hud-attributes-390.png. Capturas de recursos das versões anteriores são históricas.

A 1.27.24 atualiza as medidas do retrato para 202/186/212 px, verifica indicadores ao lado da foto, nome acima dos indicadores, faixa de atributos abaixo da identidade e foco inteiramente visível após atualizar o painel em janela baixa. As capturas de atributos e atividades mostram o acabamento atual.

A 1.27.25 verifica abertura acima do próprio lançador com intervalo de 8 px, listas laterais nas cinco economias em 867 px, posição restaurada após atualizar o HUD e alternância de desktop/celular com o painel já aberto. Em telas estreitas e janelas baixas, a lista preserva retrato e botões. Capturas de atividades e abertura passam a representar a posição atual.

A 1.27.26 mede pelo menos cinco atividades completas e 240 px de área útil na lista do cenário inicial em 1440×900 (medição atual: 248 px). Confere busca dentro do cabeçalho, segunda linha em 320 px, estabilidade dos atalhos ao adicionar/remover favoritos e Haki, rótulos em português e botões contidos no retrato, mantendo a largura mínima de 24 px em celular. Captura: hud-compact-header.png.

A 1.27.27 cobre identidade separada, metadados persistentes durante execução/indisponibilidade, estado compartilhado entre variantes do mesmo item, cancelamento e ausência de erro após fechar o HUD durante um uso. Usa mouseup, o evento de execução real do CORE, no teste de concorrência. Confere falta de permissão, nomes extensos com travessão/caracteres HTML, descrições acessíveis e execução da variante a1. Capturas: hud-activity-pending.png, hud-activity-unavailable.png e hud-activity-long-name.png.
