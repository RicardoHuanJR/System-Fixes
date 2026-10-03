export const MODULE_ID = "oprpg-system-fixes";
export const SYSTEM_ID = "oprpg-system";
export const VERIFIED_SYSTEM = "1.0.20";

const warnings=[];
Object.defineProperty(warnings,'push',{value:function(...messages){
  for(const message of messages){
    if(this.at(-1)===message)continue;
    Array.prototype.push.call(this,message);
    if(this.length>100)this.splice(0,this.length-100);
  }
  return this.length;
}});

export const STATE = {
  bookRulesPatch: false,
  initialized: false,
  itemPatch: false,
  healClassPatch: false,
  preUseBypass: false,
  chatPatch: false,
  autoHealPatch: false,
  sustainedDurationPatch: false,
  freeTrainingPatch: false,
  fruitSheetPatch: false,
  multiActivityDamagePatch: false,
  multiActivityDamageIndependent: false,
  multiActivityDamageUnlocked: 0,
  multiActivityDamageLast: null,
  multiActivityDamagePersisted: 0,
  multiActivityAttackPatch: false,
  multiActivityAttackBridges: 0,
  multiActivityAttackPending: 0,
  multiActivityAttackLast: null,
  multiActivityAttackLastRestore: null,
  multiActivityAttackSelectionsPreserved: 0,
  multiActivityAttackSelectionRecoveries: 0,
  shieldPointsPatch: false,
  shieldPointsNativeCard: false,
  shieldPointsPatchMode: null,
  shieldPointsAbsorbed: 0,
  shieldPointsLast: null,
  shieldPhysicalResistancePatch: false,
  shieldPhysicalResistancePrevented: 0,
  shieldPhysicalResistanceLast: null,
  shieldTypedResistanceFallbacks: 0,
  shieldTypedResistanceFallbackLast: null,
  shieldLayerReconciliations: 0,
  shieldLayerReconciliationLast: null,
  damageTypePipelinePatch: false,
  damageTypePipelineResolved: 0,
  damageTypePipelineMixedSkipped: 0,
  damageTypePipelineLast: null,
  multiActivityDamageLabelsPatch: false,
  multiActivityDamageTypedRolls: 0,
  nativeDamageLabelBridges: 0,
  akumaAlternativePatch: false,
  akumaAlternativeArmed: 0,
  akumaAlternativeRefundedPP: 0,
  akumaAlternativeLast: null,
  powerUpLifecyclePatch: false,
  powerUpEffectsTracked: 0,
  powerUpAutoEnded: 0,
  powerUpLast: null,
  powerUpSavPatch: false,
  powerUpSaveTargets: 0,
  powerUpSaveApplied: 0,
  powerUpSaveUnscoped: 0,
  powerUpSaveLast: null,
  powerUpDamagePatch: false,
  powerUpDamageRolls: 0,
  powerUpDamageAmbiguous: 0,
  powerUpDamageLast: null,
  powerUpReductionPatch: false,
  powerUpRedPrevented: 0,
  powerUpRedLast: null,
  intangibilityPatch: false,
  intangibilityActivations: 0,
  intangibilityBlocked: 0,
  intangibilityLast: null,
  predatorPatch: false,
  predatorHandlerPatch: false,
  predatorHandlerName: null,
  predatorDamageCaptured: 0,
  predatorUses: 0,
  predatorLast: null,
  shieldRechargePatch: false,
  shieldRechargeCount: 0,
  shieldRechargeLast: null,
  hakiInfusionPatch: false,
  hakiInfusionManualMarks: 0,
  hakiUnifiedPatch: false,
  hakiUnifiedDeferredExternal: false,
  hakiContentPatch: false,
  hakiHudPatch: false,
  hakiAntevisaoPatch: false,
  hakiRecoveryPatch: false,
  hakiDamageHudPatch: false,
  hakiUnifiedUses: 0,
  hakiUnifiedLast: null,
  awakeningDrainPatch: false,
  awakeningLifecyclePatch: false,
  awakeningTurnsDrained: 0,
  awakeningPpSpent: 0,
  awakeningAutoEnded: 0,
  awakenedPowerBurstNative: false,
  awakenedPowerBurstPatch: false,
  awakenedPowerBurstHandler: null,
  awakenedPowerBurstUses: 0,
  awakeningLast: null,
  npcSheetPatch: false,
  npcSheetMethodsPatched: 0,
  npcSheetPrepareCalls: 0,
  npcSheetSvgStringsRepaired: 0,
  npcSheetTextEditorGuard: false,
  npcSheetAccessorsSkipped: 0,
  npcSheetSourceAudit: null,
  api: false,
  formulaPersisted: 0,
  warnings
};

export const NEEDS_FORMULA_PERSIST = Symbol("OPRPGFixesNeedsFormulaPersist");
export const BYPASS_HEAL_LIMIT = Symbol("OPRPGFixesBypassHealLimit");
export const RAW_GET_HEAL_LIMIT = Symbol("OPRPGFixesRawGetHealLimit");

export function healMode(activity) {
  const raw = activity?.healing?.types;
  const types = raw instanceof Set ? raw : new Set(typeof raw === "string" ? raw.split(",").map(s => s.trim()) : raw ?? []);
  if (types.has("temphp") && types.has("healing")) return "mixed";
  if (types.has("temphp")) return "temphp";
  return "healing";
}

export function disabledHealLimit() {
  return { enabled: false, max: Infinity, spent: 0, remaining: Infinity };
}

export function canAct(actor) {
  const gm = game.users?.activeGM;
  return gm ? gm.id === game.user?.id : actor?.isOwner === true;
}


const CARD_ACTIVITY_SELECTIONS = new Map();

function cardMessageId(card) {
  return card?.closest?.("[data-message-id]")?.dataset?.messageId ?? null;
}

function cardSelectionKey(card) {
  const holder = card?.closest?.("[data-message-id]");
  const messageId = holder?.dataset?.messageId ?? null;
  const itemId = card?.dataset?.itemId;
  if (!messageId || !itemId) return null;
  let slot = 0;
  try {
    const siblings = Array.from(holder.querySelectorAll?.(`.jujutsu-card[data-item-id="${CSS.escape(String(itemId))}"]`) ?? []);
    const index = siblings.indexOf(card);
    if (index >= 0) slot = index;
  } catch (_) { slot = card?.classList?.contains?.("jj-extra-card") ? 1 : 0; }
  return [messageId, card?.dataset?.actorId ?? "", card?.dataset?.tokenId ?? "", itemId, slot].join("|");
}

function pruneCardSelections() {
  if (CARD_ACTIVITY_SELECTIONS.size <= 500) return;
  const entries = [...CARD_ACTIVITY_SELECTIONS.entries()].sort((a,b) => Number(a[1]?.at ?? 0) - Number(b[1]?.at ?? 0));
  for (const [key] of entries.slice(0, Math.max(1, entries.length - 400))) CARD_ACTIVITY_SELECTIONS.delete(key);
}

export function rememberCardActivitySelection(card, activityOrId) {
  const key = cardSelectionKey(card);
  const activityId = typeof activityOrId === "string" ? activityOrId : activityOrId?.id;
  if (!key || !activityId) return false;
  CARD_ACTIVITY_SELECTIONS.set(key, { activityId: String(activityId), at: Date.now() });
  pruneCardSelections();
  return true;
}

export function rememberedCardActivityId(card) {
  const key = cardSelectionKey(card);
  return key ? CARD_ACTIVITY_SELECTIONS.get(key)?.activityId ?? null : null;
}

export function forgetCardActivitySelectionsForMessage(messageId) {
  if (!messageId) return 0;
  const prefix = `${messageId}|`;
  let removed = 0;
  for (const key of [...CARD_ACTIVITY_SELECTIONS.keys()]) {
    if (!key.startsWith(prefix)) continue;
    CARD_ACTIVITY_SELECTIONS.delete(key);
    removed++;
  }
  return removed;
}

export function activitiesOf(item) {
  const acts = item?.system?.activities;
  if (!acts) return [];
  try { return Array.from(acts.values?.() ?? acts); }
  catch (_) { return []; }
}

export function getActivityActor(card) {
  const actorId = card?.dataset?.actorId;
  const tokenId = card?.dataset?.tokenId;
  if (tokenId) return canvas?.tokens?.get(tokenId)?.actor ?? game.actors?.get(actorId) ?? null;
  return game.actors?.get(actorId) ?? null;
}

export function getCardActivity(card) {
  const actor = getActivityActor(card);
  const item = actor?.items?.get(card?.dataset?.itemId);
  const datasetId = card?.dataset?.activityId ?? null;
  const rememberedId = rememberedCardActivityId(card);
  const ids = [rememberedId, datasetId].filter(Boolean);
  let activity = null;
  let resolvedId = null;
  for (const id of ids) {
    activity = item?.system?.activities?.get?.(id) ?? activitiesOf(item).find(a => a.id === id);
    if (activity) { resolvedId = id; break; }
  }
  if (!rememberedId && activity && datasetId) rememberCardActivitySelection(card, activity);
  if (rememberedId && resolvedId === rememberedId && datasetId && datasetId !== rememberedId) {
    STATE.multiActivityAttackSelectionRecoveries = Number(STATE.multiActivityAttackSelectionRecoveries ?? 0) + 1;
    try { card.dataset.oprpgFixesSelectedActivityId = rememberedId; } catch (_) {}
  }
  return { actor, item, activity, activityId: resolvedId, datasetActivityId: datasetId, rememberedActivityId: rememberedId };
}

export async function applyTempHP(actor, amount) {
  amount = Math.max(0, Number(amount) || 0);
  if (!actor || !amount) return false;
  const hp = actor.system?.attributes?.hp;
  if (!hp) return false;
  const before = Number(hp.temp ?? 0);
  if (typeof actor.applyTempHP === "function") await actor.applyTempHP(amount);
  else if (amount > before) await actor.update({ "system.attributes.hp.temp": amount });
  const after = Number(actor.system?.attributes?.hp?.temp ?? before);
  return after !== before;
}
