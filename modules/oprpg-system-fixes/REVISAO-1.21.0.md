# System Fixes 1.21.0 — áreas e Controle Cirúrgico

## Uso

1. Ative uma técnica cuja atividade tenha área configurada. Posicione e confirme o modelo com o fluxo do sistema. Não há um novo botão de posicionar área no cartão.
2. Depois de confirmar todos os modelos da mesma ativação, os tokens que intersectam a área substituem os alvos anteriores. Tokens grandes podem ser atingidos mesmo com o centro fora da área. A união de vários modelos não duplica a ficha de um mesmo ator vinculado.
3. Cada alvo de uma técnica de salvaguarda recebe um pedido individual para rolar. O pedido aparece para donos da ficha e mestres que possam ver o cartão original. NPCs recebem pedidos para o mestre. Nenhuma salvaguarda é rolada automaticamente pelo lançador.
4. O resultado conserva a audiência do cartão original: uma técnica pública continua tendo resultado público; um cartão privado não amplia seus destinatários. Os pedidos individuais são privados para os responsáveis.
5. O botão de dano continua disponível somente após uma salvaguarda concluída. Ao aplicar o dano, todos os alvos não protegidos devem ter terminado suas salvaguardas. Cada um recebe dano completo na falha ou a consequência configurada em `damage.onSave` no sucesso, inclusive metade ou nenhum dano. As escolhas manuais de metade/quarto continuam disponíveis e acumulam com essa consequência individual.
6. O cartão registra os alvos da execução. Mudar os alvos com T depois não redireciona aquele dano. Para lançar a técnica de novo, gere uma nova ativação/cartão.

## Controle Cirúrgico

Na janela de edição de uma técnica, o ícone de mira no cabeçalho abre **Configurar Controle Cirúrgico**. Ative apenas nas técnicas que possuem esse efeito. Uma descrição que contenha o nome do efeito também é reconhecida; a configuração explícita pode desativar esse reconhecimento.

Inclua **1 PP** do efeito no consumo da atividade. Para estender a proteção pela duração prolongada, inclua o PP adicional indicado pelo livro e marque essa opção. A configuração não altera o consumo nem cobra PP novamente. A opção de custo não incluído bloqueia a finalização da área; ela não desfaz um consumo já realizado pelo sistema ao ativar a técnica.

Após posicionar, escolha aliados protegidos até o modificador de Destreza do lançador, mínimo de um. Eles continuam marcados no mapa, mas não recebem pedidos de salvaguarda nem dano desse cartão. A escolha de quem é aliado cabe ao lançador/mestre; a disposição do token não substitui essa decisão.

A proteção de condições automáticas exige que o efeito esteja associado à execução. A ponte DAE aceita `sourceMessage` em `game.oprpgFixes.compatibility.applyEffects` e filtra os protegidos. O hook de criação de efeitos aceita `options.oprpgAreaSource` ou `flags.oprpg-system-fixes.areaSource`; efeitos benéficos podem usar `options.oprpgBeneficial: true`. Condições manuais ou automações externas sem essa associação não são bloqueadas. A opção prolongada conserva a lista de proteção nesse cartão, mas não automatiza cobranças posteriores de PP nem identifica novas criaturas que entrem em uma área persistente.

## Cancelamento e limites

Cancelar um modelo ou a escolha de aliados não envia pedidos. Uma falha de posicionamento marca a execução como cancelada. Isso não reembolsa automaticamente o consumo nativo de PP. Nenhuma seleção ou salvaguarda ocorre ao simplesmente renderizar novamente um cartão.

A identificação é feita uma vez com os tokens visíveis ao lançador, na cena aberta, pela geometria do preview nativo. Não verifica cobertura, paredes, altura/Levels ou movimento posterior. Tokens ocultos não são revelados ao jogador; o mestre pode resolver esses casos. Não aplica condições nativas sem uma automação associada.

O fluxo antigo de Vitalidade permanece: a resolução por grau é confirmada no diálogo existente. A redução numérica de dano por sucesso é automática para os recursos normais; esta versão não cria uma nova regra de redução de grau/PVE.

A compatibilidade com o motor completo Midi-QOL continua parcial. Diable Jambe ainda é distribuído separadamente; a consolidação dos demais módulos próprios ainda não foi realizada nesta versão. Antifraude, detector e modificadores permanecem separados, assim como módulos externos.

## Verificação

522 verificações passaram: 273 de fichas/DOM/alvos/áreas, 104 de auditoria de automações, 18 de regressão, 26 de efeitos sustentados, 53 de regras e 48 da ponte externa. As 41 novas verificações cobrem interseção de círculo/cone/linha, tokens grandes, seis pedidos individuais, duplicação, cancelamento, múltiplas áreas, privacidade, custos, proteção, dano e efeitos DAE associados.

Testes executados com o código do módulo e métodos reais disponíveis do sistema em navegador sem interface, com documentos e permissões Foundry simulados. **Sem teste desta versão em Foundry real e sem instalação na pasta ativa nesta etapa.** Consulte VALIDACAO-SYSTEM-FIXES-1.21.0.json para os resultados e hashes.

