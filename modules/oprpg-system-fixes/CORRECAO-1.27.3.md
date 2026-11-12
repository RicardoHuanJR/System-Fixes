# OPRPG System Fixes 1.27.3 — Alvos por quadrados da grade

## O que mudou

- **Regra única de alvo em cenas com grade:** a técnica atinge um token quando ao menos uma das casas que ele ocupa está entre as casas afetadas pela área. A mera interseção do contorno do molde com o token **não** basta.
- **Regiões do Foundry V14**, incluindo emanações nativas vinculadas ao token: calculam as casas afetadas pelos seus centros com `RegionDocument.testPoint`, respeitando vazios/furos da região e a geometria do Foundry.
- **Moldes do OPRPG:** quando o template disponibiliza `_getGridHighlightPositions()`, são preservados os quadrados destacados pelo próprio sistema. Caso contrário, a seleção é calculada a partir do centro de cada quadrado e da forma do molde (círculo, cone, linha e retângulo).
- **Tokens grandes:** um token 2×2/3×3 é atingido se qualquer quadrado ocupado por ele for afetado; tokens pequenos continuam associados ao quadrado em que estão.
- **Áreas persistentes:** a lista de quadrados destacados pelos moldes é serializada e reutilizada nos ciclos; emanações recuperam a geometria atual da Região nativa ao mover o lançador.
- **Paredes:** quando essa opção de automação está ligada, os testes de obstrução partem para os centros dos quadrados afetados, nunca para os pontos do molde que não fazem parte do destaque da grade.
- **Cenas sem grade:** mantida a geometria contínua anterior, porque não existem quadrados a considerar.

## Testes locais

- `node tests/area-grid.mjs`: 35 verificações simuladas da lógica de grade, moldes, paredes, regiões, persistência e fallback sem grade.
- `node tests/native-emanation.mjs`: 19 verificações simuladas do fluxo da emanação nativa.
- Verificação de sintaxe JavaScript executada em todos os arquivos JS do módulo.

**Limitação:** os testes são simulados, não uma reprodução no Foundry V14 com o sistema OPRPG em execução. Teste também uma técnica de cone, uma linha, uma emanação e uma área persistente no mundo real antes de jogar. Se o sistema base aplicar dano por outro caminho sem usar o fluxo `area-workflow.js`, será necessário adaptar esse caminho no sistema.

## Instalação

1. Faça backup do diretório `Data/modules/oprpg-system-fixes`.
2. Extraia o arquivo ZIP de modo que `Data/modules/oprpg-system-fixes/module.json` exista.
3. Reinicie o Foundry e atualize o mundo (limpe cache se necessário).
4. Teste com tokens dentro e fora dos quadrados realçados, incluindo personagens grandes.
