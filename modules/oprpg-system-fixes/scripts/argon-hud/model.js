/** Pure model utilities. No Foundry or Argon globals required. */
export const GROUPS = Object.freeze([
  { key: "akuma", itemTypes: [], label: "Akuma no Mi", icon: "icons/svg/fire.svg" },
  { key: "weapons", itemTypes: ["weapon"], label: "Armas", icon: "icons/svg/sword.svg" },
  { key: "techniques", itemTypes: ["spell"], label: "Técnicas", icon: "icons/svg/lightning.svg" },
  { key: "features", itemTypes: ["feat", "class", "subclass", "race", "background"], label: "Habilidades", icon: "icons/svg/upgrade.svg" },
  { key: "items", itemTypes: ["consumable", "tool", "equipment", "loot", "container", "backpack", "facility"], label: "Itens", icon: "icons/svg/chest.svg" },
  { key: "other", itemTypes: [], label: "Outras ações", icon: "icons/svg/dice-target.svg" }
]);
export const ECONOMY = Object.freeze([
  { key: "action", label: "Ação", icon: "icons/svg/sword.svg" },
  { key: "powerful", label: "Poderosa", icon: "icons/svg/lightning.svg" },
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
  const flags = item?.flags?.["oprpg-system"];
  if (flags?.akumaTec || flags?.akumaManif || flags?.hatsu?.slot || flags?.hatsu?.parent) return "akuma";
  const type = String(item?.type ?? "").toLowerCase();
  return GROUPS.find(group => group.itemTypes.includes(type))?.key ?? "other";
}

export function economyOf(activity) {
  const value = String(activity?.activation?.type ?? activity?.activation?.activationType ?? activity?.activation?.value ?? "").toLowerCase();
  if (["action", "standard", "act", "1", "main"].includes(value)) return "action";
  if (["bonus", "bonusaction", "bonus action", "swift"].includes(value)) return "bonus";
  if (["reaction", "react"].includes(value)) return "reaction";
  if (value === "powerful") return "powerful";
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

export function finiteValue(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
}

/** Costs are information only; formulas and scaling are never evaluated by the HUD. */
export function resourceLabel(activity, item) {
  const targets = asArray(activity?.consumption?.targets).filter(t =>
    t.type === "attribute" && ["energy.total", "energy.generated"].includes(t.target));
  const labels = [];
  if (targets.length) {
    const dynamic = targets.some(t => !/^[0-9]+(?:\.[0-9]+)?$/.test(String(t.value)) || t.scaling?.mode || t.scaling?.formula);
    labels.push(dynamic ? "PP variável" : `${targets.reduce((n, t) => n + Number(t.value), 0)} PP`);
  }
  const uses = activity?.uses?.max ? activity.uses : item?.system?.uses;
  const max = finiteValue(uses?.max);
  if (max > 0) {
    const left = finiteValue(uses.value) ?? (finiteValue(uses.spent) !== null ? max - Number(uses.spent) : null);
    if (left !== null) labels.push(`${Math.max(0, left)}/${max} usos`);
  }
  return labels.join(" · ");
}
