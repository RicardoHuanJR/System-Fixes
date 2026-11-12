# System Fixes 1.27.14 — Argon compacto

## Mudanças

- Barra inferior com retrato de 180×122 px e categorias de 46×46 px; o autoscale do CORE, dimensionado para cartões grandes, não reduz esses controles novamente. Em telas estreitas a barra tem rolagem. O minimizar nativo continua disponível.
- Hierarquia por ação, poderosa, bônus, reação e livre/outras. Cada atividade conserva itemId/activityId, inclusive técnicas de múltiplas atividades. Armas, técnicas, Akuma, habilidades e itens aparecem conforme os documentos da ficha.
- Painéis contextuais exclusivos com busca, teclado Enter/Espaço, Escape para fechar e F2 para abrir a ficha da atividade. Botão direito também abre o item.
- PP corrigidos para `system.energy.total/max`; PV temporários e defesa. Custos com fórmulas/scaling ficam explicitamente variáveis. O executor não subtrai recursos nem aplica dano ou efeitos manualmente.
- Esquivar, Preparar, Disparada e Esconder recuperados do adaptador 6.4.1, sob a namespace do Fixes e com sua licença preservada em LICENSE-ARGON.txt. A integração só instala esses hooks quando está registrada e o adaptador antigo está desativado.
- Preparar preserva a atividade exata e só remove seu efeito depois de execução nativa concluída. Cliques concorrentes são bloqueados. Ações temporárias expiram em turnos ou avanço do relógio do mundo fora do combate.
- Favoritos nativos de item/atividade/efeito/perícia/ferramenta, macros deduplicadas, atributos, salvaguardas, perícias, ferramentas, efeitos e itens passivos acessíveis pelo painel lateral. Favorito de item com várias atividades abre a ficha para evitar escolha implícita.
- Haki abre o painel nativo; Akuma continua usando atividades nativas, respeitando o bloqueio da ficha quando aplicável. Efeitos temporários e iniciativa/ficha/minimizar herdados do CORE são preservados.
- Movimento respeita modo atual, conversão entre unidades e histórico do token. Sem velocidade ou conversão conhecida, o indicador é oculto. Disparada desativada/suprimida/expirada não amplia o movimento, e seu bônus não atravessa modos.
- Retrato diferencia morto, morrendo e estável pelos dados nativos; não oferece salvaguardas após três sucessos/falhas.
- Importação de ZIP em espera ignora versões iguais ou anteriores à fonte. Isso impede que o ZIP 1.27.13 rastreado apague a implementação nova no workflow. Testes Node/Python executam antes do build/release.

## Evidência e limites

Inspecionados: distribuição oficial OP RPG **1.0.22**, manifesto fornecido pelo usuário; código do Argon CORE no tag **5.0.2**, commit `dc0ea6b7bfba4dff5defe1b757104db20ebf5f1a`; integração atual 1.27.13 e adaptador histórico 6.4.1. O manifesto no checkout público desse tag CORE ainda informa 3.1.0; não é evidência de versão instalada em uma mesa. A integração mantém seu gate de CORE 5.x.

Validação automatizada: `node --test tests/argon-integrated.mjs`; `python -m unittest discover -s tests -p 'test_*.py'`; build com sintaxe de todos os JavaScripts, integridade dos ZIPs, manifesto interno e hashes. A suíte cobre identidade de atividade, exclusão de fallback após remoção, permissões, bloqueio nativo, cancelamento, exceções, concorrência, PP variável, unidades de movimento, retrato, Disparada e expiração.

Validação visual em Chromium/Playwright: **simulada**, usando as classes e templates reais do checkout CORE, com documentos Foundry falsos e ícones substitutos. Com 60 itens/120 atividades, barra desktop de 924×166 px em 1440×900; em 390×844, área de ações limitada a 206×174 px com rolagem. Busca, resultado vazio, execução de atividade por Enter, abertura de ficha por F2 e rolagem de perícia pelo drawer foram exercitados. O teste não representa execução no Foundry nem valida ícones, fontes, temas de terceiros ou automações de uma mesa real.

**Nenhum teste em Foundry real foi feito.** Não existe contador universal nativo de ações restantes para personagens/NPCs no código inspecionado; a economia é classificada, sem inferir que um clique consumiu uma ação. Conjuntos de armas continuam ocultos; todas as atividades das armas estão disponíveis nas categorias. Visibilidade do atacante para Esquivar, adjudicação do gatilho de Preparar e concentração continuam dependentes da mesa; o HUD não pode certificar essas condições. A conversão de unidades precisa existir na configuração do sistema. O CORE público ainda presume adaptador separado em sua checagem inicial; um aviso desse CORE não é motivo para ativar os dois adaptadores juntos.

## Instalação e rollback

Manifesto permanente (inalterado): https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json

Antes de atualizar uma mesa: parar o mundo e copiar o mundo completo e `Data/modules/oprpg-system-fixes`. Esta atualização não executa migração de atores/itens. Favoritos existentes são lidos; efeitos de ações básicas só são criados por uso explícito.

Para voltar: parar o mundo, restaurar a pasta anterior do módulo ou instalar o ZIP imutável https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.13/oprpg-system-fixes.zip. Restaurar o backup do mundo se for necessário desfazer ações de jogo feitas após a atualização. Não usar reset destrutivo de fichas nem ativar o adaptador histórico junto da integração interna.

O workspace de desenvolvimento preserva ZIP e bundle Git locais do commit-base `2e21869e9118509fd026d781db12f08e36a17e33` em `.local-reference/`, fora da distribuição e do controle de versão. Outros módulos não tiveram seus fontes ou versões alterados.
