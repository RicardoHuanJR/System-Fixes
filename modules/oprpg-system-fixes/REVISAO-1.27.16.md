# System Fixes 1.27.16 — regressão da captura de tela

A captura fornecida pelo usuário era anterior à 1.27.15. A coluna alta de movimento e as categorias espaçadas já tinham sido substituídas pela linha de movimento e pelos cinco botões compactos.

A revisão encontrou uma falha ainda presente na 1.27.15: com o setting CORE `playerDetailsBottom` ativado, o seletor nativo `.player-details-bottom` prevalecia sobre o estilo compacto. O retrato ficava com padding inferior de **56 px**, ordem invertida e máscara de gradiente. Isso podia sobrepor nome/nível aos atributos. A correção mantém detalhes no topo, ordem normal, padding de 6 px e sem máscara, sob o escopo da integração interna.

## Evidência

- Teste Chromium reproduzido em **867×453 px**, com valores simulados baseados nos que são visíveis na captura: nome Azaleia D. Blossom, nível 6, PV 48/48, PP 24/24 e defesa 17. As unidades reais do movimento não foram deduzidas da imagem.
- O teste falhou na 1.27.15 com `56px !== 6px` e passou após a correção. Confere ainda ordem, máscara e ausência de sobreposição entre detalhes e atributos.
- Regressões confirmam movimento em faixa de no máximo 22 px abaixo das ações, sem caixas azuis, e cabeçalhos antigos de economia ocultos. Os testes anteriores de atividades, favoritos, conjuntos, permissões e viewports continuam executando.
- **15 testes Node**, regressão Python, build de ZIPs e suíte Chromium. O workflow exige o navegador antes da publicação, como na 1.27.15.

Não houve teste em Foundry real. O navegador usa classes/templates/CSS do checkout CORE de referência e documentos simulados; fontes e ícones são substitutos. Esta versão só altera o CSS do retrato e a cobertura de regressão, sem mudanças em consumo, efeitos, atividades, atores, itens ou outros módulos.

## Instalação e rollback

Manifesto permanente preservado: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json

Ativar Fixes + CORE 5.x; manter o adaptador separado desativado. Fazer backup do mundo e da pasta do módulo antes de atualizar e recarregar os clientes após a atualização.

Para reverter, parar o mundo e restaurar a pasta anterior ou instalar https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.15/oprpg-system-fixes.zip. Não há migração de dados. O workspace preserva ZIP e bundle Git do commit-base `5d18eeaf448c8fbe283e07f0db439d5ee265ea78` em `.local-reference/backup-before-1.27.16.zip` e `.local-reference/rollback-before-1.27.16.bundle`, fora da distribuição.
