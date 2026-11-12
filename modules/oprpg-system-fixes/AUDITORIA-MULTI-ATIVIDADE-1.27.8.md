# Auditoria focalizada — Múltiplas atividades do OPRPG System Fixes

**Versão de entrada:** 1.27.7  
**Versão resultante:** 1.27.8 (compilação local; não oficial)  
**Escopo:** leitura do fluxo completo de seleção, acerto, dano, labels, cartão de chat, salvaguarda, aplicação do dano, sincronização, extensões de efeitos e flags; execução de simulações em Node.js.

**Limite importante:** nenhum teste foi feito em uma mesa real de Foundry V14 + OP RPG, portanto não há evidência de compatibilidade integral com os handlers internos do sistema.

## Erros encontrados e corrigidos

1. **Atividade anterior permanece selecionada após o cartão mudar.** Em `scripts/shared.js`, `getCardActivity()` usava `rememberedId` antes de `card.dataset.activityId`. Quando um cartão reutilizado mudava da atividade A para B, o módulo podia continuar lendo A em acerto, dano, cura e salvaguardas. Agora o identificador presente no cartão tem prioridade e as memórias/marcadores obsoletos são atualizados. **Teste reproduzido e corrigido.**

2. **Mistura de Ataque + Salvaguarda não era abrangida pelo reparo de acerto.** `scripts/multi-activity-attack-fix.js` contava apenas atividades do tipo `attack`. Se um Item tivesse uma Activity de Ataque e outra de Salvaguarda, o patch não era aplicado, apesar de ser multiatividade. Agora usa a quantidade total de Activities do Item para determinar quando há cache compartilhado. **Teste reproduzido e corrigido.**

3. **Atualização de flags no chat encerrava um acerto ainda pendente.** O gancho `preUpdateChatMessage` restaurava `item.labels` mesmo se uma atualização alterasse somente flags/metadados. Isso podia ocorrer enquanto o diálogo nativo ainda aguardava o usuário. Agora a restauração associada à atualização só acontece quando há mudança de conteúdo da mensagem; o timeout de segurança permanece. **Teste reproduzido e corrigido.**

4. **Dano exposto só por `getDamageConfig` não habilitava o patch.** A seleção do handler de dano exigia `activity.damage.parts` preenchido ou `includeBase`, mas o motor pode oferecer rolagens via `getDamageConfig().rolls`. Agora detecta ambas as fontes. **Teste reproduzido e corrigido.**

5. **Clique inativo podia preparar labels temporários.** Botão `jj-attack` desabilitado ou evento previamente cancelado ainda podia executar o callback do bridge. Agora o callback verifica `disabled` e `defaultPrevented`, e a Activity precisa estar utilizável. **Teste simulado e corrigido.**

## Problemas confirmados por análise, ainda não alterados

6. **Estado de dano compartilhado por mensagem (prioridade alta quando há cartões múltiplos).** `scripts/multi-activity-damage-fix.js` usa o flag único `multiActivityDamage`. Uma nova rolagem em outro cartão da *mesma mensagem* sobrescreve o estado persistido anteriormente. Ao reabrir ou rerenderizar a mensagem, só o último cartão cujo `activityId` coincide com esse flag recupera o resultado. Exige armazenamento por cartão/atividade com migração e tratamento de concorrência para corrigir sem regressão. Não altera mensagens que possuem apenas um cartão.

7. **Rolagens concorrentes do mesmo Item compartilham `item.labels` (prioridade alta).** O bridge de acerto sobrescreve temporariamente `item.labels.toHit` e `modifier` e `restoreEntriesForItem()` desfaz o bridge anterior ao iniciar outro. Se um diálogo nativo ainda estiver aberto, a leitura posterior pode usar os bônus da outra Activity. Uma solução robusta deve integrar a atividade ao próprio handler de acerto, não depender de um cache compartilhado. Falta o código do handler OPRPG para um patch seguro.

## Limitações e riscos que precisam de validação real

8. **Handler próprio de dano substitui o nativo nos cartões suportados.** `onDamageButtonClick()` usa captura com `stopImmediatePropagation()` e executa `rollSelectedActivityDamage()`; isso não garante a execução das mesmas macros e etapas de custo/efeitos que o handler original do OP RPG. Existe integração parcial, mas não há prova de equivalência.

9. **Não cobre universalmente qualquer tipo de Activity.** O patch direto de dano só entra nos tipos `attack`, `save` ou `damage` e depende de cartão com `.jujutsu-card`. Cura e outros fluxos têm handlers separados. A correção não equivale a suporte universal a todas as atividades de qualquer item.

10. **Cancelamento e ordem de atualização.** O bridge de `item.labels` restaura na atualização do conteúdo ou após 5 minutos; se o usuário cancelar um diálogo sem atualização, o cache pode permanecer modificado até o timeout. Mudanças de ordem de cartões no mesmo ChatMessage também podem confundir a identificação baseada em posição.

11. **Cálculo de crítico e redução pela metade/quarto.** O handler próprio reconstrói as parcelas críticas e os controles do cartão; é necessário conferir em Foundry as fórmulas personalizadas e a ordem exata dos modificadores, sobretudo com vários tipos de dano.

## Testes e validações

- 17 verificações novas de identidade de Activity, alternância A/B, item Attack + Save, atualizações de flags, restauração, botões inativos e damageConfig-only.
- Todas as 16 suítes presentes no ZIP executadas com Node.js sem falhas, incluindo geometria, cura, efeitos periódicos, privacidade, segurança, estrutura e emanação.
- Sintaxe dos 62 scripts JavaScript e `main.js` verificada; imports locais conferidos pela suíte estrutural.
- ZIP e manifesto devem manter `id=oprpg-system-fixes`, versão `1.27.8` e estrutura de pasta única.

### Cenários recomendados dentro do Foundry

1. Criar uma única técnica com Atividade 1 (Ataque + dano 1d6) e Atividade 2 (Ataque + dano 2d8). Alternar A/B e confirmar acerto, fórmula exibida, resultado e tipo de dano.
2. Criar Item com Atividade 1 (Salvaguarda) e Atividade 2 (Ataque). Acionar somente a segunda e confirmar o bônus da própria Activity.
3. No mesmo ChatMessage com cartões múltiplos, rolar danos de duas Activities e atualizar o chat. Verificar persistência individual; **este caso pode falhar na 1.27.8**.
4. Abrir dois diálogos de ataque do mesmo Item em rápida sequência; **risco ainda não resolvido**.
5. Cancelar um diálogo de acerto e depois executar outra técnica, observando `item.labels`.
6. Testar Cura, Salvaguarda, efeitos automáticos, gasto de PP e macros Midi/DAE com jogador e mestre conectados.

## Reversão

Faça backup da pasta do módulo e de um mundo de testes. Instale a versão 1.27.8 substituindo **toda** a pasta `Data/modules/oprpg-system-fixes`; não misture arquivos de versões. Para reverter, restaure a pasta 1.27.7.
