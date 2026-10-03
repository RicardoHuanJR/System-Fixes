/** OPRPG — Modificadores de Acerto e Dano (Foundry VTT 14). */

const MODULE_ID = "oprpg-chat-modifiers";
const boundButtons = new WeakSet();

Hooks.once("init", () => console.log(`${MODULE_ID} | carregado`));

Hooks.on("renderChatMessageHTML", (message, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  const card = root?.querySelector(".jujutsu-card:not(.jj-extra-card)");
  if ( !card ) return;
  if ( card.dataset.userId && card.dataset.userId !== game.user.id ) return;

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
      chooseModifier(card, message, type);
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
  const formulaKey = type === "attack" ? "oprpgAttackModifier" : "oprpgDamageModifier";
  const appliedKey = type === "attack" ? "oprpgAttackModifierApplied" : "oprpgDamageModifierApplied";
  const formula = await promptModifier(type === "attack" ? "Acerto" : "Dano", card.dataset[formulaKey] ?? "");
  if ( formula === null ) return;
  if ( formula ) card.dataset[formulaKey] = formula;
  else delete card.dataset[formulaKey];
  delete card.dataset[appliedKey];
  updateModifierButton(card.querySelector(`[data-action='oprpg-${type}-modifier']`), card, type);
  await message.update({ content: card.outerHTML });
}

async function promptModifier(label, currentFormula) {
  return foundry.applications.api.DialogV2.wait({
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
}

async function applyPendingModifier(card, message, type) {
  const formulaKey = type === "attack" ? "oprpgAttackModifier" : "oprpgDamageModifier";
  const appliedKey = type === "attack" ? "oprpgAttackModifierApplied" : "oprpgDamageModifierApplied";
  const formula = card.dataset[formulaKey];
  if ( !formula || card.dataset[appliedKey] === "true" ) return;
  const result = card.querySelector(type === "attack" ? "#jj-atk-val" : "#jj-dmg-val");
  const base = numeric(type === "attack" ? result?.textContent : card.dataset.totalDmg, NaN);
  if ( !Number.isFinite(base) ) return;

  let modifierRoll;
  try { modifierRoll = await new Roll(formula).evaluate(); }
  catch (error) {
    console.error(`${MODULE_ID} | erro ao rolar modificador`, error);
    ui.notifications.warn("Não foi possível rolar o modificador selecionado.");
    return;
  }
  game.dice3d?.showForRoll(modifierRoll, game.user, true);
  result.textContent = base + modifierRoll.total;
  appendModifierBreakdown(card, type, formula, modifierRoll);
  card.dataset[appliedKey] = "true";
  if ( type === "damage" ) updateDamageData(card, base, modifierRoll.total);
  await message.update({ content: card.outerHTML });
}

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
