import { MODULE_ID, STATE, activitiesOf, getCardActivity, rememberCardActivitySelection, forgetCardActivitySelectionsForMessage } from "./shared.js";

const pendingByMessage = new Map();
const boundAttackButtons = new WeakSet();

function cardSlot(card) {
  try {
    const holder = card?.closest?.("[data-message-id]");
    const itemId = card?.dataset?.itemId;
    if (!holder || !itemId) return 0;
    const cards = Array.from(holder.querySelectorAll?.(`.jujutsu-card[data-item-id="${CSS.escape(String(itemId))}"]`) ?? []);
    const index = cards.indexOf(card);
    return index >= 0 ? index : 0;
  } catch (_) { return card?.classList?.contains?.("jj-extra-card") ? 1 : 0; }
}

function preserveSelectedActivityInContent(entry, changes) {
  if (!entry?.activity?.id || typeof changes?.content !== "string" || !changes.content.includes("jujutsu-card")) return false;
  try {
    const template = document.createElement("template");
    template.innerHTML = changes.content;
    const selector = `.jujutsu-card[data-item-id="${CSS.escape(String(entry.item?.id ?? ""))}"]`;
    const cards = Array.from(template.content.querySelectorAll(selector)).filter(card =>
      !(entry.actor?.id && card.dataset.actorId && card.dataset.actorId !== entry.actor.id));
    const card = cards[Number(entry.slot ?? 0)] ?? cards[0];
    if (!card) return false;
    card.dataset.activityId = entry.activity.id;
    card.dataset.oprpgFixesSelectedActivityId = entry.activity.id;
    const touched = 1;
    changes.content = template.innerHTML;
    STATE.multiActivityAttackSelectionsPreserved = Number(STATE.multiActivityAttackSelectionsPreserved ?? 0) + touched;
    return true;
  } catch (error) {
    STATE.warnings.push(`Preservação da Activity no card: ${error?.message ?? error}`);
    return false;
  }
}
let renderHookId = null;
let preUpdateMessageHookId = null;
let installed = false;

function attackActivities(item) {
  return activitiesOf(item).filter(a => a?.type === "attack" && a?.canUse !== false);
}

function restoreEntry(messageId, reason="message-update") {
  const entry = pendingByMessage.get(messageId);
  if (!entry) return false;
  pendingByMessage.delete(messageId);
  clearTimeout(entry.timer);
  const { item, originalToHit, originalModifier, patchedToHit, patchedModifier } = entry;
  try {
    if (item?.labels) {
      // Do not overwrite a newer bridge installed by another card click.
      if (item.labels.toHit === patchedToHit) item.labels.toHit = originalToHit;
      if (item.labels.modifier === patchedModifier) item.labels.modifier = originalModifier;
    }
  } catch (error) {
    console.warn(`${MODULE_ID} | Não foi possível restaurar labels de ataque`, error);
  }
  STATE.multiActivityAttackPending = pendingByMessage.size;
  STATE.multiActivityAttackLastRestore = { messageId, reason, at: Date.now() };
  return true;
}

function restoreEntriesForItem(item) {
  for (const [messageId, entry] of pendingByMessage) {
    if (entry.item === item) restoreEntry(messageId, "new-roll-same-item");
  }
}

function shouldBridge(item, activity) {
  if (!item || !activity || activity.type !== "attack") return false;
  const attacks = attackActivities(item);
  if (attacks.length < 2) return false;
  return typeof activity.labels?.toHit === "string" && activity.labels.toHit.length > 0;
}

function bridgeSelectedAttack(card, message) {
  const { actor, item, activity } = getCardActivity(card);
  if (!shouldBridge(item, activity)) return null;
  rememberCardActivitySelection(card, activity);
  const messageId = message?.id ?? card.closest?.("[data-message-id]")?.dataset?.messageId;
  if (!messageId || !item?.labels) return null;

  restoreEntriesForItem(item);

  const originalToHit = item.labels.toHit;
  const originalModifier = item.labels.modifier;
  const patchedToHit = activity.labels.toHit;
  const patchedModifier = activity.labels.modifier ?? originalModifier;

  item.labels.toHit = patchedToHit;
  item.labels.modifier = patchedModifier;

  const entry = {
    actor, item, activity, messageId, slot: cardSlot(card),
    originalToHit, originalModifier,
    patchedToHit, patchedModifier,
    startedAt: Date.now(),
    timer: null
  };
  // Cancellation of either native dialog produces no ChatMessage update. Keep the
  // bridge long enough for normal player interaction, then safely restore it.
  entry.timer = setTimeout(() => restoreEntry(messageId, "timeout"), 5 * 60 * 1000);
  pendingByMessage.set(messageId, entry);

  STATE.multiActivityAttackBridges = Number(STATE.multiActivityAttackBridges ?? 0) + 1;
  STATE.multiActivityAttackPending = pendingByMessage.size;
  STATE.multiActivityAttackLast = {
    actor: actor?.name ?? null,
    item: item?.name ?? null,
    activity: activity?.name ?? null,
    activityId: activity?.id ?? null,
    itemToHitBefore: originalToHit ?? null,
    activityToHit: patchedToHit,
    at: Date.now()
  };
  return entry;
}

function bindCard(message, root) {
  if (!root) return 0;
  const cards = [];
  if (root.matches?.(".jujutsu-card:not(.jj-extra-card)")) cards.push(root);
  for (const card of root.querySelectorAll?.(".jujutsu-card:not(.jj-extra-card)") ?? []) cards.push(card);
  let count = 0;
  for (const card of cards) {
    const button = card.querySelector?.(".jj-attack-btn[data-action='jj-attack']");
    if (!button || boundAttackButtons.has(button)) continue;
    const { item, activity } = getCardActivity(card);
    if (!shouldBridge(item, activity)) continue;
    button.dataset.oprpgFixesActivityAttack = "1";
    boundAttackButtons.add(button);
    // Capture phase runs before the OPRPG's native bubble listener. We do not
    // stop the event: the native _handleAttackRoll remains responsible for PA,
    // Energy Scale, Haki, critical thresholds, Dice So Nice and card rendering.
    button.addEventListener("click", () => bridgeSelectedAttack(card, message), { capture: true });
    count++;
  }
  return count;
}

export function installMultiActivityAttackPatch() {
  if (installed) return true;
  installed = true;
  renderHookId = Hooks.on("renderChatMessageHTML", (message, html) => {
    try {
      const root = html instanceof HTMLElement ? html : html?.[0];
      if (root) bindCard(message, root);
    } catch (error) {
      STATE.warnings.push(`Acerto multi-Activity/render: ${error?.message ?? error}`);
    }
  });
  preUpdateMessageHookId = Hooks.on("preUpdateChatMessage", (message, changes) => {
    if (!message?.id || !pendingByMessage.has(message.id)) return;
    const entry = pendingByMessage.get(message.id);
    preserveSelectedActivityInContent(entry, changes);
    restoreEntry(message.id, "native-card-update");
  });
  Hooks.on("deleteChatMessage", message => {
    if (message?.id) forgetCardActivitySelectionsForMessage(message.id);
  });
  requestAnimationFrame?.(() => {
    try {
      document.querySelectorAll?.(".message[data-message-id]").forEach(el => {
        const message = game.messages?.get(el.dataset.messageId);
        if (message) bindCard(message, el);
      });
    } catch (_) { /* chat not mounted */ }
  });
  STATE.multiActivityAttackPatch = !!(renderHookId && preUpdateMessageHookId);
  return STATE.multiActivityAttackPatch;
}

export function multiActivityAttackStatus() {
  return {
    installed: !!STATE.multiActivityAttackPatch,
    mode: "native-label-bridge",
    nativeHandlerPreserved: true,
    bridges: Number(STATE.multiActivityAttackBridges ?? 0),
    pending: pendingByMessage.size,
    selectionsPreservedInNativeUpdates: Number(STATE.multiActivityAttackSelectionsPreserved ?? 0),
    recoveredSelections: Number(STATE.multiActivityAttackSelectionRecoveries ?? 0),
    last: STATE.multiActivityAttackLast ?? null,
    lastRestore: STATE.multiActivityAttackLastRestore ?? null
  };
}
