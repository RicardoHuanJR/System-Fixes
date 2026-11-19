# System Fixes 1.27.17 — informações das atividades e atalhos

## Melhorias

- Cada atividade tem um botão de informação, separado da execução e dos favoritos. A tecla **I** na linha também abre os detalhes; F2 continua abrindo a ficha. Apenas um detalhamento fica aberto por painel.
- Exibe os rótulos que o próprio sistema preparou: ativação, alcance, alvos, área, duração/concentração, dano ou cura e recursos. Respeita `activationLabels` do ataque quando o alcance é herdado da arma e reconhece o array nativo de parcelas de dano, sem produzir `[object Object]`.
- Não chama rolagens, não calcula fórmulas e não escolhe a primeira atividade como fallback. Dados ausentes não são preenchidos com valores de outra atividade ou do item; a interface orienta a abrir a ficha quando não há detalhes preparados.
- A nova consulta exige propriedade ou permissão de observador. Respeita itens não identificados e a visibilidade de configuração das atividades para jogadores; o mestre mantém a consulta permitida. Valores são inseridos como texto, sem interpretar HTML.
- O retrato ganha atalhos **Favoritos — atividades** e **Armas — conjunto ativo**, conforme os documentos existentes. Favoritos de item abrangem suas atividades; cada atividade segue com seu ID próprio. Quando há apenas favoritos de perícias/ferramentas/efeitos, o atalho abre o painel lateral da ficha.
- O atalho de armas filtra pelo conjunto ativo quando ele contém armas. Um conjunto inicialmente vazio abre as armas disponíveis; o jogador pode configurar e filtrar os conjuntos no próprio painel. Abrir o atalho não equipa armas, não executa atividades e não gasta recursos.
- Os atalhos mostram a economia em cada resultado, pois podem reunir ações, bônus e reações. Mantêm busca, filtros, detalhes e foco durante atualizações completas. Atualizações parciais do retrato reaproveitam os painéis e não duplicam controles nem removem o foco do usuário.
- Os seis controles possíveis do retrato, incluindo Haki e os dois atalhos, cabem na largura de 144 px do retrato móvel. Os cinco botões principais e as dimensões fixas da barra não aumentaram.

## Verificação

Fontes: OP RPG 1.0.22 na distribuição oficial local, modelos de atividade `base-activity`, `attack-data`, `heal-data` e campos compartilhados de alcance/alvos/duração. Referência CORE permanece no commit `dc0ea6b7bfba4dff5defe1b757104db20ebf5f1a`. Bibliotecas de testes e execução nativa permanecem as mesmas.

**19 testes Node**, regressão Python do importador e suíte Chromium com classes/templates/CSS do CORE e documentos simulados. Casos novos: rótulos preparados e múltiplas parcelas, isolamento entre atividades, cura, campos ausentes, identificação, permissão de observador, consulta sem execução, atalhos com escolha exata da atividade, atualização parcial/completa sem duplicação, foco e controles do Haki no celular. Os cenários anteriores, incluindo a captura 867×453 e o conflito de `playerDetailsBottom`, continuam cobertos.

Na simulação de 60 itens/120 atividades, a barra continua em **524×122 px** no desktop. Os detalhes crescem somente dentro do painel contextual com rolagem. O detector Impeccable não encontrou problemas mecânicos nos arquivos visuais alterados. O workflow exige aprovação do job de navegador antes da publicação.

**Não houve teste em Foundry real.** A nova consulta depende dos rótulos preparados pelo sistema instalado; campos ausentes ou indisponíveis não são reconstruídos pelo HUD. Ícones e fontes da simulação são substitutos. A validação em mesa, revisão de condições complexas de ações básicas, indicadores adicionais de escudo/PP gerados e rastreamento de ações restantes continuam pendentes; não foi inventado um contador de ações.

## Instalação e rollback

Manifesto permanente: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json

Ativar Fixes + CORE 5.x e manter o adaptador antigo desativado. Não há migração de fichas, alteração automática de equipamento ou cópia de recursos. Fazer backup do mundo e da pasta do módulo antes da atualização e recarregar os clientes.

Para reverter, parar o mundo e restaurar a pasta anterior ou instalar https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.16/oprpg-system-fixes.zip. O workspace mantém `.local-reference/backup-before-1.27.17.zip` e `.local-reference/rollback-before-1.27.17.bundle`, base `d939d7c738a9ff1c724950cdc4a6c7fd6c6d3998`. Outros módulos, licenças e fontes oficiais locais permanecem preservados; os arquivos locais ignorados não entram na distribuição.
