# System Fixes 1.27.26 — cabeçalho compacto e atalhos estáveis

Primeira etapa do plano de usabilidade aprovado: ganhar espaço dentro das listas e estabilizar os atalhos do personagem.

- Título, busca e fechar compartilham uma faixa. Em larguras menores que 360 px, a busca fica abaixo do título para continuar legível. O painel mantém 380 px de altura máxima e a abertura acima do botão acionado.
- Na simulação em 1440×900, com 28 atividades na categoria Ação, a área da lista sobe de 209 para 248 px: cinco atividades completas visíveis, antes quatro. É uma medição desse cenário, não uma promessa para todo nome, filtro ou tamanho de tela.
- Custo e alcance passam de 11 para 12 px. Nomes continuam em 13 px e imagens em 32 px, com atividades individuais e execução nativa preservadas.
- Iniciativa, atalhos da ficha, recolher, favoritos, armas e Haki possuem seis posições fixas. Atalhos sem função disponível não criam botões nem alvos de teclado. Aparecer ou desaparecer um favorito ou Haki não desloca os demais controles.
- Iniciativa e recolher/expandir usam rótulos em português. Ações nativas, tamanho ampliado dos ícones, foto inteira, recursos e dados dos atores são preservados. Outros módulos e licenças não são alterados.

## Verificação

27 testes Node, regressão Python do importador e Chromium com classes/templates reais do CORE 5.0.2 e documentos simulados. O navegador mede área útil e quantidade de atividades completas, conserva busca/filtro/foco após atualizar, adiciona e remove favorito e Haki conferindo posições, verifica os seis atalhos dentro do retrato com pelo menos 24 px de largura em celular e o cabeçalho em 320 px. As regressões de permissões, execução, fotos, múltiplas atividades, teclado, macros e posição dos painéis continuam passando.

Não foi executado em Foundry real. Captura adicional: hud-compact-header.png nos artefatos da simulação.

## Instalação e rollback

Manifesto permanente: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json.

Retorno: https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.25/oprpg-system-fixes.zip. Backups locais: .local-reference/backup-before-1.27.26.zip e .local-reference/rollback-before-1.27.26.bundle. Base: 1f4ca3dcfee129bc6d0a808b0c4b9b4187cea22b.
