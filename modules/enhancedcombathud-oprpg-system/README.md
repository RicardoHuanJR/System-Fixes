# Argon Combat HUD — OPRPG

Integração nativa do OPRPG System com Argon Core 5.0.1 para Foundry VTT v14.

## 6.1
A linha 6.1 estabiliza o layout: o módulo mede os Weapon Sets reais para posicionar os controles superiores, em vez de depender de coordenadas fixas. O tamanho dos cards de Técnicas e o espaçamento podem ser configurados por usuário.

### Diagnóstico
- `OPRPG_ARGON_DIAGNOSTIC()` — mostra diagnóstico no Console.
- `OPRPG_ARGON_EXPORT_DIAGNOSTIC()` — exporta diagnóstico JSON.
- `await OPRPG_ARGON_SELF_TEST()` — executa autotestes de integração.

No botão de diagnóstico do retrato (quando habilitado): clique normal mostra o diagnóstico, Shift+clique exporta o JSON e Ctrl+clique executa o autoteste.

## Ações básicas automatizadas (6.4.0)

- **Esquivar**: cria um efeito temporário; ataques contra o ator recebem desvantagem e Salvaguardas de Destreza recebem vantagem enquanto o efeito for válido.
- **Preparar**: escolhe uma Activity, registra um gatilho e oferece Executar/Cancelar no card de chat.
- **Disparada**: adiciona ao orçamento de movimento do turno um valor igual ao deslocamento atual.
- **Esconder**: executa Furtividade, com fallback para Destreza se a perícia não estiver disponível.

As automações são implementadas apenas no módulo; o OPRPG oficial não é alterado.
