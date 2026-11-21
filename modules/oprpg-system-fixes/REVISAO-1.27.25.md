# System Fixes 1.27.25 — painéis acima dos botões

- Ação, Poderosa, Ação bônus, Reação e Livre/outras abrem a lista logo acima do botão acionado, com 8 px de separação e alinhamento à sua esquerda quando há espaço. O painel fica ao lado do retrato, aproveitando a cena como no arranjo Argon solicitado.
- Limites laterais mantêm o painel dentro da tela. Quando ele precisaria sobrepor o retrato, abre acima do conjunto inteiro. Favoritos e armas da faixa do personagem continuam abrindo acima do retrato.
- Altura máxima de 380 px, limitada ao espaço disponível acima do botão. O painel acompanha redimensionamento, quebra de linha dos botões e atualização do HUD. Um observador compartilhado acompanha a área de ações, sem criar um observador por atividade.
- Busca, filtros, posição de foco, atividades individuais, fotos, recursos, execução nativa e atalhos são preservados. Não altera dados dos atores ou outros módulos.

## Verificação

27 testes Node, regressão Python do importador e Chromium com classes/templates reais do CORE 5.0.2 e documentos simulados. Verifica alinhamento e separação em relação ao botão, disposição lateral nas cinco economias, preservação após atualizar o HUD, redimensionamento com painel aberto e limites da tela. Confere a alternativa acima do retrato em telas estreitas, inclusive 320 px de largura e janela de 360 px de altura.

Não foi executado em Foundry real. Capturas atuais: hud-open.png, hud-images-actions.png, hud-images-reactions.png e hud-mobile-open.png nos artefatos da simulação.

## Instalação e rollback

Manifesto permanente: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json.

Retorno: https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.24/oprpg-system-fixes.zip. Backups locais: .local-reference/backup-before-1.27.25.zip e .local-reference/rollback-before-1.27.25.bundle. Base: 4e04ca8ebc2cc2ee6ff0912f63923758c1cadd48.
