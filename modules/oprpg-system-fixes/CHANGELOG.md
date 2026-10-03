# Atualização 1.21.0

Após confirmar as áreas de uma técnica, marca automaticamente os tokens que intersectam a geometria e envia um pedido de salvaguarda por ficha aos responsáveis e mestres. Controle Cirúrgico permite escolher aliados protegidos até o modificador de Destreza, mínimo de um. O dano utiliza os alvos registrados no cartão e cada resultado individual. Mantém os controles nativos de metade/quarto, a privacidade dos resultados e o dano após salvaguarda.

522 verificações simuladas aprovadas; esta versão ainda não foi testada em um mundo Foundry real. Veja [REVISAO-1.21.0.md](REVISAO-1.21.0.md) para configuração, custos e limites.

# Atualização 1.20.1

Instala a ponte de compatibilidade no init e protege a leitura do sistema ainda ausente. Correção de falha de carregamento confirmada no Foundry real, com duas novas regressões de inicialização.

# Atualização 1.20.0

Ponte parcial DAE/Midi-QOL: campos OPRPG, flags de vantagem/desvantagem, API de dano/efeitos e Macros do mundo após eventos nativos. Compatibilidade total ainda não implementada. Consulte COMPATIBILIDADE-DAE-MIDI.md para ativação, limites e testes.

# Atualização 1.19.2

Corrige a legibilidade e as frases dos cards de Haki no chat. Veja REVISAO-1.19.2.md.

# Atualização 1.19.1

Melhora a visibilidade dos ativáveis do Haki no HUD e na ficha. Veja REVISAO-1.19.1.md.

# Atualização 1.19.0

Revisão de apresentação de todas as funcionalidades do Fixes, com componentes, classes e paleta nativos do OPRPG. Veja REVISAO-1.19.0.md e UI-INVENTARIO-1.19.0.md para escopo e validação.

# Atualização 1.18.0

Corrige privacidade no Foundry 14, restaura controles nativos de ½ e ¼, remove o botão de área e os avisos técnicos dos cards e limita o diálogo de alvos às técnicas. Veja [REVISAO-1.18.0.md](REVISAO-1.18.0.md) para testes reais, simulações e instalação.

# Atualização 1.17.1

Removido o botão “Regras do livro: descanso e PV negativos” da ficha e seu formulário. Esta versão contém as correções da 1.17.0.

# 1.17.0 — 30/09/2026

Salvaguardas para todos os alvos com resultados nativos separados, pedidos por permissão, dano persistido e compartilhado, migração segura de flags do Haki, duração do Corpo Armadurado, reversão sem concentração, proteção de manutenção em turnos retrocedidos e recibos do dano nativo. Melhora o contraste do guia de atividades. Ver REVISAO-1.17.0.md.

# 1.16.0

- Dano solicitado por jogadores com aprovação do mestre ativo e conferência do cartão original.
- Reversão do último registro de recursos com proteção contra alterações posteriores.
- Concentração pendente no chat e painel; instalação idempotente.
- Repetição diária da perícia Haki no estágio Perito.
- Guia visual das etapas da atividade do cartão.
- Agendador indexado para duração, fruta e recarga; filas por ficha e avisos limitados.
- Testes simulados de permissões, concorrência, reversão e escala com mil fichas inativas.

# 1.15.0 — 29/09/2026

- Integra o conteúdo de Armamento e os requisitos de estágio do Haki Unificado 1.2.0.
- Atualiza descrições dos estágios na árvore e na ficha.
- Adiciona no HUD botões para consumir resultados guardados de Vidente.
- Corrige Corpo Armadurado e Armadura Suprema conforme Haki 2.1; a forma Dominada não concede 20 Pontos de Escudo extras.
- Amplia a resistência dos Pontos de Escudo com Corpo Armadurado Dominado ativo, exceto para dano Verdadeiro, no pipeline nativo e nos cards de dano tipado.
- Atualiza a fórmula de dano de armas no card no momento da rolagem para refletir Endurecimento Ofensivo atual.

# 1.14.0 — 29/09/2026

- Solicita concentração de Antevisão com CD automática por dano em PV ou PV temporários, inclusive quando o mestre aplica dano.
- Ativa e acompanha Perceber Presença no HUD; encerra a característica em falha, 0 PV ou nova concentração.
- Respeita rolagens reservadas dos NPCs e a configuração de rastreamento do sistema.
- Corrige a descrição de Perceber Presença conforme o Livro 2.1.

# 1.13.0 — 28/09/2026

- Corrige resistência limitada à reserva de Escudo e consumo parcial de redução.
- Corrige ativações e tipos de dano do criador; adiciona orçamento virtual, limite de cura e validações básicas com exceção de mestre registrada.
- Corrige recuperação e namespace de lendárias, incluindo destaque visual de sucesso.
- Adiciona registro de PV negativos e sinalização de morte por dano, com controles por ficha.
- Integra PP ao descanso, oferece escolha explícita sobre Exaustão e remove Dados de Aura do descanso de personagens.
- Novos testes de regras e formulários; detalhes em REVISAO-1.13.0.md.

# Versão 1.12.0 — dano nos alvos e áreas

- Dano nos tokens marcados como alvo, nos cartões personalizados, componente nativo e menu de rolagem.
- Solicitação de alvos antes da ativação de técnicas sem área; cancelamento sem gasto.
- Posicionamento de áreas para cartões personalizados que pulam o fluxo nativo, com detecção de suporte existente e botão de reposicionamento.
- Proteção contra repetição de aplicação em cartões personalizados e resumos com o sigilo da origem.
- Compêndio separado: 176 características/estágios, seis artes e painel de atualização/restauração de imagens.

# Versão 1.11.0 — sigilo, técnicas guiadas e painel

Consulte [REVISAO-1.11.0.md](REVISAO-1.11.0.md) para novidades, instalação e limites dos testes. Os textos abaixo são históricos.

# Versão 1.10.2 — exclusão na aba Fruta

Consulte [REVISAO-1.10.2.md](REVISAO-1.10.2.md) para o reparo da lixeira e os testes. As seções abaixo são históricas.

# Versão 1.10.1 — pagamento no aprendizado e botões Fruta

Consulte [REVISAO-1.10.1.md](REVISAO-1.10.1.md). O modelo de créditos da 1.10.0 foi substituído por uma escolha no botão Aprender. Os textos abaixo são históricos.

# Versão 1.10.0 — treinos grátis e aba Fruta

Consulte [REVISAO-1.10.0.md](REVISAO-1.10.0.md) para instruções, correções, 160 testes simulados e limites de automação. Esta revisão prevalece sobre o histórico abaixo.

# Versão 1.9.3 — duração sustentada

Consulte [REVISAO-1.9.3.md](REVISAO-1.9.3.md) para o reparo de duração permanente, manutenção e cura por turno, com testes e limites. Esta revisão prevalece sobre os textos históricos abaixo.

# Versão 1.9.2 — revisão funcional

Consulte [REVISAO-1.9.2.md](REVISAO-1.9.2.md) para correções, cobertura dos 96 testes simulados e limitações conhecidas. Os textos de versões anteriores abaixo são históricos; esta revisão prevalece para a versão 1.9.2.

## 1.9.1 — Reconexão dos cards e dano após acerto
- Usa WeakSet por botão real para reconectar dano, acerto, labels nativos e captura do escudo após serialização/recriação do HTML.
- Bloqueia propagação de eventos repetidos durante uma rolagem; trava de processamento deixa de depender de atributos persistidos.
- Preserva PA e escala já escolhidos no acerto, Foco Agressivo e maximização da Emissão no dano-base.
- Prepara dados de crítico manual/automático, separando bônus crítico do dano-base para aplicação nativa.
- Restaura as classes de visibilidade dos painéis e respeita o autor do card ao desbloquear dano.
- Inclui regressões de navegador com DOM real, dados simulados e comparação com 1.9.0. Não representa certificação de todas as mecânicas no Foundry.

## 1.9.0 — Haki Unificado integrado + Activity persistente
- Integra as automações úteis do `oprpg-haki-unificado-v1.1.0` ao System Fixes: HUD, Antevisão, Superação Majestosa, Vidente, contadores/descansos e descrições de Haki.
- O módulo externo ativo é detectado e a cópia interna é adiada automaticamente para evitar patch duplo.
- Não importa o listener de dano do módulo externo: o System Fixes usa um resolvedor único baseado em `activity.getDamageConfig()`.
- Corrige ACERTO → DANO em multi-Activity preservando a Activity escolhida durante o update/rerender nativo do card.
- O damage roller multi-Activity usa a configuração atual da Activity, incluindo bônus dinâmicos do sistema, com fallback para o modelo de dados.
- Cards de Activity única recebem apenas uma ponte temporária dos labels atuais no clique nativo de DANO.

## 1.8.4 — NPC getter-safe traversal hotfix
- O sanitizador da ficha NPC não lê mais getters/accessors durante a busca por SVG inválido.
- Evita disparar getters depreciados como `CONFIG.DND5E.spellcastingTypes`.
- Mantém copy-on-write para Arrays/objetos read-only e preserva descriptors sem avaliá-los.
- O contexto retornado pelos métodos nativos agora propaga a versão sanitizada quando houver reparo.
- Nenhuma alteração no pipeline de dano, Escudo, Haki, Akuma ou Despertar.

## 1.8.3 — NPC frozen-context + diagnostic alias hotfix

- `NPC Sheet Repair`: o sanitizador agora é copy-on-write e nunca escreve em Arrays/Objects congelados do ApplicationV2.
- Corrige `Cannot assign to read only property '0' of object '[object Array]'` ao abrir ficha de NPC.
- Reexpõe `OPRPG_FIXES_SHIELD_STATUS()` e os demais aliases de diagnóstico também durante `ready`, além do registro antecipado.
- Mantém integralmente o Shield Layering Hotfix 1.8.2.

# Changelog

## 1.8.2 — Shield Layering Hotfix
- Corrige consumo paralelo de Escudo + PV temporários/PV observado no card customizado.
- Adiciona guarda pós-update curta para preservar o resultado sequencial das camadas quando o OPRPG emite atualizações múltiplas no mesmo clique.
- Endurecimento Defensivo recebe fallback direto no resultado de `Actor.calculateDamage`, sem empilhar resistência já existente.
- Amplia diagnóstico de Escudo com contadores de reconciliação e fallback de resistência.

## 1.8.1 — NPC Sheet Repair I

- Reparada a preparação de SVGs inválidos na ficha nativa de NPC.
- Patch restrito a `_prepareManipulationContext` e `_prepareTrainingsContext`.
- Sanitização de `width=""`, `height=""` e `viewBox="0 0 "` em markup/data URI SVG.
- Guarda escopada para `TextEditor.enrichHTML` somente durante a preparação desses contextos.
- Novo diagnóstico `OPRPG_FIXES_NPC_SHEET_STATUS()`.
- Corrigido um `console.group` duplicado na auditoria de mecânicas nativas.
- Nenhum arquivo do `oprpg-system` é modificado.

## 1.8.0 — Native Repair V
- Endurecimento Defensivo: recuperação automática dos Pontos de Escudo após 10 minutos de tempo do mundo fora de combate e sem uso detectado do Haki do Armamento.
- Ataque Infuso: integração mais conservadora com a Intangibilidade, respeitando a forma de ataque selecionada quando a ficha expõe essa seleção.
- Estágio Desperto: Liberação Cansativa consome 1 PP ao final do turno e encerra o estágio automaticamente ao chegar a 0 PP.
- A cobrança de Liberação Cansativa permanece devida se o personagem entrou e saiu do estágio antes do fim do mesmo turno.
- Explosão de Poder: preserva handler nativo quando funcional; fallback seguro de +10 PP/descanso longo quando um handler incompleto é reconhecido, além de API explícita.
- Novo diagnóstico `OPRPG_FIXES_HAKI_AWAKENING_STATUS()` e APIs de Haki/Despertar.
- Sem polling contínuo, sem `setInterval` e sem `MutationObserver` global.


## 1.7.0 — Native Repair IV
- Power Up SAV: alvos selecionados recebem desvantagem na Salvaguarda da Técnica enquanto a opção está ativa.
- Power Up DMG: Técnicas instantâneas da Akuma recebem dados extras, limitados pelo grau; Multi-Activity usa o mesmo pipeline.
- Power Up RED: PV é protegido até a forma acumular 10 × nível em dano; ao romper, o Power Up é encerrado.
- Intangibilidade Logia: ataques normais podem ser anulados no pipeline do card; Haki/Kairoseki passam, e inimigo natural pode ser marcado pela API.
- Predador: usa o dano realmente causado no turno, recupera PV até o limite acumulado e 1 PP por uso até o limite do nível.
- Mantidos listeners localizados: nenhum MutationObserver global foi reintroduzido.

# 1.6.0 — Native Mechanics Repair III

- Cards customizados com tipo de dano inequívoco passam por `Actor.calculateDamage()` antes das camadas próprias do OPRPG, recuperando resistência, imunidade e vulnerabilidade nativas.
- Dano multi-Activity persistido pelo Fixes passa a guardar total e tipo de cada parte, permitindo cálculo exato de dano misto nesses cards.
- Cards nativos mistos sem totais por parte são mantidos de forma conservadora e aparecem no diagnóstico em vez de receber uma divisão estimada.
- Labels/fórmulas de dano tentam usar a Activity indicada por `data-activity-id`, reduzindo o vazamento de `item.labels.damages` da primeira Activity.
- Repara **Uso Alternativo**: o botão nativo arma a próxima Technique instantânea elegível e `Activity.use()` roda com consumo de `energy.total`/`energy.generated` temporariamente zerado; inclui fallback curto para caminhos legados.
- Sincroniza o estado visual/lógico de **Power Up** com o Active Effect nativo: quando o efeito rastreado expira/removido, `system.akuma.powerUp.active` é desligado.
- Adiciona `OPRPG_FIXES_DAMAGE_TYPES_STATUS()`, `OPRPG_FIXES_AKUMA_STATUS()`, `game.oprpgFixes.damageTypePipelineStatus()`, `game.oprpgFixes.previewTypedDamage()` e `game.oprpgFixes.akumaFixStatus()`.
- SAV/DMG/RED de Power Up, Intangibilidade e Predador continuam explicitamente pendentes; não foram simulados de forma aproximada.

# 1.5.0 — Native Mechanics Repair II

- Completa **Endurecimento Defensivo**: enquanto houver Pontos de Escudo ativos, dano Contundente/Cortante/Perfurante recebe resistência (metade, arredondada para baixo).
- A resistência é aplicada no `Actor.calculateDamage()` nativo sem empilhar com uma resistência já aplicada pelo sistema.
- O card customizado, que não usa `calculateDamage()`, recebe o mesmo comportamento e tem suas camadas recalculadas na ordem: resistência → Redução de Dano → Pontos de Armadura → Pontos de Escudo → PV temporário → PV.
- Corrige o consumo de Pontos de Armadura quando o Endurecimento reduz o dano antes das camadas de absorção.
- Corrige **ACERTO em Items com múltiplas Activities**: o handler `jj-attack` continua nativo, mas recebe temporariamente `activity.labels.toHit` da Activity indicada por `data-activity-id`, preservando PA, Escala de Energia, Haki, crítico e Dice So Nice.
- Adiciona `OPRPG_FIXES_ATTACK_STATUS()` e `game.oprpgFixes.multiActivityAttackStatus()`.
- Amplia `OPRPG_FIXES_NATIVE_AUDIT()` para distinguir Endurecimento e Acerto multi-Activity.

# 1.3.0

- Patch de desempenho transversal sem alterar regras.
- Remove listener global de clique do dano multi-Activity; binding passa a ser por card.
- Persistência de fórmulas deixa de varrer todos os Items do mundo no `ready`.
- Autoteste automático passa a ser leve; auditoria profunda fica sob demanda.
- Reduz trabalho de DOM/timers no card de cura.

# 1.2.4

- Remove o `MutationObserver` global do `document.body` usado na 1.2.3.
- Corrige congelamentos/queda brusca de desempenho ao rolar dano, especialmente com Dice So Nice e outras animações que alteram `class/style`.
- Mantém o dano sem ACERTO usando apenas `renderChatMessageHTML` + uma hidratação única do card, sem varredura contínua do DOM.
- Reduz as reidratações pós-rolagem de três timers para um único `requestAnimationFrame`.

## 1.2.3
- Corrige a apresentação do dano quando DANO é rolado antes de ACERTO.
- Reproduz a transição visual do card nativo revelando `.jj-panels`/`#jj-dmg-panel` no próprio clique de DANO.
- Não reescreve mais `ChatMessage.content`; o resultado é persistido em `flags.oprpg-system-fixes.multiActivityDamage` e reaplicado em `renderChatMessageHTML`.
- Mantém o dano da Activity selecionada por `data-activity-id` e o uso de fórmulas como `@abilities.str.mod`.

## 1.2.2
- Corrige a exibição do DANO rolado sem ACERTO prévio: o resultado agora é persistido em `ChatMessage.content`, não apenas no DOM temporário.
- O valor, detalhamento, total e estado do botão DANO sobrevivem a rerenders do chat e aparecem imediatamente no card.
- `game.oprpgFixes.multiActivityDamageStatus()` agora informa `persistedCards` e `last.persistedToMessage`.

## 1.2.1
- Permite rolar **DANO** de uma Técnica multi-Activity sem exigir uma rolagem de **ACERTO** anterior.
- O botão DANO é desbloqueado assim que o card é renderizado quando a Activity selecionada possui `damage.parts` válidos.
- Rolar somente dano não executa a Activity novamente e não consome PP/recursos novamente.
- Mantém a correção 1.2.0: o dano continua vindo da Activity indicada por `data-activity-id`.
- MutationObserver reaplica a disponibilidade caso o OPRPG tente bloquear novamente o botão ao atualizar o card.
- `game.oprpgFixes.multiActivityDamageStatus()` agora informa `damageWithoutAttack` e quantidade de cards desbloqueados.

## 1.2.0
- Corrige o botão `jj-damage` de Técnicas com múltiplas Activities.
- O dano passa a respeitar o `data-activity-id` gravado no `jujutsu-card`.
- Preserva o painel, modificadores ½/¼/Crit e botão Aplicar do card OPRPG.
- Suporte a fórmulas explícitas como `@abilities.str.mod` e fallback contextual de `@mod` quando há `attack.ability`.
- Adiciona `game.oprpgFixes.multiActivityDamageStatus()`.
- Autoteste e painel de compatibilidade agora verificam o patch multi-Activity.

## 1.1.0
- Painel `OPRPG_FIXES_COMPATIBILITY()` e relatório `OPRPG_FIXES_COMPATIBILITY_REPORT()`.
- Diagnósticos registrados antes do `init` e inicialização tolerante a falhas parciais.
- Correções standalone de fórmulas, HealActivity, PV Temporários, cura mista e Limite de Cura.
- API pública `game.oprpg` e autoteste `OPRPG_FIXES_SELF_TEST()`.

## 1.4.0 — Native Mechanics Repair I

- Corrige **Pontos de Escudo** no botão Aplicar dos cards customizados do OPRPG.
- O patch não substitui `Actor.applyDamage`: ele deixa o helper nativo calcular Redução de Dano e Pontos de Armadura e, no `preUpdateActor`, insere a camada de Escudo antes de PV temporários/PV.
- Cards de ataque, dano extra e dano de salvaguarda são cobertos (`jj-apply-damage`, `jj-extra-apply`, `jj-apply-save-dmg`).
- O fluxo especial de Pontos de Vitalidade com aura inativa não é alterado.
- Evita consumo duplo quando uma atualização já passou pelo `Actor.applyDamage` nativo.
- Corrige a mensagem nativa de dano para registrar quanto o Escudo absorveu e os valores reais que chegaram a PV temporários/PV.
- Nova API: `game.oprpgFixes.shieldPointsStatus()` e `game.oprpgFixes.previewShieldDamage(actor, amount)`.
- Nova auditoria: `OPRPG_FIXES_NATIVE_AUDIT()` / `OPRPG_FIXES_NATIVE_AUDIT_REPORT()`.


