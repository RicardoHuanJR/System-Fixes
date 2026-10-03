import { showPrivateDice, rollAudience } from './roll-privacy.js';
import { MODULE_ID, STATE, activitiesOf, getCardActivity, canAct } from "./shared.js";
import { actorAkuma, akumaPath, actorLevel, powerUpOptionEnabled, isInstantActivity } from "./akuma-fix.js";
import { hakiInfusionApplies } from "./haki-awakening-fix.js";

const INTANG_FLAG = "intangibilityActive";
const INTANG_BYPASS_FLAG = "intangibilityBypassNext";
const RED_DAMAGE_FLAG = "powerUpRedDamage";
const PREDATOR_HP_FLAG = "predatorHpRecovered";
const PREDATOR_PP_FLAG = "predatorPpRecovered";
const PREDATOR_TURN_FLAG = "predatorLastUseTurn";
const POWERUP_DAMAGE_FLAG = "powerUpDamage";
const SAVE_TTL_MS = 2 * 60 * 1000;
const DAMAGE_TTL_MS = 60 * 1000;

const predatorDamage = new Map();
const pendingSaves = new Map();
const saveMessagesSeen = new Set();
const boundDamageCards = new WeakSet();
const patchedSheetPrototypes = new WeakSet();
const appliedSaveConfigs = new WeakSet();
const predatorInFlight = new WeakSet();

let modifyDamageHookId = null;
let preUpdateActorHookId = null;
let updateCombatHookId = null;
let renderHookId = null;
let saveHookId = null;
let saveLegacyHookId = null;
let restHookId = null;
let installed = false;

const now = () => Date.now();

function readChange(changes, path) {
  if (!changes) return undefined;
  if (Object.prototype.hasOwnProperty.call(changes, path)) return changes[path];
  try { return foundry.utils.getProperty(changes, path); }
  catch (_) { return undefined; }
}

function hasChange(changes, path) {
  if (!changes) return false;
  if (Object.prototype.hasOwnProperty.call(changes, path)) return true;
  try { return foundry.utils.hasProperty(changes, path); }
  catch (_) { return false; }
}

function writeChange(changes, path, value) {
  if (Object.keys(changes ?? {}).some(k => k.includes("."))) changes[path] = value;
  else foundry.utils.setProperty(changes, path, value);
}

function deleteChange(changes, path) {
  if (!changes) return;
  if (Object.prototype.hasOwnProperty.call(changes, path)) delete changes[path];
  try { foundry.utils.unsetProperty(changes, path); } catch (_) {}
}

function htmlToText(value) {
  const raw = String(value ?? "");
  try {
    const tmp = document.createElement("div");
    tmp.innerHTML = raw;
    return tmp.textContent ?? raw;
  } catch (_) { return raw.replace(/<[^>]*>/g, " "); }
}

function primitiveSearch(value, predicate, depth=0) {
  if (depth > 4 || value == null) return false;
  if (["string", "number", "boolean"].includes(typeof value)) return predicate(value, "");
  if (Array.isArray(value)) return value.some(v => primitiveSearch(v, predicate, depth + 1));
  if (typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (predicate(child, key)) return true;
    if (child && typeof child === "object" && primitiveSearch(child, predicate, depth + 1)) return true;
  }
  return false;
}

function isLogia(actor) {
  const akuma = actorAkuma(actor);
  if (!akuma) return false;
  const type = String(akuma.tipo ?? akuma.type ?? "").toLowerCase();
  if (type) return type === "logia";
  return primitiveSearch(akuma, (value, key) => {
    if (typeof value === "string" && /\blogia\b/i.test(value)) return true;
    return /tipo|type|classe|class/i.test(key) && typeof value === "string" && /\blogia\b/i.test(value);
  });
}

function hasPredator(actor) {
  const akuma = actorAkuma(actor);
  if (akuma?.predador !== undefined) return akuma.predador === true;
  if (akuma && primitiveSearch(akuma, (value, key) => (/predador/i.test(key) && value === true) || (typeof value === "string" && /\bpredador\b/i.test(value)))) return true;
  return Array.from(actor?.items ?? []).some(item => /\bpredador\b/i.test(String(item?.name ?? "")) || /\bpredador\b/i.test(htmlToText(item?.system?.description?.value)));
}

function currentTurnKey(actor) {
  const combat = game?.combat;
  if (combat?.started) {
    const combatant = Array.from(combat.combatants ?? []).find(c => c.actor?.id === actor?.id);
    return `combat:${combat.id}:${combat.round ?? 0}:${combat.turn ?? 0}:${combatant?.id ?? actor?.id ?? "?"}`;
  }
  return `time:${Math.floor(now() / 6000)}`;
}

function markIntangibilityActivation(actor, changes) {
  const combat = game?.combat;
  const flag = {
    at: now(),
    expires: now() + (combat?.started ? 10 * 60 * 1000 : 6500),
    combatId: combat?.id ?? null,
    round: combat?.round ?? null,
    turn: combat?.turn ?? null
  };
  writeChange(changes, `flags.${MODULE_ID}.${INTANG_FLAG}`, flag);
  STATE.intangibilityActivations = Number(STATE.intangibilityActivations ?? 0) + 1;
  STATE.intangibilityLast = { actor: actor?.name ?? actor?.id, action: "reaction-activated", ...flag };
}

function intangibilityFlag(actor) {
  try { return actor?.getFlag?.(MODULE_ID, INTANG_FLAG) ?? null; }
  catch (_) { return null; }
}

function intangibilityActive(actor) {
  if (!isLogia(actor)) return false;
  if (actorLevel(actor) >= 6) return true;
  const flag = intangibilityFlag(actor);
  if (!flag) return false;
  if (game?.combat?.started && flag.combatId !== game.combat.id) return false;
  if (!game?.combat?.started && Number(flag.expires ?? 0) <= now()) return false;
  return true;
}

function sourceText(sourceActor, item) {
  const pieces = [item?.name, item?.system?.requirements, item?.system?.requirement, item?.system?.description?.value];
  return htmlToText(pieces.filter(Boolean).join(" ")).toLowerCase();
}

function techniqueText(item, activity) {
  const pieces = [
    item?.name,
    item?.system?.requirements,
    item?.system?.requirement,
    item?.system?.description?.value,
    activity?.description?.chat,
    activity?.description?.chatFlavor,
    activity?.activation?.condition,
    activity?.requirements
  ];
  return htmlToText(pieces.filter(Boolean).join(" ")).toLowerCase();
}

function fruitNames(actor) {
  const akuma = actorAkuma(actor);
  if (!akuma) return [];
  const out = new Set();
  const collect = (value, key="", depth=0) => {
    if (depth > 4 || value == null) return;
    if (typeof value === "string") {
      const text = value.trim().toLowerCase();
      if (text.length >= 4 && (/no mi/.test(text) || /frut|fruit|nome|name/i.test(key))) out.add(text);
      return;
    }
    if (Array.isArray(value)) { for (const child of value) collect(child, key, depth + 1); return; }
    if (typeof value === "object") for (const [k, child] of Object.entries(value)) collect(child, k, depth + 1);
  };
  collect(akuma);
  return Array.from(out);
}

/** Power Up belongs only to Techniques of the active fruit. Do not use the
 * spell-like fallback employed by Uso Alternativo, because OPRPG also models
 * ordinary combat Techniques as spell-like Items. */
function isStrictAkumaTechnique(actor, item, activity) {
  if (!actor || !item || !activity) return false;
  if (item.getFlag?.("oprpg-system", "akumaTec") != null || item.getFlag?.("oprpg-system", "akumaManif")) return true;
  const text = techniqueText(item, activity);
  if (/akuma|frut[ao]|fruit|\bno mi\b/.test(text)) return true;
  return fruitNames(actor).some(name => name.length >= 4 && text.includes(name));
}

function predatorFormState(actor) {
  const akuma = actorAkuma(actor);
  if (!akuma) return null;
  const candidates = [];
  const scan = (value, key="", depth=0) => {
    if (depth > 4 || value == null) return;
    if (typeof value === "string" && /forma|form|transform/i.test(key)) candidates.push(value.toLowerCase());
    if (Array.isArray(value)) { for (const child of value) scan(child, key, depth + 1); return; }
    if (typeof value === "object") for (const [k, child] of Object.entries(value)) scan(child, k, depth + 1);
  };
  scan(akuma);
  if (candidates.some(v => /h[ií]brid|hybrid|animal|besta|beast/.test(v))) return true;
  if (candidates.some(v => /human|humano|original|base|normal/.test(v))) return false;
  return null;
}

function resolveSourceActor(adjustment) {
  const tokenActor = adjustment?.sourceTokenId ? canvas?.tokens?.get(adjustment.sourceTokenId)?.actor : null;
  return tokenActor ?? game.actors?.get(adjustment?.sourceActorId) ?? null;
}

function sourceBypassesIntangibility(sourceActor, item, activity=null) {
  if (!sourceActor && !item) return { bypass: false, reason: null };
  const text = sourceText(sourceActor, item);
  if (/kairoseki|kairouseki|seastone/.test(text)) return { bypass: true, reason: "kairoseki" };
  const infusion = hakiInfusionApplies(sourceActor, item, activity);
  if (infusion?.applies) return { bypass: true, reason: `ataque-infuso:${infusion.reason ?? "native"}`, infusion };
  try {
    const flag = sourceActor?.getFlag?.(MODULE_ID, INTANG_BYPASS_FLAG);
    if (flag && Number(flag.expires ?? 0) > now()) return { bypass: true, reason: flag.reason ?? "manual" };
  } catch (_) {}
  return { bypass: false, reason: null, infusion };
}

function restoreAdjustmentLayers(changes, adjustment) {
  if (Number.isFinite(Number(adjustment.armorBefore))) writeChange(changes, "system.armorPoints.value", Number(adjustment.armorBefore));
  if (Number.isFinite(Number(adjustment.shieldBefore))) writeChange(changes, "system.shieldPoints.value", Number(adjustment.shieldBefore));
  if (Number.isFinite(Number(adjustment.tempBefore))) writeChange(changes, "system.attributes.hp.temp", Number(adjustment.tempBefore));
  if (Number.isFinite(Number(adjustment.hpBefore))) writeChange(changes, "system.attributes.hp.value", Number(adjustment.hpBefore));
  deleteChange(changes, "flags.oprpg-system.-=reducaoDano");
  deleteChange(changes, "flags.oprpg-system.reducaoDano");

  adjustment.armorAfter = adjustment.armorBefore;
  adjustment.armorAbsorbed = 0;
  adjustment.armorSpent = 0;
  adjustment.shieldAfter = adjustment.shieldBefore;
  adjustment.shieldAbsorbed = 0;
  adjustment.tempAfter = adjustment.tempBefore;
  adjustment.tempAbsorbed = 0;
  adjustment.hpAfter = adjustment.hpBefore;
  adjustment.hpLoss = 0;
  adjustment.unabsorbed = 0;
  adjustment.reductionAbsorbed = 0;
  adjustment.consumeReduction = false;
}

function applyIntangibility(actor, changes, adjustment) {
  if (!intangibilityActive(actor)) return false;
  if (!["jj-apply-damage", "jj-extra-apply"].includes(adjustment?.action)) return false;
  const sourceActor = resolveSourceActor(adjustment);
  const item = sourceActor?.items?.get(adjustment?.itemId) ?? adjustment?.originItem ?? null;
  const activity = item?.system?.activities?.get?.(adjustment?.activityId)
    ?? activitiesOf(item).find(a => a.id === adjustment?.activityId)
    ?? null;
  const bypass = sourceBypassesIntangibility(sourceActor, item, activity);
  if (bypass.bypass) {
    STATE.intangibilityLast = { actor: actor.name ?? actor.id, source: sourceActor?.name ?? null, action: "bypassed", reason: bypass.reason, at: now() };
    return false;
  }

  restoreAdjustmentLayers(changes, adjustment);
  adjustment.intangibilityBlocked = true;
  adjustment.intangibilityReason = actorLevel(actor) >= 6 ? "controle-total" : "reacao";
  STATE.intangibilityBlocked = Number(STATE.intangibilityBlocked ?? 0) + Math.max(0, Number(adjustment.rawRequested ?? adjustment.requested ?? 0) || 0);
  STATE.intangibilityLast = { actor: actor.name ?? actor.id, source: sourceActor?.name ?? null, action: "blocked", amount: Number(adjustment.rawRequested ?? adjustment.requested ?? 0) || 0, at: now() };
  return true;
}

function trackedPowerUpEffect(actor) {
  return Array.from(actor?.effects ?? []).find(effect => effect.getFlag?.(MODULE_ID, "powerUpEffect") === true || effect.getFlag?.("oprpg-system", "akumaPowerUp") === true) ?? null;
}

function queueEndPowerUp(actor) {
  queueMicrotask(async () => {
    try {
      const effect = trackedPowerUpEffect(actor);
      if (effect) await effect.delete();
      else if (actorAkuma(actor)?.powerUp?.active === true) await actor.update({ [akumaPath(actor, "powerUp.active")]: false });
    } catch (error) {
      STATE.warnings.push(`Power Up RED/finalização: ${error?.message ?? error}`);
    }
  });
}

function applyPowerUpReduction(actor, changes, adjustment) {
  if (!powerUpOptionEnabled(actor, "red")) return false;
  const level = actorLevel(actor);
  if (level <= 0) return false;
  const threshold = 10 * level;
  const previous = Math.max(0, Number(actor.getFlag?.(MODULE_ID, RED_DAMAGE_FLAG) ?? 0) || 0);
  const incoming = Math.max(0,
    Number(adjustment.shieldAbsorbed ?? 0) +
    Number(adjustment.tempAbsorbed ?? 0) +
    Number(adjustment.hpLoss ?? 0) + Number(adjustment.unabsorbed ?? 0)
  );
  if (incoming <= 0) return false;

  const remainingToBreak = Math.max(0, threshold - previous);
  const overflow = Math.max(0, incoming - remainingToBreak);
  const originalHpLoss = Math.max(0, Number(adjustment.hpLoss ?? 0) || 0);
  const allowedHpLoss = Math.min(originalHpLoss, overflow);
  adjustment.unabsorbed=Math.min(Number(adjustment.unabsorbed)||0,Math.max(0,overflow-allowedHpLoss));
  const restore = originalHpLoss - allowedHpLoss;
  if (restore > 0) {
    const hpBefore = Math.max(0, Number(adjustment.hpBefore ?? actor.system?.attributes?.hp?.value ?? 0) || 0);
    writeChange(changes, "system.attributes.hp.value", Math.max(0, hpBefore - allowedHpLoss));
    adjustment.hpLoss = allowedHpLoss;
    adjustment.hpAfter = Math.max(0, hpBefore - allowedHpLoss);
  }

  const next = Math.min(threshold, previous + incoming);
  const reached = next >= threshold;
  if (reached) {
    writeChange(changes, `flags.${MODULE_ID}.-=${RED_DAMAGE_FLAG}`, null);
    writeChange(changes, akumaPath(actor, "powerUp.active"), false);
    queueEndPowerUp(actor);
  } else {
    writeChange(changes, `flags.${MODULE_ID}.${RED_DAMAGE_FLAG}`, next);
  }

  adjustment.powerUpRed = {
    previous,
    incoming,
    threshold,
    next,
    hpPrevented: restore,
    overflow,
    broken: reached
  };
  STATE.powerUpRedPrevented = Number(STATE.powerUpRedPrevented ?? 0) + restore;
  STATE.powerUpRedLast = { actor: actor.name ?? actor.id, ...adjustment.powerUpRed, at: now() };
  return true;
}

function effectiveDamageForPredator(adjustment) {
  if (adjustment?.intangibilityBlocked) return 0;
  if (Number.isFinite(Number(adjustment?.powerUpRed?.incoming))) {
    return Math.max(0, Number(adjustment.powerUpRed.incoming) || 0);
  }
  return Math.max(0,
    Number(adjustment?.shieldAbsorbed ?? 0) +
    Number(adjustment?.tempAbsorbed ?? 0) +
    Number(adjustment?.hpLoss ?? 0)
  );
}

function recordPredatorDamage(adjustment) {
  const sourceActor = resolveSourceActor(adjustment);
  if (!sourceActor || !hasPredator(sourceActor)) return false;
  const damage = effectiveDamageForPredator(adjustment);
  if (damage <= 0) return false;
  const entry = {
    damage,
    at: now(),
    expires: now() + DAMAGE_TTL_MS,
    turnKey: currentTurnKey(sourceActor),
    target: adjustment.actor ?? null,
    itemId: adjustment.itemId ?? null,
    activityId: adjustment.activityId ?? null
  };
  predatorDamage.set(sourceActor.uuid ?? sourceActor.id, entry);
  STATE.predatorDamageCaptured = Number(STATE.predatorDamageCaptured ?? 0) + 1;
  STATE.predatorLast = { actor: sourceActor.name ?? sourceActor.id, action: "damage-captured", ...entry };
  return true;
}

function onModifyCardDamage({ actor, changes, adjustment }={}) {
  if (!actor || !changes || !adjustment) return;
  if (applyIntangibility(actor, changes, adjustment)) return;
  applyPowerUpReduction(actor, changes, adjustment);
  recordPredatorDamage(adjustment);
}

function techniqueDegree(item, activity) {
  const candidates = [
    activity?.degree, activity?.grau, activity?.level,
    item?.system?.degree, item?.system?.grau, item?.system?.level,
    item?.system?.level?.value
  ];
  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n >= 1 && n <= 7) return Math.trunc(n);
  }
  const text = [item?.name, activity?.name, item?.system?.requirements, htmlToText(item?.system?.description?.value)].filter(Boolean).join(" ");
  const match = text.match(/\b([1-7])\s*(?:º|°|o)?\s*grau\b/i);
  return match ? Number(match[1]) : 0;
}

function normalizeTypes(types) {
  if (types instanceof Set) return Array.from(types).map(String).filter(Boolean);
  if (Array.isArray(types)) return types.map(String).filter(Boolean);
  if (typeof types === "string") return types.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

export function powerUpDamageBonusSpec(actor, item, activity) {
  if (!powerUpOptionEnabled(actor, "dmg") || !isInstantActivity(activity) || !isStrictAkumaTechnique(actor, item, activity)) return null;
  const degree = techniqueDegree(item, activity);
  if (degree <= 0) return null;
  const bonusDice = Math.min(5, degree);
  const parts = Array.from(activity?.damage?.parts ?? []).filter(part => Number(part?.denomination ?? 0) > 0 && Number(part?.number ?? 0) > 0);
  if (!parts.length) return null;
  const denominations = [...new Set(parts.map(p => Number(p.denomination)).filter(n => n > 0))];
  if (denominations.length !== 1) {
    STATE.powerUpDamageAmbiguous = Number(STATE.powerUpDamageAmbiguous ?? 0) + 1;
    return null;
  }
  const types = [...new Set(parts.flatMap(p => normalizeTypes(p?.types)))];
  return { degree, dice: bonusDice, denomination: denominations[0], types: types.length === 1 ? types : [], formula: `${bonusDice}d${denominations[0]}` };
}

function cardTotal(card) {
  const candidates = [card?.dataset?.totalDmg, card?.querySelector?.("#jj-dmg-val")?.textContent, card?.querySelector?.("#jj-total-display")?.textContent];
  for (const value of candidates) {
    const n = Number(String(value ?? "").trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function diceBreakdown(roll) {
  const groups = [];
  for (const die of roll?.dice ?? []) {
    const values = (die.results ?? []).filter(r => r.active !== false).map(r => Number(r.result ?? 0));
    if (values.length) groups.push(`[${values.join(", ")}]`);
  }
  return groups.join(" ") || String(roll?.total ?? 0);
}

function messageForCard(card) {
  const id = card?.closest?.("[data-message-id]")?.dataset?.messageId;
  return id ? game.messages?.get(id) ?? null : null;
}

function applyPowerUpDamageState(card, state) {
  if (!card || !state) return false;
  if (state.itemId && card.dataset.itemId !== state.itemId) return false;
  if (state.activityId && card.dataset.activityId !== state.activityId) return false;
  const total = Number(state.total ?? 0);
  if (!Number.isFinite(total)) return false;
  card.dataset.totalDmg = String(total);
  card.dataset.oprpgFixesPowerUpDamage = "1";
  const value = card.querySelector?.("#jj-dmg-val");
  const display = card.querySelector?.("#jj-total-display");
  const breakdown = card.querySelector?.("#jj-dmg-break");
  const panel = card.querySelector?.("#jj-dmg-panel");
  if (value) value.textContent = String(total);
  if (display) display.textContent = String(total);
  if (breakdown && state.breakdown) breakdown.textContent = state.breakdown;
  if (panel) panel.dataset.baseValue = String(total);
  if (Array.isArray(state.typedDamage)) {
    try { card.dataset.oprpgFixesTypedDamage = JSON.stringify(state.typedDamage); } catch (_) {}
  }
  return true;
}

async function persistPowerUpDamage(card, state) {
  const message = messageForCard(card);
  if (!message?.setFlag) return false;
  try {
    await message.setFlag(MODULE_ID, POWERUP_DAMAGE_FLAG, state);
    return true;
  } catch (_) { return false; }
}

async function addNativePowerUpDamage(card, actor, item, activity, spec) {
  if (!card || card.dataset.oprpgFixesPowerUpDamageApplying === "1") return false;
  const base = cardTotal(card);
  if (!Number.isFinite(base)) return false;
  card.dataset.oprpgFixesPowerUpDamageApplying = "1";
  try {
    const roll = await new Roll(spec.formula, actor?.getRollData?.() ?? {}).evaluate();
    try { await showPrivateDice(roll, {card,actor}); } catch (_) {}
    const bonus = Number(roll.total ?? 0) || 0;
    const total = base + bonus;
    const previous = card.querySelector?.("#jj-dmg-break")?.textContent?.trim() ?? "";
    const breakdown = [previous, `${diceBreakdown(roll)} Power Up`].filter(Boolean).join(" + ");
    const singleType = spec.types?.length === 1 ? spec.types[0] : null;
    const typedDamage = singleType ? [
      { total: base, types: [singleType] },
      { total: bonus, types: [singleType] }
    ] : null;
    const state = {
      version: 1,
      itemId: item?.id ?? card.dataset.itemId ?? null,
      activityId: activity?.id ?? card.dataset.activityId ?? null,
      base,
      bonus,
      total,
      formula: spec.formula,
      breakdown,
      typedDamage,
      rolledAt: now()
    };
    applyPowerUpDamageState(card, state);
    await persistPowerUpDamage(card, state);
    STATE.powerUpDamageRolls = Number(STATE.powerUpDamageRolls ?? 0) + 1;
    STATE.powerUpDamageLast = { actor: actor?.name ?? actor?.id, item: item?.name ?? null, activity: activity?.name ?? null, ...state };
    return true;
  } finally {
    delete card.dataset.oprpgFixesPowerUpDamageApplying;
  }
}

function waitForNativeDamage(card, before, callback) {
  let done = false;
  let timer = null;
  const hadBefore = Number.isFinite(before);
  const finish = async () => {
    if (done) return;
    const current = cardTotal(card);
    if (!Number.isFinite(current)) return;
    // A fresh card commonly exposes Total 0 before the native roll. Do not
    // mistake that presentation mutation for a completed damage roll.
    if (hadBefore ? current === before : current <= 0) {
      if (!card.querySelector?.(".jj-damage-btn")?.disabled) return;
    }
    done = true;
    observer.disconnect();
    if (timer) clearTimeout(timer);
    try { await callback(current); }
    catch (error) { STATE.warnings.push(`Power Up/dano nativo: ${error?.message ?? error}`); }
  };
  const observer = new MutationObserver(() => { void finish(); });
  observer.observe(card, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-total-dmg"] });
  timer = setTimeout(() => { observer.disconnect(); done = true; }, 5000);
  requestAnimationFrame?.(() => { void finish(); });
}

function bindNativePowerUpDamage(card) {
  if (!card || boundDamageCards.has(card)) return false;
  const { actor, item, activity } = getCardActivity(card);
  if (!actor || !item || !activity) return false;
  const spec = powerUpDamageBonusSpec(actor, item, activity);
  const messageState = messageForCard(card)?.getFlag?.(MODULE_ID, POWERUP_DAMAGE_FLAG);
  if (messageState) applyPowerUpDamageState(card, messageState);
  if (!spec) return false;

  const button = card.querySelector?.(".jj-damage-btn[data-action='jj-damage']");
  if (!button) return false;
  // Multi-Activity cards are handled directly in multi-activity-damage-fix.js.
  if (button.dataset.oprpgFixesHandler === "1" || activitiesOf(item).length > 1) return false;
  boundDamageCards.add(card);
  button.addEventListener("click", () => {
    if (button.disabled || (card.dataset.userId && card.dataset.userId !== game.user?.id)) return;
    if (card.dataset.oprpgFixesPowerUpDamageApplying === "1") return;
    const currentSpec = powerUpDamageBonusSpec(actor, item, activity);
    if (!currentSpec) return;
    const before = cardTotal(card);
    waitForNativeDamage(card, before, async () => addNativePowerUpDamage(card, actor, item, activity, currentSpec));
  }, { capture: true });
  return true;
}

function registerPowerUpSaveTargets(message, root) {
  if (!message?.id || saveMessagesSeen.has(message.id)) return false;
  const card = root?.matches?.(".jujutsu-card") ? root : root?.querySelector?.(".jujutsu-card");
  if (!card) return false;
  const { actor, item, activity } = getCardActivity(card);
  if (!actor || !item || !activity || !powerUpOptionEnabled(actor, "sav") || !isStrictAkumaTechnique(actor, item, activity)) return false;
  const saveAbilities = normalizeTypes(activity?.save?.ability ?? activity?.save?.abilityId).map(s => s.toLowerCase());
  const saveAbility = saveAbilities.join(",");
  if (!(activity?.type === "save" || saveAbility)) return false;
  const user = game.users?.get(message.user?.id ?? message.userId ?? message.author?.id);
  const targets = Array.from(user?.targets ?? []).map(t => t?.actor).filter(Boolean);
  if (!targets.length) {
    STATE.powerUpSaveUnscoped = Number(STATE.powerUpSaveUnscoped ?? 0) + 1;
    return false;
  }
  saveMessagesSeen.add(message.id);
  if (saveMessagesSeen.size > 1000) saveMessagesSeen.delete(saveMessagesSeen.values().next().value);
  for (const target of targets) {
    const key = target.uuid ?? target.id;
    const list = pendingSaves.get(key) ?? [];
    list.push({ sourceActorId: actor.id, itemId: item.id, activityId: activity.id, saveAbility, messageId: message.id, expires: now() + SAVE_TTL_MS });
    pendingSaves.set(key, list.slice(-5));
  }
  STATE.powerUpSaveTargets = Number(STATE.powerUpSaveTargets ?? 0) + targets.length;
  STATE.powerUpSaveLast = { actor: actor.name ?? actor.id, item: item.name, targets: targets.map(t => t.name), saveAbility, at: now() };
  return true;
}

function takePendingSave(actor, abilityId="") {
  const key = actor?.uuid ?? actor?.id;
  if (!key) return null;
  const list = (pendingSaves.get(key) ?? []).filter(entry => Number(entry.expires ?? 0) > now());
  if (!list.length) { pendingSaves.delete(key); return null; }
  const ability = String(abilityId ?? "").toLowerCase();
  const index = [...list].reverse().findIndex(entry => !entry.saveAbility || !ability || entry.saveAbility.split(",").includes(ability));
  if (index < 0) { pendingSaves.set(key, list); return null; }
  const realIndex = list.length - 1 - index;
  const [entry] = list.splice(realIndex, 1);
  if (list.length) pendingSaves.set(key, list); else pendingSaves.delete(key);
  return entry;
}

function applySaveDisadvantage(actor, config, abilityId) {
  if (!config || appliedSaveConfigs.has(config)) return false;
  const pending = takePendingSave(actor, abilityId);
  if (!pending || !config) return false;
  appliedSaveConfigs.add(config);
  config.disadvantage = true;
  for (const roll of config.rolls ?? []) (roll.options ??= {}).disadvantage = true;
  if (config.options && typeof config.options === "object") config.options.disadvantage = true;
  STATE.powerUpSaveApplied = Number(STATE.powerUpSaveApplied ?? 0) + 1;
  STATE.powerUpSaveLast = { ...(STATE.powerUpSaveLast ?? {}), target: actor?.name ?? actor?.id, ability: abilityId ?? null, action: "disadvantage-applied", at: now() };
  return true;
}

function onModernPreSave(...args) {
  const config = args.find(arg => arg && typeof arg === "object" && ("subject" in arg || "disadvantage" in arg || "rolls" in arg)) ?? args[0];
  const actor = config?.subject?.documentName === "Actor" ? config.subject : config?.actor?.documentName === "Actor" ? config.actor : null;
  const abilityId = config?.ability ?? config?.abilityId ?? "";
  if (actor) applySaveDisadvantage(actor, config, abilityId);
}

function onLegacyPreSave(actor, config, abilityId) {
  if (actor?.documentName === "Actor" || actor?.system) applySaveDisadvantage(actor, config, abilityId);
}

function detectIntangibilityUse(actor, changes) {
  if (!actor || !isLogia(actor) || actorLevel(actor) >= 6) return false;
  const paths = [akumaPath(actor, "intangUsos"), akumaPath(actor, "intangibilidade.usos"), akumaPath(actor, "intangibility.uses")];
  for (const path of paths) {
    if (!hasChange(changes, path)) continue;
    const before = Number(foundry.utils.getProperty(actor, path) ?? 0) || 0;
    const after = Number(readChange(changes, path) ?? 0) || 0;
    if (after > before) { markIntangibilityActivation(actor, changes); return true; }
  }
  return false;
}

async function expireIntangibilityAtTurn(combat) {
  const actor = combat?.combatant?.actor;
  if (!actor || actorLevel(actor) >= 6) return;
  if (!canAct(actor)) return;
  const flag = intangibilityFlag(actor);
  if (!flag) return;
  if (flag.combatId && flag.combatId !== combat.id) return;
  try {
    await actor.unsetFlag(MODULE_ID, INTANG_FLAG);
    STATE.intangibilityLast = { actor: actor.name ?? actor.id, action: "expired-at-turn-start", round: combat.round, turn: combat.turn, at: now() };
  } catch (_) {}
}

function energyValue(actor) { return Number(actor?.system?.energy?.total ?? actor?.system?.energy?.value ?? 0) || 0; }
function energyMax(actor) { return Number(actor?.system?.energy?.max ?? 0) || 0; }

async function usePredator(actor) {
  if (!actor || (!actor.isOwner && !game.user?.isGM) || predatorInFlight.has(actor)) return false;
  predatorInFlight.add(actor);
  try { return await usePredatorUnlocked(actor); }
  finally { predatorInFlight.delete(actor); }
}

async function usePredatorUnlocked(actor) {
  const key = actor?.uuid ?? actor?.id;
  const entry = predatorDamage.get(key);
  if (!entry || Number(entry.expires ?? 0) <= now() || entry.turnKey !== currentTurnKey(actor)) {
    ui.notifications.warn("OPRPG Fixes: Predador não encontrou dano causado neste turno.");
    return false;
  }
  const formState = predatorFormState(actor);
  if (formState === false) {
    ui.notifications.warn("OPRPG Fixes: Predador só pode ser usado na forma Animal ou Híbrida.");
    return false;
  }
  const level = actorLevel(actor);
  if (level <= 0) return false;
  const turnKey = currentTurnKey(actor);
  const lastTurn = actor.getFlag?.(MODULE_ID, PREDATOR_TURN_FLAG);
  if (lastTurn === turnKey) {
    ui.notifications.warn("OPRPG Fixes: Predador já foi usado neste turno.");
    return false;
  }

  const hpCap = 5 * level;
  const ppCap = level;
  const hpUsed = Math.max(0, Number(actor.getFlag?.(MODULE_ID, PREDATOR_HP_FLAG) ?? 0) || 0);
  const ppUsed = Math.max(0, Number(actor.getFlag?.(MODULE_ID, PREDATOR_PP_FLAG) ?? 0) || 0);
  const hp = actor.system?.attributes?.hp ?? {};
  const heal = Math.max(0, Math.min(entry.damage, hpCap - hpUsed, Math.max(0, Number(hp.effectiveMax ?? hp.max ?? 0) - Number(hp.value ?? 0))));
  const pp = Math.max(0, Math.min(1, ppCap - ppUsed, Math.max(0, energyMax(actor) - energyValue(actor))));
  if (heal <= 0 && pp <= 0) {
    ui.notifications.info("OPRPG Fixes: Predador não tem PV/PP a recuperar ou seus limites já foram atingidos.");
    return false;
  }

  const updates = {
    [`flags.${MODULE_ID}.${PREDATOR_HP_FLAG}`]: hpUsed + heal,
    [`flags.${MODULE_ID}.${PREDATOR_PP_FLAG}`]: ppUsed + pp,
    [`flags.${MODULE_ID}.${PREDATOR_TURN_FLAG}`]: turnKey
  };
  if (heal > 0) updates["system.attributes.hp.value"] = Number(hp.value ?? 0) + heal;
  if (pp > 0) updates["system.energy.total"] = energyValue(actor) + pp;
  await actor.update(updates);
  predatorDamage.delete(key);
  STATE.predatorUses = Number(STATE.predatorUses ?? 0) + 1;
  STATE.predatorLast = { actor: actor.name ?? actor.id, action: "used", damage: entry.damage, healed: heal, pp, hpUsed: hpUsed + heal, hpCap, ppUsed: ppUsed + pp, ppCap, at: now() };
  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><strong>Predador</strong> — ${foundry.utils.escapeHTML(actor.name)} recupera <strong>${heal} PV</strong>${pp ? ` e <strong>${pp} PP</strong>` : ""} a partir de ${entry.damage} de dano causado.</p>`
    });
  } catch (_) {}
  return true;
}

async function patchCharacterSheetPredator() {
  try {
    const mod = await import("/systems/oprpg-system/module/applications/actor/character-sheet.mjs");
    const candidates = Object.values(mod).filter(value => typeof value === "function" && value.prototype);
    if (mod.default?.prototype) candidates.unshift(mod.default);
    for (const cls of candidates) {
      let proto = cls?.prototype;
      for (let depth = 0; proto && depth < 5; depth++, proto = Object.getPrototypeOf(proto)) {
        if (patchedSheetPrototypes.has(proto)) continue;
        const method = Object.getOwnPropertyNames(proto).find(name => /predador/i.test(name) && typeof proto[name] === "function");
        if (!method) continue;
        const original = proto[method];
        if (original.__oprpgFixesPredatorWrapped) {
          patchedSheetPrototypes.add(proto);
          STATE.predatorHandlerPatch = true;
          STATE.predatorHandlerName = method;
          return true;
        }
        async function wrappedPredator(...args) {
          const actor = this?.actor;
          if (!actor || !hasPredator(actor)) return original.apply(this, args);
          try { return await usePredator(actor); }
          catch (error) {
            STATE.warnings.push(`Predador: ${error?.message ?? error}`);
            console.error(`${MODULE_ID} | Falha no reparo de Predador`, error);
            return false;
          }
        }
        wrappedPredator.__oprpgFixesPredatorWrapped = true;
        wrappedPredator.__oprpgFixesOriginal = original;
        proto[method] = wrappedPredator;
        patchedSheetPrototypes.add(proto);
        STATE.predatorHandlerPatch = true;
        STATE.predatorHandlerName = method;
        return true;
      }
    }
  } catch (error) {
    STATE.warnings.push(`Predador/import da ficha: ${error?.message ?? error}`);
  }
  return false;
}

function isLongRest(result, config) {
  const values = [config?.type, config?.restType, result?.type, result?.restType].map(v => String(v ?? "").toLowerCase());
  return values.some(v => v.includes("long")) || config?.longRest === true || result?.longRest === true;
}

async function resetPredatorOnRest(actor, result, config) {
  if (!actor || !isLongRest(result, config)) return;
  if (!canAct(actor)) return;
  try {
    await actor.update({
      [`flags.${MODULE_ID}.-=${PREDATOR_HP_FLAG}`]: null,
      [`flags.${MODULE_ID}.-=${PREDATOR_PP_FLAG}`]: null,
      [`flags.${MODULE_ID}.-=${PREDATOR_TURN_FLAG}`]: null
    });
    predatorDamage.delete(actor.uuid ?? actor.id);
  } catch (_) {}
}

export function recordPowerUpDamageRoll(actor, item, activity, data={}) {
  STATE.powerUpDamageRolls = Number(STATE.powerUpDamageRolls ?? 0) + 1;
  STATE.powerUpDamageLast = {
    actor: actor?.name ?? actor?.id ?? null,
    item: item?.name ?? null,
    activity: activity?.name ?? null,
    activityId: activity?.id ?? null,
    ...data,
    at: now()
  };
}

export async function markIntangibilityBypass(actor, reason="natural", seconds=30) {
  if (!actor?.setFlag) return false;
  await actor.setFlag(MODULE_ID, INTANG_BYPASS_FLAG, { reason, expires: now() + Math.max(1, Number(seconds) || 30) * 1000 });
  return true;
}

export async function installAkumaCombatFixes() {
  if (installed) return true;
  installed = true;

  modifyDamageHookId = Hooks.on("oprpgFixes.modifyCardDamage", onModifyCardDamage);
  preUpdateActorHookId = Hooks.on("preUpdateActor", (actor, changes) => {
    try { detectIntangibilityUse(actor, changes); }
    catch (error) { STATE.warnings.push(`Intangibilidade/preUpdateActor: ${error?.message ?? error}`); }
  });
  updateCombatHookId = Hooks.on("updateCombat", (combat, changed) => {
    if (!("turn" in (changed ?? {}) || "round" in (changed ?? {}))) return;
    void expireIntangibilityAtTurn(combat);
  });
  renderHookId = Hooks.on("renderChatMessageHTML", (message, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root || !String(message?.content ?? "").includes("jujutsu-card")) return;
    for (const card of root.matches?.(".jujutsu-card") ? [root] : Array.from(root.querySelectorAll?.(".jujutsu-card") ?? [])) bindNativePowerUpDamage(card);
    registerPowerUpSaveTargets(message, root);
  });
  saveHookId = Hooks.on("dnd5e.preRollSavingThrow", (...args) => onModernPreSave(...args));
  saveLegacyHookId = Hooks.on("dnd5e.preRollAbilitySave", (actor, config, abilityId) => onLegacyPreSave(actor, config, abilityId));
  restHookId = Hooks.on("dnd5e.restCompleted", (actor, result, config) => { void resetPredatorOnRest(actor, result, config); });
  await patchCharacterSheetPredator();
  requestAnimationFrame?.(() => {
    try {
      for (const card of document.querySelectorAll?.(".jujutsu-card") ?? []) bindNativePowerUpDamage(card);
    } catch (_) {}
  });

  STATE.powerUpSavPatch = !!(saveHookId || saveLegacyHookId);
  STATE.powerUpDamagePatch = !!renderHookId;
  STATE.powerUpReductionPatch = !!modifyDamageHookId;
  STATE.intangibilityPatch = !!(modifyDamageHookId && preUpdateActorHookId && updateCombatHookId);
  STATE.predatorPatch = !!modifyDamageHookId;
  return true;
}

export function akumaCombatStatus(actor=null) {
  const current = actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game?.user?.character ?? null;
  const pred = current ? predatorDamage.get(current.uuid ?? current.id) ?? null : null;
  return {
    installed,
    powerUp: {
      sav: !!STATE.powerUpSavPatch,
      dmg: !!STATE.powerUpDamagePatch,
      red: !!STATE.powerUpReductionPatch,
      saveTargets: Number(STATE.powerUpSaveTargets ?? 0),
      saveApplied: Number(STATE.powerUpSaveApplied ?? 0),
      damageRolls: Number(STATE.powerUpDamageRolls ?? 0),
      damageAmbiguous: Number(STATE.powerUpDamageAmbiguous ?? 0),
      redPrevented: Number(STATE.powerUpRedPrevented ?? 0),
      lastSave: STATE.powerUpSaveLast ?? null,
      lastDamage: STATE.powerUpDamageLast ?? null,
      lastRed: STATE.powerUpRedLast ?? null
    },
    intangibility: {
      installed: !!STATE.intangibilityPatch,
      active: current ? intangibilityActive(current) : null,
      activations: Number(STATE.intangibilityActivations ?? 0),
      blocked: Number(STATE.intangibilityBlocked ?? 0),
      last: STATE.intangibilityLast ?? null
    },
    predator: {
      installed: !!STATE.predatorPatch,
      nativeHandlerPatched: !!STATE.predatorHandlerPatch,
      handler: STATE.predatorHandlerName ?? null,
      captured: Number(STATE.predatorDamageCaptured ?? 0),
      uses: Number(STATE.predatorUses ?? 0),
      pendingDamage: pred,
      last: STATE.predatorLast ?? null
    }
  };
}
