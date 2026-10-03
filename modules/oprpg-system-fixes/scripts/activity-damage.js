export function normalizeDamageTypes(types) {
  if (types instanceof Set) return Array.from(types).map(String).filter(Boolean);
  if (Array.isArray(types)) return types.map(String).filter(Boolean);
  if (typeof types === "string") return types.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

export function damageTypeLabel(type) {
  const cfg = CONFIG?.DND5E?.damageTypes?.[type] ?? CONFIG?.DND5E?.healingTypes?.[type];
  const label = cfg?.label ?? type;
  try { return game?.i18n?.localize?.(label) ?? label; }
  catch (_) { return String(label ?? type ?? ""); }
}

export function sourceDamageParts(activity) {
  try { return Array.from(activity?.damage?.parts ?? []); }
  catch (_) { return []; }
}

export function manualPartFormula(part) {
  const bonus = String(part?.bonus ?? "").trim();
  const custom = String(part?.custom?.formula ?? "").trim();
  let base = "";
  if (part?.custom?.enabled && custom) base = `(${custom})`;
  else {
    const number = Number(part?.number ?? 0);
    const denomination = Number(part?.denomination ?? 0);
    if (!Number.isFinite(number) || number <= 0 || !Number.isFinite(denomination) || denomination <= 0) return bonus || null;
    base = `${number}d${denomination}`;
  }
  return bonus ? `${base} + (${bonus})` : base;
}

export function fallbackRollData(actor, activity) {
  const data = { ...(actor?.getRollData?.() ?? {}) };
  const ability = activity?.attack?.ability;
  if (ability && ability !== "none" && data?.abilities?.[ability]) data.mod = Number(data.abilities[ability].mod ?? data.mod ?? 0);
  return data;
}

/**
 * Return the Activity's current damage configuration through the system API when
 * possible. This is deliberately preferred over item.labels because the latter
 * is a shared cache and may describe the first Activity of an Item.
 */
export function activityDamageSpecs(activity, actor=null) {
  const parts = sourceDamageParts(activity);

  if (typeof activity?.getDamageConfig === "function") {
    try {
      const config = activity.getDamageConfig();
      const rolls = Array.from(config?.rolls ?? []);
      if (rolls.length) {
        const specs = rolls.map((entry, index) => {
          const terms = Array.from(entry?.parts ?? []);
          const data = entry?.data ?? fallbackRollData(actor, activity);
          const rawFormula = terms.join(" + ") || "0";
          const formula = new Roll(rawFormula, data).formula;
          const types = normalizeDamageTypes(entry?.options?.types ?? (entry?.options?.type ? [entry.options.type] : parts[index]?.types));
          return { formula, rawFormula, data, types, part: parts[index] ?? {}, options: entry?.options ?? {}, nativeConfig: true };
        });
        if (specs.every(s => !!s.formula)) return specs;
      }
    } catch (_) {
      // Fall back to the data model below. System APIs changed between dnd5e
      // releases, so failure here must not disable rolling altogether.
    }
  }

  const data = fallbackRollData(actor, activity);
  return parts.map(part => ({
    formula: manualPartFormula(part),
    rawFormula: manualPartFormula(part),
    data,
    types: normalizeDamageTypes(part?.types),
    part,
    options: {},
    nativeConfig: false
  })).filter(spec => !!spec.formula);
}

export function freshActivityDamageLabels(activity, actor=null) {
  return activityDamageSpecs(activity, actor).map(spec => {
    const labels = spec.types.map(damageTypeLabel);
    return {
      formula: spec.formula,
      label: [spec.formula, ...labels].filter(Boolean).join(" "),
      damageType: spec.types.length === 1 ? spec.types[0] : null,
      types: [...spec.types],
      spec
    };
  });
}
