# Atualização 1.17.1

Removido o botão “Regras do livro: descanso e PV negativos” da ficha e seu formulário. Esta versão contém as correções da 1.17.0.

# Atualização 1.17.0

Corrige salvaguardas de todos os alvos, compartilhamento de dano, flags do Haki, duração do Corpo Armadurado e os quatro achados da auditoria. Consulte [REVISAO-1.17.0.md](REVISAO-1.17.0.md) para instalação, testes e limites.

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

# Compatibilidade

Validado contra:
- Foundry VTT 14.367
- OPRPG System 1.0.20

O manifesto oficial consultado em 2026-09-16 ainda informa OPRPG 1.0.20.

O módulo não possui `maximum` para o OPRPG de propósito. Ao detectar uma versão diferente da validada, ele avisa uma vez e mantém apenas patches que conseguem ser instalados por capacidade.


## 1.6.0 — Pipeline tipado e Akuma Native Repair III

- O pipeline tipado usa `Actor.calculateDamage()` **somente quando o tipo pode ser atribuído com segurança ao valor aplicado**.
- Multi-Activity rolado pelo Fixes fornece totais exatos por parte; cards nativos mistos sem esses totais são registrados e não são divididos por estimativa.
- O hook de Endurecimento permanece no `dnd5e.calculateDamage`, portanto resistência física e resistências normais não são empilhadas duas vezes quando o sistema já marcou a parcela como resistente.
- Uso Alternativo preserva o `Activity.use()` nativo e altera temporariamente apenas targets de consumo de energia; se uma futura versão tornar esses dados imutáveis, o fluxo nativo continua e o fallback curto em `preUpdateActor` assume a correção.
- O rastreamento de Power Up só associa Active Effects criados logo após `powerUp.active=true`, reduzindo risco de confundir efeitos antigos com a transformação.
- As opções SAV/DMG/RED continuam sem automação nesta versão por exigirem contexto adicional de origem/alvo.

## 1.5.0 — Endurecimento e Acerto multi-Activity

- A resistência do Endurecimento é injetada por `dnd5e.calculateDamage` no pipeline nativo e por reparo de `preUpdateActor` apenas nos três botões de dano do card customizado.
- A resistência não é aplicada duas vezes quando o sistema já marcou a parcela como resistente.
- Em dano misto no card customizado, a resistência automática só é usada quando os tipos selecionados são exclusivamente Contundente/Cortante/Perfurante; casos mistos ficam conservadores até a revisão geral do pipeline tipado.
- O Acerto multi-Activity não substitui `_handleAttackRoll`: usa listener de captura por card para expor `activity.labels.toHit` ao handler nativo e restaura os labels na atualização da mensagem.
- Não há `MutationObserver` global nem listener global de clique.

## Ponto mais sensível

A cura automática do OPRPG 1.0.20 é implementada por um hook interno `combatTurnChange`. Para não causar cura dupla, o módulo só remove esse hook quando sua função corresponde à assinatura conhecida do 1.0.20. Se não reconhecer o handler, o autoteste marcará `Cura automática substituída` como falha e nenhuma remoção será feita.

## 1.2.0 — dano multi-Activity

- O patch é aplicado apenas a `.jujutsu-card` que possuam `data-activity-id` válido e cujo Item tenha 2 ou mais Activities.
- Cards de Activity única permanecem no handler nativo.
- Se uma parte de dano não puder ser convertida com segurança para fórmula, o patch não a intercepta.
- Validado estruturalmente para Foundry v14 build 367 / OPRPG 1.0.20; após atualização oficial, execute `OPRPG_FIXES_COMPATIBILITY()`.

## 1.2.2 — dano sem Acerto prévio e persistência no card

- Em cards multi-Activity suportados, o botão **DANO** é liberado assim que o card é renderizado, desde que a Activity selecionada possua `damage.parts` válidos.
- A rolagem de DANO não depende de `data-total-atk` nem de uma rolagem de ACERTO anterior.
- Após a rolagem, `#jj-dmg-val`, `#jj-dmg-break`, `#jj-total-display`, `data-total-dmg` e `data-base-value` são persistidos em `ChatMessage.content`.
- Rolar somente DANO não chama `activity.use()` novamente e não consome recursos novamente.
- A disponibilidade do botão é reaplicada em `renderChatMessageHTML`; não há observador global. O único `MutationObserver` restante é temporário e restrito ao card de cura durante sua própria rolagem.
- Durante a própria rolagem de dano o botão continua temporariamente bloqueado para impedir duplo clique/rolagem duplicada.


## 1.7.0 — Native Repair IV
- Power Up SAV/DMG/RED ligados às estruturas nativas de `system.akuma.powerUp`.
- Intangibilidade usa o mesmo reparo de aplicação de dano dos cards; não cria um segundo sistema de PV.
- Predador envolve o handler nativo da ficha quando ele é localizado em runtime.
- Inimigo natural da Logia é uma decisão do Narrador e não pode ser inferido do Item; use `game.oprpgFixes.markIntangibilityBypass(atacante, "inimigo-natural")` antes do ataque quando necessário.
- Power Up DMG é conservador quando uma Técnica mistura tamanhos de dado diferentes: o módulo não escolhe arbitrariamente qual dado adicionar.


## 1.8.0 — Haki / Estágio Desperto
- Recarga do Escudo usa `game.time.worldTime`; não usa relógio real nem polling em background.
- O cronômetro é reiniciado no fim do combate e quando alterações reconhecíveis de Haki do Armamento/Endurecimento são observadas.
- Se a ficha expõe explicitamente Endurecimento Defensivo como inativo, o módulo não o liga automaticamente.
- Ataque Infuso só bypassa Intangibilidade automaticamente quando a forma escolhida puder ser inferida da estrutura nativa ou quando o ataque estiver explicitamente marcado/for marcado pela API.
- Liberação Cansativa depende de um campo nativo de Estágio Desperto ou de um Active Effect temporário reconhecível; se nenhuma dessas fontes existir, o diagnóstico reporta `detected: false` em vez de inventar estado.
- Explosão de Poder preserva handlers nativos que já manipulam energia.
- Recuperação Forçada e tipos avançados de Despertar não são simulados nesta versão sem confirmação estrutural da ficha.

## 1.8.1 — NPC Sheet / SVG

A classe nativa de NPC é preservada. O Fixes envolve somente os métodos de preparação de Manipulação/Treinamentos e corrige strings SVG malformadas antes que o Chromium as interprete. Não há substituição da ficha, template, Actor ou Item.

Compatibilidade esperada: OPRPG 1.0.20 + Foundry 14.367.

## 1.8.2 — Shield Layering Hotfix
- O card mantém uma expectativa curta do resultado final das camadas e reconcilia somente atualizações imediatas do mesmo dano; isso cobre builds do OPRPG que emitem mais de um `Actor.update()` para um único clique em Aplicar.
- O fallback de Endurecimento sobre dano tipado verifica resistência nativa e a marca `oprpgEndurecimentoDefensivo`, evitando redução duplicada.
- Não há observer global, polling ou timer recorrente; a expectativa expira em menos de 1 segundo e só reage a updates das camadas de dano.


## 1.9.0 — Haki Unificado / Multi-Activity
- `oprpg-haki-automations` não deve ficar ativo ao mesmo tempo que a integração interna. Se estiver ativo, o System Fixes não instala sua cópia de HUD/Antevisão/Superação e registra aviso.
- O resolvedor de dano usa `Activity.getDamageConfig()` quando disponível e volta ao modelo `damage.parts` somente como fallback. Isso substitui tanto o cache antigo do Item quanto o listener de dano separado do módulo Haki.
- A seleção de Activity é mantida por mensagem/card e preservada no conteúdo do update nativo de ACERTO; isso cobre o caso em que o OPRPG recompõe o card com a primeira Activity antes do clique em DANO.
- Nenhum `MutationObserver` global, listener global de clique ou polling foi adicionado.
