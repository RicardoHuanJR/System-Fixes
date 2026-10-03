# 6.4.0 — Fase 2

- Esquivar automatiza desvantagem em ataques e vantagem em Salvaguardas de Destreza.
- Preparar registra gatilho + Activity, cria card Executar/Cancelar e expira no próximo turno.
- Disparada amplia o orçamento de deslocamento do turno no HUD.
- Esconder rola Furtividade (ou Destreza como fallback).
- Estados temporários são limpos por turno/fim de combate e entram no autoteste.

# 6.3.0
- Favoritos de Active Effect podem ser ativados/desativados pelo HUD.
- Seletor de Activities mostra tipo, efeito/dano/cura, ativação, alcance e PP.
- Última Activity escolhida fica pré-selecionada por navegador.
- Novo painel `OPRPG_ARGON_COMPATIBILITY()` e Alt+clique no diagnóstico.

# Changelog

## 6.3.0
- Corrige o alinhamento automático dos controles superiores quando o Argon Core usa HUD escalado/Auto Scale.
- O cálculo converte coordenadas de viewport escaladas para o espaço local do Portrait antes de aplicar `left`.
- Corrige o ícone de Favoritos que apontava para `icons/svg/star.svg` inexistente no Foundry v14.
- Autoteste agora valida o asset de Favoritos e informa gap/escala no teste de alinhamento.

## 6.2.0
- Consolida o CSS das revisões 6.0.x e remove offsets conflitantes acumulados.
- Posiciona os controles superiores automaticamente após a largura real dos Weapon Sets.
- Adiciona presets Compacto/Normal/Grande, espaçamento dos ícones, distância após Weapon Sets e offset das Técnicas como configurações por cliente.
- Adiciona `OPRPG_ARGON_SELF_TEST()`, `OPRPG_ARGON_EXPORT_DIAGNOSTIC()` e diagnóstico ampliado.
- Melhora Técnicas com múltiplas Activities com seletor visual em cards e tooltip agregado.
- Mostra PP insuficiente sem esconder nem bloquear a Técnica.
- Adiciona camada de compatibilidade OPRPG para PP e Haki.
- Substitui o antigo booleano de equipar conjuntos por Modo Visual / Alterar Equipamento.
- Corrige mensagens de versão antigas no console.

## 6.0.x
- Linha inicial da integração nativa OPRPG sobre Argon Core 5.0.1.
