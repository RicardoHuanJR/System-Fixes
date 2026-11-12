# Correção 1.27.1 — alvos em áreas

- Corrigida detecção de interseção: bordas ou vértices apenas tangentes deixam de atingir tokens adjacentes.
- Retângulos e polígonos passam a exigir área de sobreposição positiva, usando recorte geométrico.
- Círculos exigem interseção estrita, excluindo tangência.
- A correção também alcança áreas persistentes, que reutilizam `tokenIntersectsArea`.
- Testes geométricos locais realizados; validar no Foundry v14 com áreas desenhadas e efeitos reais.
