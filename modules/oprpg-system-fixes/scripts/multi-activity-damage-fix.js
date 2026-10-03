import { automationDamageSpecs } from './effect-automations.js';
import { showPrivateDice, rollAudience } from './roll-privacy.js';
import { MODULE_ID, STATE, activitiesOf, getCardActivity } from "./shared.js";
import { powerUpDamageBonusSpec, recordPowerUpDamageRoll } from "./akuma-combat-fix.js";
import { activityDamageSpecs, freshActivityDamageLabels, normalizeDamageTypes, damageTypeLabel } from "./activity-damage.js";
import { damageMacroBonuses } from './compatibility-macros.js';
import { runItemMacros } from './external-compatibility.js';

const DAMAGE_FLAG = "multiActivityDamage";

let renderHookId = null;
let installed = false;
// HTML survives ChatMessage updates, but DOM listeners do not. Track the live
// node rather than a serialized data attribute when deciding whether to bind.
const boundDamageButtons = new WeakSet();
const rollingDamageCards = new WeakSet();

function damageParts(activity) {
  try { return Array.from(activity?.damage?.parts ?? []); }
  catch (_) { return []; }
}

const normalizeTypes = normalizeDamageTypes;

function typedPartState(entry) {
  const types = normalizeTypes(entry?.part?.types);
  return {
    total: Number(entry?.roll?.total ?? 0) || 0,
    types,
    type: types.length === 1 ? types[0] : null,
    formula: entry?.roll?.formula ?? entry?.formula ?? ""
  };
}

function applyActivityDamageLabels(card, state) {
  if (!card || !state?.parts?.length) return false;
  const labels = state.parts.map((part, i) => {
    const formula = String(part.formula ?? state.formulas?.[i] ?? "").trim();
    const types = normalizeTypes(part.types);
    const typeText = types.length ? types.map(damageTypeLabel).join("/") : "";
    return [formula, typeText].filter(Boolean).join(" ");
  }).filter(Boolean);
  if (!labels.length) return false;

  // O OPRPG já possui o espaço de fórmula/label no card. As versões do sistema
  // mudaram o seletor algumas vezes; somente atualizamos um alvo que realmente
  // exista, nunca criamos um segundo painel paralelo.
  const target = card.querySelector?.("#jj-dmg-formula, #jj-dmg-label, .jj-dmg-formula, .jj-damage-label, [data-role='damage-label']");
  if (target) target.textContent = labels.join(" + ");

  try {
    card.dataset.oprpgFixesTypedDamage = JSON.stringify(state.parts.map(p => ({
      total: Number(p.total ?? 0) || 0,
      types: normalizeTypes(p.types)
    })));
    card.dataset.oprpgFixesActivityDamageLabels = "1";
  } catch (_) { /* DOMStringMap serialization is best-effort */ }
  STATE.multiActivityDamageLabelsPatch = true;
  return true;
}

function syncSelectedActivityDamagePreview(card, activity, actor=null) {
  if (!card || !activity) return false;
  const labelsData = freshActivityDamageLabels(activity, actor);
  if (!labelsData.length) return false;
  const labels = labelsData.map(x => x.label).filter(Boolean);
  const target = card.querySelector?.("#jj-dmg-formula, #jj-dmg-label, .jj-dmg-formula, .jj-damage-label, [data-role='damage-label']");
  if (target) target.textContent = labels.join(" + ");
  try {
    const allTypes = [...new Set(labelsData.flatMap(x => normalizeTypes(x.types)))];
    if (allTypes.length) card.dataset.damageTypes = allTypes.join(",");
    card.dataset.oprpgFixesActivityDamageLabels = "1";
  } catch (_) {}
  STATE.multiActivityDamageLabelsPatch = true;
  return true;
}

function rollDataFor(actor, activity) {
  const data = { ...(actor?.getRollData?.() ?? {}) };
  const ability = activity?.attack?.ability;
  // Explicit @abilities.* references are preferred by OPRPG cards. Keep @mod
  // available as a compatibility alias when this Activity declares an ability.
  if (ability && ability !== "none" && data?.abilities?.[ability]) {
    data.mod = Number(data.abilities[ability].mod ?? data.mod ?? 0);
  }
  return data;
}

function diceBreakdown(roll) {
  const groups = [];
  let diceTotal = 0;
  for (const die of roll?.dice ?? []) {
    const values = (die.results ?? []).filter(r => r.active !== false).map(r => Number(r.result ?? 0));
    if (!values.length) continue;
    groups.push(`[${values.join(", ")}]`);
    diceTotal += values.reduce((a, b) => a + b, 0);
  }
  const total = Number(roll?.total ?? 0);
  const flat = total - diceTotal;
  if (flat) groups.push(`${flat > 0 ? "+" : "−"}${Math.abs(flat)}`);
  return groups.join(" ") || String(total);
}

function messageForCard(card) {
  const holder = card?.closest?.("[data-message-id]");
  const messageId = holder?.dataset?.messageId;
  return messageId ? game.messages?.get(messageId) ?? null : null;
}

function revealElement(element, fallbackDisplay = "") {
  if (!element) return;
  element.hidden = false;
  element.removeAttribute("hidden");
  element.classList.remove("hidden", "is-hidden", "collapsed");
  if (element.style.display === "none") element.style.removeProperty("display");
  try {
    if (getComputedStyle(element).display === "none" && fallbackDisplay) element.style.display = fallbackDisplay;
  } catch (_) { /* detached HTML during render hooks */ }
}

/**
 * Recreate the visible state that the native OPRPG card normally reaches after
 * its ACERTO flow. The native card already contains these panels in the HTML;
 * before an attack it may keep the result area visually collapsed/hidden.
 */
function revealDamagePresentation(card) {
  revealElement(card?.querySelector?.(".jj-panels"), "grid");
  revealElement(card?.querySelector?.("#jj-dmg-panel"), "block");
  revealElement(card?.querySelector?.(".jj-footer"), "flex");
  card?.querySelector?.("#jj-dmg-panel")?.classList.add("visible");
  card?.querySelector?.(".jj-footer")?.classList.add("visible");
}

export function applyDamageState(card, state) {
  if (!card || !state) return false;
  if (state.itemId && card.dataset.itemId !== state.itemId) return false;
  if (state.activityId && card.dataset.activityId !== state.activityId) return false;

  if(card.dataset.cardType==='save')prepareSaveDamageCard(card);
  const total = Number(state.total ?? 0);
  const breakdown = String(state.breakdown ?? "");

  card.dataset.totalDmg = String(total);
  if (state.critFormula != null) card.dataset.critFormula = state.critFormula;
  // Keep the base separate: the native Apply button adds critBonus itself.
  if (state.rolledAt && card.dataset.oprpgFixesDamageRolledAt !== String(state.rolledAt)) {
    delete card.dataset.critBonus;
    delete card.dataset.damagePartsData;
    card.querySelector("#jj-damage-separate")?.replaceChildren();
    for (const input of card.querySelectorAll(".jj-mod-check input, [data-save-mod]")) {
      input.checked = false;
      input.disabled = false;
    }
    card.dataset.oprpgFixesDamageRolledAt = String(state.rolledAt);
  }
  if (state.critBonus > 0) card.dataset.critBonus = String(state.critBonus);
  if (state.critParts?.length) card.dataset.oprpgFixesTypedCritical = JSON.stringify(state.critParts);
  else delete card.dataset.oprpgFixesTypedCritical;
  card.dataset.oprpgFixesMultiActivityDamage = "1";
  card.dataset.oprpgFixesDamageWithoutAttack = "1";

  const damageValue = card.querySelector("#jj-dmg-val, [data-fixes-save-value]");
  const damageBreakdown = card.querySelector("#jj-dmg-break, [data-fixes-save-break]");
  const totalDisplay = card.querySelector("#jj-total-display, #jj-save-total");
  const damagePanel = card.querySelector("#jj-dmg-panel, [data-fixes-save-panel]");

  if (damageValue) damageValue.textContent = String(total);
  if (damageBreakdown) damageBreakdown.textContent = breakdown;
  if (Number(card.dataset.critBonus || 0) > 0) {
    const crit = card.querySelector("input[data-mod='crit']");
    if (crit) { crit.checked = true; crit.disabled = true; }
  }
  const selectedModifier=card.querySelector(".jj-mod-check input:checked, [data-save-mod]:checked");
  const modifier = selectedModifier?.dataset.mod ?? selectedModifier?.dataset.saveMod;
  const critBonus = Number(card.dataset.critBonus || 0);
  const displayed = modifier === "half" ? Math.floor(total/2) : modifier === "quarter" ? Math.floor(total/4)
    : modifier === "kokusen" ? Math.ceil((total+critBonus)*2.5) : total+critBonus;
  if (totalDisplay) totalDisplay.textContent = String(displayed);
  if (damagePanel) damagePanel.dataset.baseValue = String(total);
  if(card.dataset.cardType==='save') {
    damagePanel?.classList.add('visible');
    card.querySelector('[data-fixes-save-footer]')?.classList.add('visible');
  }
  applyActivityDamageLabels(card, state);

  revealDamagePresentation(card);
  return true;
}

function shouldPatch(card, item, activity) {
  if (!card || !item || !activity) return false;
  if (!card.matches?.(".jujutsu-card")) return false;
  const activities = activitiesOf(item);
  if (activities.length < 2) return false;
  const parts = damageParts(activity);
  return parts.length > 0 || activity.damage?.includeBase === true;
}

function setIfDifferent(style, property, value) {
  if (!style) return;
  if (style[property] !== value) style[property] = value;
}

function unlockDamageButton(card) {
  if (rollingDamageCards.has(card)) return false;
  if (card?.dataset?.userId && card.dataset.userId !== game.user?.id && !game.user?.isGM) return false;
  const { item, activity } = getCardActivity(card);
  if (!shouldPatch(card, item, activity)) return false;

  const button = card.querySelector(".jj-damage-btn[data-action='jj-damage']");
  if (!button) return false;

  let changed = false;
  if (button.disabled) { button.disabled = false; changed = true; }
  if (button.hasAttribute("disabled")) { button.removeAttribute("disabled"); changed = true; }
  if (button.getAttribute("aria-disabled") === "true") { button.setAttribute("aria-disabled", "false"); changed = true; }
  for (const cls of ["disabled", "is-disabled"]) {
    if (button.classList.contains(cls)) { button.classList.remove(cls); changed = true; }
  }
  if (button.style.opacity === "0.4" || Number(button.style.opacity) < 1) {
    setIfDifferent(button.style, "opacity", "1");
    changed = true;
  }
  if (!button.style.cursor || button.style.cursor === "default" || button.style.cursor === "not-allowed") {
    setIfDifferent(button.style, "cursor", "var(--cursor-pointer, pointer)");
    changed = true;
  }
  if (button.style.pointerEvents === "none") {
    setIfDifferent(button.style, "pointerEvents", "auto");
    changed = true;
  }

  if (card.dataset.oprpgFixesDamageWithoutAttack !== "1") {
    card.dataset.oprpgFixesDamageWithoutAttack = "1";
    changed = true;
  }

  if (changed) STATE.multiActivityDamageUnlocked = Number(STATE.multiActivityDamageUnlocked ?? 0) + 1;
  return true;
}

function damageStateFromMessage(message) {
  try { return message?.getFlag?.(MODULE_ID, DAMAGE_FLAG) ?? null; }
  catch (_) { return null; }
}

function bindDamageButton(card) {
  const { item, activity } = getCardActivity(card);
  if (!shouldPatch(card, item, activity)) return false;
  const button = card.querySelector(".jj-damage-btn[data-action='jj-damage']");
  if (!button) return false;
  if (!boundDamageButtons.has(button)) {
    boundDamageButtons.add(button);
    button.dataset.oprpgFixesHandler = "1";
    // Bind only on relevant chat buttons instead of listening to every click in
    // the Foundry UI. Capture still runs before the system's delegated handler.
    button.addEventListener("click", onDamageButtonClick, { capture: true });
  }
  return true;
}

function hydrateCard(card, explicitMessage = null) {
  if (!card) return false;
  unlockDamageButton(card);
  bindDamageButton(card);
  const selected = getCardActivity(card);
  if (selected?.activity) syncSelectedActivityDamagePreview(card, selected.activity, selected.actor);
  const message = explicitMessage ?? messageForCard(card);
  const state = damageStateFromMessage(message);
  if (!state) return false;
  return applyDamageState(card, state);
}

function scanCards(root, explicitMessage = null) {
  if (!root) return 0;
  let count = 0;
  if (root.matches?.(".jujutsu-card")) count += hydrateCard(root, explicitMessage) ? 1 : 0;
  for (const card of root.querySelectorAll?.(".jujutsu-card") ?? []) count += hydrateCard(card, explicitMessage) ? 1 : 0;
  return count;
}

function installDamageAvailabilityPatch() {
  if (STATE.multiActivityDamageIndependent) return true;

  renderHookId = Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!String(message?.content ?? "").includes("jujutsu-card")) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (root) scanCards(root, message);
  });

  // Do not observe document.body. Foundry and Dice So Nice mutate class/style
  // continuously during animations; a global MutationObserver caused the card
  // scanner to run hundreds of times per roll and could freeze the client.
  // renderChatMessageHTML is sufficient for new/rerendered messages. Existing
  // cards are scanned once when the world becomes ready.
  const scanExisting = () => {
    try { scanCards(document); }
    catch (_) { /* chat may not be mounted yet */ }
  };
  if (globalThis.game?.ready) requestAnimationFrame?.(scanExisting);
  else Hooks.once("ready", () => requestAnimationFrame?.(scanExisting));

  STATE.multiActivityDamageIndependent = true;
  return !!renderHookId;
}

async function persistDamageState(message, state) {
  if (!message?.setFlag) return false;
  try {
    await message.setFlag(MODULE_ID, DAMAGE_FLAG, state);
    STATE.multiActivityDamagePersisted = Number(STATE.multiActivityDamagePersisted ?? 0) + 1;
    return true;
  } catch (error) {
    STATE.warnings.push(`Persistência visual do dano: ${error?.message ?? error}`);
    ui.notifications.error('O dano foi rolado, mas não pôde ser compartilhado no chat. O autor do cartão ou o mestre deve tentar novamente.');
    return false;
  }
}

function rehydrateLiveMessage(messageId) {
  if (!messageId) return false;
  const roots = document.querySelectorAll?.(`[data-message-id="${CSS.escape(String(messageId))}"]`) ?? [];
  let applied = false;
  for (const root of roots) if (scanCards(root)) applied = true;
  return applied;
}

export async function rollSelectedActivityDamage(card, actor, item, activity) {
  let bonuses=[];
  if(game.settings.get(MODULE_ID,'compatibilityMacros')===true){
    if(item.flags?.['midi-qol']?.onUseMacroName){const results=await runItemMacros(item,'preDamageRoll',{activity,card});if(results.some(r=>r===false))return null;}
    bonuses=await damageMacroBonuses(activity);
  }
  const specs = activityDamageSpecs(activity, actor);
  if(!specs.some(s=>s.options?.oprpgEffectAutomation))for(const bonus of automationDamageSpecs(actor,activity))specs.push({formula:bonus.parts.join(' + '),data:bonus.data,types:bonus.options.types,nativeConfig:true,options:bonus.options});
  for(const bonus of bonuses)specs.push({formula:bonus.parts.join(' + '),data:activity.getRollData?.()??actor.getRollData(),types:bonus.options.types,nativeConfig:true});
  if (!specs.length) throw new Error(`Nenhuma configuração de dano válida em ${activity.name}.`);
  const rolls = [];
  const isSpell = card.dataset.isSpell === "true";
  const ultimato = isSpell && actor.getFlag?.("oprpg-system", "hatsuActiveTier") === "ultimato";
  const stepDie = face => ({4:6,6:8,8:10,10:12,12:12})[face] ?? face;

  for (const spec of specs) {
    const formula = ultimato ? String(spec.formula).replace(/(\d*)d(\d+)/g, (_,n,d)=>`${n}d${stepDie(d)}`) : spec.formula;
    const roll = await new Roll(formula, spec.data ?? rollDataFor(actor, activity)).evaluate({ maximize: card.dataset.emissaoMax === "true" });
    const part = {...(spec.part ?? {}), types: spec.types ?? spec.part?.types ?? []};
    rolls.push({ roll, part, formula: spec.formula, nativeConfig: !!spec.nativeConfig });
    try { await showPrivateDice(roll, {card,actor}); }
    catch (_) { /* Dice So Nice é opcional. */ }
  }

  const data = rollDataFor(actor, activity);
  // These bonuses were already chosen/paid for by the native attack dialog.
  // Reading the card preserves them without consuming resources a second time.
  const pa = Math.max(0, Number(card.dataset.paGastos) || 0);
  const extras = [];
  if (pa) extras.push(`${pa}d${isSpell ? (activity.damage?.parts?.[0]?.denomination || 6) : 4}`);
  if (actor.getFlag?.("oprpg-system", "focoAgressivoAtivo") && !isSpell) {
    extras.push(actor.system?.manipulation?.abilities?.fluxoConstante?.unlocked ? "1d6" : "1d4");
  }
  if (card.dataset.jjScaleBonus) extras.push(card.dataset.jjScaleBonus);
  if (isSpell && actor.getFlag?.("oprpg-system", "hatsuEstagioFocoAtivo")) {
    const slot = item.getFlag?.("oprpg-system", "hatsu.slot") ?? item.getFlag?.("oprpg-system", "hatsu.parent");
    const grade = Number(item.system?.level) > 0 ? Number(item.system.level) : ({inata:5,m1:3,m2:5,m3:8}[slot] ?? 1);
    const face = activity.damage?.parts?.[0]?.denomination;
    if (face) extras.push(`${grade}d${ultimato ? stepDie(face) : face}`);
  }
  for (const formula of extras) {
    const roll = await new Roll(formula, data).evaluate();
    rolls.push({ roll, formula, part: { types: specs[0]?.types ?? [] }, attackBonus: true });
    try { await showPrivateDice(roll, {card,actor}); } catch (_) {}
  }

  const powerSpec = powerUpDamageBonusSpec(actor, item, activity);
  if (powerSpec) {
    const roll = await new Roll(powerSpec.formula, data).evaluate();
    const part = { number: powerSpec.dice, denomination: powerSpec.denomination, bonus: "", types: powerSpec.types ?? [] };
    rolls.push({ roll, part, formula: powerSpec.formula, powerUp: true });
    try { await showPrivateDice(roll, {card,actor}); }
    catch (_) {}
    recordPowerUpDamageRoll(actor, item, activity, {
      mode: "multi-activity",
      formula: powerSpec.formula,
      bonus: Number(roll.total ?? 0) || 0,
      degree: powerSpec.degree
    });
  }

  const total = rolls.reduce((sum, entry) => sum + Number(entry.roll.total ?? 0), 0);
  // Preserve custom dice expressions instead of reconstructing every part as
  // number/denomination (which loses custom formulas and their modifiers).
  const criticalSpecs = rolls.map(entry => ({types: normalizeTypes(entry.part?.types), formula: Array.from(entry.roll.dice ?? [], die => {
    return `${die.number ?? 1}d${die.faces}`;
  }).filter(term => /^\d+d\d+$/.test(term)).join(" + ")})).filter(spec=>spec.formula);
  if (activity.damage?.critical?.bonus) criticalSpecs.push({formula:new Roll(String(activity.damage.critical.bonus), data).formula,types:specs[0]?.types??[]});
  const critFormula = criticalSpecs.map(spec=>spec.formula).join(" + ");
  let critBonus = 0;
  const critParts = [];
  if (card.dataset.isCrit === "1" && critFormula) {
    for (const spec of criticalSpecs) {
      const critRoll = await new Roll(spec.formula, data).evaluate();
      const total = Number(critRoll.total) || 0;
      critBonus += total;
      critParts.push({total,types:spec.types});
      try { await showPrivateDice(critRoll, {card,actor}); } catch (_) {}
    }
  }
  const breakdown = rolls.map(entry => diceBreakdown(entry.roll)).join(" + ");
  const message = messageForCard(card);
  const state = {
    version: 2,
    itemId: item?.id ?? card?.dataset?.itemId ?? null,
    activityId: activity?.id ?? card?.dataset?.activityId ?? null,
    total,
    critFormula,
    critBonus,
    critParts,
    breakdown,
    formulas: rolls.map(r => r.roll.formula ?? r.formula),
    parts: rolls.map(typedPartState),
    rolledAt: Date.now()
  };
  STATE.multiActivityDamageTypedRolls = Number(STATE.multiActivityDamageTypedRolls ?? 0) + 1;

  // First update the exact card the user clicked. Unlike 1.2.1/1.2.2, also
  // reveal the native result panels; this is the visual transition previously
  // provided only by the OPRPG ACERTO flow.
  const renderedOnCard = applyDamageState(card, state);

  // Persist only compact state in flags. Do NOT rewrite ChatMessage.content:
  // that caused Foundry to rerender the card from a pre-roll presentation state.
  const persistedToFlag = await persistDamageState(message, state);
  if(game.settings.get(MODULE_ID,'compatibilityMacros')===true&&item.flags?.['midi-qol']?.onUseMacroName)await runItemMacros(item,'postDamageRoll',{activity,source:message,rolls:rolls.map(r=>r.roll),total});

  // setFlag rerenders the message and renderChatMessageHTML hydrates the new DOM.
  // Keep only one animation-frame fallback for clients where the replacement is
  // committed after setFlag resolves; repeated timers are unnecessary work.
  const messageId = message?.id ?? card?.closest?.("[data-message-id]")?.dataset?.messageId;
  requestAnimationFrame?.(() => rehydrateLiveMessage(messageId));

  STATE.multiActivityDamageLast = {
    actor: actor?.name ?? null,
    item: item?.name ?? null,
    activity: activity?.name ?? null,
    activityId: activity?.id ?? null,
    formulas: state.formulas,
    total,
    attackRolledFirst: Number(card?.dataset?.totalAtk ?? 0) !== 0,
    renderedOnCard,
    persistedToFlag
  };

  Hooks.callAll("oprpgFixes.multiActivityDamageRolled", {
    actor, item, activity, card, rolls: rolls.map(r => r.roll), total
  });

  return { total, rolls };
}

async function onDamageButtonClick(event) {
  const button = event.currentTarget ?? event.target?.closest?.(".jj-damage-btn[data-action='jj-damage']");
  if (!button) return;
  const card = button.closest(".jujutsu-card");
  const { actor, item, activity } = getCardActivity(card);
  if (!shouldPatch(card, item, activity)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (card.dataset.userId && card.dataset.userId !== game.user?.id && !game.user?.isGM) return;
  if (rollingDamageCards.has(card)) return;

  rollingDamageCards.add(card);
  button.disabled = true;
  const oldOpacity = button.style.opacity;
  button.style.opacity = "0.65";
  try {
    await rollSelectedActivityDamage(card, actor, item, activity);
  } catch (error) {
    STATE.warnings.push(`Dano multi-Activity (${item?.name ?? "?"}): ${error?.message ?? error}`);
    console.error(`${MODULE_ID} | Falha ao rolar dano da Activity selecionada`, error);
    ui.notifications.error(`OPRPG Fixes: não foi possível rolar o dano de ${activity?.name ?? "Activity"}.`);
  } finally {
    rollingDamageCards.delete(card);
    delete card.dataset.oprpgFixesRollingDamage;
    button.disabled = false;
    button.style.opacity = oldOpacity || "1";
    unlockDamageButton(card);
  }
}

export function installMultiActivityDamagePatch() {
  if (installed) return true;
  if (typeof document === "undefined") {
    STATE.warnings.push("Patch multi-Activity: document indisponível.");
    return false;
  }
  installed = true;
  STATE.multiActivityDamagePatch = true;
  installDamageAvailabilityPatch();
  return true;
}

export function multiActivityDamageStatus() {
  return {
    installed: installed,
    damageWithoutAttack: !!STATE.multiActivityDamageIndependent,
    presentationHydration: true,
    globalMutationObserver: false,
    hydrationMode: "renderChatMessageHTML",
    eventBinding: "per-live-button-weakset",
    formulaPersistence: "pending-only",
    formulaSource: "activity.getDamageConfig-first",
    activityDamageLabels: !!STATE.multiActivityDamageLabelsPatch,
    typedRolls: Number(STATE.multiActivityDamageTypedRolls ?? 0),
    unlockedCards: Number(STATE.multiActivityDamageUnlocked ?? 0),
    persistedStates: Number(STATE.multiActivityDamagePersisted ?? 0),
    last: STATE.multiActivityDamageLast ?? null
  };
}

const boundSaveFooters=new WeakSet();
export function prepareSaveDamageCard(card) {
  if(!card.querySelector('[data-fixes-save-panel]')) {
  const panel=document.createElement('div');panel.dataset.fixesSavePanel='1';panel.className='jj-panel';
  panel.innerHTML='<div class="jj-panel-label">Dano da técnica</div><div class="jj-panel-val dmg" data-fixes-save-value>—</div><div class="jj-panel-breakdown" data-fixes-save-break></div>';
  const footer=document.createElement('div');footer.className='jj-footer';footer.dataset.fixesSaveFooter='1';
  footer.innerHTML='<div class="jj-mods"><label class="jj-mod-check" title="Metade"><input type="checkbox" data-save-mod="half" data-mod="half"> ½</label><label class="jj-mod-check" title="Um quarto"><input type="checkbox" data-save-mod="quarter" data-mod="quarter"> ¼</label></div><span class="jj-footer-total">Total <strong id="jj-save-total">—</strong></span><button type="button" class="jj-apply-btn" data-action="jj-apply-save-dmg">Aplicar</button>';
  card.append(panel,footer);
  }
  const footer=card.querySelector('[data-fixes-save-footer]');
  if(!footer)return;
  footer.querySelector('#jj-save-total')?.parentElement.classList.add('jj-footer-total');
  for(const input of footer.querySelectorAll('[data-save-mod]')) {
    input.dataset.mod=input.dataset.saveMod;
    input.closest('label')?.classList.add('jj-mod-check');
    input.closest('label')?.setAttribute('title',input.dataset.saveMod==='half'?'Metade':'Um quarto');
  }
  // Re-rendering keeps the HTML, not its listeners. Bind each live footer once.
  if(boundSaveFooters.has(footer))return;
  boundSaveFooters.add(footer);
  footer.addEventListener('change',event=>{
    const input=event.target.closest('[data-save-mod]');if(!input)return;
    for(const other of footer.querySelectorAll('[data-save-mod]'))if(other!==input)other.checked=false;
    const total=Number(card.dataset.totalDmg);
    footer.querySelector('#jj-save-total').textContent=String(input.checked?Math.floor(total/(input.dataset.saveMod==='half'?2:4)):total);
  });
}
