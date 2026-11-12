# OPRPG System Fixes — revisão e atualização local v1.27.9

**Origem:** ZIP `oprpg-system-fixes-1.27.8-multiplas-atividades-v14(1).zip` enviado pelo usuário.
**Escopo:** correções de integridade e desempenho de baixo impacto, com preservação das outras funcionalidades.
**Ambiente dos testes:** Node.js, simulações isoladas; **não** houve execução em uma mesa real do Foundry V14.

## Correções implementadas

### 1. Múltiplas atividades — ponte de acerto por item

**Problema:** `multi-activity-attack-fix.js` guardava somente uma ponte de acerto temporária por mensagem. Um segundo cartão (de outro item) na mesma mensagem podia substituir a ponte do primeiro. Os `labels` de acerto/modificador do primeiro item podiam permanecer alterados após a rolagem.

**Mudança:** cada mensagem pode agora guardar várias pontes independentes, uma por item em execução. Em uma atualização do conteúdo ou na exclusão da mensagem, todas as pontes ligadas a ela são restauradas. Para o **mesmo item**, uma nova ponte continua substituindo/restaurando a anterior para evitar empilhamento de modificadores.

**Limite conhecido:** rolagens verdadeiramente simultâneas do **mesmo item** ainda dependem dos `item.labels` temporários e do handler nativo. Uma solução transacional exige integração direta com o código do sistema original. O único estado `multiActivityDamage` por mensagem também permanece sem alteração.

### 2. Áreas persistentes — efeitos ao sair e encerramento

**Problema:** a nova lista de membros podia ser gravada antes da remoção dos efeitos de saída. Se essa remoção falhasse, o token deixava de aparecer como membro e a tentativa de limpeza podia não ser repetida.

**Mudança:** os efeitos de saída são removidos antes de salvar a nova lista. Se ocorrer erro, a lista antiga permanece e uma nova atualização poderá tentar limpar novamente. No encerramento, os efeitos são limpos antes do `unsetFlag`, permitindo nova tentativa após falha; a limpeza dos documentos de geometria ocorre após remover o registro da área. Encerramentos simultâneos da mesma área são deduplicados em memória.

**Limite conhecido:** uma indisponibilidade permanente de permissões ou de um alvo remoto pode impedir a remoção automática. Os arquivos locais não podem garantir integridade de operações entre vários clientes (navegadores) sem um protocolo de confirmação de servidor/mestre.

### 3. Áreas persistentes — trabalho desnecessário

- O índice de áreas do ator só é reconstruído em mudanças relacionadas a `persistentAreas`.
- As verificações de manutenção só são ativadas quando a flag de `upkeep` muda.
- Ao limpar efeitos de vários tokens que saíram, as mensagens-filhas da área são procuradas **uma vez por atualização**, e não uma vez por token.

### 4. Efeitos periódicos — indexação dos pedidos

**Problema:** para cada efeito periódico no turno, o código percorria o histórico inteiro de mensagens para localizar um pedido já emitido.

**Mudança:** o processador do turno constrói uma única tabela de pedidos já existentes e a reutiliza durante todas as verificações daquele turno; atualiza a tabela à medida que cria novos pedidos. A chamada isolada `requestPeriodic` mantém a busca anterior por compatibilidade.

## Preservado nesta versão

As regras de seleção por quadrados da grade, emanação nativa do Foundry V14, imunidade do lançador, proteção de NPCs sem vínculo, reembolso de PP, cura, Haki, Akuma no Mi, dano/escudo, privacidade e demais recursos foram mantidas. Nenhuma mecânica de livro ou fórmula de dano foi redefinida nesta revisão.

## Testes

- As 16 suítes presentes na versão 1.27.8 passaram novamente.
- A suíte de múltiplas atividades recebeu 9 verificações direcionadas adicionais.
- Duas novas suítes foram adicionadas: `stability-1279.mjs` (14 verificações) e `periodic-1279.mjs` (4 verificações).
- Verificação estática de sintaxe de JavaScript/ES Modules e estrutura de importações.
- Conferência da estrutura ZIP e versão do manifesto.

Total adicional: **27 verificações direcionadas** (9 + 14 + 4), além das já existentes.

## Limitações e recomendações

1. Testar em um mundo de **cópia**, com versões correspondentes do OP RPG (manifesto: sistema 1.0.20) e Foundry V14, antes da campanha.
2. Testar dois cartões de ataque de itens diferentes na mesma mensagem, cancelar uma rolagem e excluir um cartão aberto.
3. Testar uma área persistente com vários tokens saindo ao mesmo tempo, inclusive alvos com efeitos que precisam ser removidos.
4. Testar efeitos periódicos no começo e fim de turnos com múltiplos jogadores.
5. **Não foram resolvidas** nesta atualização a concorrência entre clientes distintos em operações de recursos, a execução simultânea do **mesmo** item com labels compartilhados, a persistência de múltiplos resultados de dano no mesmo ChatMessage, nem a restauração completa de backups. Não há garantia de ausência de outros erros.
