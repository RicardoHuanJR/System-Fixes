# System Fixes 1.27.18 — ações básicas e recursos

- Esquivar testa os modos de visão do próprio defensor pela API V14 `DetectionMode.testVisibility`. Não usa a visão global do mestre, audição ou percepção de outros tokens. Exige um atacante identificável; alvos mistos e visão indisponível ficam para ajuste no diálogo nativo.
- Estados desativados, suprimidos, expirados ou de outro combate não concedem benefícios. Preparar fora do turno mantém a referência ao combate e expira na próxima vez do personagem. Incapacitação remove somente os estados de ações básicas deste módulo; deslocamento zero encerra Esquivar. Disparada ignora outro ator selecionado no HUD e permite renovar efeitos inválidos.
- Preparar lista atividades individuais disponíveis. Técnicas mantidas recebem o status nativo de concentração; atividades normalmente concentradas usam `beginConcentrating`. Não encerra concentrações alheias para abrir vaga. A perda do efeito torna o card antigo inutilizável. Ao executar uma atividade normalmente concentrada, preserva a concentração e restaura sua duração nativa, vinculando o card à concentração existente.
- Executar confirma gatilho e disponibilidade de Reação. O sistema não fornece um contador universal confiável de Reação; a confirmação não cria um contador. PP e demais recursos são consumidos apenas pela execução nativa, uma vez. Cancelar o diálogo não consome nem descarta a preparação. A configuração nativa de desabilitar concentração é respeitada.
- Retrato mantém 122 px de altura e acrescenta uma linha expansível: PP gerado, escudo atual/máximo e estados ativos de Antevisão, Perceber Presença, Corpo Armadurado, Endurecimento Defensivo e Power Up. Intangibilidade consulta o diagnóstico já existente do Fixes. Campos ausentes são omitidos; não há edição, rolagem nem gasto. Valores completos por teclado/clique; Escape fecha. Abrir recursos fecha a ficha de atalhos para evitar sobreposição.

## Verificação e limites

24 testes Node, regressão Python do importador, Chromium com classes/templates reais do CORE tag 5.0.2 e documentos simulados, incluindo 867×453 e 390×844. Verifica cancelamento, supressão, concentração, visão, alvos mistos, IDs individuais, dados ausentes e altura do retrato. Build verifica sintaxe JavaScript e integridade de ZIPs. Não foi executado em uma sessão real de Foundry; iluminação, extensões de visão e regras de concentração precisam de conferência em jogo. Fonte OP RPG local: 1.0.22.

API de visão: https://foundryvtt.com/api/v14/classes/foundry.canvas.perception.DetectionMode.html e https://foundryvtt.com/api/v14/interfaces/foundry.types.CanvasVisibilityTest.html.

## Instalação e rollback

Manifesto permanente: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json.

Não há migração de dados. Para reverter, reinstale https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.17/oprpg-system-fixes.zip. Backup local: `.local-reference/backup-before-1.27.18.zip` e `.local-reference/rollback-before-1.27.18.bundle`, base `43d688754515b012ab85fd6ba97ab0e8051a810f`. Outros módulos e licenças preservados; fontes oficiais ignoradas não são distribuídas.
