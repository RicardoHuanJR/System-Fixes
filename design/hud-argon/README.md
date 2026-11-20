# Orquídea Negra — prévia do HUD Argon

Proposta visual interativa produzida após a versão instalável **1.27.19**. Este diretório não é carregado pelo módulo Foundry nem incluído em seus pacotes. A integração do novo visual ao módulo ainda não foi realizada.

Abra [preview.html](preview.html) no navegador. A interface permite alternar economias, buscar, favoritar, consultar detalhes e recolher o HUD. Toda execução é simulada: nomes, valores, atividades e imagens são exemplos; na integração real, as informações devem vir dos documentos e APIs nativas do sistema. Não há consumo de PP ou alteração de fichas nesta prévia.

## Estado final da proposta

- Tema próprio inspirado em piratas e orquídeas: marfim, preto ameixa, rosa-orquídea e detalhes dourados. Nenhuma das imagens de referência enviadas pelo usuário foi incorporada à interface.
- Emblema vetorial original e 22 ícones próprios para as economias, consultas e atividades. [Coleção interativa](icones.html), [coleção em PNG](colecao-icones.png) e [arquivos SVG](icones).
- Cinco botões de **60×48 px**, retos, sem recorte diagonal, sem rotação e com texto sem itálico. Ícones alinhados horizontalmente. A barra completa mede **504×122 px** no cenário de teste.
- Painel contextual de até 380 px de altura, imagens por atividade, custo/alcance, consulta e favorito separados da execução. Um painel por vez; busca sem acentos, teclado e adaptação para telas pequenas.
- A proposta mantém o compromisso de não inventar contadores universais de ações ou Reação. Confirmações e automações efetivas pertencem à integração nativa do módulo.

## Capturas

[Botões retos](botoes-retos.png) · [Cena completa](cena-desktop.png) · [Detalhe do HUD](detalhe-hud.png) · [Detalhes da atividade](detalhes-atividade.png) · [Recolhido](recolhido.png) · [Celular](mobile.png) · [Tela baixa](tela-baixa.png).

As capturas são do navegador com dados demonstrativos. Não representam uma sessão real de Foundry.

## Reproduzir e verificar

Execute a partir da raiz do repositório, com Node.js e Playwright/Chromium disponíveis:

```sh
node design/hud-argon/build-icons.cjs
node design/hud-argon/verify.cjs
```

`PLAYWRIGHT_MODULE` pode apontar para uma instalação existente de Playwright. `PLAYWRIGHT_BROWSERS_PATH` segue a configuração padrão dessa ferramenta. Não há dependência de produção acrescentada pelo protótipo.

O primeiro comando atualiza os SVGs, a coleção e as imagens demonstrativas da prévia. O segundo verifica imagens, contraste calculado, busca, consulta, teclado, alinhamento dos botões, preservação dos valores e limites da tela; também regenera as capturas. Tamanhos cobertos: 1400×800, 390×844 e 867×453. A menor relação de contraste de texto medida no estado inicial foi **6,06:1**.

## Fontes e atribuição

Os ícones e o emblema deste diretório foram desenhados para esta proposta. Não são os ícones genéricos do CORE, nem recortes das referências fornecidas.

Roboto e Roboto Condensed estão incorporadas à página. Seus avisos e licenças foram preservados em [LICENSE-ROBOTO.txt](LICENSE-ROBOTO.txt) e [LICENSE-ROBOTO-CONDENSED.txt](LICENSE-ROBOTO-CONDENSED.txt). A página retém a atribuição histórica do Argon. Imagens oficiais de Haki/Akuma e arquivos de referência locais não são distribuídos neste diretório.
