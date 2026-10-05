/** OPRPG — Modificadores de Acerto e Dano (Foundry VTT 14). */

const MODULE_ID = "oprpg-chat-modifiers";
const boundButtons = new WeakSet();
const pending = new Map();
const watched = new WeakMap();
const FIXES = 'oprpg-system-fixes';
const clone = value => structuredClone(value);
const flags = (message, key) => message.getFlag?.(MODULE_ID, key) ?? message.flags?.[MODULE_ID]?.[key];
const writable = message => message?.isContentVisible !== false && (game.user.isGM || message?.author?.id === game.user.id);

Hooks.once("init", () => console.log(`${MODULE_ID} | carregado`));

Hooks.on("renderChatMessageHTML", (message, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  const card = root?.querySelector(".jujutsu-card:not(.jj-extra-card)");
  if ( !card ) return;
  if (message.isContentVisible === false) return;
  const choices = flags(message, 'choices') ?? {};
  for (const type of ['attack', 'damage']) {
    const key = type === 'attack' ? 'oprpgAttackModifier' : 'oprpgDamageModifier';
    if (Object.hasOwn(choices, type)) {
      if (choices[type]) card.dataset[key] = choices[type]; else delete card.dataset[key];
    }
    hydrateModifier(card, message, type);
  }
  if (!writable(message)) return;

  setupModifierButton(card, message, "attack");
  setupModifierButton(card, message, "damage");
  queueMicrotask(() => applyPendingModifier(card, message, "attack"));
  queueMicrotask(() => applyPendingModifier(card, message, "damage"));
});

function setupModifierButton(card, message, type) {
  const rollButton = card.querySelector(`[data-action='jj-${type}']`);
  if ( !rollButton ) return;
  let button = card.querySelector(`[data-action='oprpg-${type}-modifier']`);
  if ( !button ) {
    const wrapper = document.createElement("div");
    wrapper.className = "oprpg-roll-control";
    rollButton.replaceWith(wrapper);
    wrapper.appendChild(rollButton);
    button = document.createElement("button");
    button.type = "button";
    button.className = `oprpg-card-modifier oprpg-${type}-modifier`;
    button.dataset.action = `oprpg-${type}-modifier`;
    wrapper.appendChild(button);
  }
  button.classList.add("oprpg-card-modifier", `oprpg-${type}-modifier`);
  updateModifierButton(button, card, type);
  if ( !boundButtons.has(button) ) {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      void chooseModifier(card, message, type).catch(error=>ui.notifications.warn(error.message));
    });
    boundButtons.add(button);
  }
}

function updateModifierButton(button, card, type) {
  const key = type === "attack" ? "oprpgAttackModifier" : "oprpgDamageModifier";
  const formula = card.dataset[key];
  button.innerHTML = formula
    ? `<i class="fas fa-plus-minus"></i> ${foundry.utils.escapeHTML(formula)}`
    : '<i class="fas fa-plus-minus"></i> Modificador';
  button.classList.toggle("active", Boolean(formula));
  button.title = formula ? `Modificar: ${formula}` : "Adicionar modificador";
}

async function chooseModifier(card, message, type) {
  if (!writable(message)) return;
  const formulaKey = type === "attack" ? "oprpgAttackModifier" : "oprpgDamageModifier";
  const appliedKey = type === "attack" ? "oprpgAttackModifierApplied" : "oprpgDamageModifierApplied";
  const formula = await promptModifier(type === "attack" ? "Acerto" : "Dano", card.dataset[formulaKey] ?? "");
  if ( formula === null ) return;
  if ( formula ) card.dataset[formulaKey] = formula;
  else delete card.dataset[formulaKey];
  delete card.dataset[appliedKey];
  updateModifierButton(card.querySelector(`[data-action='oprpg-${type}-modifier']`), card, type);
  await message.setFlag(MODULE_ID, 'choices', {...flags(message, 'choices'), [type]: formula});
  await applyPendingModifier(card, message, type, true);
}

async function promptModifier(label, currentFormula) {
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: `Modificador de ${label}` },
    content: `<div class="oprpg-modifier-dialog">
      <label for="oprpg-modifier-formula">Fórmula do modificador</label>
      <input id="oprpg-modifier-formula" type="text" value="${foundry.utils.escapeHTML(currentFormula)}" placeholder="Ex.: 1d10, 2, 1d4 + 2" autofocus>
      <small>Deixe vazio para remover. Aceita números, dados e fórmulas de rolagem.</small>
    </div>`,
    buttons: [
      {
        action: "apply", label: "Confirmar", default: true, icon: "fas fa-check",
        callback: (event, button, dialog) => {
          const formula = dialog.element.querySelector("#oprpg-modifier-formula")?.value.trim() ?? "";
          if ( !formula ) return "";
          try { new Roll(formula); } catch (error) {
            ui.notifications.warn("Fórmula de modificador inválida.");
            return null;
          }
          return formula;
        }
      },
      { action: "cancel", label: "Cancelar", icon: "fas fa-xmark", callback: () => null }
    ],
    rejectClose: false,
    close: () => null
  });
  // Foundry may return the button action when its callback returns null.
  return result === 'cancel' || result === 'apply' ? null : result;
}

async function applyPendingModifier(card, message, type, replace=false) {
  if (!writable(message)) return;
  const key = `${message.id}:${type}`;
  if (pending.has(key)) return pending.get(key);
  const operation = resolveModifier(card, message, type, replace);
  pending.set(key, operation);
  try { return await operation; } finally { if (pending.get(key) === operation) pending.delete(key); }
}

async function resolveModifier(card, message, type, replace) {
  const formulaKey = type === "attack" ? "oprpgAttackModifier" : "oprpgDamageModifier";
  const appliedKey = type === "attack" ? "oprpgAttackModifierApplied" : "oprpgDamageModifierApplied";
  const formula = flags(message, 'choices')?.[type] ?? card.dataset[formulaKey] ?? '';
  const previous = flags(message, 'results')?.[type];
  const damageState = message.getFlag?.(FIXES, 'multiActivityDamage');
  // Old cards already include their manual modifier in HTML. Do not charge
  // another roll or add it twice merely because the module was updated.
  if (!Object.hasOwn(flags(message, 'choices') ?? {}, type) && card.dataset[appliedKey] === 'true') {
    if (previous && !previous.legacy) {
      const changes = {[`flags.${MODULE_ID}.results.${type}`]: {...previous,total:0,legacy:true}};
      if (type === 'damage' && damageState?.manualChatModifier) changes[`flags.${FIXES}.multiActivityDamage`] = damageState.manualChatModifier.base;
      await message.update(changes);
      hydrateModifier(card, message, type);
    }
    return;
  }
  const revision = type === 'damage' ? damageState?.rolledAt ?? 'native' : 'native';
  if (!replace && previous?.formula === formula && previous?.revision === revision) {
    hydrateModifier(card, message, type); return;
  }
  if (!formula && !previous) return;
  const result = card.querySelector(type === "attack" ? "#jj-atk-val" : "#jj-dmg-val");
  const raw = type === 'attack' ? result?.textContent?.trim() : card.dataset.totalDmg;
  let base = raw ? numeric(raw, NaN) : NaN;
  if (previous?.revision === revision) base = previous.base;
  if (type === 'damage' && damageState) base = damageState.manualChatModifier?.base?.total ?? damageState.total;
  if ( !Number.isFinite(base) ) return;

  let modifierRoll, total = 0;
  try { if (formula) { modifierRoll = await new Roll(formula).evaluate(); total = modifierRoll.total; } }
  catch (error) {
    console.error(`${MODULE_ID} | erro ao rolar modificador`, error);
    ui.notifications.warn("Não foi possível rolar o modificador selecionado.");
    return;
  }
  if (!Number.isFinite(total)) throw Error('Resultado do modificador inválido.');
  if (modifierRoll) {
    const audience = Array.from(message.whisper ?? [], u => typeof u === 'string' ? u : u.id);
    try { await game.dice3d?.showForRoll(modifierRoll, game.user, true, audience.length ? audience : null, !!message.blind, message.id); }
    catch (error) { console.warn(`${MODULE_ID} | Animação indisponível`, error); }
  }
  result.textContent = base + total;
  if (modifierRoll) appendModifierBreakdown(card, type, formula, modifierRoll);
  else card.querySelector(type === 'attack' ? '#jj-atk-break .oprpg-manual-modifier' : '#jj-dmg-break .oprpg-manual-modifier')?.remove();
  card.dataset[appliedKey] = "true";
  const changes = {[`flags.${MODULE_ID}.results.${type}`]: {formula,base,total,revision,breakdown:card.querySelector(type === 'attack' ? '#jj-atk-break' : '#jj-dmg-break')?.innerHTML ?? ''}};
  if (type === 'attack') card.dataset.totalAtk = String(base + total);
  if (type === 'damage' && damageState) {
    const original = damageState.manualChatModifier?.base ?? damageState;
    const next = clone(original);
    if (formula) {
      next.manualChatModifier = {base:clone(original),formula,total};
      next.total = base + total;
      const parts = next.parts ?? [];
      const types = parts.every(p=>p.types?.length) ? [...new Set(parts.flatMap(p=>p.types))] : [];
      next.parts = [...(next.parts ?? []),{total,types:types.length===1?types:[],formula}];
      next.formulas = [...(next.formulas ?? []),formula];
      next.breakdown = `${next.breakdown ?? ''} ${total < 0 ? '−' : '+'} ${Math.abs(total)} (${formula})`;
    }
    changes[`flags.${FIXES}.multiActivityDamage`] = next;
  } else if (type === 'damage') updateDamageData(card, base, total);
  await message.update(changes);
  hydrateModifier(card, message, type);
}

function hydrateModifier(card, message, type) {
  const saved = flags(message, 'results')?.[type];
  if (!saved) return;
  if (type === 'damage' && message.getFlag?.(FIXES, 'multiActivityDamage')) return;
  const value = card.querySelector(type === 'attack' ? '#jj-atk-val' : '#jj-dmg-val');
  if (!value) return;
  value.textContent = saved.base + saved.total;
  const panel = card.querySelector(type === 'attack' ? '#jj-atk-panel' : '#jj-dmg-panel');
  panel?.classList.add('visible');
  const breakdown = card.querySelector(type === 'attack' ? '#jj-atk-break' : '#jj-dmg-break');
  if (breakdown) breakdown.innerHTML = saved.breakdown;
  if (type === 'attack') card.dataset.totalAtk = String(saved.base + saved.total);
  else updateDamageData(card, saved.base, saved.total);
}

// Observe only the active roll's card. Native attacks may finish without a
// render hook, while Fixes damage is persisted in flags rather than content.
document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-action="jj-attack"], [data-action="jj-damage"]');
  const card = button?.closest('.jujutsu-card');
  const message = game.messages.get(card?.closest('[data-message-id]')?.dataset.messageId);
  if (!card || button.disabled || !writable(message)) return;
  const type = button.dataset.action === 'jj-attack' ? 'attack' : 'damage';
  if (type === 'damage' && button.dataset.oprpgFixesHandler === '1') return;
  watched.get(card)?.disconnect();
  let timer;
  const observer = new MutationObserver(() => {
    const value = type === 'attack' ? card.querySelector('#jj-atk-val')?.textContent?.trim() : card.dataset.totalDmg;
    if (!value || !Number.isFinite(Number(value))) return;
    observer.disconnect(); clearTimeout(timer); watched.delete(card);
    void applyPendingModifier(card, message, type).catch(error=>ui.notifications.warn(error.message));
  });
  watched.set(card, observer);
  observer.observe(card, {subtree:true,childList:true,characterData:true,attributes:true});
  timer = setTimeout(()=>{observer.disconnect();watched.delete(card);},30000);
}, true);

function appendModifierBreakdown(card, type, formula, roll) {
  const breakdown = card.querySelector(type === "attack" ? "#jj-atk-break" : "#jj-dmg-break");
  if ( !breakdown ) return;
  breakdown.querySelector(".oprpg-manual-modifier")?.remove();
  const faces = roll.dice.flatMap(die => die.results.filter(result => !result.discarded).map(result => result.result));
  const dice = faces.length ? ` [${faces.join(", ")}]` : "";
  breakdown.insertAdjacentHTML("beforeend", `<span class="jj-pa-badge oprpg-manual-modifier">+${dice} ${foundry.utils.escapeHTML(formula)} modificador</span>`);
}

function updateDamageData(card, base, modifier) {
  const originalParts = card.dataset.oprpgOriginalDamageParts ?? card.dataset.damagePartsData;
  if ( originalParts ) {
    try {
      const parts = JSON.parse(originalParts);
      card.dataset.oprpgOriginalDamageParts = originalParts;
      parts.bonus = numeric(parts.bonus, 0) + modifier;
      card.dataset.damagePartsData = JSON.stringify(parts);
    } catch (error) { console.warn(`${MODULE_ID} | dados de dano separados inválidos`, error); }
  } else card.dataset.totalDmg = String(base + modifier);
  const footerTotal = card.querySelector("#jj-total-display");
  if ( footerTotal ) footerTotal.textContent = calculateDamageTotal(card, base + modifier);
}

function calculateDamageTotal(card, base) {
  const mode = card.querySelector(".jj-mod-check input:checked")?.dataset.mod;
  const critBonus = numeric(card.dataset.critBonus, 0);
  if ( mode === "half" ) return Math.floor(base / 2);
  if ( mode === "quarter" ) return Math.floor(base / 4);
  if ( mode === "crit" ) return base + critBonus;
  if ( mode === "kokusen" ) return Math.ceil((base + critBonus) * 2.5);
  return base;
}

function numeric(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
