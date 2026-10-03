export const ID = "oprpg-system-fixes";

const number = (value, min, max, fallback = min) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
};

export const AUTOMATION_KEYS = [
  "hitTechniqueMelee", "hitTechniqueRanged", "hitCommonMelee", "hitCommonRanged",
  "comboDice", "techniqueDice", "flatDamage",
  "comboDiceAttack", "techniqueDiceAttack", "flatDamageAttack",
  "comboDiceSave", "techniqueDiceSave", "flatDamageSave",
  "commonDiceMelee", "commonDiceRanged", "commonFlatMelee", "commonFlatRanged", "maxPa"
];

const LEGACY_DAMAGE_KEYS = {
  comboDiceAttack: "comboDice", techniqueDiceAttack: "techniqueDice", flatDamageAttack: "flatDamage",
  comboDiceSave: "comboDice", techniqueDiceSave: "techniqueDice", flatDamageSave: "flatDamage"
};
const DEGREE_KEYS = ["techniqueDiceAttack", "techniqueDiceSave"];
const validDiceMode = mode => ["fixed", "degree", "half"].includes(mode) ? mode : "fixed";

const FORMULA_FUNCTIONS = new Set(["floor", "ceil", "round", "min", "max", "abs"]);
const cleanFormula = value => typeof value === "string" ? value.trim().slice(0, 120) : "";

/** Resolve only deterministic Foundry Roll formulas; never run sheet-provided JavaScript. */
export function formulaResult(actor, input, data = null) {
  const formula = cleanFormula(input);
  if (!formula) return {value: 0, error: null};
  if (String(input).trim().length > 120 || !/^[\w@.\s+\-*/%(),]+$/.test(formula)) {
    return {value: 0, error: "Use apenas números, referências @ da ficha e operações matemáticas."};
  }
  const refs = [...formula.matchAll(/@([a-zA-Z_][\w.]*)/g)].map(match => match[1]);
  const bare = formula.replace(/@[a-zA-Z_][\w.]*/g, "").match(/[a-zA-Z_]\w*/g) ?? [];
  if (bare.some(name => !FORMULA_FUNCTIONS.has(name.toLowerCase()))) {
    return {value: 0, error: "A fórmula aceita floor, ceil, round, min, max e abs, mas não dados ou código."};
  }
  try {
    const rollData = data ?? actor?.getRollData?.({deterministic: true}) ?? {};
    if (actor) for (const ref of refs) {
      const found = ref.split(".").reduce((value, key) => value?.[key], rollData);
      if (found == null || !Number.isFinite(Number(found))) {
        return {value: 0, error: `A ficha não tem um valor numérico para @${ref}.`};
      }
    }
    const roll = new Roll(formula, rollData);
    if (!roll.isDeterministic) return {value: 0, error: "Use uma fórmula sem dados aleatórios."};
    const value = Number(roll.evaluateSync().total);
    if (!Number.isFinite(value) || Math.abs(value) > 10000) {
      return {value: 0, error: "A fórmula precisa resultar em um número entre -10000 e 10000."};
    }
    return {value: Math.trunc(value), error: null};
  } catch (_error) {
    return {value: 0, error: "Não foi possível calcular a fórmula. Confira a escrita e os atributos."};
  }
}

export function cleanConfig(input = {}) {
  const legacyHit = input.hit === true;
  const value = number(input.value, 0, 100, 0);
  const fixedDice = number(input.fixedDice, 0, 100, 0);
  const values = Object.fromEntries(AUTOMATION_KEYS.map(key => [key,
    number(input.values?.[key] ?? input.values?.[LEGACY_DAMAGE_KEYS[key]]
      ?? (["techniqueDice", ...DEGREE_KEYS].includes(key) ? fixedDice : value),
    0, 100, ["techniqueDice", ...DEGREE_KEYS].includes(key) ? fixedDice : value)
  ]));
  const formulas = Object.fromEntries(AUTOMATION_KEYS.map(key => [key,
    cleanFormula(input.formulas?.[key] ?? input.formulas?.[LEGACY_DAMAGE_KEYS[key]])
  ]));
  const diceMode = validDiceMode(input.diceMode);
  const diceModes = Object.fromEntries(DEGREE_KEYS.map(key => [key,
    validDiceMode(input.diceModes?.[key] ?? diceMode)
  ]));
  return {
    value,
    values,
    formulas,
    stackable: input.stackable !== false,
    bulkEnabled: input.bulkEnabled === true,
    bulkMode: input.bulkMode === "uses" ? "uses" : "fixed",
    bulkValue: number(input.bulkValue, 0, 100, 0),
    bulkFormula: cleanFormula(input.bulkFormula),
    bulkItemId: typeof input.bulkItemId === "string" ? input.bulkItemId.slice(0, 128) : "",
    hit: legacyHit,
    hitTechniqueMelee: input.hitTechniqueMelee === true || legacyHit,
    hitTechniqueRanged: input.hitTechniqueRanged === true || legacyHit,
    hitCommonMelee: input.hitCommonMelee === true,
    hitCommonRanged: input.hitCommonRanged === true,
    comboDice: input.comboDice === true,
    flatDamage: input.flatDamage === true,
    techniqueDice: input.techniqueDice === true,
    comboDiceAttack: input.comboDiceAttack === true
      || (input.comboDiceAttack === undefined && input.comboDice === true),
    techniqueDiceAttack: input.techniqueDiceAttack === true
      || (input.techniqueDiceAttack === undefined && input.techniqueDice === true),
    flatDamageAttack: input.flatDamageAttack === true
      || (input.flatDamageAttack === undefined && input.flatDamage === true),
    comboDiceSave: input.comboDiceSave === true
      || (input.comboDiceSave === undefined && input.comboDice === true),
    techniqueDiceSave: input.techniqueDiceSave === true
      || (input.techniqueDiceSave === undefined && input.techniqueDice === true),
    flatDamageSave: input.flatDamageSave === true
      || (input.flatDamageSave === undefined && input.flatDamage === true),
    commonDiceMelee: input.commonDiceMelee === true,
    commonDiceRanged: input.commonDiceRanged === true,
    commonFlatMelee: input.commonFlatMelee === true,
    commonFlatRanged: input.commonFlatRanged === true,
    diceMode,
    diceModes,
    fixedDice,
    maxPa: input.maxPa === true,
    maxPaMultiplier: number(input.maxPaMultiplier, 0, 100, 1)
  };
}

export function isActive(effect) {
  if (!effect || effect.disabled || effect.isSuppressed
      || effect.duration?.expired === true) return false;
  return true;
}

export function applicableEffects(actor) {
  if (!actor) return [];
  // Read owned documents first: the prepared cache may omit flag-only effects.
  const sources = [actor.effects];
  for (const item of actor.items?.contents ?? actor.items ?? []) {
    sources.push(Array.from(item.effects?.contents ?? item.effects ?? []).filter(effect => effect.transfer));
  }
  // Include any temporary/externally-applied effects, but never depend on
  // these prepared Foundry accessors during the Actor's preparation phase.
  try { if (actor.allApplicableEffects) sources.push(Array.from(actor.allApplicableEffects())); }
  catch (_error) { /* Owned effects above remain available. */ }
  try { sources.push(actor.appliedEffects); }
  catch (_error) { /* The prepared cache may not exist yet. */ }
  const seen = new Set();
  const result = [];
  for (const source of sources) for (const effect of source ?? []) {
    const key = effect.uuid ?? effect;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(effect);
  }
  return result;
}

export function activeConfigs(actor) {
  if (!actor) return [];
  let rollData;
  return applicableEffects(actor).filter(isActive).map(effect => {
    const stored = effect.flags?.[ID]?.automationConfig ?? effect.flags?.["oprpg-automacoes-efeitos"]?.config;
    if (!stored || typeof stored !== "object") return null;
    const config = cleanConfig(stored);
    if (config.bulkFormula || Object.values(config.formulas).some(Boolean)) {
      rollData ??= actor.getRollData?.({deterministic: true}) ?? {};
    }
    const resolved = Object.fromEntries(AUTOMATION_KEYS.map(key => [key,
      formulaResult(actor, config.formulas[key], rollData).value
    ]));
    const bulk = bulkAmount(actor, effect, config)
      + (config.bulkEnabled ? formulaResult(actor, config.bulkFormula, rollData).value : 0);
    return {...config, resolved, bulk};
  }).filter(Boolean);
}

export function bulkAmount(actor, effect, config) {
  if (!config.bulkEnabled) return 0;
  if (config.bulkMode !== "uses") return config.bulkValue;
  const source = config.bulkItemId
    ? actor?.items?.get?.(config.bulkItemId)
    : effect?.parent?.documentName === "Item" ? effect.parent : null;
  const uses = source?.system?.uses;
  if (!uses || !source?.hasLimitedUses && !Number(uses.max)) return 0;
  const remaining = uses.value == null ? NaN : Number(uses.value);
  if (Number.isFinite(remaining)) return number(remaining, 0, 100, 0);
  return number(Number(uses.max) - Number(uses.spent), 0, 100, 0);
}

const valueFor = (config, key) => config.values[key] + (config.resolved?.[key] ?? 0) + (config.bulk ?? 0);

function totalFor(contributions) {
  if (contributions.some(({stackable}) => !stackable)) {
    return Math.max(0, ...contributions.map(({value}) => value));
  }
  return contributions.reduce((sum, {value}) => sum + value, 0);
}

export function paMaxBonus(actor) {
  return totalFor(activeConfigs(actor).filter(c => c.maxPa).map(c => ({
    value: Math.max(0, valueFor(c, "maxPa")) * c.maxPaMultiplier, stackable: c.stackable
  })));
}

export function firstDie(activity) {
  const part = Array.from(activity?.damage?.parts ?? [])[0];
  if (!part) return null;
  let faces;
  if (part.custom?.enabled) {
    faces = Number(String(part.custom.formula ?? "").match(/\b\d*d(\d+)\b/i)?.[1]);
  } else if (Number(part.number) > 0) {
    faces = Number(part.denomination);
  }
  return Number.isInteger(faces) && faces >= 2 && faces <= 100 ? faces : null;
}

export function bonuses(actor, activity) {
  const item = activity?.item;
  if (!item || !["attack", "save", "damage"].includes(activity?.type)) return null;
  const technique = item.type === "spell";
  if (!technique && activity.type !== "attack") return null;
  const ranged = activity.attack?.type?.value === "ranged"
    || (activity.attack?.type?.value == null && /^r/.test(activity.actionType ?? item.system?.actionType ?? ""));
  const degree = Number(item.system?.level);
  const faces = firstDie(activity);
  const hits = [], diceBonuses = [], flatBonuses = [];
  for (const c of activeConfigs(actor)) {
    let hitValue = 0, diceValue = 0, flatValue = 0;
    if (activity.type === "attack") {
      const hitKey = technique
        ? (ranged ? "hitTechniqueRanged" : "hitTechniqueMelee")
        : (ranged ? "hitCommonRanged" : "hitCommonMelee");
      if (c[hitKey]) hitValue += valueFor(c, hitKey);
    }
    if (technique) {
      const channel = activity.type === "save" ? "Save" : "Attack";
      const flatKey = `flatDamage${channel}`;
      const diceKey = `comboDice${channel}`;
      const degreeKey = `techniqueDice${channel}`;
      if (c[flatKey]) flatValue += valueFor(c, flatKey);
      if (c[diceKey]) diceValue += valueFor(c, diceKey);
      if (c[degreeKey] && Number.isInteger(degree) && degree >= 1 && degree <= 7) {
        const mode = c.diceModes[degreeKey];
        diceValue += (mode === "degree" ? degree
          : mode === "half" ? Math.floor(degree / 2) : c.values[degreeKey])
          + (c.resolved?.[degreeKey] ?? 0) + c.bulk;
      }
    } else {
      const flatKey = ranged ? "commonFlatRanged" : "commonFlatMelee";
      const diceKey = ranged ? "commonDiceRanged" : "commonDiceMelee";
      if (c[flatKey]) flatValue += valueFor(c, flatKey);
      if (c[diceKey]) diceValue += valueFor(c, diceKey);
    }
    if (hitValue) hits.push({value: hitValue, stackable: c.stackable});
    if (diceValue) diceBonuses.push({value: diceValue, stackable: c.stackable});
    if (flatValue) flatBonuses.push({value: flatValue, stackable: c.stackable});
  }
  let hit = Math.max(0, totalFor(hits));
  let dice = Math.max(0, totalFor(diceBonuses));
  let flat = Math.max(0, totalFor(flatBonuses));
  // An unrecognizable damage die cannot safely receive additional dice.
  if (!faces) dice = 0;
  hit = Math.min(hit, 500);
  dice = Math.min(dice, 500);
  flat = Math.min(flat, 500);
  return {hit, dice, flat, faces, damageFormula: [dice && `${dice}d${faces}`, flat && String(flat)].filter(Boolean).join(" + ")};
}
