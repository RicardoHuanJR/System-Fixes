# OPRPG System Fixes — revisão de estabilização 1.27.11

**Data:** 10/11/2026 (horário do usuário).  
**Base:** `oprpg-system-fixes-1.27.10-estabilidade-multiplas-atividades-v14.zip`.  
**Alvo declarado no manifesto:** Foundry V14 (mínimo 14.360), sistema `oprpg-system` 1.0.20.

## Escopo

Auditoria cruzada da inicialização, atividades, salvaguardas, regiões e grid, áreas persistentes, manutenção por turno, permissões, histórico e operações concorrentes. A prioridade foi corrigir falhas que podem causar **alvos errados ou perda silenciosa de progresso** sem alterar o cálculo de Haki, Akuma no Mi, PP, PV e dano sem reprodução segura.

## Correções aplicadas

1. **Entrada em área persistente após falha.** Em `scripts/persistent-areas.js`, a gravação da lista de membros ocorre **depois** de solicitar o ciclo de entrada. Se a solicitação falhar, a área permanece com a lista anterior e pode reprocessar na próxima verificação. Antes, a falha deixava a entrada marcada e o efeito podia nunca ocorrer.
2. **Recuperação de ciclos parcialmente criados.** Se o cartão de ciclo foi criado, mas uma atualização de flags ou resolução falhou, uma nova tentativa o reutiliza. A execução é reavaliada pelos fluxos idempotentes de salvaguarda/efeito. Se os ocupantes mudaram entre tentativas, ocorre erro explícito em vez de atribuir os novos alvos ao cartão antigo.
3. **Permissões no desligamento.** A exclusão de membros ou o encerramento não confirmam limpeza quando um alvo ainda existe, mas não pode ser editado pelo executor; o mestre deve concluir a operação. A limpeza já realizada para outros alvos é idempotente.
4. **Origem/ciclo inválidos.** Áreas com cartão de origem ausente, invisível para o executor ou atividade não encontrada não confirmam silenciosamente a entrada. O marcador de turno da área persistente é gravado somente após processar os ciclos necessários.
5. **Atividade específica em mensagens com vários cartões.** Em `scripts/save-workflow.js`, uma salvaguarda seleciona o cartão da atividade solicitada. Em `scripts/area-workflow.js`, a busca por mensagem de origem verifica todos os cartões relevantes. Salvaguardas de área e áreas persistentes deixam de usar a primeira atividade por engano. Solicitações para uma atividade removida são rejeitadas se o cartão original é visível.
6. **Alvos ocultos para o mestre.** O filtro visual `token.visible` não exclui criaturas escondidas do cálculo do mestre, desde que ocupem casas atingidas. Para jogadores, a filtragem anterior permanece. A regra de casas afetadas, emanação nativa e exclusão do próprio lançador foi mantida.

## Verificações executadas

- **20/20 suítes `.mjs` aprovadas** em Node.js 22, com as 19 anteriores e `tests/hardening-12711.mjs`.
- **28 verificações novas** de geometria/visibilidade, atividade correta, processamento de entrada, falhas de mensagens, recuperação de ciclos incompletos, permissão e conflito de alvos.
- Todos os **62 arquivos de entrada e scripts JavaScript** (1 principal, 61 em `scripts/`) com sintaxe válida; 246 imports locais e 453 símbolos resolvidos pela suíte estrutural.
- Manifesto e recursos existentes conferidos. ZIP testado quanto à integridade.

Essas verificações usam simulações e análise estática. **Não foi executado Foundry V14 com OP RPG 1.0.20 e clientes reais conectados.** Aprovação local não garante funcionamento em todas as situações.

## Limitações conhecidas que não foram corrigidas nesta versão

- **Concorrência real entre computadores:** operações de PP/PV/dano no mesmo personagem ainda podem colidir; filas locais não substituem um protocolo transacional entre clientes.
- **Rolagens de ataque:** há dependência temporária de `item.labels`; dois computadores podem interferir no mesmo item. A proteção 1.27.10 é local ao cliente.
- **Handlers nativos:** algumas integrações dependem de detalhes do código do OP RPG, inclusive manutenção de técnicas sustentadas, Haki, Akuma no Mi e cartões de dano. Alterá-los sem o sistema-base e testes reais poderia quebrar regras.
- **Falhas de ambiente:** um ciclo parcialmente criado cujos alvos mudaram exige intervenção do mestre para revisar/remover o cartão pendente. Esta compilação falha de forma explícita para não aplicar efeitos na lista errada.
- **Backups:** a exportação atual não fornece restauração automática validada de mundos e fichas; não foi acrescentada uma rotina de importação arriscada.
- **Testes de mesa pendentes:** permissões de proprietário/mestre, combate com diversos clientes, regiões móveis, DAE, Midi-QOL, Dice So Nice e fichas NPC não foram homologados em ambiente real.

## Roteiro mínimo de validação no Foundry

1. Copie o mundo e faça backup de `Data/modules/oprpg-system-fixes` e da pasta de dados do mundo.
2. Instale o ZIP (a raiz interna deve ser `oprpg-system-fixes/`) e verifique versão 1.27.11 nas Configurações do Foundry.
3. Crie um item com duas atividades de salvaguarda com atributos/CDs distintos. Use a **segunda** e confira a rolagem aplicada.
4. Coloque um inimigo em uma casa destacada por círculo/cone/emanação e outro fora. Confira também um token oculto controlado pelo mestre e um token 2x2 na borda.
5. Teste entrada, saída, movimentação do lançador e encerramento de uma área persistente. Refaça com um jogador que não tem permissão de editar o alvo e verifique o aviso de intervenção do mestre.
6. Teste Haki, Akuma no Mi, dano, cura, descanso e PP apenas em personagens de cópia; acompanhe erros F12.
7. Teste dois jogadores realizando ações no mesmo alvo; **não considere este cenário protegido contra corrida de dados** até haver protocolo interclientes.

## Critério de parada

Esta etapa encerra após as suítes locais e a conferência do pacote passarem. Não é tecnicamente possível afirmar “todos os erros corrigidos” sem abrir o sistema OP RPG e validar os fluxos completos numa mesa real. Esta versão prioriza mudanças pequenas e verificáveis e deixa os riscos restantes claramente identificados.
