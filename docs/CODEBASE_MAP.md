---
last_mapped: 2026-11-12T05:39:52Z
scope: embedded Argon HUD, historical adapter and release pipeline
updated: 2026-11-18
---

# Codebase Map

Mapeado com Cartographer em 2026-11-12T05:39:52Z, por três agentes de leitura. Escopo: integração Argon e publicação. Scanner de tokens indisponível por ausência de tiktoken; nenhum total estimado é apresentado.

```mermaid
flowchart LR
  Main[Fixes main.js] --> Integration[argon-hud/integration.js]
  Integration --> UI[argon.js / classes CORE]
  UI --> Model[model.js / atividades e economia]
  UI --> Execute[execute.js / execução nativa]
  UI --> Basics[basic-actions.js / ações herdadas]
  Basics --> Execute
  Basics --> Movement[movement.js / conversões]
  Execute --> System[OP RPG activity.use]
  Push[push main] --> Import[import_staged_system_fixes.py]
  Import --> Tests[Testes Node/Python]
  Tests --> Build[build_release.py]
  Build --> Release[GitHub Release e manifesto permanente]
```

## Integração ativa

| Arquivo sob modules/oprpg-system-fixes | Responsabilidade |
|---|---|
| main.js | Instala hook Argon na avaliação do módulo; settings no init |
| scripts/argon-hud/integration.js | Gate sistema/CORE/setting/legado, diagnóstico, atualização por documentos |
| scripts/argon-hud/model.js | Coleções, IDs de atividades, agrupamento, economia, custos informativos, busca sem acentos e escape |
| scripts/argon-hud/execute.js | Resolve documento atual, propriedade, bloqueio nativo, trava concorrente e cancelamento |
| scripts/argon-hud/panel-layout.js | Geometria pura de listas/drawer, retrato e barras nativas visíveis |
| scripts/argon-hud/actor-tests.js | Atributos/perícias relacionados e bônus numéricos preparados, sem avaliar fórmulas |
| scripts/argon-hud/argon.js | Cinco lançadores de economia, listas/filtros, foco/estado por ator, retrato, drawer, teclado, movimento e macros |
| scripts/argon-hud/favorites.js | Identidade relativa nativa, leitura e inclusão/remoção de favoritos por atividade |
| scripts/argon-hud/activity-details.js | Leitura pura de rótulos preparados da atividade, sem rolagem ou avaliação de fórmulas |
| scripts/argon-hud/weapon-sets.js | Três conjuntos nas flags CORE, validação de propriedade e atualização de slots sem equipar |
| scripts/argon-hud/basic-actions.js | Ações recuperadas 6.4.1; efeitos próprios, Preparar, expiração e hooks Esquivar |
| scripts/argon-hud/movement.js | Movimento real, unidades e histórico V14 |
| scripts/api.js | API pública game.oprpgFixes.argon; API game.oprpg de Haki/PP |
| scripts/module-compatibility.js | Diagnóstico de adaptadores duplicados |
| styles/argon-oprpg.css | Estilos compactos restritos à integração interna |

Não gastar PP, aplicar dano ou repetir efeitos de atividade na camada visual. O ponto único de execução é executeEntry; Preparar também o utiliza. Alterar hierarquia em model.js/argon.js e conferir tipos de item/ativação reais. Atividade removida não cai na primeira atividade disponível.

## Referência histórica

`modules/enhancedcombathud-oprpg-system` 6.4.1 fica preservado e desativado quando se usa a integração interna. Seus arquivos integration.js, utils.js, activity-ui.js, oprpg-api.js e basic-actions.js documentam as APIs anteriores. O layout antigo usava cartões grandes; não é o modelo visual atual. Não havia contador universal real de ações a migrar.

## Publicação e testes

`tests/argon-integrated.mjs` testa modelo, executor, registro de classes, retrato, movimento, favoritos, conjuntos e ações básicas com documentos falsos. `tests/test_staged_import.py` impede regressão de sobrescrita pelo ZIP publicado. `tests/argon-browser-server.cjs` e `argon-browser.html` fornecem renderização simulada com checkout externo do CORE e Handlebars externos, sem redistribuir o sistema oficial. `argon-browser-check.cjs` verifica interações e seis viewports, inclusive concorrência, refresh, permissão e movimento excedido.

`.github/workflows/release.yml` importa somente pacote mais novo e exige o job Chromium antes do job release; ambas as etapas conferem a versão em espera. Executa Node/Python, rejeita tag existente, valida/compacta e publica. `scripts/build_release.py` confere sintaxe e integridade e mantém URL latest/download estável. O workflow também embala os demais módulos, preservando suas versões e fontes.

## Limites

CORE é opcional; adaptador antigo ativo bloqueia o interno. Haki é aberto pela API nativa; PP vêm de energy. Detalhes usam rótulos preparados e os atalhos do retrato reutilizam OPRPGList/OPRPGActivityButton com IDs individuais. Fonte oficial do OP RPG fica somente na pasta local ignorada, inclusive arquivos com licenças individuais, e jamais deve entrar em commit ou ZIP. Não há mundo Foundry neste workspace; verificação de navegador é simulada. Atributos preparados e associações de perícias ficam em actor-tests.js; o drawer contextual substitui a abertura permanente e a antiga linha de recursos; basic-actions.js gerencia validade, visão e concentração das ações preparadas. Consulte REVISAO-1.27.18.md para evidência e rollback.

Refinamento 1.27.28: argon-refinement-check.cjs complementa a suíte existente com efeitos, totais, ficha do item, navegação, texto ampliado e obstruções nativas simuladas. A preferência argonTextSize é client-only, compacta por padrão, registrada em integration.js.
