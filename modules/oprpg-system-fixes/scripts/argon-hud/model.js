/** Pure model utilities. No Foundry or Argon globals required. */
export const GROUPS = Object.freeze([
  { key: "weapons", itemTypes: ["weapon"], label: "Armas", icon: "icons/svg/sword.svg" },
  { key: "techniques", itemTypes: ["spell"], label: "Técnicas", icon: "icons/svg/lightning.svg" },
  { key: "features", itemTypes: ["feat", "class", "subclass", "race", "background"], label: "Habilidades", icon: "icons/svg/upgrade.svg" },
  { key: "items", itemTypes: ["consumable", "tool", "equipment", "loot", "container", "backpack", "facility"], label: "Itens", icon: "icons/svg/chest.svg" },
  { key: "other", itemTypes: [], label: "Outras ações", icon: "icons/svg/dice-target.svg" }
]);
export const ECONOMY = Object.freeze([
  { key: "action", label: "Ação", icon: "icons/svg/sword.svg" },
  { key: "bonus", label: "Ação bônus", icon: "icons/svg/clockwork.svg" },
  { key: "reaction", label: "Reação", icon: "icons/svg/shield.svg" },
  { key: "free", label: "Livre / outras", icon: "icons/svg/dice-target.svg" }
]);

export function asArray(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (collection instanceof Map) return [...collection.values()];
  if (typeof collection.values === "function") {
    try { return [...collection.values()]; } catch (_) { /* object-like fallback */ }
  }
  if (typeof collection === "object") return Object.values(collection).filter(Boolean);
  return [];
}

export function activityList(item) {
  const source = item?.system?.activities;
  const entries = asArray(source);
  return entries.filter(activity => activity && typeof activity === "object" && (activity.id || activity._id));
}

export function activityById(item, activityId) {
  if (!item || !activityId) return null;
  const activities = item.system?.activities;
  if (typeof activities?.get === "function") {
    const a = activities.get(activityId);
    if (a) return a;
  }
  return activityList(item).find(a => String(a.id ?? a._id) === String(activityId)) ?? null;
}

export function groupOf(item) {
  const type = String(item?.type ?? "").toLowerCase();
  return GROUPS.find(group => group.itemTypes.includes(type))?.key ?? "other";
}

export function economyOf(activity) {
  const value = String(activity?.activation?.type ?? activity?.activation?.activationType ?? activity?.activation?.value ?? "").toLowerCase();
  if (["action", "standard", "act", "1", "main"].includes(value)) return "action";
  if (["bonus", "bonusaction", "bonus action", "swift"].includes(value)) return "bonus";
  if (["reaction", "react"].includes(value)) return "reaction";
  return "free";
}

export function entryLabel(item, activity, count) {
  if (!activity) return String(item?.name ?? "Item");
  const name = String(activity.name ?? activity.label ?? activity.type ?? "Atividade").trim();
  const itemName = String(item?.name ?? "Item");
  return count > 1 ? `${itemName} — ${name.toLocaleLowerCase() === itemName.toLocaleLowerCase() ? String(activity.type ?? activity.id ?? activity._id ?? "Atividade") : name}` : itemName;
}

/** Each executable activity must keep a stable id. Never guess a first activity on click. */
export function entriesForActor(actor) {
  const entries = [];
  for (const item of asArray(actor?.items)) {
    if (!item?.id || !item?.system) continue;
    const activities = activityList(item);
    if (activities.length) {
      const labels = new Map();
      for (const activity of activities) {
        const baseLabel = entryLabel(item, activity, activities.length);
        const next = (labels.get(baseLabel) ?? 0) + 1;
        labels.set(baseLabel, next);
        const label = next > 1 ? `${baseLabel} (${next})` : baseLabel;
        entries.push({ itemId: item.id, activityId: String(activity.id ?? activity._id),
          group: groupOf(item), economy: economyOf(activity), label,
          icon: activity.img || item.img || "icons/svg/dice-target.svg",
          type: String(activity.type ?? ""), item });
      }
      continue;
    }
    // Items without activities are only exposed when their type is normally usable.
    if (["consumable", "tool", "weapon", "spell", "feat"].includes(item.type) && typeof item.use === "function") {
      entries.push({ itemId: item.id, activityId: null, group: groupOf(item), economy: "free",
        label: String(item.name), icon: item.img || "icons/svg/dice-target.svg", type: "", item });
    }
  }
  return entries;
}

export function escapeHTML(input) {
  return String(input ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
