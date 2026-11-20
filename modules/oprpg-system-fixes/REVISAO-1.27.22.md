# System Fixes 1.27.22 — foto maior e retrato proporcional à tela

- Em telas com pelo menos 1200 px de largura, a foto passa de 60×60 para **116×116 px** e o painel do personagem para **280×184 px**. O nome usa 16 px e os indicadores também ficam maiores. A área da foto é aproximadamente 3,7 vezes a anterior.
- Em janelas intermediárias, o painel mede 236×158 px e a foto 92×92 px. Em telas estreitas, mantém 144 px de largura com foto de 72×84 px e 150 px de altura. Em janelas baixas, adapta para 144 px de altura com foto de 80×80 px.
- Botões de ações permanecem retos em 60×48 px. O aumento fica concentrado na identificação do personagem; fonte da imagem, cores, clique para abrir ficha e demais controles nativos são preservados.
- Atalhos e painéis acompanham a altura efetiva do retrato, evitando o deslocamento fixo antigo. Efeitos, salvaguarda de morte, consulta de recursos e minimizar seguem funcionando. Não há migração ou alteração dos dados de atores.

## Verificação

27 testes Node, regressão Python do importador e Chromium com classes/templates reais do CORE tag 5.0.2 e documentos simulados. O navegador mede foto e painel em 1920×1080, 867×453 e 390×844, além das regressões existentes de atividades, fontes, foto sem transparência, controles, recursos, efeitos e teclado. Captura adicional: `hud-portrait-fullhd.png` nos artefatos da simulação.

Não foi executado em Foundry real. A captura de teste usa imagem substituta; a instalação continua lendo a imagem existente do personagem.

## Instalação e rollback

Manifesto permanente: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json.

Retorno: https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.21/oprpg-system-fixes.zip. Backup local: `.local-reference/backup-before-1.27.22.zip` e `.local-reference/rollback-before-1.27.22.bundle`, base `4f15071f9e88e4ba97e2b13a50e7576e130658bd`. Outros módulos e licenças preservados.
