# HUD Argon OPRPG

Interface de operação: a cena permanece prioritária. Orquídea Negra usa marfim, preto ameixa e rosa-orquídea. Preserva a organização e a execução do CORE; os ícones e o emblema são próprios.

Fonte visual: classes/templates do CORE no tag 5.0.2; verificação Chromium simulada documentada em REVISAO-1.27.15.md. Ícones substitutos e dados fictícios do teste não são arte de produção.

| Elemento | Valor implementado |
|---|---|
| Botão inferior | 60×48 px; ícone 20 px; um botão por economia, até cinco |
| Retrato | 180×122 px; 144 px de largura em tela estreita |
| Lista contextual | até 380 px de largura e 440 px de altura; rolagem e limite pela viewport |
| Linha de atividade | mínimo 44 px; nome 12 px com quebra; informação secundária 11 px |
| Superfície contextual | #14181e com opacidade; texto #f2f4f7 |
| Foco | 2 px #e8c66a |
| Layout estreito | os cinco botões quebram em linhas; painel reposicionado para permanecer na viewport |

Nome completo disponível em título/ARIA. Enter/Espaço executam; setas percorrem resultados; Escape fecha; F2 ou botão direito abre o item. Filtros de categorias e favoritos vivem dentro dos painéis, com armações ocultas em um disclosure de conjuntos. Favoritar é um controle independente, fora do botão de execução. Fórmulas de PP são variáveis, jamais avaliadas só para desenhar. Redução de movimento remove transições.

Comparação da simulação com 60 itens e 120 atividades: barra passou de 924×166 px para 524×122 px em 1440×900; em 390×844, a área de ações mede 206×116 px, sem movimento. No combate o indicador compacto informa distância restante/máxima em unidades do ator e ocupa uma linha abaixo das ações.

O CSS só atua sob `.extended-combat-hud.argon-oprpg`. O retrato adiciona essa classe apenas quando o adaptador interno está registrado. Dimensões CSS prevalecem sobre os cartões grandes do CORE; o estado minimizar nativo permanece.

Mesmo com `playerDetailsBottom` ativo no CORE, o retrato compacto mantém os detalhes no topo, ordem normal e padding de 6 px, sem máscara; essa configuração foi coberta em 867×453 px na regressão 1.27.16.

Na 1.27.17, o controle de informações abre um `dl` dentro da linha contextual, separado dos botões de executar e favoritar; nomes e valores quebram quando necessário. Consulta por clique ou I e leitura de rótulos preparados, sem rolar dados. O detalhe aberto e o foco são preservados por ator/painel. Os atalhos do retrato reutilizam a mesma lista: favoritos e conjunto de armas, com economia visível em cada atividade. A barra principal continua com cinco botões e o retrato mantém 122 px de altura. Em celular, os controles do retrato medem 24 px de largura para acomodar seis controles, incluindo Haki.

Na 1.27.18, o retrato inclui uma linha de recursos expansível, sem aumentar sua altura: resumo de PP gerado/escudo e estados ativos; lista completa por clique/teclado, Escape para fechar. O detalhamento se abre acima do retrato e fecha a ficha de atalhos; efeitos nativos ficam em uma coluna lateral quando há recursos. Não há campos editáveis.

Na 1.27.19, as linhas usam imagem explícita de 32 px, nome em até duas linhas e custo/alcance em uma linha secundária com texto completo no título. Imagem própria da atividade precede a foto do item; ícone genérico preparado não apaga a foto do item. Ficha e atalhos usam miniaturas de 24 px nos documentos que possuem imagem. Cores de economia ficam nos lançadores; listas usam superfície neutra. A barra fechada mede 484×122 px na simulação; em 390 px, as ações ocupam 206×100 px. Telas baixas reservam espaço para retrato e atalhos.

Na 1.27.20, a proposta Orquídea Negra passa ao módulo: tema isolado em argon-orchid.css, SVGs em assets/argon e marcação segura em icons.js. Botões retos com rótulos sem itálico, borda fina e fonte Roboto Condensed com licença preservada. Títulos dos painéis mantêm a assinatura visual; fotos de atividades/itens continuam nativas. Capturas anteriores à integração são históricas.

Na 1.27.21, o retrato abandona a foto de fundo: botão de imagem real 60×60 px (52×60 em celular), nome em duas linhas sem itálico e faixa independente de PV/PP/defesa. Efeitos nativos são mantidos em coluna lateral. A altura permanece em 122 px, e a consulta de recursos se abre acima dos atalhos. Os títulos e as demais superfícies conservam Orquídea Negra.

A 1.27.22 substitui o limite fixo de 122 px do retrato: telas largas (≥1200 px) usam painel de 280×184 px e foto de 116×116 px; janelas médias, 236×158 e 92×92; telas estreitas, 144×150 e 72×84. Em altura ≤540 px, o retrato tem 144 px e foto de 80×80. As ações mantêm 60×48 px. Atalhos e consulta acompanham as variáveis de altura do retrato.

Na 1.27.23, a foto usa contain centralizado: a imagem inteira cabe na moldura preservando a proporção. A faixa de atalhos tem 36 px em telas grandes e 32 px nas demais, com ícones de 22/20/18 px e botões de 40/34/24 px. O painel sobe para 192/166/154 px e 148 px em janelas baixas para preservar a separação dos indicadores. Minimizado mantém faixa de 28 px e ícones de 18 px.

Ainda na 1.27.23, a consulta PPg é substituída por atributos reais: seis colunas nas janelas usuais, três em telas estreitas, abreviação e modificador em duas linhas sem cortes. A faixa reserva 30 px (60 px em celular); o painel com seis atributos mede 280×222 / 236×196 / 144×214 px, ou 178 px em janela baixa. A abertura permanente Ficha e atalhos é removida. Drawer contextual usa linhas do CORE, teste e salvaguarda nativos e perícias associadas na ficha; macros, ferramentas e demais atalhos passam ao botão de ficha. Foto abre a ficha completa. Escape e fechar devolvem foco; seleção/foco persistem em atualização. Não há campos de recurso editáveis ou geração de PP.

Na 1.27.24, o acabamento usa uma paleta comum de superfícies (#19151d, #251e29, #332735), marfim (#f0e5d3), latão (#a58c67) e orquídea (#d4a4c0). Cabeçalhos e lançadores passam à mesma base escura. Indicadores de PV/PP/defesa ficam numa coluna junto do nome; atributos formam uma faixa contínua. Dimensões atuais com seis atributos: 280×202 / 236×186 / 144×212 px. Foto, atalhos ampliados e execução nativa permanecem. Títulos contextuais usam 16 px sem caixa alta forçada. Valores e rótulos do retrato não usam sombra de texto. Navegação por teclado garante que a linha focada caiba na área visível do painel, sem rolar a página.

Na 1.27.25, listas de atividades usam posição fixa ancorada no botão acionado: 8 px acima, alinhamento esquerdo ao botão e ajuste pelos limites laterais da viewport. Se a largura disponível causaria sobreposição do retrato, a lista abre acima do conjunto. Máximo de 380 px de altura, limitado ao espaço acima da âncora. Um ResizeObserver compartilhado acompanha o HUD e a área de ações, substituindo as referências observadas quando o CORE recria a barra. Busca, filtros, foco e fotos permanecem. Atalhos do retrato mantêm a abertura acima da identidade.
