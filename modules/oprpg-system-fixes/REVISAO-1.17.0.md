# System Fixes 1.17.0 — revisão de salvaguardas, dano e Haki

## Correções

- Salvaguardas das técnicas: todos os alvos marcados com T são considerados. Tokens vinculados à mesma ficha rolam uma vez; fichas de tokens não vinculados são independentes. Usa a salvaguarda nativa, com atributo, proficiência, efeitos e vantagem da ficha. Cada resultado fica separado no chat. Cancelar ou falhar em um diálogo não impede os outros alvos. Repetir o pedido não repete os resultados já registrados.
- Quando o usuário não controla um alvo, o chat oferece um pedido para o dono da ficha ou mestre rolar. O botão verifica a permissão e mantém os destinatários do cartão original.
- Dano da salvaguarda: resultado e tipos ficam gravados no cartão e reaparecem para os demais clientes que podem vê-lo, inclusive após recarregar. Escala de Energia, grau da técnica, Estágio de Foco e Power Up continuam no cálculo. O mestre pode revisar e aplicar pedidos de dano usando esse resultado persistido.
- Cartões simples de dano: a atualização local passa a ser gravada no documento do chat. A observação fica limitada ao cartão da rolagem ativa, sem observar toda a interface. Rolagens privadas continuam privadas.
- Haki Unificado: corrigido o erro de flags do módulo externo inativo. Estado integrado é escrito no próprio Fixes; dados anteriores são lidos sem consultar um namespace inválido. Usos, Vidente, concentração e estados anteriores são preservados. Dados antigos não são apagados. O ZIP enviado foi conferido: corresponde ao Haki Unificado 1.2.0 já integrado.
- Corpo Armadurado: encerra após 60 segundos do relógio do mundo e mantém o uso gasto. O +2 nativo de salvaguarda continua sendo usado, sem somar outra cópia. Ativações antigas sem data recebem um prazo novo a partir da primeira verificação do relógio.
- Reversão de recursos: não abre teste de concentração nativo ao remover PV temporários concedidos anteriormente.
- Manutenção e cura: retroceder e voltar ao mesmo turno não desconta ou cura outra vez. Cada ativação guarda os últimos 200 turnos processados.
- Menu nativo de dano: aplicações repetidas do mesmo cartão no mesmo alvo são bloqueadas. O recibo é gravado junto dos recursos; cancelamento ou falha na gravação não deixa recibo. Desfazer recursos restaura também esse registro.
- Guia de múltiplas atividades: contraste corrigido para o cartão escuro. O mestre pode rolar dano de um cartão de múltiplas atividades criado por outro usuário.

## Instalação

1. Faça backup do mundo e da pasta anterior do módulo.
2. Com o Foundry fechado, substitua `Data/modules/oprpg-system-fixes` pela pasta do ZIP. Não crie uma segunda pasta com o mesmo módulo dentro.
3. Abra o mundo e confirme a versão **1.17.0** na lista de módulos. Recarregue o navegador do mestre e dos jogadores.
4. Mantenha o módulo separado **OPRPG — Haki Unificado** desativado ao usar a integração do Fixes.
5. Para salvaguardas, marque todos os alvos com **T** e clique em Salvaguarda no cartão. O dano é rolado uma vez pelo autor da técnica ou mestre. Marque os alvos que sofrerão dano e aplique a redução adequada à técnica.

## Verificação e limites

419 verificações passaram: 104 de auditoria, 18 de regressão, 26 de duração/manutenção, 210 de interface/alvos e funcionalidades, 53 de regras com trechos nativos e 8 casos adicionais da auditoria anterior. Há testes com seis alvos, cancelamentos, permissões, cartões privados, DOM independente para o resultado remoto, erro de flags com módulo inativo, repetição de dano, reversão e retrocesso de combate.

Os testes usam documentos e sessões simulados, com DOM real de navegador e trechos do sistema nativo. **Não houve teste em um mundo Foundry real nem instalação na mesa.** Não medem FPS nem garantem ausência de travamentos.

O sucesso da salvaguarda não aplica dano automaticamente: o mestre ainda decide quais alvos recebem dano completo, reduzido ou nenhum, conforme a técnica. Pedidos de dano com modificadores locais diferentes do total persistido continuam exigindo conferência e aplicação pelo mestre. O menu nativo exige permissão sobre os alvos.

A proteção contra repetição cobre os últimos 100 recibos de dano de cada ficha e os últimos 200 turnos de cada técnica. Não é uma transação distribuída entre cliques simultâneos de dois clientes; os testes verificam repetição sequencial e concorrência local. Para uma salvaguarda nova contra a mesma técnica, use um novo cartão de ativação. A reversão não reativa efeitos/concentração encerrados, não desfaz mensagens e não apaga testes de concentração antigos.
