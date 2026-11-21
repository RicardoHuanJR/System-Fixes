# System Fixes 1.27.24 — HUD harmonizado e compacto

- Retrato, ações e listas compartilham superfícies em ameixa escura, texto marfim e detalhes de latão e orquídea. Cabeçalhos e botões deixam de formar blocos claros separados. Estados de foco, seleção e pressão continuam distinguíveis.
- PV, PP e defesa ficam ao lado da foto, abaixo do nome, sem caixas individuais. Atributos formam uma faixa contínua com divisões discretas. Ícones, fontes, imagem integral do ator e botões retos são preservados.
- Com seis atributos, o retrato mede 280×202 px em telas grandes (20 px mais baixo), 236×186 px em janelas intermediárias e 144×212 px em telas estreitas. A foto continua em 116×116 / 92×92 / 72×84 px; em janela baixa, 80×80 px. Atalhos e listas seguem a altura efetiva.
- Ao restaurar foco ou usar setas no painel de testes, o controle fica inteiramente visível no painel com rolagem, inclusive em janelas baixas. A rolagem se limita ao painel.
- Sem mudanças de regras, recursos ou dados de atores. Outros módulos e licenças preservados.

## Verificação

27 testes Node, regressão Python do importador e Chromium com classes/templates reais do CORE 5.0.2 e documentos simulados. Mede foto, painel e ícones em 1920×1080, 867×453 e 390×844. Verifica ausência de sobreposição entre nome, indicadores, foto, atributos e atalhos; foco restaurado inteiramente visível; execução nativa, permissões, macros, fotos e troca de ator. Medição local de contraste em 86 textos/estados teve mínimo de 5,15:1.

Não foi executado em Foundry real. As capturas usam imagens e dados substitutos; a instalação mantém a foto da ficha.

## Instalação e rollback

Manifesto permanente: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json.

Retorno: https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.23/oprpg-system-fixes.zip. Backups locais: .local-reference/backup-before-1.27.24.zip e .local-reference/rollback-before-1.27.24.bundle. Base: f4c04f77041a64eb8eda73799c5f4dee98b06be3.
