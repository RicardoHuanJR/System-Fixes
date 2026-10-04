# System Fixes 1.26.0

Esta etapa integra ativação pela característica original, explicação de dano por alvo e revisão da ficha.

## Ativação pelo item e pela barra

Na aba Automações, abra Opções, escolha a característica original, habilite a regra e selecione a atividade de ativação. Se houver uma única atividade utilizável ela será escolhida automaticamente; com várias, escolha explicitamente. A atividade escolhida deve pertencer à característica selecionada. Arraste o item original para a barra de atalhos do Foundry.

Ativar essa atividade, inclusive pela aba, mantém o diálogo, a cobrança de PP e os demais consumos configurados no item. Diable Jambe, Overclock e Controle Corporal exigem um uso: se o sistema já cobrou esse uso, o Fixes não cobra novamente. Desativar encerra somente os efeitos associados e não executa o consumo nativo. As automações passivas continuam sendo habilitadas e desligadas na aba.

Cancelar o diálogo não cria efeito. O cartão próprio do OPRPG também é acompanhado: nesse caminho, usos e PP registrados são associados ao cartão antes de pedir a aplicação ao mestre. Materiais e recursos especiais desse cartão legado não recebem uma devolução adicional pelo Fixes; precisam ser conferidos se ocorrer falha. Cliques simultâneos no mesmo cliente compartilham a execução. Falha confirmada ao criar o efeito devolve o consumo registrado pelo sistema; pedidos ao mestre ainda pendentes não são reembolsados automaticamente. Um pedido pendente impede outra ativação pelo item. A confirmação de forma híbrida acontece antes do consumo. Ifrit exige Diable ativo antes da ativação. O módulo Diable antigo deve continuar desativado.

Jogadores precisam de mestre conectado para coordenar o efeito. O mestre valida o autor, a ficha, a atividade e o cartão original. Cartões de ativação já registrados não podem ser reutilizados. Não é necessário configurar macros próprias. O fluxo integrado precisa gerar o cartão do sistema no chat; chamadas de macros que suprimem esse cartão não são compatíveis com esta etapa.

## Explicação de dano

Cada alvo recebe um resumo com dano do cartão, resultado da salvaguarda e quantidade a resolver. Os detalhes recolhíveis explicam as defesas por tipo, redução, armadura, escudo, PV temporários e perda de PV conforme o cálculo existente. O dano do cartão já pode incluir os ajustes manuais de metade/quarto; o resumo não inventa o total original dos dados.

Salvaguardas que evitam todo o dano agora produzem resumo e recibo, sem perda de PV. Reaplicar o mesmo cartão não duplica dano nem resumo. Os destinatários e o estado cego continuam sendo os do cartão original. Dois personagens com nomes iguais são acompanhados pela ficha, não pelo nome.

## Revisão da ficha

Use Revisar ficha, na aba Automações. A verificação identifica grau ausente/inválido, técnica sem atividade, atributo/CD não especificados, área sem tamanho, usos fora do limite, arma sem atividade de ataque, ação lendária fora de característica, origem/atividade de automação removida e duplicações de efeitos gerenciados com a mesma origem.

O relatório permite abrir o item para revisão. Ele não altera os documentos automaticamente, não deduz grau pelo custo em PP e não transforma técnicas em características. Grau 0 auxiliar é válido. Características passivas não precisam ter usos ou atividades. Um aviso sobre arma deve ser conferido conforme sua finalidade: pode ser um item descritivo.

## Validação e limites

712 verificações simuladas aprovadas. Incluem consumo nativo de usos e PP, cancelamento, desativação gratuita, falha/devolução, último uso disponível, repetição de cartão, vínculo por atividade, permissões, dano zero, privacidade e revisão sem mutação. Prévia visual revisada. Os contratos de ativação e devolução foram conferidos nos fontes locais do OPRPG.

A versão foi instalada na mesa com cópia de segurança. Testes reais feitos como jogador, com mestre conectado, em uma cópia da ficha: revisão detectou o vínculo removido pela duplicação; configuração corrigiu o vínculo; ativação pela aba e pelo item criaram o efeito e consumiram apenas um uso; desativar não consumiu outro uso. Dano público de Bica: 11 reduzidos pelo controle nativo ½ para 5; aplicação apenas no token da cópia reduziu PV de 63 para 58. O resumo permaneceu público e a segunda aplicação não retirou PV novamente. A cópia foi mantida para conferência. Estes testes não representam validação real de todas as mecânicas. O módulo Diable antigo foi desativado pelo mestre para evitar duplicação. As demais automações do levantamento dos livros continuam pendentes; esta versão não anuncia Electro/Heat compartilhados, Sulong, Corpo Magro, reações ou complementos manuais como completos. Não inclui novas automações de monstros. Aura não participa do cálculo de dano; Controle Cirúrgico continua por atividade.
