# HUD Argon OPRPG

Interface de operação: a cena permanece prioritária. Preserva as categorias e cores de economia do CORE, sem nova identidade ilustrada.

Fonte visual: classes/templates do CORE no tag 5.0.2; verificação Chromium simulada documentada em REVISAO-1.27.14.md. Ícones substitutos e dados fictícios do teste não são arte de produção.

| Elemento | Valor implementado |
|---|---|
| Categoria inferior | 46×46 px; ícone 26 px; grupo em até 3 colunas |
| Retrato | 180×122 px; 144 px de largura em tela estreita |
| Lista contextual | até 480 px de largura e 420 px de altura; rolagem interna |
| Linha de atividade | 48 px; nome 12 px; informação secundária 11 px |
| Superfície contextual | #14181e com opacidade; texto #f2f4f7 |
| Foco | 2 px #e8c66a |
| Layout estreito | barra limitada a 174 px com rolagem; painel contextual fora dessa rolagem |

Nome completo disponível em título/ARIA quando o rótulo compacto é truncado. Enter/Espaço executam; Escape fecha; F2 ou botão direito abre o item. Fórmulas de PP são variáveis, jamais avaliadas só para desenhar. Redução de movimento remove transições.

O CSS só atua sob `.extended-combat-hud.argon-oprpg`. O retrato adiciona essa classe apenas quando o adaptador interno está registrado. Dimensões CSS prevalecem sobre os cartões grandes do CORE; o estado minimizar nativo permanece.
