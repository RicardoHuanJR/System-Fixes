# OPRPG System Fixes 1.27.10 — isolamento de rolagens e resultados por cartão

**Data:** 10/11/2026. **Origem:** versão 1.27.9 fornecida na conversa. **Alvo:** Foundry V14 com sistema OP RPG 1.0.20 (conforme `module.json`).

## Implementações

### 1. Impedir conflito entre ataques simultâneos do mesmo Item, dentro do cliente

Anteriormente, `multi-activity-attack-fix.js` restaurava a ponte temporária de um Item quando um segundo ataque do mesmo Item era iniciado. O primeiro diálogo ainda podia estar em andamento, e a rolagem original lia `item.labels` modificados pela segunda atividade.

- A ponte agora fica vinculada ao próprio Item enquanto está pendente.
- Novo clique de Ataque no mesmo Item é **bloqueado com aviso**, sem transmitir o clique ao handler nativo, até que a operação atual seja concluída.
- Continuam permitidas operações simultâneas de Itens *diferentes*.
- Ao atualizar o conteúdo do cartão, excluir a mensagem ou atingir o tempo limite, a ponte é restaurada.
- Se o diálogo nativo for cancelado sem atualizar a mensagem, depois de **fechar o diálogo** é possível recuperar a ponte local pelo console: `game.oprpgFixes.resetPendingMultiActivityAttacks()`. Sem essa ação, o timeout de segurança de cinco minutos continua existindo.
- O diagnóstico `game.oprpgFixes.multiActivityAttackStatus()` agora mostra `blockedConcurrentAttacks`.

**Limite:** essa proteção atua no cliente; ela **não é um bloqueio entre computadores diferentes** e não torna a alteração dos rótulos nativos uma transação real.

### 2. Persistir resultados de dano por cartão

Anteriormente, `multiActivityDamage` armazenava um único resultado por `ChatMessage`. O segundo cartão podia sobrescrever os dados do primeiro.

- Os resultados novos são salvos incrementalmente em `flags.oprpg-system-fixes.multiActivityDamageCards.<chave-do-cartão>`, usando atualizações pontuais do `ChatMessage` em vez de substituir um único objeto global.
- A chave contém identidade de ator, token, item, atividade, tipo de cartão e posição entre cartões idênticos. Os componentes são codificados sem pontos nem colisões de sanitização.
- O formato de dados é versão 3. O formato legado `multiActivityDamage` (v2) **continua sendo lido**, inclusive quando um cartão novo no mesmo chat já foi gravado em v3.
- A seleção de resultados para renderização considera o cartão correto, sem misturar tokens de origem diferentes.
- As solicitações de dano ao mestre agora incluem a identidade exata do cartão para revisá-lo corretamente; solicitações antigas continuam com busca por item/atividade.
- O fluxo de salvaguardas atualiza todos os cartões de save da mensagem, não apenas o primeiro.
- O módulo de privacidade reconhece também as atualizações dos novos flags por cartão.

**Limites:** se o sistema original substituir o HTML de cartões idênticos mudando sua ordenação, a identidade da posição pode mudar; o procedimento seguro é rejeitar solicitações que não encontrem a chave esperada. Ainda não há protocolo transacional para dois computadores escrevendo no **mesmo cartão** em paralelo. A integração de dano customizado com o handler original do OP RPG permanece uma área para homologação.

### 3. O que foi preservado

- Geometria por quadrados, emanações nativas V14, exclusão do lançador e áreas persistentes.
- Regras e cálculos de PP/PV, dano, cura, escudo, Haki, Akuma no Mi, treinamentos, descansos e efeitos periódicos.
- As demais opções e patches do módulo não foram modificadas nesta etapa.

## Testes executados

- **19/19 suítes `.mjs` passaram no Node.js**, incluindo as 18 existentes e `tests/stability-12710.mjs`.
- A nova suíte contém **35 verificações**: concorrência do mesmo Item; bloqueio e liberação; exclusão de mensagens; recuperação manual; IDs de cartões para tokens e cartões duplicados; gravação de múltiplos resultados; preservação do formato antigo; falha controlada de persistência.
- Verificação de sintaxe de todos os arquivos JavaScript/ESM, resolução de importações locais, validade do manifesto e integridade do ZIP.

**Não realizado:** teste de interface dentro do Foundry V14; testes reais com OP RPG 1.0.20, mestre/jogador em sessões separadas ou módulos de terceiros. Aprovação em Node.js não comprova compatibilidade funcional em uma mesa real.

## Instalação segura e testes de aceitação

1. Faça backup da pasta `Data/modules/oprpg-system-fixes` e do mundo antes de atualizar.
2. Extraia o ZIP com a pasta `oprpg-system-fixes` dentro de `Data/modules` (sem aninhar outra pasta).
3. Reinicie o Foundry; confira a versão **1.27.10** nas configurações de módulos.
4. Crie duas atividades de Ataque no mesmo Item. Inicie um ataque e tente iniciar outro antes de terminar o primeiro: deve ser bloqueado com aviso. Conclua e tente novamente: deve ser liberado.
5. Em uma mensagem que contenha dois cartões, role dano de ambos, feche/reabra o chat e confirme que cada cartão preserva seu próprio resultado.
6. Teste salvaguardas e solicitações de dano com um mestre e um jogador em duas sessões, incluindo um NPC não vinculado.
7. Teste emanações e áreas persistentes para detectar regressões; use o mundo principal somente após validar.

## Pendências conhecidas

- Coordenação entre clientes para impedir gravações concorrentes de PP/PV e danos no mesmo alvo.
- Remover completamente a dependência de mutações temporárias de `item.labels` para rolagem de acerto.
- O sistema nativo pode cancelar diálogos sem emitir atualização de chat; a recuperação manual ou o timeout ainda são necessários.
- O uso de cartões de dano customizados deve ser comparado com todas as etapas nativas de recursos, Haki e macros do OP RPG.
- Um mecanismo completo de restauração validada de backups ainda não existe.
