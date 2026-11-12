# Auditoria aprofundada — OPRPG System Fixes 1.27.5

**Objetivo:** revisar a versão local 1.27.4 sob dez perspectivas complementares, encontrar defeitos reais, corrigir o que for reproduzível e evitar regressões na seleção por quadrados, na emanação nativa do Foundry V14 e na exclusão do lançador. Esta versão é uma **compilação local**, não uma release publicada no repositório original.

## Escopo e método — dez frentes de revisão

| Frente | Método distinto | Escopo / resultado |
|---|---|---|
| 1. Sintaxe | Parser do Node e checagem de JavaScript ECMAScript | 62 arquivos JavaScript parseados sem erros. |
| 2. Integridade do pacote | Grafo de imports/exports, manifesto e recursos locais | 245 importações locais e 445 símbolos de importação conferidos; recursos do manifesto presentes. |
| 3. Compatibilidade de integração | Revisão de pontos de entrada, hooks e dependências de APIs Foundry/OPRPG | Dependências internas do sistema e do Foundry ainda exigem teste em execução real. |
| 4. Geometria discreta | Casos de borda, células ocupadas, tokens grandes e interseção | 35 verificações de casas afetadas aprovadas; seleção por grid preservada. |
| 5. Emanação e Regiões | Simulação de áreas nativas, posição e vínculo ao token | 19 verificações de emanação aprovadas; integração V14 preservada. |
| 6. Identidade / autorização de alvos | Testes de caster, tokens vinculados, NPCs sintéticos e cartão de dano adulterado/antigo | 28 verificações do lançador e 5 da lista nativa aprovadas; imunidade reforçada. |
| 7. Contabilidade de recursos | Teste de regressão contra consumos repetidos de PP, limites e duplicidade | 6 verificações; corrigida sobrescrita de devoluções simultâneas no mesmo campo. |
| 8. Ciclo de vida de áreas persistentes | Simulação dos hooks de criação, movimento e remoção; ausência de geometria | 6 verificações de ciclo de vida e 3 de guarda; reprocessamento corrigido. |
| 9. Concorrência e erros assíncronos | Testes de filas, revisão de await/catch e mudanças aninhadas | 6 verificações; tratamento de erros em hooks do Haki e Akuma reforçado. |
| 10. Altura, mensagens e privacidade | Testes de altitudes-limite, modo de rolagem, saída HTML e efeitos periódicos | 8 de altura, 7 de privacidade e 6 de efeitos periódicos aprovados. |

**Nota metodológica:** foram dez abordagens analíticas, não dez execuções completas e independentes de cada linha de todo o código. O foco foi maximizar a diversidade dos modos de falha encontrados.

## Falhas confirmadas e correções

### 1) Reembolso incorreto quando o mesmo campo de PP aparece em várias linhas
- **Arquivo:** `scripts/area-refund.js`.
- **Causa:** o objeto de atualização usava a mesma chave de recurso para várias parcelas; a última sobrescrevia as anteriores.
- **Correção:** somar os deltas por `keyPath` antes da atualização, preservando teto e recibo antirrepetição.
- **Evidência:** teste de regressão `tests/deep-refund.mjs` reproduziu a divergência antes da correção e passou depois.

### 2) Áreas persistentes não reagiam à entrada e remoção de tokens
- **Arquivo:** `scripts/persistent-areas.js`.
- **Causa:** apenas `updateToken` disparava a reavaliação de membros; `createToken` e `deleteToken` não eram observados. Qualquer alteração irrelevante também provocava varreduras.
- **Correção:** hooks de criação/exclusão, atualização apenas para alterações espaciais e coalescência de disparos num ciclo de atualização. Filtro de cena e executor responsável para evitar processamento concorrente desnecessário.
- **Evidência:** `tests/deep-persistent-lifecycle.mjs`; `tests/persistent-guards.mjs`.

### 3) Filtro vertical ignorava altura específica igual na base e no topo
- **Arquivo:** `scripts/area-obstacles.js`.
- **Causa:** `bottom===top` era interpretado como ausência de filtro, inclusive em valores como 5/5.
- **Correção:** apenas 0/0 representa a opção sem restrição. Valores iguais diferentes de zero representam um plano na elevação especificada; entradas numéricas inválidas são rejeitadas.
- **Evidência:** `tests/deep-height.mjs`.

### 4) Identidade do lançador sintético era perdida no processamento posterior
- **Arquivos:** `scripts/area-caster.js`, `scripts/area-state.js`, `scripts/area-workflow.js`, `scripts/technique-effects.js`, `scripts/persistent-areas.js`.
- **Causa:** caminhos usavam UUID da ficha-base do NPC, embora o token não vinculado tivesse UUID de ator sintético diferente.
- **Correção:** persistir `casterTokenActorUuid`, recuperar `sourceTokenUuid` e usar `isCasterActor` antes de processar salvaguarda, dano e efeitos; cópias independentes do NPC não são indevidamente imunes.
- **Evidência:** `tests/area-caster.mjs`.

### 5) Bandeja de dano ainda exibia lançador como alvo
- **Arquivo:** `scripts/native-targets.js`.
- **Causa:** a montagem visual removia alvos protegidos, mas não filtrava explicitamente o autor da técnica nos registros antigos ou incompletos.
- **Correção:** exclusão do UUID do ator-base, UUID sintético e verificação por `isCasterActor`, sem alterar a proteção já existente no processamento do dano.
- **Evidência:** `tests/deep-native-tray.mjs`.

### 6) Efeitos periódicos consultavam modo de rolagem desatualizado
- **Arquivo:** `scripts/periodic-effects.js`.
- **Causa:** leitura direta de configuração antiga, potencialmente diferente do modo efetivo de mensagens do Foundry V14.
- **Correção:** utilizar `currentRollMode()` do próprio módulo. Nomes incluídos no flavor de mensagens são escapados para HTML.
- **Evidência:** `tests/deep-privacy.mjs` e `tests/deep-periodic-privacy.mjs`.

### 7) Rejeições de Promises em hooks podiam não ser tratadas
- **Arquivos:** `scripts/haki-awakening-fix.js`, `scripts/akuma-combat-fix.js`, `scripts/akuma-fix.js`.
- **Causa:** callbacks iniciavam operações assíncronas sem captura consistente de falhas.
- **Correção:** tratamento explícito `.catch()`/wrapper local, com registro de erro e aviso quando aplicável. Evita rejeições soltas, mas não garante recuperação automática da operação falha.

## Validações automatizadas

Executadas a partir da raiz do módulo, usando Node.js:

```bash
for f in tests/*.mjs; do node "$f" || exit 1; done
find . -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

| Conjunto | Verificações |
|---|---:|
| Seleção por casas (`area-grid`) | 35 |
| Emanações (`native-emanation`) | 19 |
| Lançador (`area-caster`) | 28 |
| Guarda persistente (`persistent-guards`) | 3 |
| Reembolso (`deep-refund`) | 6 |
| Altura (`deep-height`) | 8 |
| Ciclo persistente (`deep-persistent-lifecycle`) | 6 |
| Filas (`deep-queue`) | 6 |
| Privacidade (`deep-privacy`) | 7 |
| Execução periódica (`deep-periodic-privacy`) | 6 |
| Bandeja nativa (`deep-native-tray`) | 5 |
| **Total funcional / simulado** | **129** |

Teste estático adicional `deep-structure`: **62 módulos JavaScript**, **245 importações locais**, **445 símbolos resolvidos**. Essas contagens estruturais não entram no total de 129 verificações funcionais.

## Riscos e limitações que ainda permanecem

1. **Sem Foundry real:** não foram executadas partidas com clientes conectados, cenas complexas e o sistema OPRPG instalado. Os testes em Node simulam as partes usadas do ambiente.
2. **APIs internas e versões:** o módulo utiliza APIs e caminhos internos de OPRPG/Foundry; é necessário confirmar o comportamento com as versões instaladas na mesa. O campo `verified` do manifesto descreve a compatibilidade declarada, não um teste novo desta auditoria.
3. **Módulos terceiros:** efeitos de dano aplicados diretamente por outros módulos podem contornar o pipeline de exclusão do lançador.
4. **Permissões e redes:** operações entre GM/jogadores, ownership, conexão e concorrência entre clientes não foram validadas em uma sessão de múltiplos usuários.
5. **Escala:** o novo reprocessamento de áreas é agrupado e restrito à cena, mas merece medição de desempenho em mapas com muitos tokens e Regiões.
6. **Geometria dinâmica:** a integração com triangulação e funções internas de destaque de grid precisa ser conferida visualmente em regiões complexas e diferentes configurações de grade.
7. **Dados antigos:** fazer backup antes de atualizar; nenhuma migração integral de todos os estados legados foi executada.

## Roteiro mínimo de testes manuais

1. Verificar uma linha, cone, círculo e retângulo encostando na borda de tokens; apenas casas afetadas devem contar.
2. Criar emanação nativa, movimentar o lançador e testar entrada/saída de alvos.
3. Com NPCs não vinculados duplicados, testar que apenas a cópia que lançou fica imune; inspecionar cartões de dano e salvaguardas.
4. Criar e excluir um token dentro de área persistente e verificar atualização dos membros/efeitos.
5. Testar limites verticais 0/0 (sem limite), 5/5 (apenas altura 5) e intervalos 0/10.
6. Gastar PP em duas parcelas da mesma técnica e cancelar; conferir devolução correta e prevenção de devolução dupla.
7. Testar rolagens públicas, privadas, cegas e para mestre, inclusive em efeitos periódicos.
8. Testar eventos de Haki/Akuma e revisar console para falhas assíncronas.

**Instalação:** preservar backup da pasta `Data/modules/oprpg-system-fixes`, extrair o ZIP 1.27.5 no diretório `Data/modules`, reiniciar o Foundry e validar em um mundo de testes antes da campanha.
