# System Fixes 1.18.1

Nas técnicas de salvaguarda, “Rolar dano da técnica” só aparece depois de uma salvaguarda concluída desse card e dessa atividade. Uma solicitação pendente, rolagem cancelada ou salvaguarda de outro card não libera o botão. O método de rolar dano também bloqueia a operação antes dessa etapa.

Quando outro jogador conclui a salvaguarda, o botão é liberado no card do autor pela chegada do resultado, sem precisar recarregar. Um sucesso ou uma falha libera o dano. Em ataques com vários alvos, basta a primeira salvaguarda concluída; o dano é comum à técnica e as demais salvaguardas continuam disponíveis. Ao recarregar, a liberação é reconstruída dos resultados registrados.

Cards antigos sem resultado registrado perdem o botão ao serem renderizados. Danos já rolados continuam registrados. As correções da versão 1.18.0 estão incluídas.

Testes desta revisão: 227 verificações de interface/alvos, 104 de auditoria, 18 de regressão, 26 de duração e 53 de regras, todas simuladas, total 428. Sete novos casos cobrem bloqueio antes da salvaguarda, solicitação pendente, card/atividade diferentes, cancelamento, chegada de resultado de outro cliente, recriação do card e limpeza do botão antigo. Não houve teste desta mudança em uma sessão Foundry real.

A correção foi instalada na pasta local do módulo. Atualize com F5 as janelas do mestre e jogadores. Para outra instalação, substitua `Data/modules/oprpg-system-fixes` pela pasta de mesmo nome dentro do ZIP.

Cópia de segurança anterior: `work/backup-live-fixes-1.18.0` nesta área de trabalho.
