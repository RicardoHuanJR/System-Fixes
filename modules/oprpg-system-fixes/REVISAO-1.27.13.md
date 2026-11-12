# Integração do Argon no OPRPG System Fixes 1.27.13

**Origem:** módulo System Fixes 1.27.12 + adaptador reconstruído Argon OPRPG 0.1.0.

**O que mudou:** arquivos de modelo/execução/HUD incorporados em `scripts/argon-hud/`, novo hook `argonInit` instalado antecipadamente pelo `main.js`, CSS e traduções incorporadas, configurações e API de diagnóstico adicionadas.

**Dependências:** Argon CORE 5.x é opcional; não precisa do antigo adaptador `enhancedcombathud-oprpg-system`. Caso esteja ativo, desative-o (a integração interna pula o registro dos painéis para impedir duplicação).

**Limites:** integração ainda não executada em Foundry V14 real. O uso de atividades exige que o OP RPG exponha `activity.use()`. Na ausência do método, o sistema avisa e permite abrir a ficha sem executar a primeira atividade por engano. As versões do sistema após 1.0.20 ainda precisam de teste de integração.

**Testes:** suíte integrada `tests/argon-integrated.mjs` e testes legados em `tests/*.mjs` usando Node 22.
