# System Fixes 1.27.23 — atributos clicáveis, foto inteira e atalhos maiores

- A foto do personagem mantém sua proporção e cabe inteira na moldura, sem cortar topo ou laterais. Imagens verticais e horizontais podem deixar espaço livre na moldura. A imagem original da ficha é preservada.
- Ícones da faixa inferior passam de 14 para 22 px em telas grandes, 20 px em janelas intermediárias e 18 px em telas estreitas. Os botões também ganham espaço: larguras de 40, 34 e 24 px, respectivamente; faixa de 36 ou 32 px de altura.
- A linha PPg/PP gerado e a abertura permanente Ficha e atalhos são removidas. Atributos reais mostram abreviação e modificador, com valor completo no título. Clique abre o teste do atributo, sua salvaguarda e as perícias relacionadas; a associação personalizada da ficha prevalece sobre o padrão. Abrir não rola dados.
- A foto abre a ficha completa; o ícone de ficha abre ferramentas, macros, favoritos não relacionados a atividades, efeitos e itens passivos. Escape fecha e devolve o foco; atualizar o HUD preserva seleção e foco. Permissões e identidade do ator são conferidas antes de executar.
- Com seis atributos, o painel mede 280×222 px em telas grandes, 236×196 px em janelas intermediárias e 144×214 px em telas estreitas. Janelas baixas usam 178 px de altura (208 px quando também estreitas). Sem atributos, a faixa adicional não ocupa espaço. PV, PP e defesa continuam separados da foto e dos atalhos. Minimizar preserva a faixa compacta de 28 px com ícones de 18 px.
- Nenhuma mudança de regras, consumo de recursos ou dados de atores. Outros módulos e licenças preservados.

## Verificação

27 testes Node, regressão Python do importador e Chromium com classes/templates reais do CORE tag 5.0.2 e documentos simulados. O navegador mede os seis atalhos, tamanhos de ícones e ausência de sobreposição em 1920×1080, 867×453 e 390×844. Verifica seleção e foco após atualizar, macros, ausência da abertura antiga, associações personalizadas, falta de atributos e bloqueio de controles antigos após trocar de ator. Também carrega imagens verticais e horizontais, verifica proporção e enquadramento integral, teclado, efeitos, salvaguarda de morte e minimizar.

Não foi executado em Foundry real. As imagens da simulação são substitutas e não são usadas nos atores do mundo.

## Instalação e rollback

Manifesto permanente: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json.

Retorno: https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.22/oprpg-system-fixes.zip. Backup local: .local-reference/backup-before-1.27.23.zip e .local-reference/rollback-before-1.27.23.bundle, base 09f775afe565e1f50bd6406244c711bffa12ecc4.
