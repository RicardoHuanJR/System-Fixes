# Fixes 1.25.0 — primeira etapa das automações de personagens

## Implementado

- A aba exibe somente regras associadas a características possuídas. Vínculo explícito com a característica original; itens com nomes duplicados exigem seleção.
- Ativar Diable Jambe, Overclock e Controle Corporal pela aba consome um uso nativo (`system.uses.spent`). Desativar não cobra. Uso ausente/esgotado impede ativação; falha na criação do efeito devolve o uso.
- Jogadores enviam uma solicitação ao mestre conectado, que valida propriedade, configuração e estado desejado antes de aplicar. Pedidos repetidos de ativação não desligam o efeito nem cobram outra vez. Pedidos interrompidos no estado “processing” precisam de conferência; não são reaplicados automaticamente.
- Robusto: 3 PV máximos por nível, atualização após mudança de nível, compatível com PV máximos manuais ou calculados. Corpo de Criatura também considera máximo manual. Nenhum desses bônus cura PV atuais.
- Ingenuidade Anormal: −10 em Intuição.
- Corpo Leve: deslocamento 12 m e escalada 9 m, prevalecendo o maior. Estamina Animal: deslocamento 18 m. Pisada Firme: deslocamento 12 m; terreno difícil ainda manual.
- Resiliência: proficiência na salvaguarda selecionada, sem somar uma segunda proficiência.
- Overclock: duração de cinco minutos, deslocamento de 15 m e 1d6 elétrico nos ataques comuns selecionados. A penalidade nos inimigos atingidos ainda é manual.
- Controle Corporal: Corpo Largo adiciona um dado nas técnicas de combate selecionadas; Corpo Grande concede 20 PV temporários sem somar aos existentes. Exige confirmação da forma híbrida e um uso. Corpo Magro ainda não foi implementado.
- Músculo de Aço: resistência física e término ao ficar inconsciente. As outras posições e suas interações ainda não foram automatizadas.
- Expiração de Diable encerra seu Ifrit associado. Remover a característica original remove o efeito gerenciado; outros efeitos são preservados.

## Como usar

Adicione a característica correta como item da ficha. Na aba Automações, abaixo de Personalização, habilite a regra, selecione os itens afetados e a característica original. Configure máximo de usos e recuperação na característica original conforme o livro. Ative/desative pela aba.

Os controles desta versão **não substituem integralmente o fluxo nativo de ativação da característica**: ações e PP continuam sendo registrados na atividade original. Ativar diretamente o item ou uma macro antiga não passa automaticamente pelo controlador novo da aba. Evite ativar simultaneamente pelo mecanismo antigo e pela aba. A integração completa da atividade/barra de atalhos continua pendente.

Para ativações da aba por jogadores, há necessidade de mestre conectado. O pedido e seu resultado ficam restritos ao solicitante e mestre. A confirmação de forma híbrida é feita pelo solicitante.

## O que ainda falta do plano

Esta versão não implementa todo o levantamento. Permanecem pendentes o limite compartilhado de Electro/Heat/Potencializador, Sulong/Leão da Lua, Concentração Inabalável, reações opcionais, armaduras especiais, recursos de estilos e profissões, os complementos de Ifrit/Hell e os estados excepcionais. Não foram adicionadas automações de monstros.

Não se deve anunciar essas características como automatizadas por terem aparecido no levantamento. Elas precisam de integração e testes específicos em etapas posteriores. O plano técnico continua em `outputs/PLANO-IMPLEMENTACAO-AUTOMACOES-OPRPG.md` na área de trabalho.

## Validação

680 verificações simuladas aprovadas, incluindo 39 novos casos de custos, falhas, identificação da origem, permissões, idempotência, PV manuais, mudança de nível e limpeza de efeitos. A suíte auxiliar de funcionalidades também passou; seus casos já aparecem na suíte integrada e não foram contados novamente.

56 arquivos JavaScript e 225 importações locais conferidos. Foram atualizadas as antigas fixtures de Diable para incluir os usos nativos agora obrigatórios; as asserções de dano por grau/nível foram preservadas.

Não houve teste nesta versão em uma sessão real do Foundry, nem comprovação de desempenho com várias máquinas. Os testes usam DOM de navegador e documentos simulados. Os testes entre clientes, aparência na ficha real e consumo integrado à atividade ainda são pendências.
