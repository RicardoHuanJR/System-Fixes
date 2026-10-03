import { MODULE_ID, SYSTEM_ID, t } from "./settings.js";

export function activitiesOf(item) {
  try { return Array.from(item?.system?.activities ?? []); }
  catch (_) { return []; }
}

export function activityType(activity) {
  return activity?.activation?.type ?? null;
}

export function activityCanUse(activity) {
  if (!activity) return false;
  try { return activity.canUse !== false; }
  catch (_) { return true; }
}

export function actionMatches(activity, wanted) {
  if (!wanted) return true;
  const type = activityType(activity);
  return Array.isArray(wanted) ? wanted.includes(type) : type === wanted;
}

export function getItem(source) {
  return source?.item ?? source ?? null;
}

export function isActivity(source) {
  return !!source?.item && !!source?.activation;
}

export function isDefaultActivityIcon(path) {
  return !path || /systems\/oprpg-system\/icons\/svg\/activity\//i.test(path);
}

export function resolveIcon(source) {
  const item = getItem(source);
  if (isActivity(source)) {
    const explicit = source?._source?.img;
    if (explicit && !isDefaultActivityIcon(explicit)) return explicit;
  }
  if (item?.img) return item.img;
  const computed = source?.img;
  if (computed && !isDefaultActivityIcon(computed)) return computed;
  return source?.metadata?.img ?? "icons/svg/item-bag.svg";
}

function energyTargets(activity) {
  return Array.from(activity?.consumption?.targets ?? []).filter(target =>
    target?.type === "attribute" && ["energy.total", "energy.generated"].includes(target?.target)
  );
}

function numericFormula(value) {
  const raw = String(value ?? "").trim();
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(raw)) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Describe PP cost without pretending a formula/scaling value is fixed.
 * @returns {{value:number|null,label:string|null,dynamic:boolean,raw:string[]}}
 */
export function ppCostInfo(activity) {
  const targets = energyTargets(activity);
  if (!targets.length) return { value: null, label: null, dynamic: false, raw: [] };

  let total = 0;
  let dynamic = false;
  const raw = [];

  for (const target of targets) {
    const formula = String(target?.value ?? "").trim();
    raw.push(formula);
    const n = numericFormula(formula);
    const scalingMode = String(target?.scaling?.mode ?? "").trim();
    const scalingFormula = String(target?.scaling?.formula ?? "").trim();
    if (n === null || scalingMode || scalingFormula) dynamic = true;
    if (n !== null) total += n;
  }

  if (dynamic) {
    const base = total > 0 ? total : null;
    return {
      value: base,
      label: base ? game.i18n.format(`${MODULE_ID}.hud.variablePPBase`, { value: base }) : t("hud.variablePP"),
      dynamic: true,
      raw
    };
  }

  return total > 0
    ? { value: total, label: `${total} PP`, dynamic: false, raw }
    : { value: null, label: null, dynamic: false, raw };
}


export function matchingActivities(item, wantedActivation = null) {
  const usable = activitiesOf(item).filter(activityCanUse);
  return wantedActivation
    ? usable.filter(activity => actionMatches(activity, wantedActivation))
    : usable;
}

export function itemMatchesActivation(item, wantedActivation = null) {
  const activities = matchingActivities(item, wantedActivation);
  if (activities.length) return true;
  return !wantedActivation && activitiesOf(item).length === 0;
}

export function expandItem(item, wantedActivation = null) {
  const all = activitiesOf(item);
  if (!all.length) return wantedActivation ? [] : [item];

  const usable = all.filter(activityCanUse);
  const filtered = wantedActivation
    ? usable.filter(a => actionMatches(a, wantedActivation))
    : usable;

  if (!filtered.length) return [];
  if (all.length === 1 && filtered.length === 1) return [item];
  return filtered;
}

export function techniqueGrade(item) {
  const akumaGrade = item?.getFlag?.(SYSTEM_ID, "akumaTec");
  if (akumaGrade === "aux") return 0;
  if (akumaGrade && /^\d+$/.test(String(akumaGrade))) return Number(akumaGrade);
  const level = Number(item?.system?.level ?? 0);
  return Number.isFinite(level) ? Math.max(0, Math.min(level, 7)) : 0;
}

export function techniqueLabel(grade) {
  if (grade === 0) return t("hud.auxiliary");
  return game.i18n.format(`${MODULE_ID}.hud.grade`, { grade });
}

export function isExcludedSystemSpell(item) {
  // Compatibility guard: the OPRPG package contains an unrelated spell-tab subsystem.
  // Any spell explicitly assigned to that subsystem must never leak into the One Piece HUD.
  const flag = item?.getFlag?.(SYSTEM_ID, "hatsu");
  return !!flag && typeof flag === "object" && Object.keys(flag).length > 0;
}

export function techniqueItems(actor, { akuma = null } = {}) {
  return actor.items.filter(item => {
    if (item.type !== "spell" || isExcludedSystemSpell(item)) return false;
    const isAkuma = !!item.getFlag?.(SYSTEM_ID, "akumaTec") || !!item.getFlag?.(SYSTEM_ID, "akumaManif");
    if (akuma === true) return isAkuma;
    if (akuma === false) return !isAkuma;
    return true;
  });
}

export function featureItems(actor) {
  return actor.items.filter(i => i.type === "feat");
}

export function usableItems(actor) {
  return actor.items.filter(i => ["consumable", "equipment", "loot", "tool"].includes(i.type));
}

export async function enrich(html, relativeTo) {
  if (!html) return "";
  try {
    return await foundry.applications.ux.TextEditor.implementation.enrichHTML(html, { async: true, relativeTo });
  } catch (_) {
    return html;
  }
}

export function getLabel(value) {
  if (!value) return "";
  if (typeof value === "string") return game.i18n.localize(value);
  return game.i18n.localize(value.label ?? value.name ?? String(value));
}

export function unitAbbreviation(unit) {
  if (!unit) return "";
  const config = CONFIG.DND5E.movementUnits?.[unit];
  if (!config) return unit;
  return game.i18n.localize(config.abbreviation ?? config.label ?? unit);
}

export function convertLengthSafe(value, from, to) {
  value = Number(value);
  if (!Number.isFinite(value)) return null;
  if (!from || !to || from === to) return value;
  const fromConfig = CONFIG.DND5E.movementUnits?.[from];
  const toConfig = CONFIG.DND5E.movementUnits?.[to];
  if (!fromConfig || !toConfig) return null;
  const fromConversion = Number(fromConfig.conversion);
  const toConversion = Number(toConfig.conversion);
  if (!Number.isFinite(fromConversion) || !Number.isFinite(toConversion) || toConversion === 0) return null;
  return value * fromConversion / toConversion;
}

export function movementInfo(actor, token, movementMode = "walk") {
  const movement = actor?.system?.attributes?.movement ?? {};
  const max = Number(movement?.[movementMode] ?? movement?.walk ?? 0);
  const actorUnits = movement.units ?? canvas?.scene?.grid?.units ?? null;
  const sceneUnits = canvas?.scene?.grid?.units ?? actorUnits;
  const sceneGridDistance = Number(canvas?.scene?.grid?.distance ?? canvas?.scene?.dimensions?.distance ?? 1) || 1;
  const history = token?.document?.movementHistory ?? [];
  const usedScene = history.reduce((sum, move) => sum + (Number(move?.cost) || 0), 0);
  const converted = convertLengthSafe(usedScene, sceneUnits, actorUnits);
  const used = converted ?? (sceneUnits === actorUnits ? usedScene : null);
  const remaining = used === null ? max : Math.max(0, max - used);
  const maxInSceneUnits = convertLengthSafe(max, actorUnits, sceneUnits) ?? max;

  return {
    max,
    used,
    remaining,
    actorUnits,
    sceneUnits,
    abbreviation: unitAbbreviation(actorUnits),
    maxSpaces: sceneGridDistance > 0 ? maxInSceneUnits / sceneGridDistance : 0,
    conversionKnown: used !== null
  };
}
