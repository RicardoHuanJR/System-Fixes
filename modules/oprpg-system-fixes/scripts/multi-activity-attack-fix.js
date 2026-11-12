import { automationBonuses } from './effect-automations.js';
import { MODULE_ID, STATE, activitiesOf, getCardActivity, rememberCardActivitySelection, forgetCardActivitySelectionsForMessage } from "./shared.js";

// A chat message may contain cards for different Items. Keep each native
// attack bridge independent, so a second click cannot orphan the first Item's
// temporary labels. Entries for the SAME Item are still exclusive.
const pendingByMessage = new Map();
// Item.labels is a shared native cache. Until the native handler finishes,
// a second Attack click on this Item must NOT replace the previous bridge.
const pendingByItem = new WeakMap();
const pendingCount = () => [...pendingByMessage.values()].reduce((sum, entries) => sum + entries.size, 0);
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

function restoreEntry(entry, reason="message-update") {
  const entries = pendingByMessage.get(entry?.messageId);
  if (!entries?.has(entry)) return false;
  entries.delete(entry);
  if (entry.item && pendingByItem.get(entry.item) === entry) pendingByItem.delete(entry.item);
  if (!entries.size) pendingByMessage.delete(entry.messageId);
  clearTimeout(entry.timer);
  const { item, originalToHit, originalModifier, patchedToHit, patchedModifier } = entry;
  try {
    if (item?.labels) {
      // Do not overwrite a newer bridge or an external change made mid-roll.
      if (item.labels.toHit === patchedToHit) item.labels.toHit = originalToHit;
      if (item.labels.modifier === patchedModifier) item.labels.modifier = originalModifier;
    }
  } catch (error) {
    console.warn(`${MODULE_ID} | Não foi possível restaurar labels de ataque`, error);
  }
  STATE.multiActivityAttackPending = pendingCount();
  STATE.multiActivityAttackLastRestore = { messageId: entry.messageId, reason, at: Date.now() };
  return true;
}

function restoreMessageEntries(messageId, reason) {
  for (const entry of [...(pendingByMessage.get(messageId) ?? [])]) restoreEntry(entry, reason);
}

/** Manual recovery after a native dialog is cancelled without a chat update.
 * Close the native dialog BEFORE calling this. Local client only.
 */
export function resetPendingMultiActivityAttacks(messageId = null) {
  let restored = 0;
  for (const [id, entries] of [...pendingByMessage.entries()]) {
    if (messageId && id !== messageId) continue;
    for (const entry of [...entries]) if (restoreEntry(entry, "manual-reset")) restored++;
  }
  return restored;
}

function shouldBridge(item, activity) {
  if (!item || !activity || activity.type !== "attack" || activity.canUse === false) return false;
  // One Attack + one Save/Heal is still a multi-activity Item: the native
  // item.labels cache can belong to the OTHER activity, not this attack.
  if (activitiesOf(item).length < 2 && !automationBonuses(activity.actor??item.actor,activity)?.hit) return false;
  return typeof activity.labels?.toHit === "string" && activity.labels.toHit.length > 0;
}

function bridgeSelectedAttack(card, message) {
  const { actor, item, activity } = getCardActivity(card);
  if (!shouldBridge(item, activity)) return null;
  rememberCardActivitySelection(card, activity);
  const messageId = message?.id ?? card.closest?.("[data-message-id]")?.dataset?.messageId;
  if (!messageId || !item?.labels) return null;

  // Do not overwrite a still-running native attack. The capture listener
  // blocks the second click, but this guard also protects direct callers.
  if (pendingByItem.has(item)) return null;

  const originalToHit = item.labels.toHit;
  const originalModifier = item.labels.modifier;
  const hitBonus=automationBonuses(actor,activity)?.hit??0;
  const patchedToHit = activity.labels.toHit+(hitBonus?` + ${hitBonus}`:'');
  const patchedModifier = (activity.labels.modifier ?? originalModifier)+(hitBonus?` + ${hitBonus}`:'');

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
  entry.timer = setTimeout(() => restoreEntry(entry, "timeout"), 5 * 60 * 1000);
  if (!pendingByMessage.has(messageId)) pendingByMessage.set(messageId, new Set());
  pendingByMessage.get(messageId).add(entry);
  pendingByItem.set(item, entry);

  STATE.multiActivityAttackBridges = Number(STATE.multiActivityAttackBridges ?? 0) + 1;
  STATE.multiActivityAttackPending = pendingCount();
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
    // Bind even if this Activity does not need patching: its native handler
    // could read labels temporarily patched by another Attack of this Item.
    if (!item || activity?.type !== "attack") continue;
    if (shouldBridge(item, activity)) button.dataset.oprpgFixesActivityAttack = "1";
    boundAttackButtons.add(button);
    // Capture phase runs before the OPRPG's native bubble listener. We do not
    // stop the event: the native _handleAttackRoll remains responsible for PA,
    // Energy Scale, Haki, critical thresholds, Dice So Nice and card rendering.
    button.addEventListener("click", event => {
      if (button.disabled || event.defaultPrevented) return;
      const current = getCardActivity(card);
      if (current.item && pendingByItem.has(current.item)) {
        // Fail closed rather than sending an incorrectly modified Attack to
        // the native system. This is per-client, not a cross-client lock.
        event.preventDefault?.();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
        STATE.multiActivityAttackBlocked = Number(STATE.multiActivityAttackBlocked ?? 0) + 1;
        ui.notifications?.warn?.("OPRPG Fixes: finalize a rolagem de ataque anterior deste item antes de iniciar outra.");
        return;
      }
      if (shouldBridge(current.item, current.activity)) bridgeSelectedAttack(card, message);
    }, { capture: true });
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
    // Unrelated flag/metadata updates must not end a bridge while a native
    // attack dialog is still waiting for its roll to be confirmed.
    if (typeof changes?.content !== "string") return;
    for (const entry of [...pendingByMessage.get(message.id)]) {
      preserveSelectedActivityInContent(entry, changes);
    }
    restoreMessageEntries(message.id, "native-card-update");
  });
  Hooks.on("deleteChatMessage", message => {
    if (message?.id) {
      restoreMessageEntries(message.id, "deleted-card");
      forgetCardActivitySelectionsForMessage(message.id);
    }
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
    pending: pendingCount(),
    blockedConcurrentAttacks: Number(STATE.multiActivityAttackBlocked ?? 0),
    selectionsPreservedInNativeUpdates: Number(STATE.multiActivityAttackSelectionsPreserved ?? 0),
    recoveredSelections: Number(STATE.multiActivityAttackSelectionRecoveries ?? 0),
    last: STATE.multiActivityAttackLast ?? null,
    lastRestore: STATE.multiActivityAttackLastRestore ?? null
  };
}
