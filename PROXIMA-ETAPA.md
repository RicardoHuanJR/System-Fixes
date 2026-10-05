# AutomaÃ§Ãµes de personagens 1.26.3

Compatibilidade com Modificadores de Chat 1.2.1: acerto e dano persistentes, troca e remoção sem duplicação, sigilo das animações. 734 verificações simuladas aprovadas e testes reais na cópia da ficha. Veja [revisão](modules/oprpg-system-fixes/REVISAO-1.26.3.md) e [checklist de compatibilidade](COMPATIBILIDADE.md).

# AutomaÃ§Ãµes de personagens 1.26.2

Compatibilidade com Modificadores de Chat 1.2.0: acerto e dano persistentes, troca e remoção sem duplicação, sigilo das animações. 733 verificações simuladas aprovadas e testes reais na cópia da ficha. Veja [revisão](modules/oprpg-system-fixes/REVISAO-1.26.2.md) e [checklist de compatibilidade](COMPATIBILIDADE.md).

# AutomaÃ§Ãµes de personagens 1.26.1

Correção do dano das automações nos cartões com uma única atividade e do conflito com o preparo legado de Haki. 717 verificações simuladas aprovadas. Diable Jambe testado em Foundry real na cópia da ficha: dado de fogo separado no cartão. Veja [revisão 1.26.1](modules/oprpg-system-fixes/REVISAO-1.26.1.md).

# Automações de personagens 1.26.0

Ativação pelo item original e atalhos, explicação de dano por alvo e revisão da ficha. 712 verificações simuladas aprovadas. Testes reais de ativação, consumo, desativação, revisão e dano realizados em uma cópia da ficha, com jogador e mestre conectados. A cobertura real é parcial; as demais automações dos livros continuam pendentes. Veja [revisão 1.26.0](modules/oprpg-system-fixes/REVISAO-1.26.0.md).

# Automações de personagens 1.25.0

Primeira etapa das automações de personagens: usos nativos na aba, coordenação pelo mestre e novos efeitos. 680 verificações simuladas aprovadas. As demais automações e testes em Foundry real continuam pendentes. Veja [revisão 1.25.0](modules/oprpg-system-fixes/REVISAO-1.25.0.md).

# Salvaguardas privadas 1.24.2

Pedido individual independente da audiência do ataque privado. Dono responde sem acesso ao cartão do mestre; resultado restrito aos responsáveis. Correção de pedidos antigos ao solicitar novamente. 641 verificações simuladas; teste funcional real pendente.

# Legibilidade 1.24.1

Indicador com texto escuro sobre fundo dourado; contraste visual verificado (9,30:1). Regras da 1.24.0 preservadas.

# Automações 1.24.0

Nova aba abaixo de Personalização, sete efeitos prontos dos livros, habilitação e ativação por ficha. Sem criação do zero. Consulte modules/oprpg-system-fixes/AUTOMACOES-1.24.0.md para cobertura exata e partes manuais. Testes simulados: 632. Teste funcional no mundo real pendente.

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

