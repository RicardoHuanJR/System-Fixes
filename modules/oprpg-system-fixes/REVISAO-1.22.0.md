# Revisão 1.22.0 — 03/10/2026

## Como configurar

- Abra o Painel System Fixes na ficha e escolha Características. O preset Diable Jambe pode ser ativado, editado e acompanhado de outros bônus configuráveis por fórmula, tipo de dano, categoria e duração. Zero segundos significa permanente. Marque bônus já incluído manualmente para evitar soma dupla.
- Na ficha de uma Técnica, use Automação da técnica (engrenagens no cabeçalho). Vincule os Active Effects à atividade nativa e configure aplicação na falha, no sucesso ou sempre. A opção precisa ser ativada explicitamente por técnica; nenhuma condição é deduzida do texto.
- No mesmo editor, configure área persistente, entrada/início/fim de turno, duração, altura e bloqueio por paredes. O Painel permite encerrar a área. O mestre precisa manter a cena carregada para detectar movimento e turnos nessa área.
- Controle Cirúrgico mantém o limite e os custos do Livro 2.1: 1 PP para o efeito e mais 1 PP para extensão prolongada, já incluídos na atividade. Não há cobrança extra inventada por turno. A proteção prolongada conserva os aliados escolhidos; novas criaturas entram no fluxo normal de pedidos individuais.
- No editor de um Active Effect, use o relógio para configurar efeitos periódicos. Cada pedido é atribuído a um controlador conectado, com possibilidade de o mestre assumir após a desconexão. O resultado mantém a audiência original.
- Em Vitalidade, a perda final pode ser confirmada no diálogo. O módulo não inventa uma conversão entre metade/quarto de dano e graus de Vitalidade.

## Alterações e preservação

Áreas recorrentes geram cartões novos sem carregar dano ou crítico de um ciclo anterior. Condições ligadas à mesma área são atualizadas, em vez de empilhadas a cada turno. Entrada e saída são processadas em fila, com recibos e identificação por execução. Encerrar a manutenção nativa encerra a área; o Fixes não duplica a cobrança nativa.

Cancelar a colocação remove somente os modelos criados para a execução e pode devolver PP consumidos, uma vez, se o consumo estiver registrado no cartão. A devolução nunca diminui PP que já estejam acima do máximo. Não se devolve uma execução confirmada ou com salvaguarda resolvida. A manutenção nativa previamente ativa não é apagada ao cancelar outra utilização da mesma técnica; confira sua manutenção no HUD após cancelar.

Mantidos: salvaguardas individuais, seleção por alvo, bloqueio de dano até salvaguarda, controles nativos de metade/quarto, público/privado, Haki, treinos, Fruta, escudos e múltiplas atividades. Módulos de antifraude, detector e modificadores continuam separados. Argon e outros módulos externos permanecem separados.

## Compatibilidade e limites

A ponte DAE/Midi continua parcial. Implementa flags de vantagem/desvantagem, aplicação tipada nativa, fases de macros antes/depois de uso, ataque e dano, fases de salvaguarda quando o item é acessível, postActiveEffects e DamageBonus. ItemMacro usa a API do módulo quando disponível. Macros importadas não são executadas por avaliação direta de texto; a opção de macros é desativada por padrão.

OverTime aceita um subconjunto explícito: turn, label, damageRoll, damageType, saveDC, saveAbility, saveDamage, saveRemove e damageBeforeSave=false. Expressões especiais, macros OverTime e dano antes da salvaguarda exigem adaptação. O motor completo Midi-QOL não é emulado. Se seu motor estiver realmente ativo, a ponte evita uma segunda execução.

O teste de paredes utiliza a colisão de visão do Foundry: bloqueio por paredes e pontos expostos dentro da área. Não calcula bônus de cobertura parcial nem substitui regras específicas de terreno. Geometria é a nativa do sistema, sem redesenhar cones/linhas.

A atribuição de pedidos reduz resoluções concorrentes entre mestre/jogador. Recibos e filas foram testados em um cliente simulado; ainda falta confirmar concorrência e reconexão em dois clientes reais. Não alterar retroativamente resultados ou flags de pedidos já resolvidos.

## Validação

587 verificações simuladas aprovadas: 338 de funcionalidades/alvos e novas automações, 104 de auditoria, 18 de regressão, 26 de duração/manutenção, 53 de regras do livro e 48 da ponte externa. Testes executam código do módulo, métodos nativos extraídos, cliques em DOM e documentos/API simulados. Sintaxe de todos os scripts verificada ao empacotar.

O endereço atual do Foundry respondeu HTTP 200, mas as ferramentas de controle visual falharam ao iniciar (erro de arquivos do ambiente). Isso não é teste funcional real. A versão 1.22.0 não foi instalada nem validada em mestre/jogador nesta etapa. Não houve alterações nas fichas ou cenas do mundo.
