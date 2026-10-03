import { showPrivateDice, rollAudience } from './roll-privacy.js';
import {
  MODULE_ID, STATE, BYPASS_HEAL_LIMIT, RAW_GET_HEAL_LIMIT,
  healMode, disabledHealLimit, canAct, getCardActivity, applyTempHP
} from "./shared.js";

let HealClass = null;
let rawGetHealLimit = null;
let oldAutoHealHookId = null;
let installed = false;
const boundRollButtons = new WeakSet();
const boundFooters = new WeakSet();
const applyingFooters = new WeakSet();

function withBypass(activity, fn) {
  activity[BYPASS_HEAL_LIMIT] = (activity[BYPASS_HEAL_LIMIT] ?? 0) + 1;
  try { return fn(); }
  finally {
    activity[BYPASS_HEAL_LIMIT]--;
    if (activity[BYPASS_HEAL_LIMIT] <= 0) delete activity[BYPASS_HEAL_LIMIT];
  }
}

async function withBypassAsync(activity, fn) {
  activity[BYPASS_HEAL_LIMIT] = (activity[BYPASS_HEAL_LIMIT] ?? 0) + 1;
  try { return await fn(); }
  finally {
    activity[BYPASS_HEAL_LIMIT]--;
    if (activity[BYPASS_HEAL_LIMIT] <= 0) delete activity[BYPASS_HEAL_LIMIT];
  }
}

function moveHookToFront(hookName, id) {
  const list = Hooks.events?.[hookName];
  if (!Array.isArray(list)) return false;
  const index = list.findIndex(h => h.id === id);
  if (index <= 0) return index === 0;
  const [entry] = list.splice(index, 1);
  list.unshift(entry);
  return true;
}

function getRawLimit(activity) {
  const getter = rawGetHealLimit ?? activity?.[RAW_GET_HEAL_LIMIT] ?? activity?.getHealLimit;
  if (!activity || typeof getter !== "function") return disabledHealLimit();
  try { return getter.call(activity); }
  catch (_) { return disabledHealLimit(); }
}

async function consumeHealLimit(activity, amount) {
  const lim = getRawLimit(activity);
  if (!lim.enabled) return Math.max(0, Number(amount) || 0);
  const applied = Math.max(0, Math.min(Number(amount) || 0, lim.remaining));
  if (applied < amount) ui.notifications.info(`Cura limitada a ${applied} (saldo do Limite de Cura).`);
  if (applied > 0) await activity.update({ "healLimit.spent": Math.min(lim.max, lim.spent + applied) });
  return applied;
}

function getTargets() {
  const targets = [...(game.user.targets ?? [])];
  return targets.length ? targets : (canvas.tokens?.controlled ?? []);
}

async function applyHealingToTargets(activity, amount) {
  const tokens = getTargets();
  if (!tokens.length) {
    ui.notifications.warn(game.i18n.localize("OPRPGFIXES.SelectToken"));
    return false;
  }
  const applied = await consumeHealLimit(activity, amount);
  if (applied <= 0) {
    ui.notifications.warn(game.i18n.localize("OPRPGFIXES.HealLimitExhausted"));
    return false;
  }
  for (const token of tokens) {
    const actor = token.actor ?? token;
    const hp = actor?.system?.attributes?.hp;
    if (!hp) continue;
    const max = hp.effectiveMax ?? hp.max ?? Infinity;
    await actor.update({ "system.attributes.hp.value": Math.min(max, Number(hp.value ?? 0) + applied) });
  }
  ui.notifications.info(game.i18n.format("OPRPGFIXES.HealApplied", { amount: applied }));
  return applied;
}

async function applyTempToTargets(amount) {
  const tokens = getTargets();
  if (!tokens.length) {
    ui.notifications.warn(game.i18n.localize("OPRPGFIXES.SelectToken"));
    return false;
  }
  let changed = 0;
  for (const token of tokens) if (await applyTempHP(token.actor ?? token, amount)) changed++;
  ui.notifications.info(game.i18n.format(changed ? "OPRPGFIXES.TempApply" : "OPRPGFIXES.TempNoChange", { amount }));
  return true;
}

function finishFooter(footer, label) {
  footer.dataset.oprpgFixesApplied = "1";
  footer.querySelectorAll("button").forEach(btn => { btn.disabled = true; btn.style.opacity = "0.6"; });
  const total = footer.querySelector(".jj-footer-total");
  if (total) total.innerHTML = `✓ ${label}`;
}

function patchFooter(card, activity) {
  const mode = healMode(activity);
  if (mode === "healing") return false;
  const footer = [...card.querySelectorAll(".jj-footer")].find(f => f.querySelector("[data-action='jj-apply-heal']") || f.dataset.oprpgFixesPatched === "1");
  if (!footer || boundFooters.has(footer)) return false;
  boundFooters.add(footer);
  if (footer.dataset.oprpgFixesApplied === "1") return true;
  footer.dataset.oprpgFixesPatched = "1";
  // Recreate our controls when restoring serialized HTML; listeners are not
  // serialized. Only this dedicated healing footer is affected.
  for (const button of footer.querySelectorAll("button")) button.remove();
  const amount = Number(card.dataset.totalDmg ?? footer.querySelector(".jj-footer-total strong")?.textContent ?? 0);
  const oldButton = footer.querySelector("[data-action='jj-apply-heal']");
  const totalEl = footer.querySelector(".jj-footer-total");

  if (oldButton) oldButton.remove();
  footer.classList.add("oprpg-fixes-healing-footer");
  footer.style.removeProperty("border-top-color");
  totalEl?.style.removeProperty("color");
  footer.style.gap = "6px";
  footer.style.flexWrap = "wrap";

  if (mode === "temphp") {

    if (totalEl) { totalEl.innerHTML = `PV Temporários <strong>${amount}</strong>`; }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "jj-apply-btn";
    btn.textContent = "Aplicar PV Temporários";

    btn.addEventListener("click", () => applyFooterOnce(footer, async () => {
      const current = Number(card.dataset.totalDmg ?? amount);
      if (await applyTempToTargets(current)) { finishFooter(footer, `${current} PV temporários`); return true; }
      return false;
    }));
    footer.appendChild(btn);
  } else {

    if (totalEl) { totalEl.innerHTML = `Cura / PV Temporários <strong>${amount}</strong>`; }
    const heal = document.createElement("button");
    heal.type = "button"; heal.className = "jj-apply-btn"; heal.textContent = "Aplicar Cura";

    heal.addEventListener("click", () => applyFooterOnce(footer, async () => {
      const applied = await applyHealingToTargets(activity, Number(card.dataset.totalDmg ?? amount));
      if (applied) { finishFooter(footer, `${applied} curado`); return true; }
      return false;
    }));
    const temp = document.createElement("button");
    temp.type = "button"; temp.className = "jj-apply-btn"; temp.textContent = "Aplicar PV Temporários";

    temp.addEventListener("click", () => applyFooterOnce(footer, async () => {
      const current = Number(card.dataset.totalDmg ?? amount);
      if (await applyTempToTargets(current)) { finishFooter(footer, `${current} PV temporários`); return true; }
      return false;
    }));
    footer.append(heal, temp);
  }
  return true;
}

async function applyFooterOnce(footer, operation) {
  if (applyingFooters.has(footer) || footer.dataset.oprpgFixesApplied === "1") return false;
  applyingFooters.add(footer);
  footer.querySelectorAll("button").forEach(button => { button.disabled = true; });
  try { return await operation(); }
  catch (error) { ui.notifications.error(`OPRPG Fixes: ${error.message ?? error}`); return false; }
  finally {
    applyingFooters.delete(footer);
    if (footer.dataset.oprpgFixesApplied !== "1") footer.querySelectorAll("button").forEach(button => { button.disabled = false; });
  }
}

function patchCardLabels(card, activity) {
  const mode = healMode(activity);
  if (mode === "healing") return;
  card.dataset.healingMode = mode;
  const sub = card.querySelector(".jj-top-sub");
  const button = card.querySelector("[data-action='jj-extra-roll']");
  const label = card.querySelector("#jj-extra-label");
  const text = mode === "temphp" ? "PV Temporários" : "Cura / PV Temporários";
  if (sub && sub.textContent !== text) sub.textContent = text;
  if (label && label.textContent !== text) label.textContent = text;
  if (button) {
    const markup = mode === "temphp"
      ? '<i class="fas fa-shield-heart"></i> Rolar PV Temporários'
      : '<i class="fas fa-heart-circle-plus"></i> Rolar Cura / PV Temporários';
    if (button.innerHTML !== markup) button.innerHTML = markup;
  }
}

function installChatCardPatch() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    // Most chat messages are unrelated to healing. Avoid DOM queries unless the
    // serialized card can actually contain the OPRPG heal UI.
    if (!String(message?.content ?? "").includes("jj-extra-card")) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const card = root?.querySelector?.(".jj-extra-card[data-card-type='heal']");
    if (!card) return;
    const { activity } = getCardActivity(card);
    if (!activity || healMode(activity) === "healing") return;

    // A system version which already writes healing mode into the card is considered native-fixed.
    // This also prevents double-patching if someone accidentally activates this module on the old local fork.
    if (card.dataset.healingMode && card.dataset.oprpgFixesHealing !== "1") return;
    card.dataset.oprpgFixesHealing = "1";
    patchCardLabels(card, activity);

    const rollButton = card.querySelector("[data-action='jj-extra-roll']");
    if (rollButton && !boundRollButtons.has(rollButton)) {
      boundRollButtons.add(rollButton);
      rollButton.dataset.oprpgFixesCapture = "1";
      rollButton.addEventListener("click", () => {
        activity[BYPASS_HEAL_LIMIT] = (activity[BYPASS_HEAL_LIMIT] ?? 0) + 1;
        let released = false;
        let timeoutId = null;
        const release = () => {
          if (released) return;
          released = true;
          if (timeoutId) clearTimeout(timeoutId);
          activity[BYPASS_HEAL_LIMIT]--;
          if (activity[BYPASS_HEAL_LIMIT] <= 0) delete activity[BYPASS_HEAL_LIMIT];
        };
        const watcher = new MutationObserver(() => {
          patchCardLabels(card, activity);
          if (patchFooter(card, activity)) { watcher.disconnect(); release(); }
        });
        watcher.observe(card, { childList: true, subtree: true });
        // Scoped one-shot observer only. The old 120s timer stayed alive even
        // after success and accumulated during a long session. Ten seconds is
        // ample for the native card roll while keeping cleanup bounded.
        timeoutId = setTimeout(() => { watcher.disconnect(); release(); }, 10000);
      }, { capture: true });
    }

    patchFooter(card, activity);
  });
  STATE.chatPatch = true;
}

export async function replacementAutoHeal(actor, activity) {
  const formula = activity.healing?.formula?.trim();
  if (!formula) return;
  const mode = healMode(activity);
  const lim = mode === "temphp" ? disabledHealLimit() : getRawLimit(activity);
  if (lim.enabled && lim.remaining <= 0) return;

  const rollData = actor.getRollData();
  const expr = lim.enabled ? `min(${lim.remaining}, (${formula}))` : `(${formula})`;
  let roll;
  try { roll = await new Roll(expr, rollData).evaluate(); }
  catch (error) { console.error(`${MODULE_ID} | auto-heal: fórmula inválida`, formula, error); return; }
  await showPrivateDice(roll, {actor});
  const amount = lim.enabled ? Math.max(0, Math.min(roll.total, lim.remaining)) : Math.max(0, roll.total);
  if (amount <= 0) return;

  if (mode === "temphp") await applyTempHP(actor, amount);
  else {
    const hp = actor.system?.attributes?.hp ?? {};
    await actor.update({ "system.attributes.hp.value": Math.min(hp.effectiveMax ?? hp.max ?? Infinity, Number(hp.value ?? 0) + amount) });
  }
  if (lim.enabled) await activity.update({ "healLimit.spent": Math.min(lim.max, lim.spent + amount) });

  const remaining = lim.enabled ? Math.max(0, lim.max - Math.min(lim.max, lim.spent + amount)) : null;
  await ChatMessage.create({
    ...rollAudience(),
    speaker: ChatMessage.getSpeaker({ actor }),
    content: mode === "temphp"
      ? `💙 <b>${activity.item.name}</b> concedeu automaticamente <b>${amount} PV temporários</b> no início do turno.`
      : `💚 <b>${activity.item.name}</b> curou automaticamente <b>${amount}</b> no início do turno.`
        + (remaining !== null ? ` (limite: ${remaining} restante)` : "")
  });
}

function replaceLegacyAutoHealHook() {
  const hooks = Hooks.events?.combatTurnChange;
  if (!Array.isArray(hooks)) return false;
  const candidate = hooks.find(entry => {
    const src = String(entry.fn);
    return src.includes('actor.getFlag(SCOPE, "upkeep")')
      && src.includes("act?.type === \"heal\"")
      && src.includes("act.healLimit?.autoHeal")
      && src.includes("_autoHeal(actor, act)");
  });
  if (!candidate) {
    STATE.warnings.push("Handler legado de auto-heal não foi reconhecido; não foi substituído.");
    return false;
  }
  oldAutoHealHookId = candidate.id;
  Hooks.off("combatTurnChange", candidate.id);
  Hooks.on("combatTurnChange", async (combat, prior, current) => {
    const actor = combat.combatants.get(current?.combatantId)?.actor;
    if (!actor || !canAct(actor)) return;
    const upkeep = actor.getFlag("oprpg-system", "upkeep");
    if (!upkeep || foundry.utils.isEmpty(upkeep)) return;
    for (const [activityId, info] of Object.entries(upkeep)) {
      const act = actor.items.get(info.itemId)?.system?.activities?.get(activityId);
      if (act?.type === "heal" && act.healLimit?.autoHeal) await replacementAutoHeal(actor, act);
    }
  });
  STATE.autoHealPatch = true;
  return true;
}

export function installHealingPatches() {
  if (installed) return true;
  HealClass = CONFIG.DND5E?.activityTypes?.heal?.documentClass;
  if (!HealClass?.prototype) {
    STATE.warnings.push("Classe HealActivity indisponível no init.");
    return false;
  }

  rawGetHealLimit = HealClass.prototype[RAW_GET_HEAL_LIMIT] ?? HealClass.prototype.getHealLimit;
  if (typeof rawGetHealLimit === "function" && !HealClass.prototype[RAW_GET_HEAL_LIMIT]) {
    Object.defineProperty(HealClass.prototype, RAW_GET_HEAL_LIMIT, { value: rawGetHealLimit });
    HealClass.prototype.getHealLimit = function(...args) {
      if (this[BYPASS_HEAL_LIMIT]) return disabledHealLimit();
      return rawGetHealLimit.apply(this, args);
    };
  }

  const originalRollDamage = HealClass.prototype.rollDamage;
  if (typeof originalRollDamage === "function" && !HealClass.prototype.__oprpgFixesRollDamage) {
    HealClass.prototype.rollDamage = async function(...args) {
      if (healMode(this) === "healing") return originalRollDamage.apply(this, args);
      return withBypassAsync(this, () => originalRollDamage.apply(this, args));
    };
    Object.defineProperty(HealClass.prototype, "__oprpgFixesRollDamage", { value: true });
  }
  STATE.healClassPatch = true;

  // Must run before OPRPG's preUse listeners so their legacy limit checks see a disabled limit
  // for temp/mixed healing, without changing normal healing behavior.
  const preUseId = Hooks.on("dnd5e.preUseActivity", activity => {
    if (activity?.type !== "heal" || healMode(activity) === "healing") return;
    activity[BYPASS_HEAL_LIMIT] = (activity[BYPASS_HEAL_LIMIT] ?? 0) + 1;
    queueMicrotask(() => {
      activity[BYPASS_HEAL_LIMIT]--;
      if (activity[BYPASS_HEAL_LIMIT] <= 0) delete activity[BYPASS_HEAL_LIMIT];
    });
  });
  STATE.preUseBypass = moveHookToFront("dnd5e.preUseActivity", preUseId);

  installChatCardPatch();
  replaceLegacyAutoHealHook();
  installed = true;
  return true;
}

export function rawHealLimit(activity) {
  return getRawLimit(activity);
}
