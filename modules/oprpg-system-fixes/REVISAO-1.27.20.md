# System Fixes 1.27.20 — Orquídea Negra no módulo instalável

O visual aprovado da prévia agora é carregado pela integração Argon do módulo. Instalar somente System Fixes e Argon CORE 5.x; manter o adaptador antigo separado desativado.

- Cinco botões retos de 60×48 px, com texto sem itálico e ícones alinhados. Barra simulada de 504×122 px; retrato mantém sua altura compacta.
- Tema marfim, preto ameixa, rosa-orquídea e dourado. O título dos painéis usa o emblema original; as imagens de referência não são incluídas.
- 22 SVGs próprios e emblema incluídos no módulo. As economias, ações básicas, favoritos, detalhes e atalhos do retrato usam o conjunto. Fotos cadastradas nas atividades e itens têm prioridade sobre os ícones de categoria; nenhuma imagem demonstrativa ou ficha da prévia é importada para o mundo.
- Fontes Roboto Condensed distribuídas com a licença SIL original. O CSS é limitado a `.extended-combat-hud.argon-oprpg`; os outros módulos e interfaces não recebem o tema.
- Permanecem as atividades individuais, economia nativa, permissões, identificação, busca, favoritos, conjuntos de armas, efeitos, Haki, movimentação, foco, minimizar e controles de NPCs. O tema não consome recursos, não escreve fichas nem modifica regras.

## Verificação

27 testes Node, regressão Python do importador e Chromium com classes/templates reais do CORE tag 5.0.2 e documentos simulados. Cobertura inclui botões retos, tamanho, alinhamento dos ícones, fontes, fallback de imagens, execução exata, cancelamento, concorrência, permissões, busca, favoritos, conjuntos, fotos, detalhes, Haki, retrato e telas pequenas. A espera de montagem do teste usa a presença efetiva dos cinco controles do CORE.

Não houve teste em Foundry real. O comportamento visual ainda deve ser conferido em uma cópia do mundo, principalmente com configurações e temas de terceiros. A prévia HTML continua sendo uma simulação independente.

## Instalação e rollback

Manifesto permanente preservado: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json.

Sem migração de dados. Retorno: https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.19/oprpg-system-fixes.zip. Backup local: `.local-reference/backup-before-1.27.20.zip` e `.local-reference/rollback-before-1.27.20.bundle`, base `5c76708b33eeb3614527fd05a329083b3865e554`. Outros módulos e licenças preservados.
