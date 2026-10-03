# System Fixes 1.15.0 — revisão do Haki Unificado 1.2.0

O pacote incorpora as funções presentes no ZIP `oprpg-haki-unificado-v1.2.0.zip` e preserva as correções de concentração da versão 1.14.0. Os contadores e resultados de Vidente mantêm o namespace `oprpg-haki-automations`, usado pelo módulo separado.

O ZIP separado 1.2.0 ainda verifica somente a queda dos PV atuais e depende de opções da atualização que podem não chegar ao cliente do jogador. Portanto, ele não resolve sozinho a falha de concentração ao receber dano em PV temporários ou dano aplicado pelo mestre; a correção está no Fixes integrado.

## Lacunas encontradas e corrigidas

- **Conteúdo e árvore:** a integração anterior só aplicava descrições de Observação e Rei. Agora inclui Armamento, o requisito de Endurecimento Ofensivo para Chama do Armamento e os quatro talentos que passaram ao Estágio Perito. A ficha e a árvore exibem os textos dos estágios 2.1.
- **Vidente:** o resultado era guardado, mas não aparecia um botão para consumi-lo. O HUD agora mostra cada dado guardado e permite consumi-lo com confirmação; a substituição no teste continua manual.
- **Corpo Armadurado:** o HUD ainda chamava o toggle antigo, que acrescentava 20 Pontos de Escudo. A ficha também usava esse caminho. Ambos agora usam a regra 2.1: a Forma Dominada estende a resistência dos Pontos de Escudo aos demais tipos de dano, exceto Verdadeiro, sem elevar a reserva.
- **Armadura Suprema Avançada:** com Endurecimento Defensivo Avançado, a reserva máxima de Escudo passa a 80; o máximo de PV recebe +40 de forma derivada.
- **Dano no card:** o botão de Dano consulta a fórmula atual da atividade de arma para refletir Endurecimento Ofensivo e Corpo Armadurado Avançado sem gravar mudanças no item.
- **Resistência do Escudo:** o pipeline do Fixes, inclusive cards tipados, aplica a ampliação da Forma Dominada sem empilhar a resistência caso ela já tenha sido aplicada pelo sistema.

## Conferência das demais funções

Antevisão e Perceber Presença mantêm as correções de concentração da 1.14.0. Superação Majestosa, recuperação nos descansos e contadores continuam usando o mesmo armazenamento do módulo separado. As simulações cobriram ativação, consumo, recuperação, alternância de modos, dano e concentração.

O módulo 1.2.0 descreve benefícios que ainda dependem de decisão ou operação manual: substituição de um teste por Vidente, escolha de efeito de Perceber Presença, reembolso de PP de Clarividência, aplicação dos dados de Presença Esmagadora e crítico/dano máximo de Armamento do Rei. Os textos de estágio aparecem na interface, mas a repetição diária do Teste de Haki do Perito não recebeu um botão automático nesta integração. Não anuncie essas ações como automáticas.

## Instalação

1. Feche o Foundry e guarde uma cópia da pasta `Data/modules/oprpg-system-fixes`.
2. Extraia `oprpg-system-fixes-1.15.0.zip` e substitua a pasta pelo diretório `oprpg-system-fixes` do ZIP.
3. Em Gerenciar Módulos, deixe **OPRPG — Haki Unificado** (`oprpg-haki-automations`) desativado. O Fixes adia a integração de Haki enquanto o módulo separado estiver ativo, para evitar patches duplicados. A antiga Correção de Haki também deve ficar desativada.
4. Reinicie o Foundry e recarregue todas as janelas. Confira versão 1.15.0.

## Testes e limites

Foram executadas 345 verificações simuladas no código do Fixes e do sistema local `1.0.21-local.2`; o ZIP e suas importações também foram validados. Nenhuma instalação ou teste multicliente ocorreu no mundo real. Os dados de itens antigos não são migrados automaticamente.
