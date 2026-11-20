# System Fixes 1.27.19 — HUD compacto com imagens

- Cinco abas de economia, favoritos e armas usam a mesma linha compacta com miniatura de 32 px, nome, custo e alcance preparado pelo sistema. Foto explicitamente cadastrada na atividade tem prioridade; quando ela só herda um ícone genérico do sistema, aparece a foto do item. Arquivo indisponível recebe fallback, sem ocultar o nome ou impedir execução.
- Imagens são elementos próprios, sem depender exclusivamente do fundo do botão. Técnicas, armas, reações e demais atividades preservam seus IDs e chamadas nativas. Ficha e atalhos também mostram as imagens existentes de favoritos, efeitos, itens passivos e macros.
- Lançadores de 56×48 px, painéis de até 380 px, linhas de no mínimo 44 px e filtros menores. Custo e alcance ficam visíveis; informações completas continuam no botão de detalhes. Superfícies das listas são neutras; cores de economia permanecem na barra. Telas baixas reservam espaço para os atalhos do retrato.
- Corrige o falso aviso do CORE solicitando `enhancedcombathud-oprpg-system`: sua verificação de pacote ocorre antes de `argonInit`. A compatibilidade usa `CONFIG.ARGON.CORE.CoreHud`, adia apenas essa verificação até confirmar o registro interno e mantém o comportamento original se o adaptador estiver desabilitado ou falhar. Não cria módulo fictício, não ativa o adaptador antigo nem filtra mensagens do console.

## Verificação e limites

26 testes Node, regressão Python do importador e Chromium com classes/templates reais do CORE tag 5.0.2 e documentos simulados. Verifica fotos e fallback nas cinco economias, custo/alcance, execução exata, teclado, foco, favoritos, armas, retrato com 122 px e painéis sem sobreposição em 867×453 e 390×844. Imagens dos testes são desenhos substitutos, não fotos reais da campanha. Barra simulada: de 524×122 para 484×122 px; área de ações móvel: de 206×116 para 206×100 px.

Não houve teste em sessão real de Foundry. O registro antecipado e o aviso foram reproduzidos em teste automatizado; confirme após recarregar o mundo. Fonte local OP RPG 1.0.22. Somente o módulo integrado e sua documentação/testes foram alterados, mantendo licenças e execução nativa dos recursos.

## Instalação e retorno

Manifesto permanente preservado: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json.

Sem migração de dados. Para retornar, reinstale https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.18/oprpg-system-fixes.zip. Backup local: `.local-reference/backup-before-1.27.19.zip` e `.local-reference/rollback-before-1.27.19.bundle`, base `60bc8023879191f83610dd69b168164d1625baae`. Não ative o adaptador antigo junto com a integração interna.
