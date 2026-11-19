# System Fixes 1.27.15 — aperfeiçoamento do HUD

## Comportamento

A barra agora tem um botão por economia: Ação, Poderosa, Ação bônus, Reação e Livre/outras. Categorias ficam como filtros no painel aberto. Na simulação de 60 itens/120 atividades, passou de 924×166 para **524×122 px** em 1440×900, mantendo a leitura dos rótulos. Em 390×844, a área de ações mede 206×116 px sem movimento.

- Busca sem distinção de acentos, filtros por categoria e favoritos, contagem de resultados e estado vazio. Busca, seleção, rolagem e foco de busca/atividade/controles sobrevivem às atualizações atendidas pela integração.
- Botão Fechar, Escape com retorno ao botão de origem e setas para navegar nas atividades. Abrir um painel fecha os demais e sincroniza `aria-expanded`; clique fora fecha o painel. Contextos são reposicionados ao abrir/redimensionar, incluindo telas estreitas e baixas.
- Favoritar uma atividade usa `actor.system.addFavorite/removeFavorite` e IDs relativos nativos. O controle de favorito é separado do botão de execução, sem disparar a atividade. Favorito de item abrange suas atividades; remover esse favorito remove o item da lista nativa.
- Três conjuntos de armas com principal/secundária e filtro opcional. Usa as flags existentes `enhancedcombathud.weaponSets` e `activeWeaponSet`; aceita apenas armas pertencentes ao ator. São atalhos: não muda `system.equipped` e não gasta recursos/ações. Sem configuração salva, o primeiro conjunto sugere as armas equipadas. Controles ficam sob “Conjuntos de armas”, dentro do filtro Armas, sem aumentar a barra fixa.
- Motivo de indisponibilidade no próprio resultado, tratamento de getter nativo que falha e indicação de execução. Duas atividades de um mesmo item não abrem diálogos concorrentes para os mesmos usos/PP. A execução continua delegada exclusivamente ao sistema.
- Componentes antigos ficam vinculados ao contêiner em que foram criados, evitando que uma renderização atrasada injete painéis no HUD recém-reconstruído. Estado de painéis de outro ator não é salvo/restaurado pelo componente antigo.
- Movimento informa a distância restante real na unidade do ator, inclusive zero após exceder o limite. Não usa a apresentação cíclica do CORE que voltava a mostrar orçamento cheio após ultrapassá-lo. Modo, conversões, Disparada e histórico do token continuam sendo considerados. Unidade ausente não é tratada como conversão conhecida.
- O menu recolhido respeita a largura do retrato no celular e não cobre o primeiro botão de ação. Ações básicas de uma ficha sem propriedade ficam sinalizadas como indisponíveis.

## Evidência

Manifesto oficial OP RPG consultado novamente em 18/11/2026: **1.0.22**. Referência CORE: tag 5.0.2, commit `dc0ea6b7bfba4dff5defe1b757104db20ebf5f1a`; o manifesto público desse checkout ainda informa 3.1.0. O gate de execução da integração continua exigindo a linha CORE 5.x, como na versão anterior.

**15 testes Node**, regressão Python do importador e teste Chromium/Playwright com classes/templates/CSS do CORE e documentos simulados. Casos: identidade de atividade, recursos, concorrência, erros/restrições nativas, favoritos, conjuntos com UUID externo recusado, propriedade, busca sem acentos, estado após atualização, teclado, movimento excedido, minimizar e seis tamanhos de viewport. O detector Impeccable não encontrou problemas mecânicos nos arquivos visuais alterados.

O workflow agora exige o job de navegador antes da release e guarda capturas da simulação por sete dias. O build continua verificando sintaxe de JavaScript, manifesto, ZIPs e hashes. Outros módulos mantêm seus fontes e versões.

**Não houve execução em Foundry real.** Ícones/fontes do teste são substitutos; Haki, Akuma e automações permanecem nas APIs existentes, sem nova validação em mesa. Classificação de economia não é contador de ações restantes: o sistema inspecionado não fornece esse estado universal. Ajustes manuais que posicionem toda a barra fora da tela não são corrigidos por esta versão; os painéis abertos são mantidos dentro da viewport.

## Instalação e rollback

Manifesto permanente: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json

Ativar Fixes + Argon CORE 5.x e manter o adaptador separado desativado. A instalação não migra fichas, não reequipa armas e não altera favoritos. Só os comandos explícitos do jogador gravam favoritos e flags de conjuntos.

Antes de atualizar: parar o mundo e copiar o mundo e `Data/modules/oprpg-system-fixes`. Para reverter, restaurar a pasta ou instalar https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.14/oprpg-system-fixes.zip. Favoritos e flags CORE continuam nos formatos nativos; restaurar o mundo se quiser desfazer ações realizadas após a atualização.

O workspace preserva `.local-reference/backup-before-1.27.15.zip` e `.local-reference/rollback-before-1.27.15.bundle`, base `ce510bea474638676d3d479b31349a20726cdae7`. Esses backups e fontes oficiais locais não entram na distribuição.
