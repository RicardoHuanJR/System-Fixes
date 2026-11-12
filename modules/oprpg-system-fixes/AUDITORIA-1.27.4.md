# OPRPG System Fixes — auditoria local e correções 1.27.4

Data: 09/11/2026. Base: pacote 1.27.3 (`alvos-por-grid-v14`). Esta compilação é **local**, não é um release publicado no GitHub.

## Problemas tratados

1. **Lançador incluído nos alvos da própria área (confirmado pelo código).** `finalizeAreaExecution` aplicava o filtro geométrico sem conferir a identidade do personagem que lançou a técnica. Foi adicionada `scripts/area-caster.js`: compara o Actor UUID e, quando necessário, a origem do token. O próprio personagem agora é excluído das casas atingidas, dos alvos marcados, das salvaguardas e dos ciclos de áreas persistentes. O lançamento continua podendo ter a casa de origem coberta visualmente, mas o autor não vira alvo da própria técnica.
2. **Caminhos alternativos de aplicação (risco confirmado por ausência da proteção).** O estado da execução registra `casterUuid`. A aplicação de dano (`executionActors`, `areaSaveMultiplier`), os efeitos ligados à atividade (`applyTechniqueEffects` e preCreateActiveEffect) e o painel de dano nativo inclusive para cura em área ignoram o lançador quando o cartão possui uma execução de área. Técnicas pontuais e curas fora de área preservam o comportamento existente.
3. **Áreas persistentes após troca de cena (risco de perda de estado).** Se uma Região nativa do V14 não estiver acessível durante a atualização, o módulo não pode interpretar isso como `0` alvos: a atualização aguarda a Região voltar a estar disponível, preservando os membros e efeitos até existir geometria válida.
4. **NPCs sintéticos e várias instâncias (risco de identidade).** Com NPC não vinculado, o UUID da cópia pode ser diferente do ator-base. Quando há um token de origem selecionado sem ambiguidade, o módulo exclui só esse lançador, sem conceder imunidade a todas as cópias de um mesmo protótipo.
5. **Manifesto apontava para a versão v1.27.0 (confirmado).** A versão interna foi atualizada de `1.27.3` para `1.27.4`. Os campos de atualização/download do manifesto foram omitidos **somente nesta compilação local**, para não oferecer um ZIP antigo como atualização da versão corrigida. Atualizações futuras precisarão ser feitas manualmente até publicação de manifesto/release correspondentes.

## Verificações executadas

- Sintaxe de `main.js` e 61 arquivos JavaScript dentro de `scripts/`: aprovada pelo Node.js.
- Resolução de importações relativas e símbolos importados: nenhum arquivo/símbolo local faltante encontrado (verificação estática).
- `tests/area-grid.mjs`: 35 verificações simuladas.
- `tests/native-emanation.mjs`: 19 verificações simuladas.
- `tests/area-caster.mjs`: 22 verificações simuladas.
- `tests/persistent-guards.mjs`: 3 verificações simuladas.
- **79 verificações simuladas concluídas com sucesso**. Não são testes de integração no Foundry, nem testes unitários de todos os demais recursos do módulo.

## Riscos pendentes / não alterados

- Dependência de caminhos privados do sistema, como `/systems/oprpg-system/module/canvas/ability-template.mjs`, e método não público `_getGridHighlightPositions`. É necessário rever estes pontos quando o sistema OP RPG receber atualizações.
- A integração real da API de Regiões, salvaguardas, cartões de dano, áreas persistentes e regras de altura/parede deve ser testada com Foundry V14 + OPRPG instalado. Testes simulados não garantem compatibilidade de todos os hooks.
- Qualquer outro módulo ou macro que aplique dano/efeitos diretamente, sem consultar `areaExecution`, pode contornar a seleção do Fixes.
- A atualização de tokens reavalia todas as áreas persistentes da cena; desempenho e ordenação de eventos de movimento em mesas com muitas áreas exigem medição prática.
- O código completo de dano/Haki/Akuma/automação de fichas não foi validado funcionalmente; o escopo de revisão estática não equivale à ausência de bugs nessas funcionalidades.

## Testes sugeridos dentro do Foundry

1. Cone/linha/círculo/retângulo com o lançador dentro: somente outros personagens em quadrados afetados entram na seleção.
2. Emanação nativa vinculada ao lançador (1×1 e 2×2), antes e depois de mover o token; não selecionar, danificar, salvar nem aplicar efeito no próprio lançador.
3. NPCs não vinculados: duas cópias de um mesmo ator; somente quem lançou deve ser excluído.
4. Área persistente: verificar entrada, saída, início/fim do turno, paredes, efeitos benéficos/maléficos e o próprio lançador.
5. Cura em área e dano pelo cartão nativo: conferir que o próprio lançador não aparece. Fora de área, a cura individual deve permanecer normal.
6. Cenas carregando/alternando: nenhum membro ou efeito persistente deve desaparecer só porque uma Região ainda não carregou.

Faça backup antes de substituir `Data/modules/oprpg-system-fixes`; reinicie o Foundry após copiar o diretório do ZIP.
