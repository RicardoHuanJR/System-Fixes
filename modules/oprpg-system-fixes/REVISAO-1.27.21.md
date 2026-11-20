# System Fixes 1.27.21 — retrato claro e identificação do personagem

- A foto deixa de ser um fundo escurecido atrás do texto. Agora é uma imagem própria, em cores e sem filtro/transparência, com 60×60 px no computador e 52×60 px em telas estreitas. Usa a imagem real do ator fornecida pelo CORE; não importa imagens demonstrativas.
- Nome ao lado da foto, em até duas linhas, sem itálico nem caixa alta forçada. Nome completo no título e no nome acessível. Nível e recursos ficam na mesma coluna; a foto abre a ficha por clique ou teclado.
- PV, PP e defesa ficam em uma faixa própria abaixo da identidade, seguida dos atalhos existentes. O retrato mantém 122 px de altura. Remove a camada escura nativa que incidia sobre a nova faixa de estatísticas.
- Efeitos temporários mantêm seus elementos e controles nativos, em uma coluna lateral que não cobre foto nem nome. O painel de recursos abre acima do cabeçalho dos atalhos. Minimizar e salvaguarda de morte são preservados; imagem indisponível recebe um ícone local de fallback.
- Nenhuma migração de dados, alteração de ator ou mudança nas regras/consumo de recursos. Outros módulos e licenças preservados.

## Verificação e limites

27 testes Node, regressão Python do importador e Chromium com classes/templates reais do CORE tag 5.0.2 e documentos simulados. O navegador verifica foto com opacidade 1 e sem filtro, origem da imagem, separação entre foto/nome/estatísticas, nome acessível completo, clique e Enter para abrir ficha, fallback, efeitos temporários, minimizar e execução nativa da salvaguarda de morte. Regressões mantidas para `playerDetailsBottom`, busca, atividades, favoritos, armas, recursos e telas 867×453 e 390×844.

Não foi executado em uma sessão real do Foundry. As capturas de teste usam uma imagem substituta identificada como simulação; a instalação utiliza a foto existente na ficha.

## Instalação e rollback

Manifesto permanente: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json.

Retorno à versão anterior: https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.20/oprpg-system-fixes.zip. Backup local: `.local-reference/backup-before-1.27.21.zip` e `.local-reference/rollback-before-1.27.21.bundle`, base `a285ba6256d8c74b0a23ec0d6243b3cfdc0aaaf6`.
