# System Fixes 1.14.0 — concentração do Haki

Esta versão substitui o Fixes 1.13.0 e preserva suas correções. Pacote: `oprpg-system-fixes-1.14.0.zip`.

## O que foi corrigido

- **Antevisão:** o pedido de concentração usa o dano recebido nos PV e nos PV temporários. A CD é a maior entre 10 e metade do dano, arredondada para baixo, conforme a p. 267 do Livro do Jogador 2.1. Cada aplicação de dano gera seu próprio teste enquanto a concentração estiver ativa.
- **Dano aplicado pelo mestre:** o cliente do jogador também reconhece a perda de PV/PV temporários, mesmo que não receba as opções internas da atualização criada no cliente do mestre. O jogador que controla a ficha, ou o mestre quando não há dono ativo, faz a rolagem.
- **Perceber Presença:** o botão do HUD agora ativa/encerra a característica com um efeito identificável e concentração. O benefício de percepção de criaturas vivas continua representado por sua descrição; o sistema não revela automaticamente criaturas ocultas no mapa. Corrigimos a descrição antiga, que exigia um teste com vantagem ausente no livro 2.1.
- **Concentração exclusiva:** iniciar Perceber Presença ou Antevisão concentrada encerra a outra concentração. Quando uma técnica nativa inicia concentração, a concentração do Haki termina.
- **Resultado:** perder a salvaguarda encerra a característica; chegar a 0 PV a encerra sem rolagem; cancelar a janela deixa o pedido pendente no chat. A rolagem do NPC usa modo reservado ao mestre.

O rastreamento respeita a configuração **OPRPG → Desativar rastreamento de concentração**. Para receber pedidos automáticos, ela deve estar desativada. Se o módulo antigo **OPRPG — Haki Unificado** também estiver ativo, o Fixes adia a própria integração de Haki para evitar duas implementações simultâneas; deixe apenas a versão integrada ativa.

## Instalação

1. Feche o Foundry e guarde uma cópia da pasta `Data/modules/oprpg-system-fixes`.
2. Extraia o ZIP e substitua essa pasta pela pasta `oprpg-system-fixes` contida no arquivo.
3. Reabra o Foundry e recarregue as janelas do mestre e dos jogadores. Confira a versão **1.14.0** na lista de módulos.

## Verificação

O pacote passou em simulações que exercitam os métodos do módulo, alterações de PV nas fichas, formulários e o caminho de dano recebido por outro cliente sem as opções locais do mestre. A validação e os números estão em `VALIDACAO-SYSTEM-FIXES-1.14.0.json`.

Não foi instalado nem testado no mundo real nesta entrega. Se outra característica específica continuar sem pedir teste, informe o nome e como ela foi ativada; características com concentração nativa seguem o controle do sistema, enquanto efeitos de módulos externos podem guardar esse estado de outra forma.
