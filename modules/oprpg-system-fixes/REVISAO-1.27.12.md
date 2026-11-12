# Auditoria em dez passagens — OPRPG System Fixes 1.27.12

**Data:** 11/11/2026. **Origem:** ZIP da versão 1.27.11.  
**Ambiente:** verificação estática e execução simulada com Node.js 22; **sem Foundry V14/OP RPG 1.0.20 em execução real**.

## Método: dez passagens com objetivos diferentes

1. **Integridade do pacote e inicialização.** Inventário do manifesto, recursos, arquivo principal, 18 grupos configuráveis e importações. ZIP original íntegro. Nenhum import local ausente.
2. **Compatibilidade Foundry V14.** Leitura de usos de `ChatMessage.applyMode`, `messageMode`, `RegionDocument.testPoint` e `createTokenEmanation` frente às APIs documentadas; `rollMode` permanece somente como fallback de compatibilidade.
3. **Geometria e seleção de alvos.** Verificação das áreas por quadrados destacados, emanações nativas, tamanho de tokens, paredes, altura e exclusão do lançador. As suítes anteriores continuam aprovadas.
4. **Áreas persistentes, entrada/saída e turnos.** Encontrado turno marcado como concluído quando Região nativa estava indisponível, apesar de adiar reconciliação. Corrigida a gravação prematura de `lastCombat`.
5. **Múltiplas atividades, salvaguardas e efeitos.** Encontrado processador que escolhia sempre o primeiro cartão `save`, deixando de aplicar efeitos da segunda atividade. Corrigida seleção pela chave da rolagem. Corrigida também a CD numérica direta no resolvedor de efeitos.
6. **Dano, cura, PP, PV, escudos e histórico.** Revisados caminhos de atualização, idempotência, limite de cura e testes cruzados. Não foram alteradas as regras de cálculo sem reprodução conclusiva. Concorrência entre clientes permanece risco.
7. **Haki, Akuma no Mi, descansos e treinos.** Inspeção de callbacks, recursos, efeitos e acoplamento às funções internas do OP RPG; preservadas as regras. Testes simulados existentes aprovados, sem homologação das interfaces nativas.
8. **Privacidade, permissões e integrações externas.** Encontrado caminho opcional DAE que permitia aplicar efeitos de área ao lançador presente em registros antigos. Corrigida exclusão usando `isCasterActor`.
9. **Eventos, filas e periodicidade.** Revisado o gerenciamento de Promises, timers, pedidos periódicos e alterações concorrentes. Confirmado que `periodicSpecs` já filtrava efeitos desativados; adicionada apenas verificação antecipada na varredura (pequena economia de trabalho), **não classificada como correção de bug**.
10. **Regressões, diagnósticos e empacotamento.** Execução de todas as suítes `.mjs`, checagem de sintaxe dos 62 arquivos JS, validação do manifesto/idioma, comparação do diff e testes de integridade do ZIP final.

## Defeitos confirmados e correções

| Prioridade | Arquivo | Sintoma demonstrado | Correção |
|---|---|---|---|
| Alta | `scripts/technique-effects.js` | Efeitos ligados à segunda atividade de salvaguarda podiam não ser aplicados. | Localiza o cartão correspondente à chave de resultado `${sourceId}:${activityId}:${actorUuid}` em vez de selecionar o primeiro. |
| Média | `scripts/technique-effects.js` | CD armazenada diretamente como número era interpretada como inválida nesse fluxo, embora outros validadores a aceitem. | Aceita CD numérica ou texto numérico e mantém a leitura de `dc.value`/`dc.target`. |
| Alta | `scripts/persistent-areas.js` | Região nativa indisponível durante uma troca de turno podia deixar `lastCombat` gravado antes de reconciliação. | Não confirma o turno enquanto a geometria nativa não está acessível. |
| Alta | `scripts/external-compatibility.js` | Aplicação manual via ponte DAE podia incluir o lançador de área se ele ainda constasse entre os alvos de um cartão antigo. | Adiciona a verificação de identidade do lançador antes de delegar ao DAE. |

## Verificações automatizadas

- **21/21 suítes `.mjs` aprovadas**; a nova suíte `tests/auditoria-10-passagens-12712.mjs` executa **12 verificações** de regressão.
- **62/62 arquivos JavaScript com sintaxe válida** (módulo principal e scripts), além das suítes ESM executadas.
- **Importações locais e manifesto:** análise estrutural do pacote aprovada, sem dependências locais ausentes.
- **Prova antes/depois:** a nova suíte reproduziu na 1.27.11 a ausência do efeito da segunda atividade e passou com o código 1.27.12.
- **Verificação independente das APIs V14** através de documentação pública do Foundry, não de execução de mesa.

## Riscos ainda não eliminados

- **Concorrência entre computadores** ao alterar PV, PP, efeitos e itens do mesmo personagem. Bloqueios atuais são sobretudo locais e não constituem transações distribuídas.
- **Alterações de `item.labels`** no acerto de múltiplas atividades. A ponte local ainda depende de detalhes internos do OP RPG.
- **Região indisponível durante um turno:** a correção impede marcar como concluído; a execução do ciclo perdido ainda exige uma nova reconciliação do mesmo turno. Não há reprocessamento retroativo automático garantido após avançar o combate.
- **Mensagens/cartões complexos:** mudanças na ordem do HTML dos cartões podem afetar identificadores associados à posição; as atualizações devem ser testadas em mesa.
- **Haki, Akuma no Mi, DAE, Midi-QOL, Dice So Nice, treinos e ficha NPC** dependem de integração real com o sistema e módulos instalados; testes simulados não comprovam todos os fluxos.
- **Backups:** o módulo exporta dados, mas não oferece restauração integral e transacional de mundos.
- **Dependências internas do OPRPG 1.0.20:** atualização do sistema-base pode invalidar patches sem gerar erro de sintaxe.

## Testes mínimos em mundo de cópia (com mestre + jogador)

1. Técnica com duas atividades `save`, cada uma com efeito e CD próprios. Use a segunda e confira a aplicação somente do efeito correto.
2. Emanação V14 com lançador no centro e inimigo na borda. Teste também `2x2`, altura e paredes; o lançador deve ficar fora dos efeitos.
3. Área persistente durante troca de cena/Região temporariamente ausente; confirme que a manutenção não é marcada como executada até a geometria estar disponível.
4. Ponte DAE opcional: aplique efeitos vinculados a um cartão de área antigo que contenha o lançador entre os alvos e confira que apenas outros alvos sejam incluídos.
5. Dano, cura, descanso, escudo, Haki, Akuma, treinos e efeitos periódicos em fichas descartáveis; acompanhe console F12 e históricos.
6. Dois usuários realizando ações simultâneas no mesmo personagem: **não** considere o resultado protegido contra condição de corrida entre clientes.

## Instalação e reversão

Faça backup do mundo e da pasta `Data/modules/oprpg-system-fixes`. Extraia o novo ZIP (contém a pasta-raiz `oprpg-system-fixes/`) em `Data/modules`, reinicie o Foundry e verifique a versão 1.27.12. Para reverter, restaure a pasta 1.27.11 e o backup do mundo, se os testes tiverem alterado fichas.

**Conclusão:** foram feitas dez passagens temáticas sobre todos os grupos do módulo. Quatro comportamentos concretos receberam correções pequenas e teste direcionado; isso não significa ausência de outras falhas nem homologação de todos os recursos no Foundry real.
