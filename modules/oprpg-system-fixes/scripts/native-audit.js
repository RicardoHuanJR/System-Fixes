import { STATE, activitiesOf } from "./shared.js";
import { shieldPointsStatus, damageTypePipelineStatus } from "./shield-points-fix.js";
import { multiActivityAttackStatus } from "./multi-activity-attack-fix.js";
import { akumaFixStatus } from "./akuma-fix.js";
import { actorAkuma } from "./akuma-fix.js";
import { akumaCombatStatus } from "./akuma-combat-fix.js";
import { hakiAwakeningStatus } from "./haki-awakening-fix.js";
import { unifiedHakiStatus } from "./haki-unified-fix.js";
import { npcSheetRepairStatus } from "./npc-sheet-fix.js";

function functionSource(fn) {
  try { return typeof fn === "function" ? Function.prototype.toString.call(fn) : ""; }
  catch (_) { return ""; }
}

function characterActors() {
  return Array.from(game?.actors ?? []).filter(a => a?.type === "character");
}

function hasAkumaData(actor) {
  if (actorAkuma(actor)) return true;
  const system = actor?.system ?? {};
  const keys = Object.keys(system);
  return keys.some(k => /akuma|fruit|fruta/i.test(k));
}

function countMultiActivityItems() {
  let items = 0;
  let activities = 0;
  for (const actor of game?.actors ?? []) {
    for (const item of actor.items ?? []) {
      const acts = activitiesOf(item);
      if (acts.length > 1) {
        items++;
        activities += acts.length;
      }
    }
  }
  return { items, activities };
}

export function nativeMechanicsAudit() {
  const actors = characterActors();
  const withShieldModel = actors.filter(a => a?.system?.shieldPoints && "value" in a.system.shieldPoints);
  const withAkuma = actors.filter(hasAkumaData);
  const actorClass = CONFIG?.Actor?.documentClass;
  const applyDamageSource = functionSource(actorClass?.prototype?.applyDamage);
  const calculateDamageSource = functionSource(actorClass?.prototype?.calculateDamage);
  const actorApplyDamageUsesShield = /shieldPoints/i.test(applyDamageSource);
  const calculateDamageUsesShield = /shieldPoints/i.test(calculateDamageSource);
  const multi = countMultiActivityItems();
  const shield = shieldPointsStatus();
  const damageTypes = damageTypePipelineStatus();
  const attack = multiActivityAttackStatus();
  const akuma = akumaFixStatus();
  const akumaCombat = akumaCombatStatus();
  const hakiAwakening = hakiAwakeningStatus();
  const hakiUnified = unifiedHakiStatus();
  const npcSheet = npcSheetRepairStatus();

  const checks = [
    {
      id: "shield-model",
      label: "Modelo nativo de Pontos de Escudo",
      status: withShieldModel.length ? "present" : "unknown",
      detail: `${withShieldModel.length}/${actors.length} personagens carregados expõem system.shieldPoints`
    },
    {
      id: "shield-actor-apply-damage",
      label: "Actor.applyDamage consome Escudo",
      status: actorApplyDamageUsesShield ? "native" : "not-detected",
      detail: actorApplyDamageUsesShield ? "Referência a shieldPoints detectada no método nativo." : "Referência não detectada no método carregado."
    },
    {
      id: "shield-custom-card",
      label: "Card customizado consome Escudo",
      status: shield.installed ? (shield.mode === "native" ? "native" : "fixed") : "broken",
      detail: shield.installed ? `Modo: ${shield.mode}` : "Patch de compatibilidade não instalado."
    },
    {
      id: "shield-physical-resistance",
      label: "Endurecimento: resistência física enquanto há Escudo",
      status: shield.physicalResistance ? "fixed" : (calculateDamageUsesShield ? "possible-native" : "needs-review"),
      detail: shield.physicalResistance ? "Fixes injeta resistência a Contundente/Cortante/Perfurante no calculateDamage e no card customizado enquanto há Escudo." : (calculateDamageUsesShield ? "calculateDamage referencia shieldPoints; requer teste funcional." : "Nenhuma ligação direta entre calculateDamage e shieldPoints foi detectada.")
    },
    {
      id: "damage-type-pipeline",
      label: "Cards respeitam resistência/imunidade/vulnerabilidade",
      status: damageTypes.installed ? "fixed-partial" : "needs-review",
      detail: damageTypes.installed ? `Cards tipados passam por Actor.calculateDamage antes das camadas OPRPG; ${damageTypes.unresolvedMixedNativeCards} cards mistos sem totais por parte foram preservados sem adivinhação.` : "Pipeline de tipos não instalado."
    },
    {
      id: "multi-activity-attack",
      label: "Acerto usa a Activity selecionada",
      status: attack.installed ? "fixed" : "needs-review",
      detail: attack.installed ? `Bridge temporário entrega activity.labels.toHit ao handler nativo e preserva a Activity selecionada no rerender; ${attack.selectionsPreservedInNativeUpdates ?? 0} updates de card reparados nesta sessão.` : "Patch de Acerto multi-Activity não instalado."
    },
    {
      id: "multi-activity-labels",
      label: "Labels de dano seguem a Activity selecionada",
      status: STATE.multiActivityDamageLabelsPatch ? "fixed" : "needs-review",
      detail: STATE.multiActivityDamageLabelsPatch ? "Fórmula/tipos vêm prioritariamente de Activity.getDamageConfig(); item.labels.damages é usado apenas como ponte temporária no handler nativo de Activity única." : "Patch de labels não instalado."
    },
    {
      id: "multi-activity",
      label: "Items com múltiplas Activities",
      status: multi.items ? "present" : "none-loaded",
      detail: `${multi.items} Items / ${multi.activities} Activities carregadas em Items multi-Activity.`
    },
    {
      id: "akuma-data",
      label: "Dados nativos de Akuma no Mi",
      status: withAkuma.length ? "present" : "unknown",
      detail: `${withAkuma.length}/${actors.length} personagens carregados possuem chave de sistema relacionada a Akuma/Fruta.`
    },
    {
      id: "akuma-uso-alternativo",
      label: "Uso Alternativo impede custo de PP",
      status: akuma.alternativeUse?.installed ? "fixed" : "needs-review",
      detail: akuma.alternativeUse?.installed ? "O botão nativo arma o benefício; Activity.use zera temporariamente somente consumos energy.total/generated, com fallback curto para caminhos legados." : "Reparo não instalado."
    },
    {
      id: "akuma-powerup-lifecycle",
      label: "Power Up sincroniza expiração do Active Effect",
      status: akuma.powerUp?.lifecycleSync ? "fixed" : "needs-review",
      detail: akuma.powerUp?.lifecycleSync ? "Active Effect criado após ativação é rastreado; ao expirar/remover, powerUp.active é desligado." : "Sincronização não instalada."
    },
    {
      id: "akuma-powerup-sav",
      label: "Power Up SAV impõe desvantagem",
      status: akumaCombat.powerUp?.sav ? "fixed-runtime-test" : "needs-review",
      detail: "Associação é feita entre o card da Técnica e os alvos selecionados; requer validação em jogo do hook de Salvaguarda usado pelo OPRPG carregado."
    },
    {
      id: "akuma-powerup-dmg",
      label: "Power Up DMG adiciona dados pelo grau",
      status: akumaCombat.powerUp?.dmg ? "fixed-runtime-test" : "needs-review",
      detail: "Somente Técnicas instantâneas identificadas como pertencentes à Akuma; danos com vários tamanhos de dado permanecem conservadores."
    },
    {
      id: "akuma-powerup-red",
      label: "Power Up RED protege PV até 10 × nível",
      status: akumaCombat.powerUp?.red ? "fixed-runtime-test" : "needs-review",
      detail: "Acumula dano no estado da transformação e encerra o Power Up ao atingir o limiar."
    },
    {
      id: "akuma-intangibilidade",
      label: "Intangibilidade Logia interfere no dano",
      status: akumaCombat.intangibility?.installed ? "fixed-runtime-test" : "needs-review",
      detail: "Ataques normais são anulados; Haki/Kairoseki são detectados e inimigo natural pode ser marcado pela API."
    },
    {
      id: "zoan-predador",
      label: "Predador usa dano realmente causado",
      status: akumaCombat.predator?.installed ? (akumaCombat.predator?.nativeHandlerPatched ? "fixed-runtime-test" : "partial") : "needs-review",
      detail: akumaCombat.predator?.nativeHandlerPatched ? "Handler nativo da ficha foi envolvido e usa o dano capturado no turno." : "Captura de dano ativa; handler nativo da ficha ainda não foi localizado nesta inicialização."
    },
    {
      id: "haki-unified",
      label: "Haki Unificado — HUD e usos",
      status: hakiUnified.installed ? "fixed-runtime-test" : (hakiUnified.deferredBecauseExternalModuleActive ? "external-active" : "needs-review"),
      detail: hakiUnified.installed ? "Antevisão, Superação Majestosa, contadores e descrições foram integrados ao System Fixes; o dano usa o resolvedor central por Activity." : (hakiUnified.deferredBecauseExternalModuleActive ? "O módulo separado OPRPG — Haki Unificado está ativo; a cópia integrada foi desativada para evitar patch duplo." : "Integração de Haki não instalada.")
    },
    {
      id: "haki-shield-recharge",
      label: "Endurecimento recupera Escudo após 10 minutos",
      status: hakiAwakening.shieldRecovery?.installed ? "fixed-runtime-test" : "needs-review",
      detail: "Usa game.time.worldTime; o cronômetro não corre em combate e é reiniciado quando um uso de Haki do Armamento é detectado."
    },
    {
      id: "haki-attack-infuso",
      label: "Ataque Infuso respeita a forma escolhida",
      status: hakiAwakening.haki?.attackInfusion ? "fixed-runtime-test" : "needs-review",
      detail: "O bypass da Intangibilidade deixa de tratar qualquer Haki ativo como Ataque Infuso e tenta casar desarmado/arma corpo a corpo/distância."
    },
    {
      id: "akuma-awakening-drain",
      label: "Estágio Desperto consome 1 PP no fim do turno",
      status: hakiAwakening.awakening?.drainInstalled ? "fixed-runtime-test" : "needs-review",
      detail: "Liberação Cansativa usa o estado nativo/Active Effect e cobra 1 PP mesmo se o estágio tiver sido encerrado antes do fim do turno, quando a ativação foi detectada."
    },
    {
      id: "akuma-awakening-zero",
      label: "Estágio Desperto encerra em 0 PP",
      status: hakiAwakening.awakening?.drainInstalled ? "fixed-runtime-test" : "needs-review",
      detail: "Ao chegar a 0 PP, o campo nativo detectado é desligado e o Active Effect temporário do Estágio Desperto é encerrado."
    },
    {
      id: "akuma-awakening-burst",
      label: "Explosão de Poder",
      status: hakiAwakening.awakening?.powerBurstNative ? "native-detected" : (hakiAwakening.awakening?.powerBurstPatched ? "fixed-runtime-test" : "available-via-api"),
      detail: hakiAwakening.awakening?.powerBurstNative ? "Handler nativo com consumo/recuperação de energia foi detectado e preservado." : (hakiAwakening.awakening?.powerBurstPatched ? "Handler nativo incompleto foi envolvido para recuperar 10 PP uma vez por descanso longo." : "Nenhum handler foi localizado; game.oprpgFixes.useAwakenedPowerBurst(actor) fica disponível como fallback explícito.")
    },
    {
      id: "npc-sheet-svg",
      label: "NPC Sheet: SVG de Manipulação/Treinamentos",
      status: npcSheet.installed ? "fixed-runtime-test" : "needs-review",
      detail: npcSheet.installed ? `${npcSheet.nativeMethodsPatched} métodos nativos envolvidos; ${npcSheet.svgStringsRepaired} strings SVG reparadas nesta sessão.` : "Métodos alvo não foram localizados na classe carregada."
    }
  ];

  const result = {
    module: game.modules?.get("oprpg-system-fixes")?.version ?? null,
    system: game.system?.version ?? null,
    foundry: game.version ?? null,
    checks,
    shield,
    damageTypes,
    attack,
    akuma,
    akumaCombat,
    hakiAwakening,
    hakiUnified,
    npcSheet,
    state: {
      shieldPointsPatch: !!STATE.shieldPointsPatch,
      multiActivityDamagePatch: !!STATE.multiActivityDamagePatch,
      multiActivityDamageLabelsPatch: !!STATE.multiActivityDamageLabelsPatch,
      multiActivityAttackPatch: !!STATE.multiActivityAttackPatch,
      shieldPhysicalResistancePatch: !!STATE.shieldPhysicalResistancePatch,
      damageTypePipelinePatch: !!STATE.damageTypePipelinePatch,
      akumaAlternativePatch: !!STATE.akumaAlternativePatch,
      powerUpLifecyclePatch: !!STATE.powerUpLifecyclePatch,
      powerUpSavPatch: !!STATE.powerUpSavPatch,
      powerUpDamagePatch: !!STATE.powerUpDamagePatch,
      powerUpReductionPatch: !!STATE.powerUpReductionPatch,
      intangibilityPatch: !!STATE.intangibilityPatch,
      predatorPatch: !!STATE.predatorPatch,
      shieldRechargePatch: !!STATE.shieldRechargePatch,
      hakiInfusionPatch: !!STATE.hakiInfusionPatch,
      hakiUnifiedPatch: !!STATE.hakiUnifiedPatch,
      awakeningDrainPatch: !!STATE.awakeningDrainPatch,
      awakeningLifecyclePatch: !!STATE.awakeningLifecyclePatch,
      npcSheetPatch: !!STATE.npcSheetPatch
    }
  };
  return result;
}

export function logNativeMechanicsAudit() {
  const report = nativeMechanicsAudit();
  console.group("OPRPG System Fixes | Auditoria de mecânicas nativas");
  console.table(report.checks.map(c => ({ mecanica: c.label, status: c.status, detalhe: c.detail })));
  console.log(report);
  console.groupEnd();
  return report;
}
