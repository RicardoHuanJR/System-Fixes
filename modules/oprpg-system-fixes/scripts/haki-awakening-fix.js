import { MODULE_ID, STATE, activitiesOf } from "./shared.js";
import { actorAkuma, akumaPath } from "./akuma-fix.js";
import { registerActorTimer, changeTouches, queueActor } from './automation-runtime.js';

const SHIELD_RECHARGE_FLAG = "shieldRecharge";
const HAKI_INFUSION_FLAG = "hakiInfusionNext";
const AWAKENED_BURST_FLAG = "awakenedPowerBurstUsed";
const SHIELD_RECHARGE_SECONDS = 10 * 60;
const INFUSION_TTL_MS = 60 * 1000;

const awakeningTouched = new Map();
const combatTurns = new Map();
const awakeningCache = new Map();
const internallyUpdating = new Set();
const patchedSheetPrototypes = new WeakSet();
const drainedTurns = new WeakMap();
const burstInFlight = new WeakSet();

function actorHaki(actor) { return actor?.getFlag?.("oprpg-system", "haki") ?? actor?.system?.haki; }

let updateWorldTimeHookId = null;
let updateActorHookId = null;
let updateCombatHookId = null;
let deleteCombatHookId = null;
let deleteCombatantHookId = null;
let createCombatantHookId = null;
let restHookId = null;
let createEffectHookId = null;
let updateEffectHookId = null;
let deleteEffectHookId = null;
let installed = false;

function nowMs() { return Date.now(); }
function worldNow() { return Math.max(0, Number(game?.time?.worldTime ?? 0) || 0); }
function actorKey(actor) { return actor?.uuid ?? actor?.id ?? null; }
function escape(value) { return foundry.utils.escapeHTML(String(value ?? "")); }
function automationAuthority(actor) {
  const gm = game?.users?.activeGM;
  if (gm) return gm === game.user || gm.id === game.user?.id;
  return actor?.isOwner === true || game?.user?.isGM === true;
}
function explicitAuthority(actor) { return game?.user?.isGM === true || actor?.isOwner === true; }

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

function flattenObject(value, prefix="", out={}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (prefix) out[prefix] = value;
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flattenObject(child, path, out);
    else out[path] = child;
  }
  return out;
}

function primitiveSearch(value, predicate, depth=0, path="") {
  if (depth > 6 || value == null) return false;
  if (["string", "number", "boolean"].includes(typeof value)) return predicate(value, path);
  if (Array.isArray(value)) return value.some((v, i) => primitiveSearch(v, predicate, depth + 1, `${path}.${i}`));
  if (typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (predicate(child, childPath)) return true;
    if (child && typeof child === "object" && primitiveSearch(child, predicate, depth + 1, childPath)) return true;
  }
  return false;
}

function collectPrimitive(value, predicate, depth=0, path="", out=[]) {
  if (depth > 6 || value == null) return out;
  if (["string", "number", "boolean"].includes(typeof value)) {
    if (predicate(value, path)) out.push({ path, value });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => collectPrimitive(child, predicate, depth + 1, `${path}.${index}`, out));
    return out;
  }
  if (typeof value !== "object") return out;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (["string", "number", "boolean"].includes(typeof child) && predicate(child, childPath)) out.push({ path: childPath, value: child });
    else collectPrimitive(child, predicate, depth + 1, childPath, out);
  }
  return out;
}

function truthy(value) {
  if (value === true || value === 1 || value === "1") return true;
  const s = String(value ?? "").trim().toLowerCase();
  return ["true", "sim", "yes", "on", "ativo", "active", "enabled"].includes(s);
}

function shieldValue(actor) { return Math.max(0, Number(actor?.system?.shieldPoints?.value ?? 0) || 0); }
function shieldMax(actor) { return Math.max(0, Number(actor?.system?.shieldPoints?.max ?? 0) || 0); }

function actorInCombat(actor) {
  if (!actor) return false;
  for (const combat of game?.combats ?? []) {
    if (!combat?.started) continue;
    if (Array.from(combat.combatants ?? []).some(c => c.actor?.uuid === actor.uuid || c.actor?.id === actor.id)) return true;
  }
  return false;
}

function endurecimentoActive(actor) {
  const flag = actor?.getFlag?.("oprpg-system", "enduDefensivoAtivo");
  if (flag !== undefined) return truthy(flag);
  const haki = actorHaki(actor);
  if (!haki) return null;
  const known = [
    "enduDefensivoAtivo", "endurecimentoDefensivoAtivo", "endurecimentoDefensivo.ativo",
    "endurecimentoDefensivo.active", "armamento.endurecimentoDefensivo.ativo",
    "armamento.endurecimentoDefensivo.active"
  ];
  for (const path of known) {
    const value = foundry.utils.getProperty(haki, path);
    if (value !== undefined) return truthy(value);
  }
  const found = collectPrimitive(haki, (_value, path) => /endu.*defens.*ativ|defens.*endu.*ativ/i.test(path));
  if (!found.length) return null;
  return found.some(entry => truthy(entry.value));
}

function hasEndurecimento(actor) {
  return shieldMax(actor) > 0 || primitiveSearch(actorHaki(actor), (value, path) => /endurecimento.?defensivo/i.test(`${path} ${String(value ?? "")}`));
}

function shieldRechargeData(actor) {
  try { return actor?.getFlag?.(MODULE_ID, SHIELD_RECHARGE_FLAG) ?? null; }
  catch (_) { return null; }
}

async function setShieldRecharge(actor, start, reason) {
  if (!actor?.setFlag || !automationAuthority(actor)) return false;
  const key = actorKey(actor);
  if (!key || internallyUpdating.has(key)) return false;
  const next = { start: Number.isFinite(Number(start)) ? Math.max(0, Number(start)) : worldNow(), reason: String(reason ?? "unknown"), markedAt: nowMs() };
  const current = shieldRechargeData(actor);
  if (current && Number(current.start) === next.start && current.reason === next.reason) return true;
  internallyUpdating.add(key);
  try { await actor.setFlag(MODULE_ID, SHIELD_RECHARGE_FLAG, next); }
  finally { internallyUpdating.delete(key); }
  STATE.shieldRechargeLast = { actor: actor.name ?? actor.id, action: "timer-reset", ...next };
  return true;
}

async function clearShieldRecharge(actor) {
  const key = actorKey(actor);
  if (!key || !actor?.unsetFlag || !automationAuthority(actor) || internallyUpdating.has(key)) return false;
  internallyUpdating.add(key);
  try { await actor.unsetFlag(MODULE_ID, SHIELD_RECHARGE_FLAG); }
  finally { internallyUpdating.delete(key); }
  return true;
}

function armamentChangeDetected(actor, changes) {
  if (!actor || !changes) return false;
  const flat = flattenObject(changes);
  for (const [path, value] of Object.entries(flat)) {
    if (/^flags\.oprpg-system-fixes\./i.test(path)) continue;
    if (/system\.shieldPoints\.value/i.test(path)) {
      const before = shieldValue(actor);
      const after = Number(value);
      if (Number.isFinite(after) && after > before) return true;
    }
    if (!/system\.haki|flags\.oprpg-system\./i.test(path)) continue;
    if (/armamento|ataque.?infus|endurec|enduOfensivo|enduDefensivo|corpoArmadurado|chama|emiss|destrui|fortalec|imbu/i.test(path) && (truthy(value) || typeof value === "number")) return true;
  }
  return false;
}

export async function markArmamentUse(actor, reason="haki-armamento") {
  if (!actor || !hasEndurecimento(actor)) return false;
  await setShieldRecharge(actor, worldNow(), reason);
  return true;
}

export async function recoverShieldIfReady(actor, { force=false, source="check" }={}) {
  if (!actor || !hasEndurecimento(actor)) return { restored: false, reason: "no-endurecimento" };
  if (!automationAuthority(actor)) return { restored: false, reason: "no-authority" };
  const max = shieldMax(actor);
  const current = shieldValue(actor);
  if (max <= 0 || current >= max) return { restored: false, reason: "full", current, max };
  if (actorInCombat(actor)) return { restored: false, reason: "in-combat", current, max };
  const active = endurecimentoActive(actor);
  if (active === false) return { restored: false, reason: "endurecimento-inactive", current, max };

  let data = shieldRechargeData(actor);
  if (!data) {
    await setShieldRecharge(actor, worldNow(), source === "combat-end" ? "combat-end" : "outside-combat-start");
    data = shieldRechargeData(actor) ?? { start: worldNow() };
  }
  const elapsed = Math.max(0, worldNow() - Number(data.start ?? worldNow()));
  if (!force && elapsed < SHIELD_RECHARGE_SECONDS) return { restored: false, reason: "cooldown", elapsed, remaining: SHIELD_RECHARGE_SECONDS - elapsed, current, max };

  const key = actorKey(actor);
  internallyUpdating.add(key);
  try {
    await actor.update({ "system.shieldPoints.value": max, [`flags.${MODULE_ID}.-=${SHIELD_RECHARGE_FLAG}`]: null });
  } finally { internallyUpdating.delete(key); }
  STATE.shieldRechargeCount = Number(STATE.shieldRechargeCount ?? 0) + 1;
  STATE.shieldRechargeLast = { actor: actor.name ?? actor.id, action: "restored", before: current, after: max, elapsed, source, at: nowMs() };
  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><strong>Endurecimento Defensivo</strong> — ${escape(actor.name)} recuperou <strong>${max - current} Pontos de Escudo</strong> após 10 minutos sem usar o Haki do Armamento.</p>`
    });
  } catch (_) {}
  return { restored: true, before: current, after: max, elapsed };
}

async function checkAllShieldRecharges(source="world-time") {
  const gm = game?.users?.activeGM;
  if (gm && gm !== game.user && gm.id !== game.user?.id) return;
  for (const actor of game?.actors ?? []) {
    if (actor?.type !== "character" || !hasEndurecimento(actor)) continue;
    try { await recoverShieldIfReady(actor, { source }); }
    catch (error) { STATE.warnings.push(`Recarga de Escudo/${actor?.name}: ${error?.message ?? error}`); }
  }
}

function currentTurnKey(actor, combat=game?.combat) {
  if (!combat?.started) return null;
  const combatant = combat?.combatant;
  if (!combatant?.actor || !(combatant.actor.uuid === actor?.uuid || combatant.actor.id === actor?.id)) return null;
  return `combat:${combat.id}:${combat.round ?? 0}:${combat.turn ?? 0}:${combatant.id}`;
}

function directAwakeningCandidates(actor) {
  const akuma = actorAkuma(actor);
  if (!akuma) return [];
  const candidates = [
    "estagioDesperto.ativo", "estagioDesperto.active", "estagioDespertoAtivo",
    "despertoAtivo", "despertar.ativo", "despertar.active", "awakening.active",
    "awakened.active", "awakeningActive", "awakenedActive"
  ];
  const out = [];
  for (const path of candidates) {
    const value = foundry.utils.getProperty(akuma, path);
    if (typeof value === "boolean" || value === 0 || value === 1 || value === "0" || value === "1") out.push({ path: akumaPath(actor, path), value: truthy(value), source: "field" });
  }
  return out;
}

function recursiveAwakeningCandidates(actor) {
  const akuma = actorAkuma(actor);
  if (!akuma) return [];
  return collectPrimitive(akuma, (value, path) => {
    if (!(typeof value === "boolean" || value === 0 || value === 1 || value === "0" || value === "1")) return false;
    const normalized = path.toLowerCase();
    const hasAwaken = /despert|awak/.test(normalized);
    const activeish = /ativ|active|enabled/.test(normalized) || /estagio.?desperto$|estágio.?desperto$/.test(normalized);
    return hasAwaken && activeish;
  }).map(entry => ({ path: akumaPath(actor, entry.path), value: truthy(entry.value), source: "field-recursive" }));
}

function awakeningEffect(actor) {
  return Array.from(actor?.effects ?? []).find(effect => {
    if (effect?.disabled) return false;
    const name = String(effect?.name ?? effect?.label ?? "").toLowerCase();
    return /est[aá]gio\s+despert|despert.*est[aá]gio|awakened\s+stage/.test(name);
  }) ?? null;
}

export function awakeningState(actor) {
  if (!actor) return { active: false, path: null, effect: null, detected: false };
  const direct = directAwakeningCandidates(actor);
  const recursive = recursiveAwakeningCandidates(actor);
  const all = [...direct, ...recursive];
  const active = all.find(entry => entry.value === true);
  const inactive = all.find(entry => entry.value === false);
  const effect = awakeningEffect(actor);
  if (active) return { active: true, path: active.path, effect, detected: true, source: active.source };
  if (effect) return { active: true, path: inactive?.path ?? null, effect, detected: true, source: "active-effect" };
  if (inactive) return { active: false, path: inactive.path, effect: null, detected: true, source: inactive.source };
  return { active: false, path: null, effect: null, detected: false, source: null };
}

async function endAwakeningStage(actor, reason="pp-zero") {
  const state = awakeningState(actor);
  const updates = {};
  if (state.path) updates[state.path] = false;
  if (Object.keys(updates).length) {
    const key = actorKey(actor);
    internallyUpdating.add(key);
    try { await actor.update(updates); }
    finally { internallyUpdating.delete(key); }
  }
  if (state.effect && /est[aá]gio\s+despert|awakened\s+stage/i.test(String(state.effect.name ?? state.effect.label ?? ""))) {
    try { await state.effect.delete(); } catch (_) {}
  }
  STATE.awakeningAutoEnded = Number(STATE.awakeningAutoEnded ?? 0) + 1;
  STATE.awakeningLast = { actor: actor.name ?? actor.id, action: "auto-ended", reason, at: nowMs() };
  return true;
}

function energyPath(actor) {
  const candidates = ["system.energy.total", "system.energy.value"];
  for (const path of candidates) {
    const value = Number(foundry.utils.getProperty(actor, path));
    if (Number.isFinite(value)) return { path, value };
  }
  return null;
}

function energyMax(actor) {
  const candidates = [actor?.system?.energy?.max, actor?.system?.energy?.maximum];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

async function spendAwakeningPP(actor, turnKey, { source="turn-end" }={}) {
  const key = actorKey(actor);
  if (!key || !automationAuthority(actor)) return false;
  if (drainedTurns.get(actor) === turnKey) return false;
  const touched = awakeningTouched.get(key);
  const state = awakeningState(actor);
  if (!state.active && touched !== turnKey) return false;
  const energy = energyPath(actor);
  if (!energy) {
    STATE.warnings.push(`Estágio Desperto/${actor.name}: caminho de PP não detectado.`);
    return false;
  }
  const before = Math.max(0, energy.value);
  const after = Math.max(0, before - 1);
  drainedTurns.set(actor, turnKey);
  internallyUpdating.add(key);
  try { await actor.update({ [energy.path]: after }); }
  catch (error) { drainedTurns.delete(actor); throw error; }
  finally { internallyUpdating.delete(key); }
  awakeningTouched.delete(key);
  STATE.awakeningPpSpent = Number(STATE.awakeningPpSpent ?? 0) + Math.min(1, before);
  STATE.awakeningTurnsDrained = Number(STATE.awakeningTurnsDrained ?? 0) + 1;
  STATE.awakeningLast = { actor: actor.name ?? actor.id, action: "liberacao-cansativa", before, after, turnKey, source, at: nowMs() };
  if (after <= 0) await endAwakeningStage(actor, "pp-zero");
  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><strong>Liberação Cansativa</strong> — ${escape(actor.name)} consumiu <strong>1 PP</strong>${after <= 0 ? " e o Estágio Desperto foi encerrado" : ` (${after} PP restantes)`}.</p>`
    });
  } catch (_) {}
  return true;
}

function markAwakeningTouched(actor, combat=game?.combat) {
  const key = actorKey(actor);
  const turnKey = currentTurnKey(actor, combat);
  if (!key || !turnKey) return false;
  awakeningTouched.set(key, turnKey);
  return true;
}

function combatTurnSnapshot(combat) {
  const combatant = combat?.combatant;
  return {
    actorUuid: combatant?.actor?.uuid ?? null,
    actorId: combatant?.actor?.id ?? null,
    combatantId: combatant?.id ?? null,
    round: combat?.round ?? 0,
    turn: combat?.turn ?? 0,
    key: combatant?.actor ? currentTurnKey(combatant.actor, combat) : null
  };
}

function actorFromSnapshot(snapshot) {
  if (!snapshot) return null;
  const fromCombat = Array.from(game?.combats ?? []).flatMap(c => Array.from(c.combatants ?? [])).find(c => c.actor?.uuid === snapshot.actorUuid || c.actor?.id === snapshot.actorId)?.actor;
  return fromCombat ?? game?.actors?.get(snapshot.actorId) ?? null;
}

async function onCombatAdvanced(combat, changed) {
  if (!("turn" in (changed ?? {}) || "round" in (changed ?? {}) || "started" in (changed ?? {}))) return;
  if ("started" in (changed ?? {}) && changed.started === false) await markCombatEndForShields(combat, "combat-ended");
  if ("started" in (changed ?? {}) && changed.started === true) {
    for (const combatant of combat?.combatants ?? []) {
      if (combatant?.actor && hasEndurecimento(combatant.actor)) await clearShieldRecharge(combatant.actor);
    }
  }
  const previous = combatTurns.get(combat.id);
  const current = combatTurnSnapshot(combat);
  const ending = "started" in (changed ?? {}) && changed.started === false;
  if (previous?.key && (previous.key !== current.key || ending)) {
    const actor = actorFromSnapshot(previous);
    if (actor) await spendAwakeningPP(actor, previous.key, { source: ending ? "combat-ended" : "combat-turn-change" });
  }
  if (ending) {
    combatTurns.delete(combat.id);
    return;
  }
  combatTurns.set(combat.id, current);
  if (combat?.started && combat?.combatant?.actor && awakeningState(combat.combatant.actor).active) markAwakeningTouched(combat.combatant.actor, combat);
}


async function onCombatDeleted(combat) {
  const previous = combatTurns.get(combat?.id);
  if (previous?.key) {
    const actor = actorFromSnapshot(previous);
    if (actor) await spendAwakeningPP(actor, previous.key, { source: "combat-deleted" });
  }
  await markCombatEndForShields(combat, "combat-deleted");
  combatTurns.delete(combat?.id);
}

async function markCombatEndForShields(combat, reason="combat-end") {
  const start = worldNow();
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant?.actor;
    if (!actor || !hasEndurecimento(actor)) continue;
    await setShieldRecharge(actor, start, reason);
  }
}

function sourceText(item, activity) {
  const html = [item?.name, item?.system?.description?.value, item?.system?.requirements, activity?.name, activity?.requirements, activity?.description?.chatFlavor].filter(Boolean).join(" ");
  try {
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.textContent ?? html).toLowerCase();
  } catch (_) { return html.replace(/<[^>]*>/g, " ").toLowerCase(); }
}

function hasAttackInfuso(actor) {
  const haki = actorHaki(actor);
  if (Number(haki?.talentos?.["ataque-infuso"]) > 0) return true;
  if (haki && primitiveSearch(haki, (value, path) => /ataque.?infus/i.test(`${path} ${String(value ?? "")}`) && (truthy(value) || typeof value === "object" || typeof value === "string"))) return true;
  return Array.from(actor?.items ?? []).some(item => /ataque\s+infus/i.test(String(item?.name ?? "")) || /ataque\s+infus/i.test(String(item?.system?.description?.value ?? "")));
}

function selectedInfusionForms(actor) {
  const haki = actorHaki(actor);
  const forms = new Set();
  if (!haki) return forms;
  const entries = collectPrimitive(haki, (value, path) => {
    if (!/ataque.?infus|infus/i.test(path)) return false;
    if (typeof value === "string" && value.length > 80) return false;
    return true;
  });
  for (const { path, value } of entries) {
    if (value === false || value === 0 || value === "0" || value === "false" || value == null) continue;
    const text = `${path} ${String(value ?? "")}`.toLowerCase();
    if (/desarmad|unarmed/.test(text)) forms.add("unarmed");
    if (/dist[aâ]ncia|ranged/.test(text)) forms.add("ranged");
    if (/corpo.?a.?corpo.*arma|arma.*corpo.?a.?corpo|melee.?weapon/.test(text)) forms.add("melee-weapon");
  }
  return forms;
}

function attackForm(item, activity) {
  const text = sourceText(item, activity);
  if (/desarmad|unarmed/.test(text)) return "unarmed";
  const type = String(activity?.attack?.type?.value ?? activity?.attack?.type ?? "").toLowerCase();
  const classification = String(activity?.attack?.type?.classification ?? activity?.attack?.classification ?? "").toLowerCase();
  if (/ranged|dist/.test(type) || /ranged/.test(classification)) return "ranged";
  if (/melee|corpo/.test(type) || /weapon/.test(classification)) return "melee-weapon";
  return null;
}

function manualInfusion(actor) {
  try {
    const flag = actor?.getFlag?.(MODULE_ID, HAKI_INFUSION_FLAG);
    if (!flag || Number(flag.expires ?? 0) <= nowMs()) return null;
    return flag;
  } catch (_) { return null; }
}

export function hakiInfusionApplies(actor, item=null, activity=null) {
  if (!actor) return { applies: false, reason: "no-actor", form: null, selected: [] };
  const text = sourceText(item, activity);
  if (/haki\s+do\s+armamento|ataque\s+infus/.test(text)) return { applies: true, reason: "attack-explicitly-infused", form: attackForm(item, activity), selected: [] };
  const form = attackForm(item, activity);
  const manual = manualInfusion(actor);
  if (manual && (!manual.form || !form || manual.form === form || manual.form === "any")) return { applies: true, reason: manual.reason ?? "manual", form, selected: manual.form ? [manual.form] : [] };
  if (!hasAttackInfuso(actor)) return { applies: false, reason: "talent-not-detected", form, selected: [] };
  const selected = selectedInfusionForms(actor);
  if (!form) return { applies: false, reason: "attack-form-unknown", form, selected: Array.from(selected) };
  if (!selected.size) return { applies: false, reason: "selected-form-not-detected", form, selected: [] };
  return { applies: selected.has(form), reason: selected.has(form) ? "native-selected-form" : "different-selected-form", form, selected: Array.from(selected) };
}

export async function markHakiInfusion(actor, form="any", seconds=60, reason="manual-ataque-infuso") {
  if (!actor?.setFlag || !explicitAuthority(actor)) return false;
  const normalized = ["unarmed", "melee-weapon", "ranged", "any"].includes(form) ? form : "any";
  await actor.setFlag(MODULE_ID, HAKI_INFUSION_FLAG, { form: normalized, reason, expires: nowMs() + Math.max(1, Number(seconds) || 60) * 1000 });
  STATE.hakiInfusionManualMarks = Number(STATE.hakiInfusionManualMarks ?? 0) + 1;
  return true;
}

export async function useAwakenedPowerBurst(actor) {
  if (!actor || burstInFlight.has(actor)) return false;
  burstInFlight.add(actor);
  try { return await useAwakenedPowerBurstUnlocked(actor); }
  finally { burstInFlight.delete(actor); }
}

async function useAwakenedPowerBurstUnlocked(actor) {
  if (!actor || !explicitAuthority(actor)) return false;
  const stage = awakeningState(actor);
  if (!stage.active) {
    ui.notifications?.warn?.("OPRPG Fixes: Explosão de Poder só pode ser usada no Estágio Desperto.");
    return false;
  }
  if (actor.getFlag?.(MODULE_ID, AWAKENED_BURST_FLAG) === true) {
    ui.notifications?.warn?.("OPRPG Fixes: Explosão de Poder já foi usada desde o último descanso longo.");
    return false;
  }
  const energy = energyPath(actor);
  if (!energy) return false;
  const max = Math.max(energy.value, energyMax(actor));
  const after = Math.min(max, Math.max(0, energy.value) + 10);
  const recovered = Math.max(0, after - energy.value);
  await actor.update({ [energy.path]: after, [`flags.${MODULE_ID}.${AWAKENED_BURST_FLAG}`]: true });
  STATE.awakenedPowerBurstUses = Number(STATE.awakenedPowerBurstUses ?? 0) + 1;
  STATE.awakeningLast = { actor: actor.name ?? actor.id, action: "explosao-de-poder", recovered, before: energy.value, after, at: nowMs() };
  try {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><strong>Explosão de Poder</strong> — ${escape(actor.name)} recuperou <strong>${recovered} PP</strong>.</p>` });
  } catch (_) {}
  return true;
}

async function patchAwakenedPowerBurstHandler() {
  try {
    const mod = await import("/systems/oprpg-system/module/applications/actor/character-sheet.mjs");
    const candidates = Object.values(mod).filter(value => typeof value === "function" && value.prototype);
    if (mod.default?.prototype) candidates.unshift(mod.default);
    for (const cls of candidates) {
      let proto = cls?.prototype;
      for (let depth = 0; proto && depth < 5; depth++, proto = Object.getPrototypeOf(proto)) {
        if (patchedSheetPrototypes.has(proto)) continue;
        const names = Object.getOwnPropertyNames(proto).filter(name => /explos.*poder|power.*burst|burst.*power/i.test(name) && typeof proto[name] === "function");
        for (const name of names) {
          const original = proto[name];
          const src = Function.prototype.toString.call(original);
          if (/system\.energy|energy\.total|energy\.value|pontos.?de.?poder/i.test(src)) {
            STATE.awakenedPowerBurstNative = true;
            STATE.awakenedPowerBurstHandler = name;
            patchedSheetPrototypes.add(proto);
            return true;
          }
          async function wrappedBurst(...args) {
            const actor = this?.actor;
            if (!actor) return original.apply(this, args);
            return useAwakenedPowerBurst(actor);
          }
          wrappedBurst.__oprpgFixesAwakenedBurstWrapped = true;
          wrappedBurst.__oprpgFixesOriginal = original;
          proto[name] = wrappedBurst;
          STATE.awakenedPowerBurstPatch = true;
          STATE.awakenedPowerBurstHandler = name;
          patchedSheetPrototypes.add(proto);
          return true;
        }
        patchedSheetPrototypes.add(proto);
      }
    }
  } catch (error) {
    STATE.warnings.push(`Explosão de Poder/import da ficha: ${error?.message ?? error}`);
  }
  return false;
}

function isLongRest(result, config) {
  const values = [config?.type, config?.restType, result?.type, result?.restType].map(v => String(v ?? "").toLowerCase());
  return values.some(v => v.includes("long")) || config?.longRest === true || result?.longRest === true;
}

async function onRestCompleted(actor, result, config) {
  if (!actor) return;
  if (isLongRest(result, config)) {
    try { await actor.unsetFlag?.(MODULE_ID, AWAKENED_BURST_FLAG); } catch (_) {}
  }
  // Do not blindly restore Shield Points on every DND5E rest: the OPRPG rule is
  // specifically ten minutes without using Armament Haki. If world time already
  // advanced by at least ten minutes, this check will restore them immediately.
  try { await recoverShieldIfReady(actor, { source: "rest-completed" }); } catch (_) {}
}

async function onActorUpdated(actor, changes) {
  if(Object.keys(changes??{}).length&&!changeTouches(changes,['flags.oprpg-system','flags.oprpg-system-fixes.shieldRecharge','system.shieldPoints','system.haki']))return;
  const key = actorKey(actor);
  if (!key || internallyUpdating.has(key)) return;

  if (armamentChangeDetected(actor, changes)) await markArmamentUse(actor, "native-haki-update");
  else if (hasChange(changes, "system.shieldPoints.value")) {
    const current = shieldValue(actor);
    if (current < shieldMax(actor) && !actorInCombat(actor) && !shieldRechargeData(actor)) await setShieldRecharge(actor, worldNow(), "shield-spent-outside-combat");
  }

  const stage = awakeningState(actor);
  const previous = awakeningCache.get(key);
  awakeningCache.set(key, stage.active);
  if (stage.active) markAwakeningTouched(actor);
  if (previous !== stage.active) {
    STATE.awakeningLast = { actor: actor.name ?? actor.id, action: stage.active ? "stage-detected-active" : "stage-detected-inactive", path: stage.path, source: stage.source, at: nowMs() };
  }
  if (!actorInCombat(actor)) await recoverShieldIfReady(actor, { source: "actor-update" });
}

function initializeRuntimeState() {
  for (const combat of game?.combats ?? []) {
    if (!combat?.started) continue;
    combatTurns.set(combat.id, combatTurnSnapshot(combat));
    const actor = combat.combatant?.actor;
    if (actor && awakeningState(actor).active) markAwakeningTouched(actor, combat);
  }
  for (const actor of game?.actors ?? []) {
    const key = actorKey(actor);
    if (key) awakeningCache.set(key, awakeningState(actor).active);
  }
}

export async function installHakiAwakeningFixes() {
  if (installed) return true;
  installed = true;
  initializeRuntimeState();

  registerActorTimer('shield-recharge',actor=>actor.type==='character'&&hasEndurecimento(actor)&&shieldValue(actor)<shieldMax(actor),actor=>queueActor(actor,()=>recoverShieldIfReady(actor,{source:'world-time'})));
  updateWorldTimeHookId = 'indexed-runtime';
  updateActorHookId = Hooks.on("updateActor", (actor, changes) => { void onActorUpdated(actor, changes); });
  updateCombatHookId = Hooks.on("updateCombat", (combat, changed) => { void onCombatAdvanced(combat, changed); });
  deleteCombatHookId = Hooks.on("deleteCombat", combat => { void onCombatDeleted(combat); });
  deleteCombatantHookId = Hooks.on("deleteCombatant", combatant => {
    const actor = combatant?.actor;
    if (actor && hasEndurecimento(actor) && shieldValue(actor) < shieldMax(actor)) void setShieldRecharge(actor, worldNow(), "left-combat");
  });
  createCombatantHookId = Hooks.on("createCombatant", combatant => {
    const actor = combatant?.actor;
    if (actor && hasEndurecimento(actor)) void clearShieldRecharge(actor);
  });
  restHookId = Hooks.on("dnd5e.restCompleted", (actor, result, config) => { void onRestCompleted(actor, result, config); });
  const refreshAwakening = effect => {
    const actor = effect?.parent;
    if (actor?.documentName === "Actor") void onActorUpdated(actor, {});
  };
  createEffectHookId = Hooks.on("createActiveEffect", refreshAwakening);
  updateEffectHookId = Hooks.on("updateActiveEffect", refreshAwakening);
  deleteEffectHookId = Hooks.on("deleteActiveEffect", refreshAwakening);
  await patchAwakenedPowerBurstHandler();
  await checkAllShieldRecharges("ready");

  STATE.shieldRechargePatch = !!updateWorldTimeHookId;
  STATE.hakiInfusionPatch = true;
  STATE.awakeningDrainPatch = !!updateCombatHookId;
  STATE.awakeningLifecyclePatch = !!(createEffectHookId && updateEffectHookId && deleteEffectHookId);
  return true;
}

export function hakiAwakeningStatus(actor=null) {
  const current = actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game?.user?.character ?? null;
  const recharge = current ? shieldRechargeData(current) : null;
  const stage = current ? awakeningState(current) : null;
  const energy = current ? energyPath(current) : null;
  return {
    installed,
    shieldRecovery: {
      installed: !!STATE.shieldRechargePatch,
      cooldownSeconds: SHIELD_RECHARGE_SECONDS,
      restored: Number(STATE.shieldRechargeCount ?? 0),
      last: STATE.shieldRechargeLast ?? null,
      actor: current ? {
        name: current.name,
        value: shieldValue(current),
        max: shieldMax(current),
        inCombat: actorInCombat(current),
        endurecimentoActive: endurecimentoActive(current),
        timer: recharge,
        elapsed: recharge ? Math.max(0, worldNow() - Number(recharge.start ?? worldNow())) : null
      } : null
    },
    haki: {
      attackInfusion: !!STATE.hakiInfusionPatch,
      manualMarks: Number(STATE.hakiInfusionManualMarks ?? 0),
      actorHasAttackInfuso: current ? hasAttackInfuso(current) : null,
      selectedForms: current ? Array.from(selectedInfusionForms(current)) : []
    },
    awakening: {
      drainInstalled: !!STATE.awakeningDrainPatch,
      lifecycleInstalled: !!STATE.awakeningLifecyclePatch,
      turnsDrained: Number(STATE.awakeningTurnsDrained ?? 0),
      ppSpent: Number(STATE.awakeningPpSpent ?? 0),
      autoEnded: Number(STATE.awakeningAutoEnded ?? 0),
      powerBurstNative: !!STATE.awakenedPowerBurstNative,
      powerBurstPatched: !!STATE.awakenedPowerBurstPatch,
      powerBurstHandler: STATE.awakenedPowerBurstHandler ?? null,
      powerBurstUses: Number(STATE.awakenedPowerBurstUses ?? 0),
      last: STATE.awakeningLast ?? null,
      actor: current ? {
        name: current.name,
        ...stage,
        pp: energy?.value ?? null,
        ppMax: energyMax(current),
        touchedTurn: awakeningTouched.get(actorKey(current)) ?? null,
        burstUsed: current.getFlag?.(MODULE_ID, AWAKENED_BURST_FLAG) === true
      } : null
    }
  };
}
