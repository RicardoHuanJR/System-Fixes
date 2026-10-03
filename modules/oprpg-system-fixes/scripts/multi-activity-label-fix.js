import { STATE, activitiesOf, getCardActivity } from "./shared.js";
import { freshActivityDamageLabels, normalizeDamageTypes } from "./activity-damage.js";

let renderHookId = null;
let installed = false;
const pendingNativeLabels = new WeakMap();
const boundNativeLabelButtons = new WeakSet();

function summary(activity, actor) {
  return freshActivityDamageLabels(activity, actor).map(x => x.label).filter(Boolean).join(" + ");
}

function syncCard(card) {
  const { actor, item, activity } = getCardActivity(card);
  if (!item || !activity || activitiesOf(item).length < 2) return false;
  const labels = freshActivityDamageLabels(activity, actor);
  const text = labels.map(x => x.label).filter(Boolean).join(" + ");
  if (!text) return false;

  const selectors = [
    "#jj-dmg-formula", "#jj-dmg-label", ".jj-dmg-formula", ".jj-damage-label",
    "#jj-extra-formula", ".jj-extra-formula", "#jj-save-dmg-formula", ".jj-save-dmg-formula",
    "[data-role='damage-label']", "[data-role='damage-formula']"
  ];
  let touched = false;
  for (const selector of selectors) {
    for (const node of card.querySelectorAll?.(selector) ?? []) {
      if (node.dataset?.oprpgFixesActivityLabel === "1" && node.textContent === text) continue;
      node.textContent = text;
      if (node.dataset) node.dataset.oprpgFixesActivityLabel = "1";
      touched = true;
    }
  }

  const types = [...new Set(labels.flatMap(x => normalizeDamageTypes(x.types)))];
  if (types.length) card.dataset.damageTypes = types.join(",");
  card.dataset.oprpgFixesActivityDamageLabels = "1";
  return touched || true;
}

/**
 * The native OPRPG damage handler reads item.labels.damages, a shared cache.
 * Refresh that cache from the exact Activity only for the duration of the
 * trusted click. Multi-Activity cards use our own selected-Activity roller and
 * therefore do not need this bridge.
 */
export function prepareNativeCardDamageLabels(card) {
  const { actor, item, activity } = getCardActivity(card);
  if (!actor || !item || !activity || activitiesOf(item).length >= 2) return false;
  if (!item.labels) return false;
  const labels = freshActivityDamageLabels(activity, actor);
  if (!labels.length) return false;

  const previous = pendingNativeLabels.get(item)?.previous ?? item.labels.damages;
  const pending = { previous, labels, activityId: activity.id };
  pendingNativeLabels.set(item, pending);
  item.labels.damages = labels;

  setTimeout(() => {
    if (pendingNativeLabels.get(item) !== pending) return;
    if (item.labels?.damages === labels) item.labels.damages = previous;
    pendingNativeLabels.delete(item);
  }, 0);

  STATE.nativeDamageLabelBridges = Number(STATE.nativeDamageLabelBridges ?? 0) + 1;
  return true;
}

function bindNativeLabelBridge(card) {
  const { item, activity } = getCardActivity(card);
  if (!item || !activity || activitiesOf(item).length >= 2) return false;
  const button = card.querySelector?.(".jj-damage-btn[data-action='jj-damage'], [data-action='jj-damage']");
  if (!button || boundNativeLabelButtons.has(button)) return false;
  boundNativeLabelButtons.add(button);
  button.dataset.oprpgFixesNativeDamageLabels = "1";
  button.addEventListener("click", event => {
    if (button.disabled || event.defaultPrevented) return;
    try { prepareNativeCardDamageLabels(card); }
    catch (error) { STATE.warnings.push(`Labels nativos de dano: ${error?.message ?? error}`); }
  }, {capture:true});
  return true;
}

function scan(root) {
  if (!root) return 0;
  const cards = [];
  if (root.matches?.(".jujutsu-card[data-activity-id]")) cards.push(root);
  for (const card of root.querySelectorAll?.(".jujutsu-card[data-activity-id]") ?? []) cards.push(card);
  let count = 0;
  for (const card of cards) {
    if (syncCard(card)) count++;
    bindNativeLabelBridge(card);
  }
  return count;
}

export function installMultiActivityLabelPatch() {
  if (installed) return true;
  installed = true;
  renderHookId = Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!String(message?.content ?? "").includes("data-activity-id")) return;
    try {
      const root = html instanceof HTMLElement ? html : html?.[0];
      if (root) scan(root);
    } catch (error) {
      STATE.warnings.push(`Labels multi-Activity: ${error?.message ?? error}`);
    }
  });
  requestAnimationFrame?.(() => {
    try { scan(document); } catch (_) {}
  });
  STATE.multiActivityDamageLabelsPatch = !!renderHookId;
  return STATE.multiActivityDamageLabelsPatch;
}
