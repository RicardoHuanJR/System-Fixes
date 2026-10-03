# Fixes 1.10.2 — exclusão na aba Fruta

A conexão direta da 1.10.1 tratava os botões de criação, mas deixava a lixeira dependente do despacho nativo da ficha. A 1.10.2 inclui `akuma-delete-tecnica` na conexão da ficha efetivamente aberta, incluindo o clique no ícone interno e abas recriadas.

O fluxo confirma o nome do item, verifica a permissão e exclui somente uma técnica ou manifestação pertencente ao ator. Cancelar preserva o item. Cliques concorrentes não abrem confirmações repetidas. Após a exclusão, remove as entradas de manutenção dessa técnica e solicita a atualização da ficha. Itens alheios e a manutenção de outras técnicas são preservados.

Se outro módulo ou o sistema vetar a exclusão, o reparo detecta que o item continua na ficha e mostra um erro; não limpa sua manutenção nem informa sucesso indevido.

**170 casos simulados aprovados:** 49 de Fruta/treinamento/interface (nove novos de exclusão), 78 de auditoria, 18 de regressão e 25 de duração. Os nove casos novos cobrem clique na lixeira, manifestação, cancelamento, repetição/recriação de HTML, permissão, item alheio, limpeza de manutenção, veto e ficha de outra classe. O navegador usa DOM real, com documentos e persistência do Foundry simulados. Não houve teste no mundo real do usuário.

Substitua `Data/modules/oprpg-system-fixes`, reinicie o Foundry, atualize o navegador com Ctrl+F5 e reabra a ficha. Confirme **1.10.2**. A lixeira da técnica/manifestação deve abrir a confirmação de exclusão.

Os demais comportamentos e limitações das versões anteriores são mantidos. Os resultados atuais estão em `tests/*-1.10.2.json`; a suíte de interface pode ser repetida com `node tests/features.cjs CAMINHO_DO_MODULO`, usando Node.js, Playwright e Microsoft Edge.
