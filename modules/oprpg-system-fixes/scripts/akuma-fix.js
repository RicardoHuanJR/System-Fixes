import { MODULE_ID, STATE, activitiesOf, canAct } from "./shared.js";

const ALT_FLAG = "usoAlternativoPending";
const POWERUP_PENDING_FLAG = "powerUpEffectPending";
const POWERUP_EFFECT_FLAG = "powerUpEffect";
const ALT_TTL_MS = 2 * 60 * 1000;
const POWERUP_EFFECT_WINDOW_MS = 10 * 1000;
const patchedActivityPrototypes = new WeakSet();
let preUpdateActorHookId = null;
let createItemHookId = null;
let createEffectHookId = null;
let deleteEffectHookId = null;
let installed = false;
const alternativeContexts = new WeakMap();
const alternativeInFlight = new WeakSet();

function now() { return Date.now(); }

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

function deleteFlagChange(changes, key) {
  writeChange(changes, `flags.${MODULE_ID}.-=${key}`, null);
  try { foundry.utils.unsetProperty(changes, `flags.${MODULE_ID}.${key}`); }
  catch (_) { /* flattened update */ }
}

export function actorAkuma(actor) { return actor?.getFlag?.("oprpg-system", "akuma") ?? actor?.system?.akuma ?? null; }

export function akumaPath(actor, key) {
  const prefix = actor?.getFlag?.("oprpg-system", "akuma") != null ? "flags.oprpg-system.akuma" : "system.akuma";
  return `${prefix}.${key}`;
}

export function actorLevel(actor) {
  const candidates = [
    actor?.system?.details?.level,
    actor?.system?.level,
    actor?.system?.details?.level?.value,
    actor?.system?.attributes?.level
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return 0;
}

function optionContainerValues(powerUp, key) {
  const containers = [
    powerUp,
    powerUp?.options,
    powerUp?.opcoes,
    powerUp?.effects,
    powerUp?.efeitos,
    powerUp?.selected,
    powerUp?.selecionados
  ].filter(Boolean);
  const values = [];
  for (const container of containers) {
    if (Object.prototype.hasOwnProperty.call(container, key)) values.push(container[key]);
  }
  return values;
}

export function powerUpOptionEnabled(actor, key) {
  const powerUp = actorAkuma(actor)?.powerUp;
  if (!powerUp || powerUp.active !== true) return false;
  const values = optionContainerValues(powerUp, key);
  return values.some(value => value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true");
}

function isAlternativeAvailableActor(actor) {
  const akuma = actorAkuma(actor);
  return !!akuma && "usoAltUsado" in akuma;
}

function pendingAlternative(actor, changes=null) {
  const incoming = readChange(changes, `flags.${MODULE_ID}.${ALT_FLAG}`);
  if (incoming && typeof incoming === "object") return incoming;
  try { return actor?.getFlag?.(MODULE_ID, ALT_FLAG) ?? null; }
  catch (_) { return null; }
}

function isPendingValid(pending) {
  if (!pending) return false;
  return Number(pending.expires ?? 0) > now();
}

function armAlternative(actor, changes) {
  const pending = { armedAt: now(), expires: now() + ALT_TTL_MS };
  writeChange(changes, `flags.${MODULE_ID}.${ALT_FLAG}`, pending);
  STATE.akumaAlternativeArmed = Number(STATE.akumaAlternativeArmed ?? 0) + 1;
  STATE.akumaAlternativeLast = { actor: actor?.name ?? actor?.id ?? null, action: "armed", ...pending };
  return pending;
}

function clearAlternative(changes) {
  deleteFlagChange(changes, ALT_FLAG);
}

function durationText(activity) {
  const values = [
    activity?.labels?.duration,
    activity?.duration?.units,
    activity?.duration?.value,
    activity?.item?.system?.duration?.units,
    activity?.item?.system?.duration?.value,
    activity?.item?.labels?.duration
  ].filter(v => v !== undefined && v !== null && v !== "");
  return values.map(String).join(" ");
}

export function isInstantActivity(activity) {
  const raw = durationText(activity).toLowerCase();
  if (/instant/.test(raw)) return true;
  const units = String(activity?.duration?.units ?? activity?.item?.system?.duration?.units ?? "").toLowerCase();
  return ["inst", "instant", "instantaneous"].includes(units);
}

function techniqueText(item, activity) {
  const fields = [
    item?.name,
    item?.system?.requirements,
    item?.system?.requirement,
    item?.system?.description?.value,
    activity?.description?.chat,
    activity?.activation?.condition,
    activity?.requirements
  ];
  try { fields.push(JSON.stringify(item?.system?.type ?? {})); } catch (_) {}
  return fields.filter(Boolean).join(" ").toLowerCase();
}

function akumaNames(actor) {
  const a = actorAkuma(actor) ?? {};
  return [a.nome, a.name, a.fruta, a.fruit, a.nomeFruta, a.fruitName]
    .filter(v => typeof v === "string" && v.trim().length >= 3)
    .map(v => v.toLowerCase());
}

export function isAkumaTechnique(actor, item, activity) {
  if (!item || !activity) return false;
  if (item.getFlag?.("oprpg-system", "akumaTec") != null || item.getFlag?.("oprpg-system", "akumaManif")) return true;
  const text = techniqueText(item, activity);
  if (/akuma|frut[ao]|\bno mi\b/.test(text)) return true;
  if (akumaNames(actor).some(name => text.includes(name))) return true;
  // OPRPG models Techniques as spell-like Items. This fallback is deliberately
  // restricted to instantaneous Activities and is only reachable after the
  // player explicitly arms the native Uso Alternativo feature.
  return item.type === "spell" && isInstantActivity(activity);
}

function energyTargets(activity) {
  try {
    return Array.from(activity?.consumption?.targets ?? []).filter(target =>
      target?.type === "attribute" && ["energy.total", "energy.generated"].includes(target?.target)
    );
  } catch (_) { return []; }
}

function numericCost(target) {
  const raw = String(target?.value ?? "").trim().replace(",", ".");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.abs(value) : null;
}

function activityActor(activity) {
  const item = activity?.item ?? activity?.parent ?? null;
  return item?.actor ?? item?.parent ?? null;
}

function activityItem(activity) { return activity?.item ?? activity?.parent ?? null; }

async function consumeAlternativeFlag(actor) {
  try { await actor?.unsetFlag?.(MODULE_ID, ALT_FLAG); }
  catch (_) { /* preUpdate fallback will clear it on next actor update */ }
}

function observeAlternativeCard(actor, item, activity) {
  // The native OPRPG preUse hook creates its own card and returns false. In
  // that successful path Activity.use resolves undefined, just like cancel.
  const observation = { seen: false, stop: null };
  const hook = Hooks.on("preCreateChatMessage", (_message, data) => {
    let matches = false;
    const info = data?.flags?.["oprpg-system"]?.cardData;
    if (info) matches = info.actorId === actor.id && info.itemId === item.id && info.activityId === activity.id;
    else if (String(data?.content ?? "").includes("jujutsu-card")) {
      const template = document.createElement("template");
      template.innerHTML = data.content;
      matches = Array.from(template.content.querySelectorAll(".jujutsu-card")).some(card =>
        card.dataset.actorId === actor.id && card.dataset.itemId === item.id && card.dataset.activityId === activity.id);
    }
    if (!matches) return;
    observation.seen = true;
    observation.stop();
    void consumeAlternativeFlag(actor);
  });
  const timer = setTimeout(() => observation.stop(), 30000);
  observation.stop = () => { clearTimeout(timer); Hooks.off("preCreateChatMessage", hook); };
  return observation;
}

function bridgeAlternativeOnPrototype(proto) {
  if (!proto || patchedActivityPrototypes.has(proto) || typeof proto.use !== "function") return false;
  const original = proto.use;
  if (original.__oprpgFixesAlternativeWrapped) {
    patchedActivityPrototypes.add(proto);
    return true;
  }

  async function wrappedUse(...args) {
    const activity = this;
    const actor = activityActor(activity);
    const item = activityItem(activity);
    const pending = pendingAlternative(actor);
    if (!actor || !isPendingValid(pending) || actorAkuma(actor)?.usoAltUsado !== true || !isInstantActivity(activity) || !isAkumaTechnique(actor, item, activity)) {
      return original.apply(this, args);
    }

    const targets = energyTargets(activity);
    if (!targets.length) return original.apply(this, args);
    if (alternativeInFlight.has(actor)) return false;
    alternativeInFlight.add(actor);
    alternativeContexts.set(actor, { activity, expires: now() + ALT_TTL_MS });
    const backups = targets.map(target => ({ target, value: target.value }));
    const estimated = targets.reduce((sum, target) => sum + (numericCost(target) ?? 0), 0);
    let bridgeReady = true;
    try {
      for (const { target } of backups) target.value = "0";
    } catch (_) {
      bridgeReady = false;
      for (const backup of backups) { try { backup.target.value = backup.value; } catch (_) {} }
    }
    // Some future OPRPG/DND5E versions may expose immutable consumption data.
    // In that case preserve the native use path and let preUpdateActor perform
    // the short-lived refund fallback instead of blocking the Technique.
    if (!bridgeReady) {
      try { return await original.apply(this, args); }
      finally { alternativeContexts.delete(actor); alternativeInFlight.delete(actor); }
    }

    let succeeded = false;
    const observation = observeAlternativeCard(actor, item, activity);
    try {
      const result = await original.apply(this, args);
      succeeded = (result != null && result !== false) || observation.seen;
      if (succeeded) {
        observation.stop();
        await consumeAlternativeFlag(actor);
        STATE.akumaAlternativeRefundedPP = Number(STATE.akumaAlternativeRefundedPP ?? 0) + estimated;
        STATE.akumaAlternativeLast = {
          actor: actor.name ?? actor.id,
          item: item?.name ?? null,
          activity: activity?.name ?? null,
          activityId: activity?.id ?? null,
          action: "native-activity-free",
          preventedCost: estimated,
          at: now()
        };
      }
      if (result === false) observation.stop();
      return result;
    } catch (error) {
      observation.stop();
      throw error;
    } finally {
      alternativeContexts.delete(actor);
      alternativeInFlight.delete(actor);
      for (const backup of backups) backup.target.value = backup.value;
      // A canceled configuration dialog should not consume the benefit.
      if (!succeeded) STATE.akumaAlternativeLast = {
        actor: actor.name ?? actor.id,
        item: item?.name ?? null,
        activity: activity?.name ?? null,
        action: "canceled-kept-pending",
        at: now()
      };
    }
  }
  wrappedUse.__oprpgFixesAlternativeWrapped = true;
  wrappedUse.__oprpgFixesOriginal = original;
  proto.use = wrappedUse;
  patchedActivityPrototypes.add(proto);
  return true;
}

function patchActivity(activity) {
  const proto = activity?.constructor?.prototype;
  return bridgeAlternativeOnPrototype(proto);
}

function patchItemActivities(item) {
  let count = 0;
  for (const activity of activitiesOf(item)) if (patchActivity(activity)) count++;
  return count;
}

function patchLoadedActivities() {
  let count = 0;
  for (const actor of game?.actors ?? []) for (const item of actor.items ?? []) count += patchItemActivities(item);
  // Some Activity document classes can be reached from the CONFIG registry even
  // when no world Item currently uses that type.
  for (const cfg of Object.values(CONFIG?.DND5E?.activityTypes ?? {})) {
    const cls = cfg?.documentClass ?? cfg?.class ?? cfg?.implementation;
    if (cls?.prototype && bridgeAlternativeOnPrototype(cls.prototype)) count++;
  }
  return count;
}

function candidateEnergyPath(actor, changes) {
  const candidates = ["system.energy.total", "system.energy.generated", "system.energy.value"];
  for (const path of candidates) {
    if (!hasChange(changes, path)) continue;
    const before = Number(foundry.utils.getProperty(actor, path) ?? NaN);
    const after = Number(readChange(changes, path) ?? NaN);
    if (Number.isFinite(before) && Number.isFinite(after) && after < before) return { path, before, after, spent: before - after };
  }
  return null;
}

function fallbackPreventPPCost(actor, changes) {
  const context = alternativeContexts.get(actor);
  if (!context || context.expires <= now()) return null;
  const pending = pendingAlternative(actor, changes);
  if (!isPendingValid(pending) || actorAkuma(actor)?.usoAltUsado !== true) return null;
  const spend = candidateEnergyPath(actor, changes);
  if (!spend) return null;

  // This fallback exists for OPRPG execution paths that bypass Activity.use.
  // It is intentionally short-lived and only armed by the native Akuma button.
  writeChange(changes, spend.path, spend.before);
  clearAlternative(changes);
  STATE.akumaAlternativeRefundedPP = Number(STATE.akumaAlternativeRefundedPP ?? 0) + spend.spent;
  const result = { actor: actor.name ?? actor.id, action: "preUpdate-fallback-free", ...spend, at: now() };
  STATE.akumaAlternativeLast = result;
  return result;
}

function markPowerUpActivation(actor, changes) {
  const pending = { at: now(), expires: now() + POWERUP_EFFECT_WINDOW_MS };
  writeChange(changes, `flags.${MODULE_ID}.${POWERUP_PENDING_FLAG}`, pending);
  STATE.powerUpLast = { actor: actor.name ?? actor.id, action: "activation-pending-effect", at: pending.at };
}

function effectLooksLikePowerUp(effect, actor) {
  if (effect?.getFlag?.("oprpg-system", "akumaPowerUp") === true) return true;
  const pending = actor?.getFlag?.(MODULE_ID, POWERUP_PENDING_FLAG);
  if (!pending || Number(pending.expires ?? 0) < now()) return false;
  const durationSeconds = Number(effect?.duration?.seconds ?? 0);
  const durationRounds = Number(effect?.duration?.rounds ?? 0);
  const name = String(effect?.name ?? effect?.label ?? "").toLowerCase();
  const hasSizeChange = Array.from(effect?.changes ?? []).some(c => /traits\.size|size/i.test(String(c?.key ?? "")));
  return /power\s*up/.test(name);
}

async function trackPowerUpEffect(effect) {
  const actor = effect?.parent;
  if (!actor || actor.documentName !== "Actor" || actorAkuma(actor)?.powerUp?.active !== true) return;
  if (!canAct(actor)) return;
  if (!effectLooksLikePowerUp(effect, actor)) return;
  try {
    await effect.setFlag(MODULE_ID, POWERUP_EFFECT_FLAG, true);
    await actor.unsetFlag(MODULE_ID, POWERUP_PENDING_FLAG);
    STATE.powerUpEffectsTracked = Number(STATE.powerUpEffectsTracked ?? 0) + 1;
    STATE.powerUpLast = { actor: actor.name ?? actor.id, effect: effect.name ?? effect.id, action: "effect-tracked", at: now() };
  } catch (error) {
    STATE.warnings.push(`Power Up/track effect: ${error?.message ?? error}`);
  }
}

async function endPowerUpFromEffect(effect) {
  const actor = effect?.parent;
  if (!actor || actor.documentName !== "Actor") return;
  if (!canAct(actor)) return;
  let tracked = false;
  try { tracked = effect.getFlag?.(MODULE_ID, POWERUP_EFFECT_FLAG) === true || effect.getFlag?.("oprpg-system", "akumaPowerUp") === true; }
  catch (_) { tracked = false; }
  if (!tracked || actorAkuma(actor)?.powerUp?.active !== true) return;
  try {
    await actor.update({ [akumaPath(actor, "powerUp.active")]: false, [`flags.${MODULE_ID}.-=${POWERUP_PENDING_FLAG}`]: null });
    STATE.powerUpAutoEnded = Number(STATE.powerUpAutoEnded ?? 0) + 1;
    STATE.powerUpLast = { actor: actor.name ?? actor.id, effect: effect.name ?? effect.id, action: "auto-ended-with-effect", at: now() };
  } catch (error) {
    STATE.warnings.push(`Power Up/auto end: ${error?.message ?? error}`);
  }
}

function onPreUpdateActor(actor, changes) {
  if (!actor || !["character", "npc"].includes(actor.type)) return;
  const akuma = actorAkuma(actor);
  if (!akuma) return;

  const altPath = akumaPath(actor, "usoAltUsado");
  if (hasChange(changes, altPath)) {
    const next = readChange(changes, altPath);
    if (next === true && akuma.usoAltUsado !== true) armAlternative(actor, changes);
    else if (next === false) clearAlternative(changes);
  }

  const pending = pendingAlternative(actor, changes);
  if (pending && !isPendingValid(pending)) clearAlternative(changes);
  else fallbackPreventPPCost(actor, changes);

  const powerActivePath = akumaPath(actor, "powerUp.active");
  if (hasChange(changes, powerActivePath)) {
    const next = readChange(changes, powerActivePath);
    if (next === true && akuma.powerUp?.active !== true) markPowerUpActivation(actor, changes);
    else if (next === false) {
      deleteFlagChange(changes, POWERUP_PENDING_FLAG);
      // Power Up RED stores accumulated damage only while the current
      // transformation exists. Manual deactivation and automatic effect expiry
      // must both clear the pool before a future activation.
      deleteFlagChange(changes, "powerUpRedDamage");
    }
  }
}

export function installAkumaNativeFixes() {
  if (installed) return true;
  installed = true;
  patchLoadedActivities();

  preUpdateActorHookId = Hooks.on("preUpdateActor", (actor, changes) => {
    try { onPreUpdateActor(actor, changes); }
    catch (error) {
      STATE.warnings.push(`Akuma/preUpdateActor: ${error?.message ?? error}`);
      console.error(`${MODULE_ID} | Falha no reparo de Akuma no Mi`, error);
    }
  });
  createItemHookId = Hooks.on("createItem", item => {
    try { patchItemActivities(item); } catch (_) {}
  });
  createEffectHookId = Hooks.on("createActiveEffect", effect => {
    void trackPowerUpEffect(effect);
  });
  deleteEffectHookId = Hooks.on("deleteActiveEffect", effect => {
    void endPowerUpFromEffect(effect);
  });

  STATE.akumaAlternativePatch = !!preUpdateActorHookId;
  STATE.powerUpLifecyclePatch = !!(createEffectHookId && deleteEffectHookId);
  return STATE.akumaAlternativePatch;
}

export function akumaFixStatus(actor=null) {
  const current = actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game?.user?.character ?? null;
  const pending = current ? pendingAlternative(current) : null;
  return {
    installed: !!STATE.akumaAlternativePatch,
    alternativeUse: {
      installed: !!STATE.akumaAlternativePatch,
      mode: "native-Activity.use bridge + short preUpdate fallback",
      armedCount: Number(STATE.akumaAlternativeArmed ?? 0),
      preventedPP: Number(STATE.akumaAlternativeRefundedPP ?? 0),
      pending: isPendingValid(pending),
      last: STATE.akumaAlternativeLast ?? null
    },
    powerUp: {
      lifecycleSync: !!STATE.powerUpLifecyclePatch,
      effectsTracked: Number(STATE.powerUpEffectsTracked ?? 0),
      autoEnded: Number(STATE.powerUpAutoEnded ?? 0),
      savImplemented: !!STATE.powerUpSavPatch,
      dmgImplemented: !!STATE.powerUpDamagePatch,
      redImplemented: !!STATE.powerUpReductionPatch,
      last: STATE.powerUpLast ?? null
    },
    actor: current ? {
      name: current.name,
      usoAltUsado: actorAkuma(current)?.usoAltUsado ?? null,
      powerUpActive: actorAkuma(current)?.powerUp?.active ?? null
    } : null
  };
}
