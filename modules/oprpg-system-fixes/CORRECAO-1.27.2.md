# Correção 1.27.2 — emanação nativa Foundry V14

- As atividades de técnica com `target.template.type` igual a `emanation` (ou `emanação`) criam uma Região nativa pelo `RegionDocument.createTokenEmanation` ao passar por `AbilityTemplate.drawPreview`. O fallback do cartão também cobre o caso em que o sistema não produz templates antigos.
- A Região é vinculada ao token do lançador, com alcance medido em unidades de grade (`tamanho da atividade / distância da grade`), em vez de desenhar um círculo antigo.
- A seleção de alvos usa a triangulação da Região (grade e contornos nativos) para exigir interseção de área positiva; contato apenas por borda não conta.
- Áreas persistentes passam a guardar o UUID da Região, buscando a geometria atual após movimentação do token ou carregamento da cena. São observadas atualizações/exclusões de Regiões.
- Mantidos os demais tipos de template no comportamento anterior.

## Limites e verificação

- Sem acesso ao pacote instalado do sistema `oprpg-system`, não foi possível reproduzir o fluxo completo `technique-templates.mjs` no Foundry real. A alteração captura o fluxo que utiliza `AbilityTemplate.drawPreview`, e requer teste no mundo.
- Se a técnica gerar área diretamente sem chamar `AbilityTemplate.drawPreview`, esta versão não altera tal fluxo; é necessário conferir o código do sistema base para interceptá-lo corretamente.
- Faça backup antes de substituir. A aplicação não altera fichas de personagens existentes.
- Teste uma emanação de 1 quadrado em lançador 1x1 e 2x2, mover token e comparar cobertura, efeitos persistentes e alvos apenas tangentes.
