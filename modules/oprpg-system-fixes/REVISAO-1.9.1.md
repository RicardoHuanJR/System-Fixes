# Revisão do OPRPG System Fixes 1.9.1

## Resultado e instalação

Esta atualização corrige a perda do reparo de múltiplas atividades após o acerto recriar o card. Substitua a pasta `Data/modules/oprpg-system-fixes` pelo conteúdo do ZIP, reinicie o Foundry e atualize o navegador com Ctrl+F5. Confira a versão 1.9.1 no gerenciador de módulos. Crie um card novo para validar: um resultado errado já gravado no histórico não é recalculado automaticamente.

O sistema fornecido é **1.0.21-local.2**; o módulo recebido é **1.9.0**. A análise foi feita sobre esses arquivos. O sistema base não foi alterado. A declaração histórica de compatibilidade com 1.0.20 foi mantida, pois testes simulados não autorizam declarar uma nova versão como validada no Foundry.

## Causa demonstrada

O sistema salva `card.outerHTML` ao terminar o acerto. Esse HTML inclui `data-oprpg-fixes-handler="1"`, mas não inclui os eventos JavaScript conectados ao botão. Ao recriar o card, a 1.9.0 interpreta a marca como prova de que o evento ainda existe e pula a conexão. O clique passa ao código nativo, que usa `item.labels.damages[i]`: esse é um resumo agregado das atividades, não uma lista exclusiva da atividade selecionada.

No teste, a primeira atividade causa `1d4` e a segunda `3d8`. Com dados determinísticos no máximo, a segunda gera 24 antes da recriação, mas 4 depois dela na versão antiga. A correção mantém 24 nos dois caminhos. O teste reproduz a serialização do acerto, não uma sessão completa de rolagem dentro do Foundry.

## Alterações

- Dano, acerto, preparação de labels e captura de aplicação ao escudo registram conexões por identidade do botão real, usando WeakSet. Um novo botão recebe um evento; varreduras repetidas do mesmo botão não duplicam eventos.
- A trava de rolagem é transitória. Atributos antigos salvos no HTML não deixam o card permanentemente bloqueado. Eventos repetidos durante o processamento não escapam para o cálculo nativo.
- O dano próprio do Fixes passa a incluir PA e escala já registrados pelo acerto, sem novo consumo. Também preserva Foco Agressivo e a maximização da Emissão no dano-base.
- A rolagem prepara a fórmula de crítico com os dados efetivamente rolados. O crítico automático guarda seu bônus separado do dano-base, como espera a aplicação nativa.
- Os painéis recebem as classes de visibilidade usadas pelo sistema. O desbloqueio respeita o autor indicado no card.

## Método e limites dos testes

Os testes executam o código do módulo em navegador Edge sem janela, com DOM e propagação de eventos reais. As dependências do Foundry, a persistência das mensagens e os dados são simulados. As funções internas são carregadas para testar seus comportamentos; não é um carregamento completo do módulo dentro do Foundry.

O pacote inclui `tests/regression.cjs`, resultados das versões antiga/nova e este relatório. Para executar em ambiente de desenvolvimento, instale Playwright, tenha Microsoft Edge disponível e rode `node tests/regression.cjs CAMINHO_DO_MODULO`. É possível indicar a localização de Playwright pela variável `OPRPG_TEST_PLAYWRIGHT`.

Os casos cobrem dano isolado, recriação após acerto, quatro conexões de eventos, primeira atividade, PA/escala, preparação de crítico, trava persistida antiga, fórmulas customizadas com modificador e tipos diferentes, cliques repetidos, prioridade da configuração nativa da atividade e sanitização de contexto NPC congelado sem executar getters.

**Não foi testada uma sessão real de Foundry**, nem o funcionamento de todas as combinações com Argon, Dice So Nice, outros módulos, permissões de vários clientes e aplicação efetiva de dano em atores.

## Achados que exigem validação adicional

- O `SELF_TEST` da 1.9.0 verifica principalmente indicadores de instalação. Um indicador ativo não demonstra que uma mecânica funciona após a recriação de um card; foi exatamente por isso que o erro podia passar por esse diagnóstico.
- A integração de Haki já usa conjuntos de objetos vivos em vários pontos e possui detecção de módulo externo para evitar duplicação. Isso é uma revisão de código, não confirmação prática de todos os talentos.
- O cálculo próprio de dano do Fixes não reproduz integralmente todos os caminhos adicionais do fork local, especialmente Estágio de Foco/Ultimato, Chama do Armamento e seleção individual de parcelas de dano. Esta versão não certifica essas combinações e não deve ser descrita como revisão completa de todas as regras.
- As regras de resistência, imunidade, escudo, Power Up e Despertar não receberam uma validação integral em atores reais. A alteração no escudo nesta entrega é especificamente a reconexão do evento que captura os dados do card.
- Cards antigos podem conter dano ou crítico incorreto persistido; use cards novos para comparar a instalação e não aplique novamente um dano antigo apenas para testar.

## Verificação no Foundry

Crie duas atividades com danos distintos no mesmo item. Em cards novos, compare dano isolado da segunda atividade com acerto seguido de dano da segunda. Repita com PA/escala e um crítico, confirmando o valor exibido e o valor realmente aplicado. Confira também uma atividade única e a abertura de uma ficha NPC. Os testes automáticos fornecem evidência sobre o defeito corrigido; essa etapa confirma a integração com o seu mundo.
