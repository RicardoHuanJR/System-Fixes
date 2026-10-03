# System Fixes 1.23.0 — correções OPRPG

## Dano sem aura

Aura/auraOn/auraActive e o desvio automático para Vitalidade foram removidos das automações de dano do Fixes. Esses campos são resíduos de outro sistema, não regras desta mesa. Dano segue PV, PV temporários, armadura, escudo, resistências e resultados individuais. Não há morte instantânea, multiplicação por aura ou redução de PV máximo por perda de Vitalidade. A preferência está registrada no AGENTS.md da área de trabalho. Os arquivos do sistema base não foram alterados.

## Pedidos individuais

O botão de salvaguardas agora envia um pedido por ficha marcada como alvo, inclusive em técnicas sem área; o mestre não rola automaticamente pelas fichas dos jogadores. Cada pedido vai ao controlador daquela ficha e aos mestres, preservando a audiência autorizada da técnica. Dois tokens vinculados à mesma ficha compartilham um pedido; atores sintéticos diferentes permanecem independentes.

Pedidos guardam atributo, CD e atividade, para o dono do alvo não depender de acesso ao item atacante. A rolagem nativa continua incluindo proficiência, efeitos e modificadores. Técnicas sem área também registram os alvos da execução e usam o sucesso individual na aplicação de dano. Um cartão privado não divulga o pedido a jogadores fora de seus destinatários; publique a técnica quando os alvos precisarem recebê-lo.

## Controle Cirúrgico por atividade

Abra uma Técnica, clique em Configurar Controle Cirúrgico no cabeçalho e escolha a atividade de salvaguarda com área. Cada atividade tem suas opções de habilitação, custo já incluído e proteção prolongada. Configurações globais antigas e menções na descrição não ativam automaticamente todas as atividades: configure explicitamente as atividades desejadas.

## Efeitos OPRPG na ficha

Abra uma ficha e clique no botão Efeitos OPRPG no cabeçalho. Também é acessível pelo Painel System Fixes.

- Características especiais: ativar/desativar, configurar e remover. Diable Jambe, fórmula de dano e grau inteiro em dados extras; tipo de dano, duração, categoria, alcance e seleção dos itens autorizados. Zero segundos significa permanente. A opção de bônus já incluído manualmente evita duplicação.
- Novo efeito de automação: cria um Active Effect desativado e abre o editor nativo. No painel Automações cadastradas — OP-RPG, adicione regras e salve. Ative o efeito quando estiver pronto.
- Regras adaptadas do módulo Automações de Efeitos 0.6.0: acerto técnica/comum corpo a corpo/distância, dados e dano fixo separados entre ataque e salvaguarda, dados por graduação, usos restantes, fórmulas determinísticas, acúmulo ou maior bônus e PP máximo.
- Efeitos existentes do módulo 0.6.0 são lidos pelas flags originais sem exigir módulo ativo; ao salvar pelo Fixes, a configuração fica no Fixes. Efeitos transferidos precisam estar ativos e não suprimidos pelo item. PP máximo não preenche automaticamente os pontos atuais.
- A integração usa configurações nativas e os caminhos dos cards do Fixes; não instala uma interceptação global de Roll.evaluate.

Desative oprpg-automacoes-efeitos para usar a integração nova. Se ele permanecer ativo, o Fixes evita uma segunda aplicação e exibe aviso. Desative também o módulo Diable Jambe antigo para usar o preset integrado. Os demais módulos independentes permanecem separados.

## Estilos de Combate Exclusivos 2.1

Consultados o texto e a página visual de Black Leg no PDF enviado. Diable Jambe: metade do grau, arredondada para baixo, mínimo de um dado, confirmado na página 5 do PDF (página impressa 3). O preset integrado automatiza a parcela dos dados extras em Técnicas; não promete automatizar sozinho toda a característica.

O editor permite separar o dano de fogo de ataques desarmados escolhidos na ficha, configurar dados por grau inteiro e restringir técnicas por item. A regra de grau inteiro é útil para a parcela de técnicas de Black Leg em Hell Memories; escolha somente os itens correspondentes. A quantidade de usos por descanso, resistência a fogo e benefícios por sequência de acertos ainda devem ser configurados nos recursos/efeitos nativos ou controlados pelo mestre.

Shoot, Ifrit Jambe e Hell Memories também envolvem escolhas de condição, limites por turno/descanso, resistência/invulnerabilidade e resultados naturais. Não foram resumidos a bônus universais; essas partes continuam pendentes de implementação específica.

## Validação e teste real

610 verificações simuladas aprovadas: 361 de funcionalidades/alvos/UI, 104 de auditoria, 18 de regressão, 26 de duração/manutenção, 53 de regras e 48 da ponte externa. Foram exercitados cliques reais em DOM, o botão da ficha, a janela, o editor de efeitos, seis destinatários, ausência de acesso ao item atacante, dano com campos legados desligados e bônus no crítico/card customizado. A apresentação foi conferida em prévia local, não no Foundry real.

O endereço heavily-wolf-budget-terry.trycloudflare.com respondeu HTTP 200. Na conferência, o módulo servido ainda era 1.21.0. As duas ferramentas de controle visual falharam ao iniciar com erro de arquivos do ambiente; portanto nenhum teste funcional com mestre/jogador real foi concluído. Compatibilidade DAE/Midi continua parcial.
