import { resourceLabel } from "./model.js";

/** Read prepared labels only. No rolls, formula evaluation or first-activity fallback. */
export function activityDetails(activity, item, localize = value => value, {isGM = false} = {}) {
  if (!activity) return [];
  if (!isGM && (item?.system?.identified === false || activity.canConfigure === false)) return [];
  const text = value => {
    if (typeof value === "string" || typeof value === "number") return String(localize(String(value))).trim();
    if (Array.isArray(value)) return value.map(text).filter(Boolean).join("; ");
    if (value && typeof value === "object") return text(value.label ?? value.formula ?? "");
    return "";
  };
  const labels = activity.labels ?? {};
  const effective = activity.activationLabels ?? labels;
  const rows = [];
  const add = (label,value) => {const prepared = text(value); if (prepared) rows.push({label,value:prepared});};
  add("Ativação", effective.activation ?? labels.activation);
  add("Alcance", effective.range ?? labels.range);
  add("Alvos", activity.target?.affects?.labels?.sheet || effective.target || labels.target);
  add("Área", activity.target?.template?.labels?.description || activity.target?.template?.label);
  add("Duração", labels.concentrationDuration || effective.duration || labels.duration);
  add(activity.type === "heal" ? "Cura" : "Dano", labels.damages ?? labels.damage);
  // Some system versions prepare a single string instead of the damage-label array.
  if (!rows.some(row => ["Dano","Cura"].includes(row.label))) add(activity.type === "heal" ? "Cura" : "Dano", labels.healing ?? labels.damage);
  add("Recursos", resourceLabel(activity,item));
  return rows;
}
