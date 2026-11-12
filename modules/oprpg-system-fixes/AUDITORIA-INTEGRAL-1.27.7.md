# Auditoria integral de funcionalidades — OPRPG System Fixes 1.27.7

**Origem:** ZIP local 1.27.6, mantido separado do sistema base OP RPG.  
**Alvo declarado pelo manifesto:** Foundry V14 (mínimo 14.360, verificado originalmente até 14.367) e sistema `oprpg-system` 1.0.20.  
**Tipo de validação:** leitura/revisão estática de código, rastreamento de inicializadores, testes unitários e simulações em Node.js; **não houve inicialização real do Foundry, de uma mesa com o sistema OP RPG, de Dice So Nice, DAE ou Midi-QOL**.  
**Escopo integral:** `main.js` + 61 arquivos `scripts/*.js`; 18 grupos configuráveis; scripts e configuração; funcionalidades auxiliares de mestre, diagnóstico e API.

## Inventário: todas as funcionalidades revisadas

| Grupo/funcionalidade | Scripts e fluxo analisados | Resultado e validação |
|---|---|---|
| 1. Características e automações de efeitos | `characteristic-automations`, `automation-catalogue`, `effect-automation-*`, `catalogue-rules` | Configuração, validação, bônus e duração revisados; testes transversais de fórmulas, perfis ativos e regras. Exige teste com Actor preparado. |
| 2. Efeitos automáticos das técnicas | `technique-effects`, `save-workflow`, `area-state` | Roteamento por resultados e proteção do lançador revisados; testes anteriores de salvaguarda. Aplicação real de ActiveEffects pendente. |
| 3. Áreas persistentes | `persistent-areas`, `area-grid`, `area-obstacles` | Revisados ingresso/saída/movimento, ciclo temporal, altitude e paredes; regressões anteriores aprovadas. |
| 4. Efeitos periódicos | `periodic-effects`, `roll-privacy` | Validação de configuração, OverTime, recibos e sigilo; testes de erros e de visibilidade aprovados. |
| 5. Compatibilidade externa | `external-compatibility`, `compatibility-macros`, `module-compatibility` | Análise de flags, execução de macros e integração DAE/Midi; execução externa **não testada**. |
| 6. Regras do livro e descanso | `book-rules`, `catalogue-rules`, `narrator-tools` | Testadas regras de PP/exaustão, PV negativos e cálculo de dificuldade; gancho real de descanso requer validação. |
| 7. Alvos, seleção, dano e salvaguardas | `target-damage`, `native-targets`, `damage-requests`, `technique-targets`, `save-workflow`, `area-*` | Conferida seleção por casas, proteção do lançador e aplicação; múltiplas regressões existentes aprovadas. |
| 8. Sigilo, chat e dados 3D | `roll-privacy`, `card-sync`, `presentation` | Testados modos público, GM, cego, autor e interseções de públicos; interface/DSN real pendente. |
| 9. Ataques com múltiplas atividades | `multi-activity-*`, `activity-damage`, `activity-guide` | Seleção de atividade, partes de dano, rótulos e recibos revisados; testes de fórmulas e cartões anteriores. |
| 10. Técnicas sustentadas | `sustained-duration-fix`, `automation-runtime` | Testes de duração, expiração e filas; handlers específicos do OP RPG devem ser reconhecidos no Foundry. |
| 11. Fruta / Akuma no Mi | `fruit-sheet-fix`, `akuma-fix`, `akuma-combat-fix` | Revisados fluxos de criação/remoção, energia, power-up, tokens e combate. Sem ambiente real, dependências são riscos residuais. |
| 12. Treinamentos | `free-training-fix`, `operation-history`, `live-sheet-bridge` | Revisados escolha de pagamento, dependências e desfazer; política de autorização de treinamentos gratuitos precisa decisão do mestre. |
| 13. Camadas de dano e escudo | `shield-points-fix`, `native-targets`, `book-rules` | Revisados cálculos, recibos e reconciliação; teste de tipos físicos/force e testes prévios de bandeja. |
| 14. Haki e despertar | `haki-*` (8 arquivos) | Revisados estados, recursos, duração, sigilo, dano e tratamento de exceções. Interação com efeitos reais não simulada integralmente. |
| 15. Fórmulas e persistência de itens | `formula-fix`, `effect-automation-rules` | Regras de validação testadas; alterações reais em compêndios/mundos não executadas. |
| 16. Cura e PV temporários | `healing-fix`, `shared`, `sustained-duration-fix` | **Correções confirmadas na 1.27.7**, 31 verificações novas e testes anteriores. |
| 17. Ficha NPC | `npc-sheet-fix`, `haki-mechanics-fix`, `haki-stages-fix` | Análise de patches e fallback; reconstrução de DOM e integração com ficha real pendentes. |
| 18. Painel, histórico e backups | `workspace`, `operation-history`, `diagnostic`, `api`, `sheet-review` | Revisados escopo, reversão, permissões, exportação e logs; testes de histórico e alterações. Importação de backups não automatizada pelo módulo. |
| **Auxiliares sempre ativos** | `main.js`, `shared`, `feature-settings`, `narrator-tools`, `area-refund` | Revisados ciclo `init/ready`, flags, instaladores, manifesto, reembolso e ferramentas GM. |

## Erros funcionais encontrados e corrigidos nesta versão

**1. Cura podia gastar Limite de Cura sem conseguir aplicar PV.** O caminho do cartão de cura consumia o limite antes de saber se havia algum personagem válido/necessitado; também podia tentar curar a mesma ficha duas vezes se o usuário a selecionasse através de dois tokens vinculados. Agora deduplica Actors, verifica a permissão sobre todos os alvos antes do gasto e pula fichas com PV cheios ou máximo de PV inválido.

**2. Cura automática podia consumir limite ao recuperar zero PV.** O caminho de manutenção cobrava o valor rolado mesmo quando o alvo estava no máximo, ou quando o ganho real era inferior ao valor rolado. Agora não cobra se não há ganho, e limita o gasto ao valor efetivamente recuperado. A mensagem do item tem nome escapado para não interpretar HTML.

**3. Valores inválidos de cura ou PV temporário.** Dados `Infinity`, `NaN` ou máximos de PV ausentes podiam chegar aos cálculos. O módulo rejeita valores não finitos e evita atualizar recursos inválidos. Aplicações de PV temporários que não alteram a ficha não são tratadas como sucesso.

**4. Cure card com dois tokens do mesmo Actor.** Uma mesma ficha vinculada é tratada como um único destinatário; não ocorre atualização duplicada. A regra de gasto por cartão é preservada.

**Arquivos modificados de lógica:** `scripts/healing-fix.js`, `scripts/shared.js`. Os demais módulos permaneceram com a lógica da 1.27.6 para reduzir regressões.

## Testes executados e significado das contagens

| Teste | Verificações aprovadas |
|---|---:|
| Exclusão do lançador | 28 |
| Geometria e casas de área | 35 |
| Altura | 8 |
| Cartão nativo e alvos | 5 |
| Efeitos periódicos e privacidade | 6 |
| Ciclo de áreas persistentes | 6 |
| Privacidade | 7 |
| Filas/eventos aninhados | 6 |
| Reembolso | 6 |
| Emanação nativa | 19 |
| Guarda de áreas persistentes | 3 |
| Cinco revisões anteriores | 23 |
| **Nova revisão transversal de subsistemas** | **61** |
| **Novos testes de cura/segurança de dados** | **31** |
| **Total de asserções funcionais/simuladas** | **244** |

Adicionalmente: execução de `node --check` em **77 arquivos JS/MJS** (62 códigos de execução, incluindo `main.js`, e 15 testes); verificação estrutural de **246 importações locais e 448 símbolos**; leitura do manifesto e recursos. Esses números **não significam 244 testes end-to-end** nem comprovação de que todos os recursos operam em uma mesa real.

## Riscos residuais e decisões não tomadas automaticamente

1. **Integrações internas do OP RPG:** o módulo substitui alguns handlers privados por inspeção de código e depende de caminhos, classes e estrutura do sistema. É necessário teste com `oprpg-system` efetivamente carregado, em especial em versões diferentes da verificada.
2. **Permissões e treinos gratuitos:** um jogador que controla a ficha pode selecionar a opção “recebido gratuitamente” no diálogo de treinamento. Isso pode ser intencional; exigir autorização explícita de GM seria uma mudança de regra/fluxo, portanto não foi alterado sem autorização.
3. **Cura distribuída não é transação atômica multiator:** uma falha de banco de dados/permissão no meio de várias alterações pode deixar parte dos PV aplicados e uma única cobrança. A mudança automática de rollback poderia causar novos efeitos colaterais, portanto requer definição de política transacional.
4. **Regras em área:** por requisito do usuário, somente quadrados afetados determinam os alvos e o lançador permanece imune. É preciso conferir visualmente graduações de grid, paredes, emanações móveis, grids hexagonais, tokens pequenos e alturas.
5. **DAE, Midi-QOL e Dice So Nice:** dependências externas e macros não foram executadas. Compatibilidade anunciada é parcial.
6. **Desempenho/concorrência em campanhas longas:** many Regions, efeitos periódicos e históricos longos exigem teste de carga com usuários simultâneos. Recibos limitados a 200 entradas podem exigir política de retenção.
7. **Mudanças em arquivos de mundo/compêndios:** patches de persistência de fórmulas devem ser precedidos por backup completo; não foi executada migração de dados em um mundo real.
8. **Compatibilidade Foundry V14:** a faixa `maximum` do manifesto é declarativa. O campo `verified` permaneceu em 14.367 porque a versão 1.27.7 não foi validada numa instalação real.

## Cenários mínimos de validação dentro do Foundry

1. Em mundo-clone com GM e jogador: atacar com cone, círculo, linha, retângulo, emanação 2×2, personagem fora da borda e lançador dentro; conferir alvos, dano, salvaguardas e log de recibos.
2. Criar/mover/excluir token numa área persistente e verificar aplicação/remoção de efeitos, paredes, altura e custo de manutenção.
3. Rolar cura com PV cheio, PV parcial, dois tokens ligados ao mesmo Actor, ficha sem permissão e cura automática; conferir Limite de Cura gasto.
4. Ativar/suspender Haki, Akuma, escudo, características, descanso, treinamento gratuito/pago e desfazer histórico, conferindo valores antes/depois.
5. Testar rolagem pública/GM/cega/autor e macros DAE/Midi em caso de uso; verificar visibilidade em dois clientes distintos.
6. Com módulo desativado, confirmar que o sistema-base não teve arquivos alterados; reativar e executar diagnóstico `OPRPG_FIXES_SELF_TEST()` pelo console.

## Instalação e reversão

**Versão 1.27.7 é uma compilação local, não oficial.** Fechar o Foundry, fazer cópia da pasta `Data/modules/oprpg-system-fixes`, extrair o ZIP substituindo o módulo e reabrir. Para reverter, restaurar a cópia 1.27.6. Não misturar arquivos de versões diferentes. Manter o mundo principal fechado durante a validação em mundo-clone.
