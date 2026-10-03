# System Fixes 1.19.2

Corrige os avisos de Haki no chat mostrados na captura do usuário: a frase não é mais dividida em parágrafos por cada trecho de texto, e nomes em negrito como Antevisão recebem a cor dourada do sistema. Só o primeiro título vira cabeçalho; renderizações repetidas não promovem outro negrito a um novo título.

O corpo das solicitações e avisos passa a usar o componente nativo jj-description. Botões, nomes dos alvos, texto, eventos e estados são preservados. As melhorias dos ativáveis do HUD/ficha da 1.19.1 estão incluídas.

Teste específico reproduziu os avisos de ativação e encerramento com um estilo genérico de chat que torna negritos pretos: após duas renderizações, os títulos continuam únicos, o texto permanece contínuo e Antevisão está dourado. Prévia em navegador local, sem teste nesta revisão em uma mesa Foundry real. 436 verificações funcionais simuladas passaram, incluindo o teste de regressão da frase da captura.

Atualize as janelas com F5 após instalar. Cards antigos recebem a correção ao serem renderizados a partir do conteúdo original. Para outra instalação, substitua a pasta Data/modules/oprpg-system-fixes pela pasta de mesmo nome no ZIP. Backup local: work/backup-live-fixes-1.19.1.
