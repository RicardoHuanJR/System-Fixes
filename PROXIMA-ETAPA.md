# Correções 1.23.0

Aura/Vitalidade removidas do dano; pedidos individuais; Controle Cirúrgico por atividade; janela Efeitos OPRPG e regras do módulo 0.6.0 integradas. Consulte a revisão 1.23.0. Estilos exclusivos: parcela de dados confirmada; sequências e condições de Shoot/Ifrit/Hell Memories precisam de automação específica. Teste funcional real continua pendente.

# Implementações 1.22.0

Diable Jambe configurável, condições por resultado, áreas persistentes, reembolso de PP e efeitos periódicos implementados. Consulte modules/oprpg-system-fixes/REVISAO-1.22.0.md. A validação funcional com dois clientes reais continua pendente.

# Áreas, salvaguardas e consolidação

## Fluxo incorporado no Fixes 1.21.0

1. Ativar a técnica e posicionar sua área pela ferramenta nativa do sistema.
2. Após confirmar a posição, identificar os tokens com ficha dentro da geometria real e marcá-los como alvos. Considerar a área ocupada por tokens grandes; não usar apenas distância circular para cones, linhas ou retângulos.
3. Se a técnica tiver Controle Cirúrgico configurado, apresentar os alvos e permitir escolher os aliados poupados dentro do limite da regra.
4. Gravar no card os alvos da execução e os protegidos. As rolagens e aplicações posteriores devem usar esse registro, sem depender da seleção atual no mapa.
5. Enviar uma solicitação individual por alvo não protegido. O dono da ficha rola a salvaguarda; para NPCs, o mestre. Não rolar automaticamente todos os NPCs ao solicitar os testes.
6. Registrar a resposta por alvo e impedir solicitação/rolagem/aplicação duplicada. Manter a visibilidade original da técnica; não divulgar nomes, CD ou dados de técnicas privadas para pessoas fora de seus destinatários.
7. Liberar a rolagem de dano depois de uma salvaguarda concluída, preservando a preferência já pedida. A aplicação deve respeitar sucesso/falha por alvo e impedir dano e condições maléficas nos protegidos.
8. Se a técnica possuir várias áreas na mesma execução, reunir os alvos e eliminar repetições. Cancelar a colocação não deve disparar pedidos de salvaguarda.

## Controle Cirúrgico

Fonte: Livro do Jogador 2.1, seção Controle Cirúrgico, página extraída 198.

- Exige técnica que peça salvaguarda para evitar dano ou condição.
- Limite: modificador de Destreza, com mínimo de uma criatura, dentro da área.
- Protege aliados do dano e das condições maléficas da técnica.
- Custo do efeito: 1 PP; extensão durante duração prolongada: 1 PP conforme configuração da técnica.
- Não deduzir nem cobrar novamente um custo já incluído na atividade. A configuração da técnica deve indicar se o custo já está incorporado.
- Não disponibilizar essa proteção universalmente para técnicas sem o efeito; existem técnicas com proteção própria, que devem possuir sua configuração específica.

## Consolidação

O usuário confirmou consolidar somente módulos próprios de OPRPG. Excluiu da consolidação: antifraude, detector de rolagens suspeitas e modificadores de acerto/dano. DAE, Dice So Nice, Argon, Better Roofs e demais módulos externos permanecem separados. Não copiar compêndios oficiais com licença individual.

Para cada recurso incorporado: opção de ativação no Fixes, migração das configurações/flags necessárias, detecção do módulo antigo para evitar execução dupla, autoria preservada e carregamento apenas quando necessário. Diable Jambe requer revisão da soma de bônus manual/automático antes da migração.

## Verificação simulada e próximos testes

- Círculo, cone, linha e retângulo; tokens pequenos/grandes e bordas da área.
- Cancelamento, reposicionamento, várias áreas e alvos repetidos.
- Dono do personagem, mestre com NPC e usuário sem permissão.
- Solicitação individual, visibilidade pública/privada e resposta em outro cliente.
- Limite de Destreza, ausência do efeito, PP já incluído e proteção prolongada.
- Protegidos sem salvaguarda/dano/condições; demais alvos com resultado individual.
- Não reaplicar dano nem duplicar hooks com módulo antigo ativo.
- Testes de regressão e teste real em documentos próprios de teste, sem gastar recursos dos personagens da mesa.

A implementação de áreas passou em simulações. O teste em Foundry real continua pendente. Condições externas exigem associação ao cartão e a proteção prolongada não automatiza PP posterior ou criaturas que entrem depois; veja a revisão 1.21.0.

