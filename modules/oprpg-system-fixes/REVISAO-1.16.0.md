# System Fixes 1.16.0

Esta versão inicia a atualização de estabilidade e de fluxo de combate. Mantém as correções das versões anteriores sem alterar os arquivos do sistema OPRPG.

## Novidades

- **Solicitar dano ao mestre:** ao aplicar pelo cartão customizado do OPRPG em um alvo sem permissão, o jogador envia um pedido privado. O mestre ativo confirma os alvos e aplica as defesas atuais. Os alvos ficam gravados no pedido, independentemente dos tokens que o mestre selecionar depois. Recusar ou cancelar não causa dano. A técnica não é ativada novamente.
- **Reversão de recursos:** no Painel System Fixes, “Desfazer últimos recursos” restaura o último registro de PV, PV temporários, PP, PP gerados, escudo, armadura, Vitalidade ou PT. Os valores devem continuar iguais aos registrados. Uma reversão não pode ser repetida; registros de treino continuam com seu próprio botão. O registro de aplicação do cartão também é revertido, permitindo reaplicar um dano desfeito.
- **Concentração pendente:** por padrão, a CD automática continua sendo calculada por dano, mas os testes ficam no chat e no painel sem abrir várias janelas. Cada dano gera seu próprio teste. Configurações de Jogo → OPRPG System Fixes → Testes de concentração permite voltar ao modo automático. A escolha é por cliente. Controles repetidamente instalados não duplicam os pedidos.
- **Perito:** o painel permite selecionar um teste de Haki que falhou e repetir uma vez por dia do relógio do mundo, conforme Livro do Jogador 2.1, página 232. Exige 71 PA distribuídos nos talentos nativos. Usa a rolagem nativa da perícia com atributo, proficiência e demais regras da ficha, reutiliza CD e modo de vantagem quando gravados e mantém os destinatários exatos do teste original. O segundo resultado é obrigatório; cancelar não gasta o uso. O mestre confirma a falha quando o teste não contém uma CD.
- **Etapas das múltiplas atividades:** cada cartão mostra a atividade correspondente e os estados de acerto, dano e aplicação. O cartão permanece vinculado à sua própria atividade. A indicação ajuda a acompanhar o fluxo; não executa outras atividades nem cobra novamente a ativação.

## Desempenho

O avanço do relógio usa um único agendador para duração sustentada, Power Up da fruta e recarga de escudo do Haki. Ele mantém índices de fichas relevantes, incluindo atores de tokens não vinculados, em vez de percorrer todas as fichas em cada avanço. A inicialização e a troca de cena ainda fazem uma verificação para preencher os índices.

As operações de manutenção, Power Up e alterações comandadas pelo painel usam uma fila por ficha. As janelas de Haki ficam em uma fila separada, para não impedir a atualização dos recursos. Alterações de PV não disparam a sincronização de movimento/forma da fruta. Avisos de diagnóstico são limitados aos últimos 100, sem repetir avisos consecutivos idênticos.

Um teste com mil fichas inativas e uma ativa confirmou uma visita ao índice correspondente por verificação. Isso mede o comportamento do código em simulação; não é uma medição de FPS ou garantia de ausência de travamentos no Foundry real.

## Instalação e uso

1. Faça backup do mundo e da pasta anterior `oprpg-system-fixes`.
2. Com o Foundry fechado, substitua a pasta em `Data/modules/oprpg-system-fixes` pela pasta contida no ZIP. Não instale uma segunda cópia do mesmo módulo.
3. Abra o mundo e recarregue o navegador do mestre e dos jogadores. O módulo deve mostrar a versão **1.16.0**.
4. Abra o **Painel System Fixes** pelo botão de ferramentas no cabeçalho da ficha ou pelas configurações para concentração, Perito, histórico e diagnóstico.
5. Mantenha desativado o módulo separado Haki Unificado se estiver usando a integração do Fixes, para evitar dois conjuntos de automações.

## Limites e cuidados

- Os testes usam documentos, hooks, relógios e rolagens simulados e DOM real de navegador. **Não houve teste em um mundo Foundry real nem instalação na sua mesa.** O manifesto mantém a compatibilidade previamente declarada; esta versão não foi verificada ao vivo no Foundry 14.
- Pedidos de dano cobrem os cartões customizados do OPRPG. O menu nativo de dano e cartões de outros módulos ainda exigem aplicação pelo mestre quando o jogador não tem permissão.
- Pedidos com total diferente do cartão persistido — por exemplo, modificadores ½/¼ aplicados apenas na tela do jogador — são bloqueados. O mestre precisa conferir os modificadores e aplicar pelo cartão. Não é usada uma quantidade enviada pelo jogador sem conferência da origem.
- Reversão restaura recursos, não reativa efeitos ou concentração encerrados, não desfaz mensagens nem reconstrói turnos. Ao desfazer dano, um teste de concentração ainda pendente deve ser avaliado pelo mestre; não é automaticamente apagado.
- Perito usa dias de 24 horas do relógio do mundo (ou `CONFIG.time.dayTime` quando disponível). Descansar sem avançar esse relógio não inicia um novo dia. Bônus circunstanciais escolhidos manualmente devem ser conferidos no diálogo nativo da segunda rolagem. Não apaga o resultado anterior.
- A lista de alvos aplicados no guia é um resumo histórico. Nomes iguais podem aparecer como um único nome; os registros de dano continuam separados por ator. Desfazer recursos não remove nomes desse resumo.
- Vidente permanece com substituição manual confirmada. Automações de invocação, fases de chefes, migração de itens e um fluxo que execute várias atividades em sequência ainda não fazem parte desta versão.

## Validação

**383 testes passaram:** 104 de auditoria, 18 de regressão, 25 de duração sustentada, 186 de funcionalidades/alvos/interface e 50 das regras do livro. Foram verificados 38 arquivos JavaScript e 133 importações locais.

Os resultados detalhados estão em `tests/*-1.16.0.json` e no relatório externo `VALIDACAO-SYSTEM-FIXES-1.16.0.json`. Incluem regressões de treinos, fruta, múltiplas atividades, privacidade, cura permanente, escudo, regras do livro e os cenários novos de concorrência, permissões, aprovação, reversão e concentração pendente. O empacotamento verifica sintaxe, importações locais e conteúdo do ZIP.
