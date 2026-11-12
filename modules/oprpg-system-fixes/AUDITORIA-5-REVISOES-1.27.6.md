# OPRPG System Fixes 1.27.6 — Cinco revisões adicionais

**Base:** compilação local 1.27.5. **Objetivo:** examinar cinco classes de erro adicionais, implementar apenas correções fundamentadas e preservar seleção pelos quadrados da grade, emanações nativas e exclusão do lançador. Esta é uma compilação local, não uma versão oficial do autor do módulo.

## As cinco revisões

| # | Estratégia independente | Achado / decisão | Evidência |
|---|---|---|---|
| 1 | Confronto de chamadas com a API pública Foundry V14 | **Falha confirmada**: Haki e efeitos periódicos ainda empregavam `ChatMessage.applyRollMode`/`rollMode`. Migrados para `ChatMessage.applyMode`/`messageMode`, com mapeamento correto de modos (`blindroll` para `blind`, etc.) e fallback explícito para não abrir mensagens privadas. | Documentação oficial do Foundry V14 e testes `revisoes-5-extras.mjs`, `deep-periodic-privacy.mjs`. |
| 2 | Análise de interleavings de operações assíncronas (cancelamento e término tardio) | **Falha confirmada**: após um dos templates cancelar uma colocação múltipla, outro template que terminasse depois podia permanecer na cena. Os resultados tardios são removidos sem executar a confirmação. Normalizada a identidade do Documento quando o sistema retorna um objeto Placeable ao invés de um Document. | Testes de limpeza tardia e deduplicação; análise do fluxo `wrapAreaPreview`. |
| 3 | Revisão das barreiras de identificação do lançador até o último estágio | **Brecha de defesa em profundidade**: `rollSaveForActor` verificava a lista registrada, mas não impedia explicitamente o lançador em um estado antigo/adulterado que contivesse seu UUID. A salvaguarda do próprio lançador agora é recusada nesse estágio também. | Regressão com estado legado contendo o UUID do lançador. |
| 4 | Testes de borda baseados em casas, não contornos de pixels | **Sem nova correção**: comprovado que token 2×2 utiliza quatro centros de casas; contato de 1 pixel na casa vizinha não produz alvo; mini-token que cruza grade preserva a casa dominante conforme a posição central. Mantida a regra aprovada para evitar regressão. | Teste específico de bordas + suíte anterior `area-grid.mjs`. |
| 5 | Reexecução simultânea de operações contábeis e revisão de segurança do estado | **Sem nova correção**: dois pedidos simultâneos de reembolso do mesmo cartão foram serializados; o segundo foi rejeitado e apenas uma devolução foi persistida. Permanece o risco operacional de estados antigos/incompatíveis fora da cobertura dos mocks. | Teste com `Promise.all`, recibos e PP simulados; suíte `deep-refund.mjs`. |

## Arquivos alterados

- `scripts/roll-privacy.js`: ponte de visibilidade de mensagens nativa V14 e fallback seguro.
- `scripts/periodic-effects.js`: mensagens periódicas usam visibilidade V14.
- `scripts/haki-unified-fix.js`: mensagens de Haki e rolagens usam os novos nomes/modos V14.
- `scripts/haki-perito-fix.js`: rolagem do Perito atualizada para `messageMode`.
- `scripts/area-workflow.js`: limpeza de colocação tardia e aceitação de Placeable/Document.
- `scripts/save-workflow.js`: barreira adicional contra salvaguarda do lançador.
- `module.json`, `CHANGELOG.md` e novos testes.

## Verificações

- **152 verificações funcionais e simuladas aprovadas**: 129 da versão 1.27.5 mais 23 novas.
- **62 arquivos JavaScript** parseados, **246 importações locais** e **448 símbolos importados** verificados via testes estruturais.
- Conferência de todas as sintaxes JavaScript e integridade dos arquivos do ZIP.

As contagens de verificação são verificações `assert` de testes locais, não equivalem a 152 cenários distintos em uma mesa Foundry real.

## Limitações e riscos restantes

1. O pacote **não foi testado em uma mesa Foundry V14 conectada ao sistema OPRPG**; APIs internas do sistema, permissões de usuário e módulos externos continuam exigindo validação.
2. Uma emanação deve ser testada movimentando o token e em áreas com paredes e níveis de altura.
3. Em multi-template, confirmar cancelamentos durante carregamento lento e conexão instável.
4. Testar modos público, mestre, cego e apenas o autor com jogador e mestre conectados, especialmente Haki e efeitos periódicos.
5. A regra de quadrados em grades hexagonais e tokens em posicionamentos não convencionais depende de validação visual; este patch **não redefiniu** o critério existente de centros das casas.
6. Recibos de reembolso e dano têm limites históricos deliberados; para campanhas com centenas de aplicações, validar não reaplicar cartões muito antigos. Uma política definitiva de retenção/idempotência exige ajuste de arquitetura e testes em mundo real.

## Instalação sugerida

Fazer backup da pasta `Data/modules/oprpg-system-fixes`, substituir pelo conteúdo do ZIP e reiniciar o Foundry. Validar primeiro em mundo de testes. Não atualizar automaticamente a partir de repositório externo: esta compilação é local.
