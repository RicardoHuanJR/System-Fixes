# System Fixes 1.19.1 — ativáveis do Haki legíveis

Correção de CSS no HUD de Haki e nos ativáveis da ficha. Nomes mais claros, bordas visíveis, indicação textual Ativo/Desativado no HUD e destaque dourado quando ativo. Habilidades sem usos conservam o texto legível e recebem borda tracejada e a indicação Sem usos. Os interruptores ficaram maiores. Foram preservados os eventos, custos, estados, permissões e bloqueios nativos.

Teste visual com CSS nativo mais o CSS desta revisão, em navegador local nas larguras 1024 e 320 pixels: sem transbordamento, contraste mínimo 11:1 nos nomes do HUD, controles disponíveis clicáveis e controles disabled bloqueados. Os exemplos da prévia são representativos; não houve teste desta revisão numa mesa Foundry real. A indicação textual do HUD é gerada pelo CSS a partir dos estados nativos existentes.

As demais funcionalidades e correções da 1.19.0 estão incluídas. Relatórios de testes estão em `tests/*-1.19.1.json`.

Instalação: substitua `Data/modules/oprpg-system-fixes` pela pasta de mesmo nome dentro do ZIP e atualize as janelas com F5. Backup local da versão anterior: `work/backup-live-fixes-1.19.0`.
