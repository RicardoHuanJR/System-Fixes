# HUD Argon OPRPG

Interface de operação: a cena permanece prioritária. Preserva as categorias e cores de economia do CORE, sem nova identidade ilustrada.

Fonte visual: classes/templates do CORE no tag 5.0.2; verificação Chromium simulada documentada em REVISAO-1.27.15.md. Ícones substitutos e dados fictícios do teste não são arte de produção.

| Elemento | Valor implementado |
|---|---|
| Botão inferior | 64×56 px; ícone 25 px; um botão por economia, até cinco |
| Retrato | 180×122 px; 144 px de largura em tela estreita |
| Lista contextual | até 480 px de largura e 520 px de altura; rolagem e limite pela viewport |
| Linha de atividade | mínimo 52 px; nome 13 px com quebra; informação secundária 11 px |
| Superfície contextual | #14181e com opacidade; texto #f2f4f7 |
| Foco | 2 px #e8c66a |
| Layout estreito | os cinco botões quebram em linhas; painel reposicionado para permanecer na viewport |

Nome completo disponível em título/ARIA. Enter/Espaço executam; setas percorrem resultados; Escape fecha; F2 ou botão direito abre o item. Filtros de categorias e favoritos vivem dentro dos painéis, com armações ocultas em um disclosure de conjuntos. Favoritar é um controle independente, fora do botão de execução. Fórmulas de PP são variáveis, jamais avaliadas só para desenhar. Redução de movimento remove transições.

Comparação da simulação com 60 itens e 120 atividades: barra passou de 924×166 px para 524×122 px em 1440×900; em 390×844, a área de ações mede 206×116 px, sem movimento. No combate o indicador compacto informa distância restante/máxima em unidades do ator e ocupa uma linha abaixo das ações.

O CSS só atua sob `.extended-combat-hud.argon-oprpg`. O retrato adiciona essa classe apenas quando o adaptador interno está registrado. Dimensões CSS prevalecem sobre os cartões grandes do CORE; o estado minimizar nativo permanece.

Mesmo com `playerDetailsBottom` ativo no CORE, o retrato compacto mantém os detalhes no topo, ordem normal e padding de 6 px, sem máscara; essa configuração foi coberta em 867×453 px na regressão 1.27.16.
