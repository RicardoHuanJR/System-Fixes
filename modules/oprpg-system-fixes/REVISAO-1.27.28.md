# System Fixes 1.27.28 — refinamento completo dos painéis do HUD

Conclui as etapas restantes do plano após a 1.27.27. Mantém o visual Orquídea Negra, o retrato claro e a barra compacta.

- Cabeçalhos de ações, favoritos, armas, atributos e atalhos compartilham títulos de 14 px, emblema de 16 px e separadores discretos. Os lançadores continuam retos, com 60×48 px e ícones de 22 px. Linhas de consulta usam 13 px, com bônus alinhados à direita. A seleção dos detalhes acompanha a cor de seleção do HUD.
- Os detalhes oferecem **Abrir ficha do item**, sem usar a atividade. Botão, F2 e botão direito compartilham a verificação de ator atual e permissão de proprietário, mestre ou observador. Foco e detalhe aberto sobrevivem à atualização.
- Testes mostram apenas bônus preparados: `abilities[key].check.value`, `abilities[key].save.value` e `skills[key].total`. Quando só existe o modificador base do atributo, o teste o identifica como **Mod. +N**. Fórmulas não são avaliadas para desenhar; valores ausentes ficam ausentes. Sem permissão de consulta, bônus não são exibidos.
- Efeitos temporários podem abrir uma lista de efeitos por clique, Enter ou Espaço. Consultar não ativa/desativa efeitos. As linhas maiores preservam o comando existente de alternância com verificação de propriedade/supressão. A coluna de ícones termina acima dos recursos e rola por foco quando há muitos efeitos. Manipuladores nativos de outros botões do mouse permanecem. Se o efeito desaparecer, fechar retorna ao retrato.
- Busca sem resultados permite **Limpar busca e filtros**, incluindo o filtro de armas do conjunto. Apenas a visualização é alterada; não equipa armas nem regrava flags.
- Setas percorrem resultados a partir da busca e das atividades, preservando selects e checkboxes. Home/End vão ao primeiro/último resultado. Escape nos detalhes fecha primeiro o detalhe e devolve o foco; outro Escape fecha a lista. Rolagem de foco fica nos painéis.
- Listas e consultas compartilham geometria que considera a barra lateral e a barra de atalhos nativas visíveis. O observador acompanha mudanças de tamanho. Nenhum elemento nativo é movido ou ocultado pelo posicionamento. Uma barra lateral que deixe menos de 160 px livres exige o fallback aos limites da janela: não é possível garantir espaço para todos os painéis num cenário inteiramente obstruído.
- Preferência individual **Argon: tamanho do texto**, em configurações do System Fixes: **Padrão compacto** permanece padrão; **Texto ampliado** aumenta texto e controles, mostrando menos linhas quando necessário. Aplicação sem recarregar e sem uma segunda redução automática pelo CORE.

Nenhuma migração de ator, novo consumo de PP, dano ou aplicação duplicada de efeito. Outros módulos e licenças preservados.

## Verificação

30 testes Node, testes Python de importação, build e duas suítes Chromium usando classes/templates/CSS reais do CORE 5.0.2 com documentos simulados. Cobertura de ficha, permissões, bônus, oito efeitos, remoção de efeito aberto, teclado, busca vazia, preferência de texto, barra lateral/atalhos simulados e janelas até 320 px. A regressão anterior mantém cinco atividades completas em 248 px de área útil no painel compacto de referência. Verificação visual das capturas e detector de interface sem achados.

Sem sessão de Foundry real disponível: estas verificações não validam execução em Foundry real. Imagens e documentos do teste são substitutos. Capturas adicionais: hud-chrome-safe.png e hud-large-text-1440/867/390/320.png.

## Instalação e rollback

Manifesto permanente: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json.

Retorno: https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.27/oprpg-system-fixes.zip. Backups locais: .local-reference/backup-before-1.27.28.zip e .local-reference/rollback-before-1.27.28.bundle. Base: 39b3401591d47e3c9b28336b8264b6724ae27ed3.
