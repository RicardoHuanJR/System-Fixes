import { MODULE_ID, t } from "./settings.js";
import { activitiesOf, activityCanUse, enrich, getItem, getLabel, isActivity, ppCostInfo, resolveIcon } from "./utils.js";

function escapeHtml(value) {
  const text = String(value ?? "");
  if (foundry?.utils?.escapeHTML) return foundry.utils.escapeHTML(text);
  return text.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
}

export async function tooltipFor(source, preferredActivity = null) {
  const item = getItem(source);
  const activity = preferredActivity ?? (isActivity(source) ? source : activitiesOf(item).find(activityCanUse) ?? activitiesOf(item)[0]);
  if (!item) return null;
  const title = isActivity(source) ? `${source.name} — ${item.name}` : item.name;
  const description = await enrich(activity?.description?.chat || item.system?.description?.value || "", item);
  const details = [];
  const activation = activity?.labels?.activation ?? activity?.activation?.type;
  const range = activity?.labels?.range ?? activity?.range?.units;
  const target = activity?.labels?.target ?? activity?.target?.affects?.type;
  const duration = activity?.labels?.duration ?? activity?.duration?.units;
  if (activation) details.push({ label: `${MODULE_ID}.tooltip.activation`, value: getLabel(activation) });
  if (range) details.push({ label: `${MODULE_ID}.tooltip.range`, value: getLabel(range) });
  if (target) details.push({ label: `${MODULE_ID}.tooltip.target`, value: getLabel(target) });
  if (duration) details.push({ label: `${MODULE_ID}.tooltip.duration`, value: getLabel(duration) });
  const cost = ppCostInfo(activity);
  if (cost.label) details.push({ label: `${MODULE_ID}.tooltip.cost`, value: cost.label });
  return {
    title, description,
    subtitle: item.type === "spell" ? t("hud.technique") : game.i18n.localize(CONFIG.Item.typeLabels?.[item.type] ?? item.type),
    details, propertiesLabel: `${MODULE_ID}.tooltip.properties`, properties: [], footerText: ""
  };
}

export async function tooltipForActivities(item, activities) {
  const list = Array.from(activities ?? []).filter(Boolean);
  if (list.length <= 1) return tooltipFor(item, list[0] ?? null);
  const base = await enrich(item.system?.description?.value || "", item);
  const rows = list.map(activity => {
    const activation = getLabel(activity?.labels?.activation ?? activity?.activation?.type ?? "");
    const cost = ppCostInfo(activity).label ?? "";
    const healing = Array.from(activity?.healing?.types ?? [])
      .map(type => getLabel(CONFIG.DND5E.healingTypes?.[type] ?? type)).filter(Boolean).join(" / ");
    const meta = [healing, activation, cost].filter(Boolean).join(" • ");
    return `<li><strong>${escapeHtml(activity.name ?? t("hud.activity"))}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ""}</li>`;
  }).join("");
  return {
    title: item.name,
    description: `${base}<div class="oprpg-multi-activity-tooltip"><strong>${escapeHtml(game.i18n.format(`${MODULE_ID}.hud.activityCount`, {count:list.length}))}</strong><ul>${rows}</ul></div>`,
    subtitle: item.type === "spell" ? t("hud.technique") : game.i18n.localize(CONFIG.Item.typeLabels?.[item.type] ?? item.type),
    details: [], propertiesLabel: `${MODULE_ID}.tooltip.properties`, properties: [], footerText: ""
  };
}

function activityTypeLabel(activity) {
  const config = CONFIG.DND5E?.activityTypes?.[activity?.type];
  return getLabel(config?.label ?? config ?? activity?.type ?? t("hud.activity"));
}

function damageSummary(activity) {
  const explicit = activity?.labels?.damage;
  if (explicit) return getLabel(explicit);
  const parts = Array.from(activity?.damage?.parts ?? []);
  const rows = parts.map(part => {
    const number = part?.number ?? part?.dice?.number;
    const denomination = part?.denomination ?? part?.dice?.denomination;
    const bonus = String(part?.bonus ?? "").trim();
    let formula = number && denomination ? `${number}${String(denomination).startsWith("d") ? denomination : `d${denomination}`}` : "";
    if (bonus) formula = formula ? `${formula} ${bonus.startsWith("+") || bonus.startsWith("-") ? bonus : `+ ${bonus}`}` : bonus;
    const types = Array.from(part?.types ?? part?.type ?? []).map(type => getLabel(CONFIG.DND5E?.damageTypes?.[type] ?? type)).filter(Boolean).join("/");
    return [formula, types].filter(Boolean).join(" ");
  }).filter(Boolean);
  return rows.join("; ");
}

function activityMeta(activity) {
  const activation = getLabel(activity?.labels?.activation ?? activity?.activation?.type ?? "");
  const cost = ppCostInfo(activity)?.label ?? "";
  const range = getLabel(activity?.labels?.range ?? activity?.range?.units ?? "");
  const healingTypes = Array.from(activity?.healing?.types ?? []);
  const healing = healingTypes.map(type => getLabel(CONFIG.DND5E.healingTypes?.[type] ?? type)).filter(Boolean).join(" / ");
  const damage = damageSummary(activity);
  return {
    type: activityTypeLabel(activity), activation, cost, range,
    effect: healing || damage || ""
  };
}

function activityChoiceLabel(activity) {
  const meta = activityMeta(activity);
  const suffix = [meta.effect, meta.activation, meta.cost].filter(Boolean).join(" • ");
  return suffix ? `${activity?.name ?? t("hud.activity")} — ${suffix}` : (activity?.name ?? t("hud.activity"));
}

function activityChoiceKey(item) {
  const actor = item?.actor ?? item?.parent;
  return `${MODULE_ID}:activity-choice:${actor?.uuid ?? actor?.id ?? "actor"}:${item?.uuid ?? item?.id ?? "item"}`;
}

export async function chooseActivity(item, activities) {
  const choices = Array.from(activities ?? []).filter(Boolean);
  if (!choices.length) return null;
  if (choices.length === 1) return choices[0];

  const key = activityChoiceKey(item);
  let remembered = null;
  try { remembered = localStorage.getItem(key); } catch (_) {}
  if (!choices.some(a => a.id === remembered)) remembered = choices[0]?.id ?? null;

  const cards = choices.map(activity => {
    const meta = activityMeta(activity);
    const checked = activity.id === remembered ? "checked" : "";
    const lines = [
      meta.type ? `<span><b>${escapeHtml(t("hud.type"))}:</b> ${escapeHtml(meta.type)}</span>` : "",
      meta.effect ? `<span><b>${escapeHtml(t("hud.effect"))}:</b> ${escapeHtml(meta.effect)}</span>` : "",
      meta.activation ? `<span><b>${escapeHtml(t("tooltip.activation"))}:</b> ${escapeHtml(meta.activation)}</span>` : "",
      meta.range ? `<span><b>${escapeHtml(t("tooltip.range"))}:</b> ${escapeHtml(meta.range)}</span>` : "",
      meta.cost ? `<span><b>${escapeHtml(t("tooltip.cost"))}:</b> ${escapeHtml(meta.cost)}</span>` : ""
    ].filter(Boolean).join("");
    return `<label class="oprpg-activity-choice-card">
      <input type="radio" name="oprpg-activity-choice" value="${escapeHtml(activity.id)}" ${checked}>
      <img src="${escapeHtml(resolveIcon(activity))}" alt="">
      <span class="oprpg-activity-choice-body"><strong>${escapeHtml(activity.name ?? t("hud.activity"))}</strong><small>${lines}</small></span>
    </label>`;
  }).join("");

  const selectedId = await foundry.applications.api.DialogV2.wait({
    window: { title: item?.name ?? t("hud.chooseActivity") },
    content: `<div class="oprpg-activity-choice"><p>${escapeHtml(t("hud.chooseActivity"))}</p><div class="oprpg-activity-choice-grid">${cards}</div><p class="hint">${escapeHtml(t("hud.rememberActivity"))}</p></div>`,
    buttons: [
      { label: t("hud.useActivity"), action: "use", default: true,
        callback: (event, button, dialog) => (dialog.element ?? document).querySelector('input[name="oprpg-activity-choice"]:checked')?.value ?? null },
      { label: t("hud.cancel"), action: "cancel", callback: () => null }
    ],
    rejectClose: false, close: () => null
  });
  if (selectedId) {
    try { localStorage.setItem(key, selectedId); } catch (_) {}
  }
  return choices.find(activity => activity.id === selectedId) ?? null;
}

