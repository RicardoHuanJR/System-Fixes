import { STATE, getCardActivity } from "./shared.js";
import { level as hakiLevel } from "./haki-unified-rules.js";

const APPLY_ACTIONS = new Set(["jj-apply-damage", "jj-extra-apply", "jj-apply-save-dmg"]);
const PHYSICAL_TYPES = new Set(["bludgeoning", "piercing", "slashing"]);
export function shieldResistsDamage(actor, type) {
  if (!type || type === "force") return false; // Verdadeiro usa force no OPRPG.
  if (PHYSICAL_TYPES.has(type)) return true;
  return actor?.type === "character" && hakiLevel(actor, "corpo-armadurado") >= 2
    && !!actor.getFlag?.("oprpg-system", "corpoArmaduradoAtivo")
    && !!globalThis.CONFIG?.DND5E?.damageTypes?.[type];
}
const PENDING_MS = 5000;
const pendingActors = new Map();
const boundApplyButtons = new WeakSet();
const messageAdjustments = new Map();
const layerExpectations = new Map();
const LAYER_EXPECTATION_MS = 600;
let renderHookId = null;
let preUpdateHookId = null;
let updateActorHookId = null;
let preChatHookId = null;
let calculateDamageHookId = null;
let installed = false;

function now() { return Date.now(); }

function shieldValue(actor) {
  return Math.max(0, Number(actor?.system?.shieldPoints?.value ?? 0) || 0);
}

function shieldMax(actor) {
  return Math.max(0, Number(actor?.system?.shieldPoints?.max ?? 0) || 0);
}

function armorValue(actor) {
  return Math.max(0, Number(actor?.system?.armorPoints?.value ?? 0) || 0);
}

function readChange(changes, path) {
  if (!changes) return undefined;
  if (Object.prototype.hasOwnProperty.call(changes, path)) return changes[path];
  return foundry.utils.getProperty(changes, path);
}

function hasChange(changes, path) {
  if (!changes) return false;
  return Object.prototype.hasOwnProperty.call(changes, path) || foundry.utils.hasProperty(changes, path);
}

function writeChange(changes, path, value) {
  if (Object.keys(changes ?? {}).some(k => k.includes("."))) changes[path] = value;
  else foundry.utils.setProperty(changes, path, value);
}

function deleteChange(changes, path) {
  if (!changes) return;
  if (Object.prototype.hasOwnProperty.call(changes, path)) delete changes[path];
  try { foundry.utils.unsetProperty(changes, path); } catch (_) { /* flattened update */ }
}

function actorKey(actor) { return actor?.uuid ?? actor?.id ?? null; }

function markPending(actor, meta={}) {
  const key = actorKey(actor);
  if (!key) return;
  layerExpectations.delete(key);
  pendingActors.set(key, { ...meta, expires: now() + PENDING_MS });
}

function takePending(actor) {
  const key = actorKey(actor);
  if (!key) return null;
  const entry = pendingActors.get(key);
  if (!entry) return null;
  if (entry.expires < now()) {
    pendingActors.delete(key);
    return null;
  }
  return entry;
}

function clearPending(actor) {
  const key = actorKey(actor);
  if (key) pendingActors.delete(key);
}

function layerValue(actor, path, fallback=0) {
  const value = foundry.utils.getProperty(actor, path);
  return Math.max(0, Number(value ?? fallback) || 0);
}

function queueLayerExpectation(actor, adjustment) {
  const key = actorKey(actor);
  if (!key || !adjustment) return;
  layerExpectations.set(key, {
    transactionId: adjustment.transactionId ?? null,
    expires: now() + LAYER_EXPECTATION_MS,
    action: adjustment.action ?? null,
    expected: {
      armor: Math.max(0, Number(adjustment.armorAfter ?? adjustment.armorBefore ?? armorValue(actor)) || 0),
      shield: Math.max(0, Number(adjustment.shieldAfter ?? adjustment.shieldBefore ?? shieldValue(actor)) || 0),
      temp: Math.max(0, Number(adjustment.tempAfter ?? adjustment.tempBefore ?? actor?.system?.attributes?.hp?.temp ?? 0) || 0),
      hp: Math.max(0, Number(adjustment.hpAfter ?? adjustment.hpBefore ?? actor?.system?.attributes?.hp?.value ?? 0) || 0)
    },
    correcting: false
  });
}

function relevantLayerUpdate(changes) {
  if (!changes) return false;
  const paths = [
    "system.armorPoints.value",
    "system.shieldPoints.value",
    "system.attributes.hp.temp",
    "system.attributes.hp.value"
  ];
  if (paths.some(path => hasChange(changes, path))) return true;
  // Some Foundry/system code sends a parent object rather than leaf paths.
  return Object.keys(changes).some(key =>
    key === "system" || key === "system.attributes" || key === "system.attributes.hp" ||
    key === "system.armorPoints" || key === "system.shieldPoints"
  );
}

function reconcileLayerExpectation(actor, changes, options={}) {
  if (!actor || options?.oprpgFixesLayerCorrection === true || !relevantLayerUpdate(changes)) return false;
  const key = actorKey(actor);
  const entry = key ? layerExpectations.get(key) : null;
  if (!entry) return false;
  // Timing alone cannot identify a duplicate write: it could be a second
  // attack, healing, or a manual edit. Only reconcile explicitly linked writes.
  if (!entry.transactionId || options.oprpgFixesDamageTransaction !== entry.transactionId) return false;
  if (entry.expires < now()) {
    layerExpectations.delete(key);
    return false;
  }
  if (entry.correcting) return false;

  const actual = {
    armor: armorValue(actor),
    shield: shieldValue(actor),
    temp: Math.max(0, Number(actor?.system?.attributes?.hp?.temp ?? 0) || 0),
    hp: Math.max(0, Number(actor?.system?.attributes?.hp?.value ?? 0) || 0)
  };
  const expected = entry.expected;
  // A new heal, armor/shield change, or another identified card application is
  // independent. Never restore an old snapshot over such a change.
  if (actual.hp > expected.hp || actual.temp > expected.temp || actual.armor !== expected.armor || actual.shield !== expected.shield) {
    layerExpectations.delete(key);
    return false;
  }
  const patch = {};
  if (actual.armor !== expected.armor) patch["system.armorPoints.value"] = expected.armor;
  if (actual.shield !== expected.shield) patch["system.shieldPoints.value"] = expected.shield;
  if (actual.temp !== expected.temp) patch["system.attributes.hp.temp"] = expected.temp;
  if (actual.hp !== expected.hp) patch["system.attributes.hp.value"] = expected.hp;
  if (!Object.keys(patch).length) return false;

  entry.correcting = true;
  STATE.shieldLayerReconciliations = Number(STATE.shieldLayerReconciliations ?? 0) + 1;
  STATE.shieldLayerReconciliationLast = {
    actor: actor.name ?? actor.id,
    action: entry.action,
    actual, expected: { ...expected },
    patch: { ...patch },
    at: now()
  };
  queueMicrotask(async () => {
    try {
      if (layerExpectations.get(key) !== entry) return;
      if (Number(actor.system?.attributes?.hp?.value ?? 0) !== actual.hp || Number(actor.system?.attributes?.hp?.temp ?? 0) !== actual.temp) return;
      await actor.update(patch, { oprpgFixesLayerCorrection: true });
    } catch (error) {
      STATE.warnings.push(`Camadas de dano/reconciliação: ${error?.message ?? error}`);
    } finally {
      entry.correcting = false;
      // Keep the expectation briefly so a second immediate native update from the
      // same click cannot re-consume TempHP/PV after Shield Points were applied.
      setTimeout(() => {
        if (layerExpectations.get(key) === entry) layerExpectations.delete(key);
      }, 120);
    }
  });
  return true;
}

function queueMessageAdjustment(actor, data) {
  if (!actor?.id) return;
  const list = messageAdjustments.get(actor.id) ?? [];
  list.push({ ...data, expires: now() + PENDING_MS });
  messageAdjustments.set(actor.id, list);
}

function shiftMessageAdjustment(actorId) {
  if (!actorId) return null;
  const list = messageAdjustments.get(actorId) ?? [];
  while (list.length && list[0].expires < now()) list.shift();
  const next = list.shift() ?? null;
  if (list.length) messageAdjustments.set(actorId, list);
  else messageAdjustments.delete(actorId);
  return next;
}

function isPVEPrevailing(actor) {
  return actor?.type === "character" && actor.system?.attributes?.auraOn === false;
}

function parseDisplayedAmount(card, action) {
  const selectors = action === "jj-extra-apply"
    ? ["#jj-extra-total", "#jj-total-display"]
    : action === "jj-apply-save-dmg"
      ? ["#jj-save-total", "#jj-extra-total", "#jj-total-display"]
      : ["#jj-total-display", "#jj-extra-total", "#jj-save-total"];
  for (const selector of selectors) {
    const raw = card?.querySelector?.(selector)?.textContent?.trim();
    if (raw !== undefined && raw !== null && raw !== "" && Number.isFinite(Number(raw))) return Math.max(0, Number(raw));
  }
  const fallback = Number(card?.dataset?.totalDmg ?? NaN);
  return Number.isFinite(fallback) ? Math.max(0, fallback) : null;
}

function normalizeTypes(types) {
  if (types instanceof Set) return Array.from(types).map(String).filter(Boolean);
  if (Array.isArray(types)) return types.map(String).filter(Boolean);
  if (typeof types === "string") return types.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

function selectedDamageTypes(card) {
  const { activity } = getCardActivity(card);
  const parts = Array.from(activity?.damage?.parts ?? []);
  const selectors = Array.from(card?.querySelectorAll?.(".jj-dmg-part input[data-dmg-part]") ?? []);
  if (parts.length && selectors.length) {
    const selected = selectors.filter(cb => cb.checked).map(cb => Number(cb.dataset.dmgPart)).filter(Number.isInteger);
    const types = selected.flatMap(i => normalizeTypes(parts[i]?.types));
    if (types.length) return [...new Set(types)];
  }
  const activityTypes = parts.flatMap(p => normalizeTypes(p?.types));
  if (activityTypes.length) return [...new Set(activityTypes)];
  return [...new Set(normalizeTypes(card?.dataset?.damageTypes))];
}

function selectedPartIndices(card, partCount) {
  const selectors = Array.from(card?.querySelectorAll?.(".jj-dmg-part input[data-dmg-part]") ?? []);
  if (!selectors.length) return Array.from({length: partCount}, (_, i) => i);
  const selected = selectors.filter(cb => cb.checked).map(cb => Number(cb.dataset.dmgPart)).filter(Number.isInteger);
  return selected.filter(i => i >= 0 && i < partCount);
}

function exactTypedDamageFromDataset(card) {
  const raw = card?.dataset?.oprpgFixesTypedDamage;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const result = [];
    for (const entry of parsed) {
      const value = Math.max(0, Number(entry?.total ?? entry?.value ?? 0) || 0);
      const types = normalizeTypes(entry?.types ?? entry?.type);
      if (!value) continue;
      if (types.length !== 1) return null;
      result.push({ value, type: types[0] });
    }
    return result.length ? result : null;
  } catch (_) { return null; }
}

function typedDamageComponents(card, amount) {
  const exact = exactTypedDamageFromDataset(card);
  if (exact) {
    const exactTotal = exact.reduce((sum, d) => sum + d.value, 0);
    // Quarter/half/crit controls can change the displayed total after the roll.
    // Exact part values are only safe while they still match that total.
    if (Math.abs(exactTotal - Number(amount ?? 0)) < 0.0001) return { components: exact, exact: true, mixedSkipped: false };
    const modifier = card.querySelector?.(".jj-mod-check input:checked")?.dataset?.mod;
    const factor = modifier === "half" ? 0.5 : modifier === "quarter" ? 0.25 : null;
    if (factor !== null && Math.floor(exactTotal * factor) === Number(amount)) {
      const scaled = exact.map((part, index) => ({...part, value: Math.floor(part.value * factor), remainder: part.value * factor % 1, index}));
      let remaining = Number(amount) - scaled.reduce((sum, part) => sum + part.value, 0);
      for (const part of [...scaled].sort((a,b) => b.remainder-a.remainder || a.index-b.index)) {
        if (remaining-- > 0) part.value++;
      }
      return { components: scaled.map(({value,type})=>({value,type})), exact: true, mixedSkipped: false };
    }
    if (modifier === "crit" && card.dataset.oprpgFixesTypedCritical) {
      try {
        const critical = JSON.parse(card.dataset.oprpgFixesTypedCritical);
        if (Array.isArray(critical) && critical.every(p=>normalizeTypes(p.types).length===1)) {
          const components = [...exact, ...critical.map(p=>({value:Number(p.total)||0,type:normalizeTypes(p.types)[0]}))];
          if (components.reduce((sum,p)=>sum+p.value,0) === Number(amount)) return {components, exact:true, mixedSkipped:false};
        }
      } catch (_) {}
    }
  }

  const { activity } = getCardActivity(card);
  const parts = Array.from(activity?.damage?.parts ?? []);
  const indices = selectedPartIndices(card, parts.length);
  const types = indices.flatMap(i => normalizeTypes(parts[i]?.types));
  const unique = [...new Set(types)];
  if (unique.length === 1 && Number.isFinite(Number(amount))) {
    return { components: [{ value: Math.max(0, Number(amount) || 0), type: unique[0] }], exact: false, mixedSkipped: false };
  }
  if (unique.length > 1) return { components: null, exact: false, mixedSkipped: true };
  return { components: null, exact: false, mixedSkipped: false };
}

function summarizeCalculatedDamage(rawComponents, calculated) {
  if (!calculated || !Array.isArray(calculated)) return null;
  const raw = rawComponents.reduce((sum, d) => sum + Math.max(0, Number(d.value) || 0), 0);
  const amount = Math.max(0, Number(calculated.amount ?? calculated.reduce((sum, d) => sum + Math.max(0, Number(d?.value) || 0), 0)) || 0);
  const parts = calculated.map((d, i) => ({
    type: d?.type ?? rawComponents[i]?.type ?? null,
    before: Math.max(0, Number(rawComponents[i]?.value ?? 0) || 0),
    after: Math.max(0, Number(d?.value ?? 0) || 0),
    immunity: !!(d?.active?.type?.immunity || d?.active?.all?.immunity),
    resistance: !!(d?.active?.type?.resistance || d?.active?.all?.resistance),
    vulnerability: !!(d?.active?.type?.vulnerability || d?.active?.all?.vulnerability),
    endurecimento: !!(d?.active?.type?.oprpgEndurecimentoDefensivo || d?.active?.all?.oprpgEndurecimentoDefensivo)
  }));
  return { raw, amount, delta: amount - raw, parts };
}

function calculateTypedDamage(actor, components, pending) {
  if (!actor || !Array.isArray(components) || !components.length || typeof actor.calculateDamage !== "function") return null;
  try {
    const damages = components.map(d => ({ value: Math.max(0, Number(d.value) || 0), type: d.type }));
    const options = { ignore: { threshold: true }, oprpgDeferShield: true };
    // Preserve source documents when possible so system hooks/effects can inspect
    // the origin. The damage target is still `actor`.
    if (pending?.originItem) options.origin = pending.originItem;
    const calculated = actor.calculateDamage(damages, options);
    if (!calculated) return null;
    // Foundry/OPRPG builds do not all dispatch dnd5e.calculateDamage in the same
    // place. Apply the Endurecimento rule directly to the calculated parts as a
    // fallback, but only when native resistance or our hook has not already done so.
    const prevented = 0; // The card applies shield resistance after its reduction/armor layers.
    if (prevented > 0) {
      STATE.shieldTypedResistanceFallbacks = Number(STATE.shieldTypedResistanceFallbacks ?? 0) + 1;
      STATE.shieldTypedResistanceFallbackLast = { actor: actor.name ?? actor.id, prevented, at: now() };
    }
    return { calculated, summary: summarizeCalculatedDamage(damages, calculated) };
  } catch (error) {
    STATE.warnings.push(`Tipos de dano/calculateDamage: ${error?.message ?? error}`);
    return null;
  }
}

function isPhysicalOnly(types) {
  return !!types?.length && types.every(t => PHYSICAL_TYPES.has(t));
}

export function captureCardMeta(button, card) {
  const action = button.dataset?.action ?? "";
  const damageTypes = selectedDamageTypes(card);
  const amount = parseDisplayedAmount(card, action);
  const typed = typedDamageComponents(card, amount);
  const { actor: sourceActor, item, activityId } = getCardActivity(card);
  return {
    action,
    amount,
    damageTypes,
    typedDamage: typed.components,
    typedExact: typed.exact,
    mixedTypedUnresolved: typed.mixedSkipped,
    physicalOnly: isPhysicalOnly(damageTypes),
    trueDamage: damageTypes.length > 0 && damageTypes.every(t => t === "force"),
    originItem: item ?? null,
    sourceActorId: sourceActor?.id ?? card.dataset?.actorId ?? null,
    sourceTokenId: card.dataset?.tokenId ?? null,
    messageId: button.closest?.("[data-message-id]")?.dataset?.messageId ?? null,
    itemId: card.dataset?.itemId ?? null,
    activityId: activityId ?? card.dataset?.activityId ?? null
  };
}

function bindApplyButtons(root) {
  if (!root) return 0;
  const buttons = [];
  if (root.matches?.("[data-action]")) buttons.push(root);
  for (const button of root.querySelectorAll?.("[data-action]") ?? []) buttons.push(button);
  let count = 0;

  for (const button of buttons) {
    if (!APPLY_ACTIONS.has(button.dataset?.action)) continue;
    const card = button.closest?.(".jujutsu-card, .jj-card, [data-item-id]");
    if (!card) continue;
    if (boundApplyButtons.has(button)) continue;
    boundApplyButtons.add(button);
    button.dataset.oprpgFixesShieldCapture = "1";
    button.addEventListener("click", () => {
      if (button.dataset.action === "jj-extra-apply" && card.dataset.cardType !== "damage") return;
      const meta = captureCardMeta(button, card);
      const tokens = Array.from(canvas?.tokens?.controlled ?? []);
      if (!tokens.length) return;
      for (const token of tokens) {
        if (!token?.actor) continue;
        markPending(token.actor, meta);
      }
    }, { capture: true });
    count++;
  }
  return count;
}

/** Apply one explicit target through the same defenses as native cards. */
export async function applyTargetCardDamage(actor, meta) {
  if (!actor?.isOwner) throw Error("Sem permissão para alterar este alvo.");
  if (!Number.isFinite(meta.amount) || meta.amount < 0) throw Error("Dano inválido.");
  if (isPVEPrevailing(actor)) throw Error("Use a resolução de Vitalidade para este alvo.");
  const changes = { "system.attributes.hp.value": actor.system?.attributes?.hp?.value ?? 0 };
  markPending(actor, meta);
  let adjustment;
  try {
    adjustment = repairNativeCardLayers(actor, changes);
    if (!adjustment) throw Error("Não foi possível calcular as defesas deste alvo.");
    // This path sends one complete update; native follow-up reconciliation is unnecessary.
    layerExpectations.delete(actorKey(actor));
    const queue = messageAdjustments.get(actor.id);
    if (queue) {
      const index = queue.findLastIndex(entry => entry.at === adjustment.at && entry.messageId === adjustment.messageId);
      if (index >= 0) queue.splice(index, 1);
      if (!queue.length) messageAdjustments.delete(actor.id);
    }
    Hooks.callAll("oprpgFixes.preShieldDamageApplied", { actor, changes, adjustment });
    Object.assign(changes, meta.receiptChanges ?? {});
    if (Object.keys(changes).length) await actor.update(changes);
    return adjustment;
  } finally {
    clearPending(actor);
    layerExpectations.delete(actorKey(actor));
  }
}

/**
 * Reproduces the OPRPG custom-card layering with the two missing native rules:
 * Endurecimento Defensivo physical resistance and Shield Points before TempHP.
 * Pure helper used both by the patch and static regression tests.
 */
export function computeCardDamageLayers({
  amount=0,
  reduction=0,
  reductionPersistent=false,
  armor=0,
  shield=0,
  temp=0,
  hp=0,
  trueDamage=false,
  physicalResistance=false,
  damageParts=null
}={}) {
  const requested = Math.max(0, Number(amount) || 0);
  const reductionBefore = Math.max(0, Number(reduction) || 0);
  const armorBefore = Math.max(0, Number(armor) || 0);
  const shieldBefore = Math.max(0, Number(shield) || 0);
  const tempBefore = Math.max(0, Number(temp) || 0);
  const hpBefore = Math.max(0, Number(hp) || 0);

  let remaining = requested;

  const reductionAbsorbed = remaining > 0 ? Math.min(reductionBefore, remaining) : 0;
  remaining -= reductionAbsorbed;
  const consumeReduction = reductionAbsorbed > 0 && !reductionPersistent;

  let armorAbsorbed = 0;
  let armorSpent = 0;
  if (armorBefore > 0 && remaining > 0 && !trueDamage) {
    armorAbsorbed = Math.min(remaining, armorBefore * 2);
    armorSpent = Math.ceil(armorAbsorbed / 2);
    remaining -= armorAbsorbed;
  }

  // Attribute preceding layers to parts in displayed order. A resistant shield
  // cannot halve damage that already passed through its exhausted pool.
  let priorAbsorption = reductionAbsorbed + armorAbsorbed;
  let pool = shieldBefore, shieldAbsorbed = 0, resistanceReduced = 0, overflow = 0;
  const parts = damageParts?.length ? damageParts : [{after:requested, shieldResistant:physicalResistance}];
  for(const part of parts){
    let value=Math.max(0,Number(part.after)||0);
    const beforeShield=Math.min(priorAbsorption,value);value-=beforeShield;priorAbsorption-=beforeShield;
    const resistant=part.shieldResistant===true;
    if(pool>0&&resistant){
      const effective=Math.trunc(value/2);
      if(effective<=pool){shieldAbsorbed+=effective;pool-=effective;resistanceReduced+=value-effective;}
      else {resistanceReduced+=pool;shieldAbsorbed+=pool;overflow+=value-2*pool;pool=0;}
    }else {const absorbed=Math.min(pool,value);pool-=absorbed;shieldAbsorbed+=absorbed;overflow+=value-absorbed;}
  }
  remaining=overflow;
  const afterResistance=requested-resistanceReduced;

  const tempAbsorbed = remaining > 0 ? Math.min(tempBefore, remaining) : 0;
  remaining -= tempAbsorbed;

  const hpLoss = Math.min(hpBefore, Math.max(0, remaining));
  remaining -= hpLoss;

  return {
    requested,
    afterResistance,
    resistanceReduced,
    reductionBefore,
    reductionAbsorbed,
    consumeReduction,
    armorBefore,
    armorAbsorbed,
    armorSpent,
    armorAfter: Math.max(0, armorBefore - armorSpent),
    shieldBefore,
    shieldAbsorbed,
    shieldAfter: Math.max(0, shieldBefore - shieldAbsorbed),
    tempBefore,
    tempAbsorbed,
    tempAfter: Math.max(0, tempBefore - tempAbsorbed),
    hpBefore,
    hpLoss,
    hpAfter: Math.max(0, hpBefore - hpLoss),
    trueDamage: !!trueDamage,
    physicalResistance: !!physicalResistance,
    unabsorbed: Math.max(0, remaining)
  };
}

function recognizedDamageUpdate(changes) {
  return hasChange(changes, "system.attributes.hp.temp") ||
    hasChange(changes, "system.attributes.hp.value") ||
    hasChange(changes, "system.armorPoints.value") ||
    hasChange(changes, "system.shieldPoints.value") ||
    hasChange(changes, "flags.oprpg-system.-=reducaoDano") ||
    hasChange(changes, "flags.oprpg-system.reducaoDano");
}

function repairNativeCardLayers(actor, changes) {
  if (!actor || !changes) return null;
  const pending = takePending(actor);
  if (!pending) return null;
  if (isPVEPrevailing(actor)) {
    clearPending(actor);
    return null;
  }
  if (!recognizedDamageUpdate(changes)) return null;

  const hp = actor.system?.attributes?.hp;
  if (!hp) {
    clearPending(actor);
    return null;
  }

  // If the card total cannot be read, retain the proven 1.4.0 behavior: derive
  // the amount which penetrated the native layers and only insert Shield Points.
  if (!Number.isFinite(pending.amount)) {
    const shieldBefore = shieldValue(actor);
    if (shieldBefore <= 0) { clearPending(actor); return null; }
    const tempBefore = Math.max(0, Number(hp.temp ?? 0) || 0);
    const hpBefore = Math.max(0, Number(hp.value ?? 0) || 0);
    const rawTempAfter = readChange(changes, "system.attributes.hp.temp");
    const rawHpAfter = readChange(changes, "system.attributes.hp.value");
    const tempAfterNative = rawTempAfter === undefined ? tempBefore : Math.max(0, Number(rawTempAfter) || 0);
    const hpAfterNative = rawHpAfter === undefined ? hpBefore : Math.max(0, Number(rawHpAfter) || 0);
    const tempLossNative = Math.max(0, tempBefore - tempAfterNative);
    const hpLossNative = Math.max(0, hpBefore - hpAfterNative);
    const penetratedNative = tempLossNative + hpLossNative;
    if (penetratedNative <= 0) { clearPending(actor); return null; }
    const absorbed = Math.min(shieldBefore, penetratedNative);
    let restore = absorbed;
    const restoreHp = Math.min(restore, hpLossNative);
    restore -= restoreHp;
    const restoreTemp = Math.min(restore, tempLossNative);
    const hpAfter = hpAfterNative + restoreHp;
    const tempAfter = tempAfterNative + restoreTemp;
    if (rawHpAfter !== undefined) writeChange(changes, "system.attributes.hp.value", hpAfter);
    if (rawTempAfter !== undefined) writeChange(changes, "system.attributes.hp.temp", tempAfter);
    writeChange(changes, "system.shieldPoints.value", shieldBefore - absorbed);
    clearPending(actor);
    const fallback = {
      actor: actor.name ?? actor.id ?? null,
      actorId: actor.id,
      action: pending.action,
      sourceActorId: pending.sourceActorId ?? null,
      sourceTokenId: pending.sourceTokenId ?? null,
      messageId: pending.messageId ?? null,
      itemId: pending.itemId ?? null,
      activityId: pending.activityId ?? null,
      originItem: pending.originItem ?? null,
      damageTypes: pending.damageTypes ?? [],
      requested: penetratedNative,
      afterResistance: penetratedNative,
      resistanceReduced: 0,
      reductionAbsorbed: 0,
      armorBefore: armorValue(actor),
      armorAfter: readChange(changes, "system.armorPoints.value") ?? armorValue(actor),
      armorAbsorbed: 0,
      armorSpent: 0,
      shieldBefore,
      shieldAfter: shieldBefore - absorbed,
      shieldAbsorbed: absorbed,
      tempBefore,
      tempAfter,
      tempAbsorbed: Math.max(0, tempBefore - tempAfter),
      hpBefore,
      hpAfter,
      hpLoss: Math.max(0, hpBefore - hpAfter),
      fallback: true,
      at: now()
    };
    Hooks.callAll("oprpgFixes.modifyCardDamage", { actor, changes, adjustment: fallback });
    queueMessageAdjustment(actor, fallback);
    STATE.shieldPointsAbsorbed = Number(STATE.shieldPointsAbsorbed ?? 0) + Math.max(0, Number(fallback.shieldAbsorbed ?? 0) || 0);
    STATE.shieldPointsLast = fallback;
    return fallback;
  }

  const redFlag = actor.getFlag?.("oprpg-system", "reducaoDano") ?? null;
  const reduction = Math.max(0, Number(redFlag?.valor ?? 0) || 0);
  const shieldBefore = shieldValue(actor);

  // The custom OPRPG card historically bypasses Actor.calculateDamage entirely.
  // Route only the *typed* portion through the native calculator so ordinary
  // immunity/resistance/vulnerability remains owned by the system. For mixed
  // native cards where per-part totals are unavailable, stay conservative and
  // keep the old amount rather than guessing how to split it. Multi-Activity
  // rolls created by this module expose exact typed part totals and are safe.
  const typed = pending.typedDamage ? calculateTypedDamage(actor, pending.typedDamage, pending) : null;
  const amountAfterTypes = typed?.summary ? typed.summary.amount : pending.amount;
  const physicalResistance = !typed?.summary && shieldBefore > 0 && shieldMax(actor) > 0 && pending.physicalOnly === true;
  const result = computeCardDamageLayers({
    amount: amountAfterTypes,
    reduction,
    reductionPersistent: !!redFlag?.persistente,
    armor: armorValue(actor),
    shield: shieldBefore,
    temp: hp.temp,
    hp: hp.value,
    trueDamage: pending.trueDamage === true,
    physicalResistance,
    damageParts: typed?.summary?.parts.map(p=>({...p,shieldResistant:shieldMax(actor)>0&&shieldResistsDamage(actor,p.type)&&!p.resistance}))
  });
  result.rawRequested = Math.max(0, Number(pending.amount) || 0);
  result.damageTypeResolution = typed?.summary ?? null;
  result.typedDamageExact = !!pending.typedExact;
  result.mixedTypedUnresolved = !!pending.mixedTypedUnresolved;

  if (typed?.summary) {
    STATE.damageTypePipelineResolved = Number(STATE.damageTypePipelineResolved ?? 0) + 1;
    STATE.damageTypePipelineLast = {
      actor: actor.name ?? actor.id,
      action: pending.action,
      exact: !!pending.typedExact,
      ...typed.summary,
      at: now()
    };
  } else if (pending.mixedTypedUnresolved) {
    STATE.damageTypePipelineMixedSkipped = Number(STATE.damageTypePipelineMixedSkipped ?? 0) + 1;
    STATE.damageTypePipelineLast = { actor: actor.name ?? actor.id, action: pending.action, skipped: "mixed-without-part-totals", at: now() };
  }

  // Replace the custom card's parallel result with the same layer ordering the
  // native OPRPG data model describes. This also corrects Armor consumption when
  // Endurecimento halves the incoming physical damage before absorption layers.
  if (result.armorAfter !== result.armorBefore) writeChange(changes, "system.armorPoints.value", result.armorAfter);
  else deleteChange(changes, "system.armorPoints.value");

  if (result.shieldAfter !== result.shieldBefore) writeChange(changes, "system.shieldPoints.value", result.shieldAfter);
  else deleteChange(changes, "system.shieldPoints.value");

  if (result.tempAfter !== result.tempBefore) writeChange(changes, "system.attributes.hp.temp", result.tempAfter);
  else deleteChange(changes, "system.attributes.hp.temp");

  if (result.hpAfter !== result.hpBefore) writeChange(changes, "system.attributes.hp.value", result.hpAfter);
  else deleteChange(changes, "system.attributes.hp.value");

  if (result.consumeReduction) {
    const left=result.reductionBefore-result.reductionAbsorbed;
    if(left>0){
      deleteChange(changes,"flags.oprpg-system.-=reducaoDano");
      writeChange(changes,"flags.oprpg-system.reducaoDano",{...redFlag,valor:left});
    }else{
      deleteChange(changes,"flags.oprpg-system.reducaoDano");
      writeChange(changes, "flags.oprpg-system.-=reducaoDano", null);
    }
  } else {
    deleteChange(changes, "flags.oprpg-system.-=reducaoDano");
    deleteChange(changes, "flags.oprpg-system.reducaoDano");
  }

  clearPending(actor);
  const adjustment = {
    actor: actor.name ?? actor.id ?? null,
    actorId: actor.id,
    action: pending.action,
    damageTypes: pending.damageTypes,
    sourceActorId: pending.sourceActorId ?? null,
    sourceTokenId: pending.sourceTokenId ?? null,
    messageId: pending.messageId ?? null,
    itemId: pending.itemId ?? null,
    activityId: pending.activityId ?? null,
    originItem: pending.originItem ?? null,
    ...result,
    at: now()
  };

  // Native-repair extensions (Power Up RED, Intangibility, Predador) modify the
  // already-computed OPRPG layers synchronously here. This keeps one damage
  // pipeline and lets the chat rewrite reflect the final state.
  Hooks.callAll("oprpgFixes.modifyCardDamage", { actor, changes, adjustment });
  // The custom card can perform more than one Actor update for a single click on
  // some OPRPG builds. Preserve the final sequential layer result across those
  // immediate follow-up updates so TempHP/PV cannot be consumed in parallel with
  // Shield Points.
  queueLayerExpectation(actor, adjustment);
  queueMessageAdjustment(actor, adjustment);

  STATE.shieldPointsAbsorbed = Number(STATE.shieldPointsAbsorbed ?? 0) + Math.max(0, Number(adjustment.shieldAbsorbed ?? 0) || 0);
  STATE.shieldPhysicalResistancePrevented = Number(STATE.shieldPhysicalResistancePrevented ?? 0) + Math.max(0, Number(adjustment.resistanceReduced ?? 0) || 0);
  STATE.shieldPointsLast = adjustment;
  return adjustment;
}

function activeNativeResistance(damage) {
  return !!(damage?.active?.type?.resistance || damage?.active?.all?.resistance);
}

function endurecimentoAlreadyApplied(damage) {
  return !!(damage?.active?.type?.oprpgEndurecimentoDefensivo || damage?.active?.all?.oprpgEndurecimentoDefensivo);
}

function resistanceIgnored(options, type) {
  const ignored = options?.ignore;
  if (ignored === true || ignored?.resistance === true) return true;
  return !!(ignored?.resistance?.has?.(type) || ignored?.resistance?.has?.("ALL"));
}

/** Add the missing Endurecimento resistance to the actual Actor.calculateDamage pipeline. */
export function applyEndurecimentoToNativeDamage(actor, damages, options={}) {
  if (options?.oprpgDeferShield || !actor || !damages || shieldValue(actor) <= 0 || shieldMax(actor) <= 0) return 0;
  let prevented = 0;
  let pool = shieldValue(actor);
  for (const damage of damages) {
    if (!(Number(damage?.value) > 0)) continue;
    if(endurecimentoAlreadyApplied(damage)){pool=Math.max(0,pool-Number(damage.value));continue;}
    if (!shieldResistsDamage(actor, damage?.type) || activeNativeResistance(damage) || resistanceIgnored(options, damage.type)) {pool=Math.max(0,pool-Number(damage.value));continue;}
    const before = Number(damage.value) || 0;
    const after = pool>0 ? (Math.trunc(before/2)<=pool ? Math.trunc(before/2) : before-pool) : before;
    pool=Math.max(0,pool-Math.min(pool,after));
    if (after === before) continue;
    damage.value = after;
    damage.active ??= {};
    (damage.active.type ??= {}).oprpgEndurecimentoDefensivo = true;
    prevented += before - after;
  }
  if (prevented > 0 && Number.isFinite(Number(damages.amount))) {
    damages.amount = Math.trunc(Math.max(0, Number(damages.amount) - prevented));
    STATE.shieldPhysicalResistancePrevented = Number(STATE.shieldPhysicalResistancePrevented ?? 0) + prevented;
    STATE.shieldPhysicalResistanceLast = { actor: actor.name ?? actor.id, prevented, at: now(), source: "Actor.calculateDamage" };
  }
  return prevented;
}

export function rewriteNativeDamageMessage(content, adjustment) {
  if (!content || !adjustment) return content;
  if (!String(content).includes("🛡️") || !String(content).includes(" de dano):")) return content;
  const splitAt = String(content).indexOf(":", String(content).indexOf(" de dano)"));
  if (splitAt < 0) return content;
  const prefix = String(content).slice(0, splitAt + 1);
  const segments = [];

  if (adjustment.intangibilityBlocked) {
    return `${prefix} <strong>Intangibilidade</strong> anulou todo o dano${adjustment.intangibilityReason ? ` (${adjustment.intangibilityReason})` : ""}.`;
  }

  if (adjustment.damageTypeResolution && adjustment.damageTypeResolution.raw !== adjustment.damageTypeResolution.amount) {
    const a = adjustment.damageTypeResolution;
    segments.push(`Defesas por tipo ajustaram <strong>${a.raw}</strong> → <strong>${a.amount}</strong>`);
  } else if (adjustment.mixedTypedUnresolved) {
    segments.push(`tipos mistos mantidos sem ajuste automático (totais por parte indisponíveis)`);
  }

  if (adjustment.resistanceReduced > 0) {
    segments.push(`Endurecimento Defensivo resistiu <strong>${adjustment.resistanceReduced}</strong>`);
  }
  if (adjustment.reductionAbsorbed > 0) {
    segments.push(`Redução de Dano reduziu <strong>${adjustment.reductionAbsorbed}</strong>`);
  }
  if (adjustment.trueDamage && adjustment.armorBefore > 0) {
    segments.push(`Dano <strong>Verdadeiro</strong> ignorou a armadura`);
  } else if (adjustment.armorAbsorbed > 0) {
    const extra = adjustment.armorAbsorbed - adjustment.armorSpent;
    segments.push(`Pontos de Armadura absorveram <strong>${adjustment.armorAbsorbed}</strong> (${adjustment.armorSpent} PA${extra > 0 ? `, resistência evitou ${extra} a mais` : ""})`);
  }
  if (adjustment.shieldAbsorbed > 0) segments.push(`Pontos de Escudo absorveram <strong>${adjustment.shieldAbsorbed}</strong>`);
  if (adjustment.tempAbsorbed > 0) segments.push(`PV temporário absorveu <strong>${adjustment.tempAbsorbed}</strong>`);
  if (adjustment.powerUpRed?.hpPrevented > 0) {
    segments.push(`Power Up protegeu <strong>${adjustment.powerUpRed.hpPrevented}</strong> PV (${adjustment.powerUpRed.next}/${adjustment.powerUpRed.threshold} de dano na forma)`);
  }
  if (adjustment.powerUpRed?.broken) segments.push(`a forma do Power Up foi rompida`);
  if (adjustment.hpLoss > 0) segments.push(`PV recebeu <strong>${adjustment.hpLoss}</strong>`);
  if (!segments.length) segments.push(`nenhum PV foi perdido`);
  return `${prefix} ${segments.join("; ")}.`;
}

function installHooks() {
  renderHookId = Hooks.on("renderChatMessageHTML", (message, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (root) bindApplyButtons(root);
  });

  preUpdateHookId = Hooks.on("preUpdateActor", (actor, changes, options={}) => {
    try {
      const adjustment = repairNativeCardLayers(actor, changes);
      if (adjustment) {
        adjustment.transactionId = foundry.utils.randomID();
        options.oprpgFixesDamageTransaction = adjustment.transactionId;
        queueLayerExpectation(actor, adjustment);
        Hooks.callAll("oprpgFixes.preShieldDamageApplied", { actor, changes, adjustment });
      }
    } catch (error) {
      STATE.warnings.push(`Pontos de Escudo/preUpdateActor: ${error?.message ?? error}`);
      console.error("oprpg-system-fixes | Falha ao reparar camadas de dano do card", error);
    }
  });

  updateActorHookId = Hooks.on("updateActor", (actor, changes, options) => {
    try { reconcileLayerExpectation(actor, changes, options); }
    catch (error) { STATE.warnings.push(`Pontos de Escudo/updateActor: ${error?.message ?? error}`); }
  });

  calculateDamageHookId = Hooks.on("dnd5e.calculateDamage", (actor, damages, options) => {
    try { applyEndurecimentoToNativeDamage(actor, damages, options); }
    catch (error) {
      STATE.warnings.push(`Endurecimento/calculateDamage: ${error?.message ?? error}`);
      console.error("oprpg-system-fixes | Falha ao aplicar resistência do Endurecimento", error);
    }
  });

  preChatHookId = Hooks.on("preCreateChatMessage", (message, data) => {
    try {
      const actorId = data?.speaker?.actor ?? message?.speaker?.actor ?? null;
      if (!actorId) return;
      const queue = messageAdjustments.get(actorId);
      if (!queue?.length) return;
      const content = data?.content ?? message?.content ?? "";
      if (!String(content).includes("🛡️") || !String(content).includes(" de dano):")) return;
      const adjustment = shiftMessageAdjustment(actorId);
      if (!adjustment) return;
      const rewritten = rewriteNativeDamageMessage(content, adjustment);
      if (rewritten === content) return;
      if (typeof message?.updateSource === "function") message.updateSource({ content: rewritten });
      else data.content = rewritten;
    } catch (error) {
      STATE.warnings.push(`Pontos de Escudo/chat: ${error?.message ?? error}`);
    }
  });

  requestAnimationFrame?.(() => {
    try { bindApplyButtons(document); }
    catch (_) { /* chat may not be mounted */ }
  });

  return !!(renderHookId && preUpdateHookId && updateActorHookId && calculateDamageHookId);
}

export function installShieldPointsPatch() {
  if (installed) return true;
  installed = true;
  STATE.shieldPointsPatch = installHooks();
  STATE.shieldPointsNativeCard = false;
  STATE.shieldPointsPatchMode = "native-card-layer-repair";
  STATE.shieldPhysicalResistancePatch = !!calculateDamageHookId;
  STATE.damageTypePipelinePatch = true;
  return STATE.shieldPointsPatch;
}

export function shieldPointsStatus(actor = null) {
  const currentActor = actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game?.user?.character ?? null;
  let nativeActorApplyDamageSupport = false;
  try {
    const fn = CONFIG?.Actor?.documentClass?.prototype?.applyDamage;
    nativeActorApplyDamageSupport = typeof fn === "function" && /shieldPoints/i.test(Function.prototype.toString.call(fn));
  } catch (_) { /* diagnostic only */ }
  return {
    installed: !!STATE.shieldPointsPatch,
    mode: STATE.shieldPointsPatchMode ?? null,
    nativeActorApplyDamageSupport,
    nativeCardSupportDetected: false,
    physicalResistance: !!STATE.shieldPhysicalResistancePatch,
    sequentialLayerGuard: !!updateActorHookId,
    layerGuardScope: "explicit-damage-transaction",
    absorbedTotal: Number(STATE.shieldPointsAbsorbed ?? 0),
    physicalResistancePrevented: Number(STATE.shieldPhysicalResistancePrevented ?? 0),
    typedResistanceFallbacks: Number(STATE.shieldTypedResistanceFallbacks ?? 0),
    layerReconciliations: Number(STATE.shieldLayerReconciliations ?? 0),
    layerReconciliationLast: STATE.shieldLayerReconciliationLast ?? null,
    last: STATE.shieldPointsLast ?? null,
    actor: currentActor ? {
      name: currentActor.name,
      value: shieldValue(currentActor),
      max: shieldMax(currentActor)
    } : null
  };
}

export function previewTypedDamage(actor, components=[]) {
  const normalized = Array.from(components ?? []).map(entry => ({
    value: Math.max(0, Number(entry?.value ?? entry?.total ?? 0) || 0),
    type: String(entry?.type ?? normalizeTypes(entry?.types)[0] ?? "")
  })).filter(entry => entry.value > 0 && entry.type);
  const resolved = calculateTypedDamage(actor, normalized, {});
  return resolved ? { input: normalized, ...resolved.summary, parts: resolved.summary?.parts ?? [] } : null;
}

export function damageTypePipelineStatus() {
  return {
    installed: !!STATE.damageTypePipelinePatch,
    mode: "native-actor-calculateDamage-before-oprpg-layers",
    preservesNativeTraits: true,
    exactMixedFromMultiActivity: true,
    unresolvedMixedNativeCards: Number(STATE.damageTypePipelineMixedSkipped ?? 0),
    resolved: Number(STATE.damageTypePipelineResolved ?? 0),
    last: STATE.damageTypePipelineLast ?? null
  };
}

/** Dry-run helper for diagnostics; it never updates the Actor. */
export function previewShieldDamage(actor, amount, { damageTypes=[] }={}) {
  const hp = actor?.system?.attributes?.hp ?? {};
  const redFlag = actor?.getFlag?.("oprpg-system", "reducaoDano") ?? null;
  return computeCardDamageLayers({
    amount,
    reduction: redFlag?.valor ?? 0,
    reductionPersistent: !!redFlag?.persistente,
    armor: armorValue(actor),
    shield: shieldValue(actor),
    temp: hp.temp,
    hp: hp.value,
    trueDamage: normalizeTypes(damageTypes).length > 0 && normalizeTypes(damageTypes).every(t => t === "force"),
    physicalResistance: shieldValue(actor) > 0 && isPhysicalOnly(normalizeTypes(damageTypes))
  });
}
