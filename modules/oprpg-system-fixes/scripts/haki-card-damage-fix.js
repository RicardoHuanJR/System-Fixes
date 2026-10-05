import {HAKI_SCOPE as ID, level} from "./haki-unified-rules.js";

const boundCards = new WeakSet();
const pendingLabels = new WeakMap();

export function freshDamageLabels(activity) {
  const parts = activity.damage?.parts ?? [];
  const config = activity.getDamageConfig();
  if (config.rolls?.length !== parts.length) {
    throw new Error("A quantidade de partes de dano mudou; não foi possível atualizar o card com segurança.");
  }
  return config.rolls.map(({parts: terms, data, options = {}}, index) => {
    const formula = new Roll(terms.join(" + ") || "0", data).formula;
    const types = Array.from(options.types ?? (options.type ? [options.type] : parts[index].types ?? []));
    const labels = types.map(type => CONFIG.DND5E.damageTypes[type]?.label
      ?? CONFIG.DND5E.healingTypes[type]?.label ?? type);
    return {formula, label: [formula, ...labels].join(" "),
      damageType: types.length === 1 ? types[0] : null};
  });
}

export function prepareCardDamage(card) {
  const actor = card.dataset.tokenId
    ? canvas.tokens.get(card.dataset.tokenId)?.actor
    : game.actors.get(card.dataset.actorId);
  if (!actor || !level(actor, "endurecimento-ofensivo")) return;
  const item = actor.items.get(card.dataset.itemId);
  const activity = item?.system.activities?.get(card.dataset.activityId);
  if (!activity || !["mwak", "rwak"].includes(activity.getActionType?.())) return;
  const labels = freshDamageLabels(activity);
  const previous = pendingLabels.get(item)?.previous ?? item.labels.damages;
  const pending = {previous, labels};
  pendingLabels.set(item, pending);
  item.labels.damages = labels;
  setTimeout(() => {
    if (pendingLabels.get(item) !== pending) return;
    if (item.labels.damages === labels) item.labels.damages = previous;
    pendingLabels.delete(item);
  }, 0);
}

export function installCardDamageRefresh() {
  Hooks.on("renderChatMessageHTML", (_message, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    for (const card of root?.querySelectorAll(".jujutsu-card:not(.jj-extra-card)") ?? []) {
      if (boundCards.has(card)) continue;
      boundCards.add(card);
      card.addEventListener("click", event => {
        const button = event.target.closest?.("[data-action='jj-damage']");
        if (!button || button.disabled || !card.contains(button) || card.dataset.userId !== game.user.id) return;
        // The typed Fixes pipeline reads the current damage configuration itself.
        // Extra automation rolls need not match the number of native parts.
        if (button.dataset.oprpgFixesHandler === '1') return;
        try { prepareCardDamage(card); }
        catch (error) {
          event.preventDefault();
          event.stopImmediatePropagation();
          console.error(`${ID} | Dano de Haki`, error);
          ui.notifications.error(`Haki: ${error.message}`);
        }
      }, true);
    }
  });
}
