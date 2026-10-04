import { openEffectsWindow } from './effect-automations.js';
import { inspectSheet, openSheetReview } from './sheet-review.js';
import { useCatalogueCharacteristic, configureCatalogue } from './automation-catalogue.js';
import { STATE, activitiesOf, applyTempHP } from "./shared.js";
import { rawHealLimit } from "./healing-fix.js";
import { repairLoadedCompendium, normalizeFormulaReferences } from "./formula-fix.js";
import { multiActivityDamageStatus } from "./multi-activity-damage-fix.js";
import { multiActivityAttackStatus } from "./multi-activity-attack-fix.js";
import { shieldPointsStatus, previewShieldDamage, previewTypedDamage, damageTypePipelineStatus } from "./shield-points-fix.js";
import { nativeMechanicsAudit } from "./native-audit.js";
import { akumaFixStatus } from "./akuma-fix.js";
import { akumaCombatStatus, markIntangibilityBypass } from "./akuma-combat-fix.js";
import { hakiAwakeningStatus, recoverShieldIfReady, markArmamentUse, hakiInfusionApplies, markHakiInfusion, awakeningState, useAwakenedPowerBurst } from "./haki-awakening-fix.js";
import { unifiedHakiStatus } from "./haki-unified-fix.js";
import { npcSheetRepairStatus } from "./npc-sheet-fix.js";
import { automationStatus } from './automation-runtime.js';
import { undoResources } from './operation-history.js';
import { externalCompatibilityStatus, applyCompatibilityDamage, applyCompatibilityEffects, runItemMacros, openDAEEffects } from './external-compatibility.js';
import { configureSurgicalControl, finalizeAreaExecution } from './area-workflow.js';
import { areaProtected } from './area-state.js';
import { openCharacteristics, toggleCharacteristic, saveProfiles } from './characteristic-automations.js';
import { endPersistentArea } from './persistent-areas.js';
import { configureTechniqueAutomation, applyTechniqueEffects } from './technique-effects.js';
import { configurePeriodic, resolvePeriodic } from './periodic-effects.js';
import { refundCancelledArea } from './area-refund.js';

export function installPublicAPI() {
  game.oprpg ??= {};
  game.oprpg.openHakiHud ??= async actor => {
    const mod = await import("/systems/oprpg-system/module/applications/actor/haki-hud.mjs");
    return mod.default?.openFor?.(actor ?? game.user.character);
  };
  game.oprpg.getPP ??= actor => {
    const energy = actor?.system?.energy ?? {};
    return { current: Number(energy.total ?? 0), max: Number(energy.max ?? 0), generated: Number(energy.generated ?? 0) };
  };
  game.oprpg.getActivities ??= item => activitiesOf(item);
  game.oprpg.getMovement ??= actor => foundry.utils.deepClone(actor?.system?.attributes?.movement ?? {});
  game.oprpg.applyTempHP ??= applyTempHP;

  // Re-expose the common console diagnostics at ready as well. Diagnostics are
  // normally registered when the ES module is evaluated, but keeping these
  // aliases here makes them resilient to stale console/module evaluation order.
  globalThis.OPRPG_FIXES_SHIELD_STATUS = shieldPointsStatus;
  globalThis.OPRPG_FIXES_DAMAGE_TYPES_STATUS = damageTypePipelineStatus;
  globalThis.OPRPG_FIXES_ATTACK_STATUS = multiActivityAttackStatus;
  globalThis.OPRPG_FIXES_AKUMA_STATUS = akumaFixStatus;
  globalThis.OPRPG_FIXES_AKUMA_COMBAT_STATUS = akumaCombatStatus;
  globalThis.OPRPG_FIXES_HAKI_AWAKENING_STATUS = hakiAwakeningStatus;
  globalThis.OPRPG_FIXES_HAKI_STATUS = unifiedHakiStatus;
  globalThis.OPRPG_FIXES_NPC_SHEET_STATUS = npcSheetRepairStatus;

  game.oprpgFixes = {
    automations:{use:useCatalogueCharacteristic,configure:configureCatalogue},
    sheetReview:{inspect:inspectSheet,open:openSheetReview},
    characteristics:{open:openEffectsWindow,toggle:toggleCharacteristic,configure:saveProfiles},
    techniqueAutomation:{configure:configureTechniqueAutomation,applyEffects:applyTechniqueEffects},
    periodic:{configure:configurePeriodic,resolve:resolvePeriodic},
    areas:{configureSurgicalControl,finalize:finalizeAreaExecution,isProtected:areaProtected,end:endPersistentArea,refund:refundCancelledArea},
    compatibility:{status:externalCompatibilityStatus,applyDamage:applyCompatibilityDamage,
      applyEffects:applyCompatibilityEffects,runItemMacros,openEffects:openDAEEffects},
    version: game.modules.get("oprpg-system-fixes")?.version ?? "1.23.0",
    automationStatus,
    undoResources,
    get status() { return foundry.utils.deepClone(STATE); },
    rawHealLimit,
    normalizeFormulaReferences,
    multiActivityDamageStatus,
    multiActivityAttackStatus,
    shieldPointsStatus,
    previewShieldDamage,
    previewTypedDamage,
    damageTypePipelineStatus,
    akumaFixStatus,
    akumaCombatStatus,
    markIntangibilityBypass,
    hakiAwakeningStatus,
    unifiedHakiStatus,
    recoverShieldIfReady,
    markArmamentUse,
    hakiInfusionApplies,
    markHakiInfusion,
    awakeningState,
    useAwakenedPowerBurst,
    npcSheetRepairStatus,
    nativeMechanicsAudit,
    repairCompendium: async packOrId => {
      const pack = typeof packOrId === "string" ? game.packs.get(packOrId) : packOrId;
      return repairLoadedCompendium(pack);
    }
  };
  STATE.api = true;
}


