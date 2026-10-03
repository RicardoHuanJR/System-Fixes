# System Fixes 1.19.0 — apresentação OPRPG

Revisão de design de todas as funcionalidades do módulo. A referência é a implementação nativa OPRPG: `oprpg-base.css`, `oprpg-chat-card.css` e os componentes da ficha. Alterações usam a paleta `--jj-*`, fontes, bordas e classes dos cards do sistema. O inventário de todos os scripts está em `UI-INVENTARIO-1.19.0.md`.

## Resultado por funcionalidade

| Funcionalidades | Apresentação revisada |
|---|---|
| Acerto, dano, múltiplas atividades, tipos de dano e frações | Mantidos os componentes nativos. Total de salvaguarda passa a usar a classe nativa do total. |
| Salvaguardas e dano posterior | Botão de dano laranja, ícone nativo, mesma tipografia; colocado junto aos controles de rolagem, antes do resultado. Só aparece depois de uma salvaguarda concluída. |
| Salvaguardas de outros jogadores | Solicitação com cabeçalho OPRPG, nomes preservados e ações douradas. |
| Solicitação de dano ao mestre | Mesmo padrão de card; ação principal dourada e recusa secundária. |
| Cura e PV temporários | Footer e botões harmonizados com os tokens OPRPG. Removidas as cores azul e ciano próprias do Fixes. Estados aplicado/bloqueado continuam preservados. |
| Haki, concentração, Vidente, Perito e Superação | Avisos de chat com cabeçalho nativo; diálogos padronizados. HUD mantém o desenho do sistema, e o resumo de usos passa a usar seus tokens. |
| Treinamentos pagos e gratuitos, desfazer | Diálogos com campos alinhados, fundo do sistema e ações consistentes. Botões e listas nativos da ficha preservados. |
| Criação, exclusão e duplicação de técnicas da fruta | Diálogos no mesmo padrão; campos e seletores com cores legíveis. Componentes da aba Fruta continuam nativos. |
| Alvos, áreas e Vitalidade | Diálogos de seleção/confirmação no padrão OPRPG. O posicionamento da área segue o componente nativo; não voltou o botão extra. |
| Efeitos, duração, manutenção, cura automática e recarga de escudo | Componentes de ficha/HUD nativos preservados; controles do Painel Fixes seguem a nova apresentação. |
| Descanso e PV negativos | Confirmação de descanso padronizada e indicador discreto de PV negativos. O botão de regras anteriormente removido não foi restaurado. |
| NPCs e reparo de contexto/ícones | Preservado o desenho nativo da ficha; não foi criado painel concorrente. |
| Painel Fixes, prévia, histórico e diagnóstico | Títulos dourados, campos alinhados, tabelas legíveis, rolagem interna e ações que quebram linha em telas estreitas. |
| Privacidade, fórmulas, sincronização, índices, filas e API | Sem interface própria a redesenhar. Configurações permanecem nos controles do Foundry. |

A decoração é limitada aos elementos do Fixes. Não há observador permanente, polling ou nova animação; ocorre nos eventos de renderização existentes. Não altera custo, duração, propriedade dos itens, destinatários ou autorização para rolar/aplicar.

## Validação

435 verificações funcionais simuladas passaram: interface/alvos 234, auditoria 104, regressão 18, duração 26 e regras 53. Os sete novos testes de apresentação verificam preservação de eventos e bloqueios, nomes e botões dos seis alvos, aprovar/recusar, concentração, chat nativo intacto cura já aplicada e texto restante do Haki. Sintaxe de 41 arquivos e 147 importações locais validadas.

Prévia visual renderizada com CSS nativo e o código de apresentação do módulo, conferida em 1280 e 320 pixels, sem transbordamento horizontal ou controles cortados. Exemplos usam conteúdo representativo, não capturas de uma mesa real. Animações foram desligadas apenas no ambiente da prévia para capturar o estado final das cores. Não houve teste desta atualização de design no Foundry real; os testes reais descritos na revisão 1.18.0 não são atribuídos à 1.19.0.

## Instalação

Os arquivos foram instalados no módulo local. Atualize as janelas do mestre e jogadores com F5. O manifesto pode mostrar a versão antiga até o próximo reinício normal do mundo.

Para outra mesa, substitua `Data/modules/oprpg-system-fixes` pela pasta de mesmo nome do ZIP. Não modifique o sistema OPRPG. Backup da versão anterior nesta área de trabalho: `work/backup-live-fixes-1.18.1`.
