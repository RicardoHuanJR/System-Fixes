// Adapted from OPRPG Argon 6.4.1; see LICENSE-ARGON.txt.
const MODULE_ID = "oprpg-system-fixes";
const t = key => game.i18n.localize('oprpg-system-fixes.argon.' + key);
import { executeEntry, isAvailable } from "./execute.js";
import { activityList as activitiesOf, economyOf as activityType, asArray } from "./model.js";
import { movementInfo } from "./movement.js";
const activityCanUse = activity => activity?.canUse !== false && typeof activity?.use === "function";

const FLAG_KEY = "basicAction";
const TURN_SCOPED = new Set(["dodge", "dash", "ready"]);
const pendingBasics = new WeakSet();
const pendingPrepared = new Set();

function activePrimaryGM() {
  return (game.users ?? []).find(u => u.active && u.isGM) ?? null;
}

function canManageActor(actor) {
  const gm = activePrimaryGM();
  return gm ? gm.id === game.user.id : !!actor?.isOwner;
}

function combatStamp(actor) {
  const combat = game.combat;
  const combatant = combat?.combatant;
  if (!combat?.started || !combatant || !asArray(combat.combatants).some(c=>c.actor === actor)) return null;
  return { combatId: combat.id, round: combat.round, turn: combat.turn, combatantId: combatant.id };
}

function sameTurn(a, b) {
  return !!a && !!b && a.combatId === b.combatId && a.round === b.round && a.turn === b.turn && a.combatantId === b.combatantId;
}

export function basicActionEffect(actor, key) {
  return Array.from(actor?.effects ?? []).find(effect => effect.getFlag?.(MODULE_ID, FLAG_KEY)?.key === key) ?? null;
}

export function basicActionState(actor, key) {
  return basicActionEffect(actor, key)?.getFlag?.(MODULE_ID, FLAG_KEY) ?? null;
}

function effectData(actor, key, icon, extra={}) {
  const stamp = combatStamp(actor);
  const duration = stamp
    ? { rounds: 1, startRound: stamp.round, startTurn: stamp.turn }
    : { seconds: 6, startTime: game.time?.worldTime ?? 0 };
  return {
    name: t(`basic.${key}.name`),
    img: icon,
    disabled: false,
    duration,
    flags: {
      [MODULE_ID]: {
        [FLAG_KEY]: {
          key,
          activated: stamp,
          createdBy: game.user.id,
          createdAt: Date.now(),
          ...extra
        }
      }
    }
  };
}

async function replaceEffect(actor, key, icon, extra={}) {
  const previous = basicActionEffect(actor, key);
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [effectData(actor, key, icon, extra)]);
  if (effect && previous) await previous.delete();
  return effect;
}

export function basicEffectActive(effect) {
  if (!effect || effect.disabled || effect.isSuppressed) return false;
  if (effect.id && effect.parent?.effects?.get && effect.parent.effects.get(effect.id) !== effect) return false;
  const duration = effect.duration;
  if (duration?.seconds > 0 && game.time?.worldTime >= duration.startTime + duration.seconds) return false;
  const state = effect.getFlag?.(MODULE_ID, FLAG_KEY);
  if (!state?.activated) return true;
  const combat = game.combat;
  if (!combat?.started || state.activated.combatId !== combat.id) return false;
  const current = {combatId:combat.id, round:combat.round, turn:combat.turn, combatantId:combat.combatant?.id};
  if (state.key === "dash") return sameTurn(state.activated,current);
  const ownerTurn = combat.turns?.findIndex(c=>c.actor === effect.parent) ?? -1;
  if (ownerTurn >= 0) {
    const rounds = combat.round - state.activated.round;
    if (rounds > 1 || (rounds === 1 && (combat.turn >= ownerTurn || state.activated.turn < ownerTurn)) ||
      (rounds === 0 && state.activated.turn < ownerTurn && combat.turn >= ownerTurn)) return false;
  }
  return !(combat.combatant?.actor === effect.parent && !sameTurn(state.activated,current));
}

async function postActionCard(actor, key, icon, extra="") {
  const name = t(`basic.${key}.name`);
  const desc = t(`basic.${key}.desc`);
  return ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dnd5e2 chat-card item-card oprpg-basic-action-card"><section class="card-header description"><header class="summary"><img class="gold-icon" src="${icon}"><div class="name-stacked border"><span class="title">${name}</span><span class="subtitle">${t("hud.action")}</span></div></header><section class="details card-content"><div class="wrapper">${desc}${extra}</div></section></section></div>`
  });
}

function incapacitated(actor) {
  const statuses = actor?.statuses ?? new Set();
  return ["incapacitated", "unconscious", "dead", "paralyzed", "stunned"].some(s => statuses.has?.(s));
}

function movementZero(actor) {
  const movement = actor?.system?.attributes?.movement ?? {};
  const candidates = [movement.walk, movement.fly, movement.swim, movement.climb, movement.burrow]
    .map(Number).filter(Number.isFinite);
  return candidates.length > 0 && Math.max(...candidates) <= 0;
}

export function isDodging(actor) {
  const effect = basicActionEffect(actor, "dodge");
  return basicEffectActive(effect) && !incapacitated(actor) && !movementZero(actor);
}

export function dashMovementInfo(actor, token, movementMode="walk") {
  const info = movementInfo(actor, token, movementMode);
  const effect = basicActionEffect(actor, "dash");
  const state = basicActionState(actor, "dash");
  if (!basicEffectActive(effect) || incapacitated(actor) || state?.movementMode !== movementMode) return info;
  const bonus = Number(state?.movementBonus ?? 0);
  if (!Number.isFinite(bonus) || bonus <= 0) return info;
  const max = info.max + bonus;
  const remaining = info.used === null ? max : Math.max(0, max - info.used);
  const maxScene = info.max > 0 ? info.maxSpaces * (max / info.max) : info.maxSpaces;
  return { ...info, max, remaining, maxSpaces: maxScene, dashBonus: bonus };
}

async function useDodge(actor, icon) {
  if (movementZero(actor)) ui.notifications.warn(`${t("basic.dodge.name")}: deslocamento atual é 0; os benefícios não se aplicam.`);
  const effect = await replaceEffect(actor, "dodge", icon);
  await postActionCard(actor, "dodge", icon, `<p><em>${t("basic.dodge.active")}</em></p>`);
  ui.ARGON?.refresh?.();
  return effect;
}

async function useDash(actor, icon) {
  const existing = basicActionState(actor, "dash");
  const stamp = combatStamp(actor);
  if (basicEffectActive(basicActionEffect(actor,"dash")) && existing && ((stamp && sameTurn(existing.activated, stamp)) || (!stamp && !existing.activated))) {
    ui.notifications.info(t("basic.dash.alreadyActive"));
    return basicActionEffect(actor, "dash");
  }
  const movement = actor?.system?.attributes?.movement ?? {};
  const mode = ui.ARGON?._token?.actor === actor ? ui.ARGON._token.document?.movementAction || "walk" : "walk";
  const bonus = Number(movement?.[mode] ?? movement.walk ?? 0) || 0;
  if (bonus <= 0) return ui.notifications.warn("Disparada: não há deslocamento disponível nesta modalidade.");
  const effect = await replaceEffect(actor, "dash", icon, { movementBonus: bonus, movementMode: mode });
  await postActionCard(actor, "dash", icon, `<p><strong>+${bonus} ${movement.units ?? "m"}</strong> ${t("basic.dash.movementAdded")}</p>`);
  ui.ARGON?.components?.movement?.updateMovement?.();
  ui.ARGON?.refresh?.();
  return effect;
}

function findStealthSkill(actor) {
  const skills = CONFIG.DND5E?.skills ?? {};
  const candidates = ["ste", "stealth", "furtividade"];
  for (const key of candidates) if (skills[key] || actor?.system?.skills?.[key]) return key;
  for (const [key, data] of Object.entries(skills)) {
    const label = String(data?.label ?? data ?? "");
    const localized = game.i18n.localize(label);
    if (/furtividade|stealth/i.test(`${label} ${localized}`)) return key;
  }
  return null;
}

async function useHide(actor, icon, event) {
  await postActionCard(actor, "hide", icon);
  const skill = findStealthSkill(actor);
  if (skill && typeof actor.rollSkill === "function") return actor.rollSkill({ skill, event });
  if (typeof actor.rollAbilityCheck === "function") {
    ui.notifications.warn(t("basic.hide.skillFallback"));
    return actor.rollAbilityCheck({ ability: "dex", event });
  }
  return ui.notifications.error(t("basic.hide.noRollApi"));
}

function readyChoices(actor) {
  const choices = [];
  for (const item of asArray(actor?.items)) {
    for (const activity of activitiesOf(item)) {
      if (!activityCanUse(activity) || !isAvailable(actor,{itemId:item.id,activityId:activity.id})) continue;
      const activation = activityType(activity);
      if (!new Set(["action", "powerful"]).has(activation)) continue;
      choices.push({ activity, item, activation });
    }
  }
  return choices;
}

async function useReady(actor, icon) {
  const choices = readyChoices(actor);
  if (!choices.length) {
    ui.notifications.warn(t("basic.ready.noActivities"));
    return postActionCard(actor, "ready", icon);
  }
  const options = choices.map(({activity,item,activation}) => {
    const label = `${item.name} — ${activity.name}${activation === "powerful" ? ` (${t("hud.powerful")})` : ""}`;
    return `<option value="${foundry.utils.escapeHTML(activity.uuid)}">${foundry.utils.escapeHTML(label)}</option>`;
  }).join("");
  return foundry.applications.api.DialogV2.wait({
    window: { title: t("basic.ready.dialogTitle") },
    content: `<div style="display:grid;gap:8px"><label>${t("basic.ready.triggerLabel")}<input id="oprpg-ready-trigger" type="text" placeholder="${foundry.utils.escapeHTML(t("basic.ready.triggerPlaceholder"))}"></label><label>${t("basic.ready.activityLabel")}<select id="oprpg-ready-activity">${options}</select></label><p class="hint">${t("basic.ready.hint")}</p></div>`,
    buttons: [
      { label: t("basic.ready.confirm"), action: "ready", default: true, callback: async (event, button, dialog) => {
        const root = dialog.element ?? document;
        const trigger = root.querySelector("#oprpg-ready-trigger")?.value?.trim();
        const activityUuid = root.querySelector("#oprpg-ready-activity")?.value;
        if (!trigger || !activityUuid) { ui.notifications.warn(t("basic.ready.missingData")); return null; }
        const chosen = choices.find(c => c.activity.uuid === activityUuid);
        if (!chosen || !isAvailable(actor,{itemId:chosen.item.id,activityId:chosen.activity.id})) return null;
        const extraState = {
          trigger, activityUuid, itemUuid: chosen?.item?.uuid ?? null, activityName: chosen?.activity?.name ?? ""
        };
        let effect;
        if ((chosen.item.type === "spell" || chosen.activity.duration?.concentration) && !game.settings.get("oprpg-system","disableConcentration")) {
          // Native concentration enforces damage checks and incapacitation. Never end unrelated effects here.
          const limit = actor.system?.attributes?.concentration?.limit ?? 1;
          const previous = basicActionEffect(actor,"ready");
          const others = asArray(actor.concentration?.effects).filter(e=>e !== previous);
          if (limit > 0 && others.length >= limit) return ui.notifications.warn("Encerre uma concentração pela ficha antes de preparar esta atividade.");
          if (chosen.activity.duration?.concentration) {
            if (typeof actor.beginConcentrating !== "function") return ui.notifications.warn("Concentração nativa indisponível; prepare esta atividade pela ficha.");
            effect = await actor.beginConcentrating(chosen.activity,effectData(actor,"ready",icon,{...extraState,nativeConcentration:true}));
          } else {
            // Holding a prepared technique requires concentration even when its normal use does not.
            const status = CONFIG.specialStatusEffects?.CONCENTRATING;
            if (!status || !actor.system?.attributes?.concentration?.limit) return ui.notifications.warn("Concentração nativa indisponível; prepare esta Técnica pela ficha.");
            const data = effectData(actor,"ready",icon,extraState);
            data.statuses = [status];
            [effect] = await actor.createEmbeddedDocuments("ActiveEffect",[data]);
          }
          if (!effect) return null;
          if (previous) await previous.delete();
        } else effect = await replaceEffect(actor, "ready", icon, extraState);
        const extra = `<hr><p><strong>${t("basic.ready.triggerLabel")}:</strong> ${foundry.utils.escapeHTML(trigger)}</p><p><strong>${t("basic.ready.activityLabel")}:</strong> ${foundry.utils.escapeHTML(chosen?.item?.name ?? "")} — ${foundry.utils.escapeHTML(chosen?.activity?.name ?? "")}</p><div class="card-buttons"><button type="button" data-oprpg-ready-execute="${effect.uuid}"><i class="fa-solid fa-bolt"></i> ${t("basic.ready.execute")}</button><button type="button" data-oprpg-ready-cancel="${effect.uuid}"><i class="fa-solid fa-xmark"></i> ${t("basic.ready.cancel")}</button></div>`;
        await postActionCard(actor, "ready", icon, extra);
        ui.ARGON?.refresh?.();
        return effect;
      }},
      { label: t("hud.cancel"), action: "cancel", callback: () => null }
    ], rejectClose: false, close: () => null
  });
}

export async function executePrepared(effectOrUuid) {
  const effect = typeof effectOrUuid === "string" ? await fromUuid(effectOrUuid) : effectOrUuid;
  const actor = effect?.parent;
  const state = effect?.getFlag?.(MODULE_ID, FLAG_KEY);
  if (!actor || state?.key !== "ready") return ui.notifications.warn(t("basic.ready.notFound"));
  if (!actor.isOwner && !game.user.isGM) return ui.notifications.warn(t("hud.noEffectPermission"));
  let activity = null;
  try { activity = await fromUuid(state.activityUuid); } catch (_) { activity = null; }
  if (!activity || typeof activity.use !== "function") return ui.notifications.error(t("basic.ready.activityMissing"));
  if (activity.item?.parent !== actor || !basicEffectActive(effect) || incapacitated(actor) || pendingPrepared.has(effect.uuid)) return;
  pendingPrepared.add(effect.uuid);
  try {
    const confirmed = await foundry.applications.api.DialogV2.confirm({window:{title:"Executar ação preparada"},content:"<p>O gatilho ocorreu e sua Reação está disponível? A execução usará sua Reação. Confira os demais usos na ficha.</p>",rejectClose:false});
    if (!confirmed || !basicEffectActive(effect) || incapacitated(actor)) return {ok:false,reason:"cancelled"};
    const result = await executeEntry(actor, {itemId:activity.item.id, activityId:activity.id, label:activity.name},
      {usageConfig:state.nativeConcentration ? {concentration:{begin:false,end:null}} : undefined,
        messageConfig:state.nativeConcentration ? {data:{system:{concentration:effect.id}}} : undefined});
    if (result.ok) {
      if (state.nativeConcentration && basicEffectActive(effect)) await effect.update({[`flags.${MODULE_ID}.-=${FLAG_KEY}`]:null,duration:activity.duration.getEffectData()});
      else await effect.delete();
    }
    ui.ARGON?.refresh?.();
    return result;
  } catch (error) {
    console.error("Argon OPRPG | Falha ao executar ação preparada", error);
    ui.notifications.error(t("basic.ready.executeFailed"));
    return null;
  } finally {
    pendingPrepared.delete(effect.uuid);
  }
}

async function cancelPrepared(effectOrUuid) {
  const effect = typeof effectOrUuid === "string" ? await fromUuid(effectOrUuid) : effectOrUuid;
  if (!effect || effect.getFlag?.(MODULE_ID, FLAG_KEY)?.key !== "ready") return;
  if (!effect.parent?.isOwner && !game.user.isGM) return ui.notifications.warn(t("hud.noEffectPermission"));
  await effect.delete();
  ui.ARGON?.refresh?.();
}

export async function useBasicAction(actor, key, icon, event) {
  if (!actor) return ui.notifications.warn(t("basic.noActor"));
  if (!actor.isOwner && !game.user.isGM) return ui.notifications.warn(t("basic.noPermission"));
  if (incapacitated(actor)) return ui.notifications.warn("Esta ficha está incapacitada e não pode executar ações básicas.");
  if (pendingBasics.has(actor)) return;
  pendingBasics.add(actor);
  try {
    switch (key) {
      case "dodge": return await useDodge(actor, icon);
      case "dash": return await useDash(actor, icon);
      case "hide": return await useHide(actor, icon, event);
      case "ready": return await useReady(actor, icon);
      default: return null;
    }
  } finally {
    pendingBasics.delete(actor);
  }
}

/** Test the defender's sight source, never the GM's or another token's visibility. */
export function defenderSeesAttacker(defender, attacker) {
  if (!defender?.vision || !attacker?.center || attacker.document?.hidden) return false;
  const levelRef = attacker.document?.level;
  const level = typeof levelRef === "string" ? attacker.document.parent?.levels?.get(levelRef) : levelRef;
  if (!level) return false; // V14 level is required; unknown vision stays manual.
  const sight = foundry.canvas?.perception?.DetectionMode?.DETECTION_TYPES?.SIGHT;
  if (sight === undefined) return false;
  const points = attacker.document.getVisibilityTestPoints?.() ?? [{...attacker.center,elevation:attacker.document.elevation ?? 0}];
  const tests = points.map(point=>({level,los:new Map(),point}));
  for (const mode of defender.document?.detectionModes ?? []) {
    const detection = CONFIG.Canvas?.detectionModes?.[mode.id];
    if (!mode.enabled || detection?.type !== sight || typeof detection.testVisibility !== "function") continue;
    try { if (detection.testVisibility(defender.vision,mode,{object:attacker,level,tests})) return true; }
    catch (_) { /* Unsupported perception extension: leave the modifier to the native dialog. */ }
  }
  return false;
}

export function applyDodgeToAttack(config) {
  const targets = asArray(config.targets ?? game.user?.targets).map(target=>target?.object ?? target);
  if (!targets.length) return;
  const sourceActor = config.subject?.actor ?? config.subject?.item?.actor;
  const source = sourceActor?.token?.object;
  const tokens = source ? [source] : sourceActor?.getActiveTokens?.() ?? [];
  if (tokens.length !== 1) return;
  // Attack rolls are normally single-target. For mixed multi-target rolls we do not
  // force a global modifier because that would incorrectly penalize non-dodging targets.
  if (!targets.every(token=>isDodging(token.actor) && defenderSeesAttacker(token,tokens[0]))) return;
  config.disadvantage = true;
  for (const roll of config.rolls ?? []) {
    roll.options ??= {};
    roll.options.disadvantage = true;
  }
}

function savingThrowSubject(config, legacyActor=null) {
  return legacyActor ?? config?.subject ?? config?.actor ?? config?.data?.subject ?? null;
}

function saveAbility(config, legacyAbility=null) {
  const ability = legacyAbility ?? config?.ability ?? config?.data?.ability ?? config?.abilityId;
  return Array.isArray(ability) ? ability[0] : ability;
}

function applyDodgeToSave(config, actor, ability) {
  if (saveAbility(config, ability) !== "dex") return;
  const subject = savingThrowSubject(config, actor);
  if (!isDodging(subject)) return;
  config.advantage = true;
  for (const roll of config.rolls ?? []) {
    roll.options ??= {};
    roll.options.advantage = true;
  }
}

async function expireTurnScopedEffects(combat) {
  if (!combat?.combatant) return;
  const now = { combatId: combat.id, round: combat.round, turn: combat.turn, combatantId: combat.combatant.id };
  const currentActor = combat.combatant.actor;
  const actors = new Map();
  for (const combatant of combat.combatants ?? []) if (combatant.actor) actors.set(combatant.actor.uuid, combatant.actor);

  let removedDash = false;
  for (const actor of actors.values()) {
    if (!canManageActor(actor)) continue;
    const expired = Array.from(actor.effects ?? []).filter(effect => {
      const state = effect.getFlag?.(MODULE_ID, FLAG_KEY);
      if (!state?.activated || state.activated.combatId !== combat.id) return false;
      // Dash lasts only for the turn in which it was used.
      if (state.key === "dash") return !sameTurn(state.activated, now);
      // Dodge and Ready last until the start of this actor's next turn.
      if (["dodge", "ready"].includes(state.key)) return actor === currentActor && !sameTurn(state.activated, now);
      return false;
    });
    if (expired.length) {
      removedDash ||= expired.some(e => e.getFlag?.(MODULE_ID, FLAG_KEY)?.key === "dash");
      await actor.deleteEmbeddedDocuments("ActiveEffect", expired.map(e => e.id));
    }
  }
  if (removedDash) ui.ARGON?.components?.movement?.updateMovement?.();
}

function attachReadyButtons(message, html) {
  const root = html?.querySelector ? html : html?.[0];
  if (!root) return;
  for (const button of root.querySelectorAll("[data-oprpg-ready-execute]")) {
    button.onclick = event => { event.preventDefault(); void executePrepared(button.dataset.oprpgReadyExecute); };
  }
  for (const button of root.querySelectorAll("[data-oprpg-ready-cancel]")) {
    button.onclick = event => { event.preventDefault(); void cancelPrepared(button.dataset.oprpgReadyCancel); };
  }
}

let installed = false;
async function expireIncapacitatedStates(actor) {
  if (!actor || !canManageActor(actor)) return;
  const ids = asArray(actor.effects).filter(effect=>{
    const key = effect.getFlag?.(MODULE_ID,FLAG_KEY)?.key;
    return TURN_SCOPED.has(key) && (incapacitated(actor) || (key === "dodge" && movementZero(actor)));
  }).map(effect=>effect.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect",ids);
}

export function installBasicActionAutomation() {
  if (installed) return;
  installed = true;
  Hooks.on("updateActor", expireIncapacitatedStates);
  for (const hook of ["createActiveEffect","updateActiveEffect"]) Hooks.on(hook,effect=>expireIncapacitatedStates(effect.parent));
  Hooks.on("updateWorldTime", async worldTime => {
    const actors = new Set([...Array.from(game.actors ?? []), ...Array.from(canvas.tokens?.placeables ?? [], token => token.actor)]);
    for (const actor of actors) {
      if (!actor || !canManageActor(actor)) continue;
      const ids = Array.from(actor.effects ?? []).filter(effect => {
        const state = effect.getFlag?.(MODULE_ID, FLAG_KEY);
        return TURN_SCOPED.has(state?.key) && !state.activated && effect.duration?.seconds > 0 &&
          worldTime >= effect.duration.startTime + effect.duration.seconds;
      }).map(effect => effect.id);
      if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
    }
  });
  Hooks.on("dnd5e.preRollAttack", (...args) => {
    // OPRPG/DND5E v4+ signature: (config, dialog, message). Older fallback: (item, config).
    const config = args[0]?.rolls || args[0]?.hookNames ? args[0] : args[1];
    if (config) applyDodgeToAttack(config);
  });
  Hooks.on("dnd5e.preRollAttackV2", config => applyDodgeToAttack(config));
  Hooks.on("dnd5e.preRollSavingThrow", config => applyDodgeToSave(config));
  Hooks.on("dnd5e.preRollSavingThrowV2", config => applyDodgeToSave(config));
  Hooks.on("dnd5e.preRollAbilitySave", (actor, config, ability) => applyDodgeToSave(config, actor, ability));
  Hooks.on("dnd5e.preRollAbilitySaveV2", config => applyDodgeToSave(config));
  Hooks.on("updateCombat", (combat, changes) => {
    if (!("turn" in changes) && !("round" in changes)) return;
    expireTurnScopedEffects(combat).catch(error => console.error("Argon OPRPG | Falha ao expirar ação básica", error));
  });
  Hooks.on("deleteCombat", async combat => {
    const gm = activePrimaryGM();
    if (gm && gm.id !== game.user.id) return;
    const actors = new Map();
    for (const combatant of combat?.combatants ?? []) if (combatant.actor) actors.set(combatant.actor.uuid, combatant.actor);
    for (const actor of actors.values()) {
      if (!gm && !actor.isOwner) continue;
      const ids = Array.from(actor.effects ?? []).filter(effect => {
        const state = effect.getFlag?.(MODULE_ID, FLAG_KEY);
        return TURN_SCOPED.has(state?.key) && state?.activated?.combatId === combat.id;
      }).map(effect => effect.id);
      if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
    }
    ui.ARGON?.components?.movement?.updateMovement?.();
    ui.ARGON?.refresh?.();
  });
  Hooks.on("renderChatMessageHTML", attachReadyButtons);
  Hooks.on("renderChatMessage", attachReadyButtons);

  globalThis.OPRPG_ARGON_BASIC_ACTIONS = {
    use: useBasicAction,
    executePrepared,
    state: basicActionState,
    isDodging,
    movementInfo: dashMovementInfo
  };
  globalThis.OPRPG_ARGON_BASIC_ACTIONS_INSTALLED = true;
}
