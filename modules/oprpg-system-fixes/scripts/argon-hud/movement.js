/** Distances come from actor movement and Foundry V14's movement history. */
export function convertLength(value, from, to, units = globalThis.CONFIG?.DND5E?.movementUnits ?? {}) {
  if (!Number.isFinite(value)) return null;
  if (from === to) return value;
  const source = Number(units[from]?.conversion), target = Number(units[to]?.conversion);
  return source > 0 && target > 0 ? value * source / target : null;
}

export function movementInfo(actor, token, mode = "walk") {
  const movement = actor?.system?.attributes?.movement ?? {};
  const scene = globalThis.canvas?.scene;
  const actorUnits = movement.units;
  const sceneUnits = scene?.grid?.units;
  const max = Number(movement[mode] ?? 0);
  const gridDistance = Number(scene?.grid?.distance ?? scene?.dimensions?.distance);
  const history = token?.document?.movementHistory ?? [];
  const usedScene = history.reduce((sum, step) => sum + (Number(step.cost) || 0), 0);
  const used = convertLength(usedScene, sceneUnits, actorUnits);
  const sceneMax = convertLength(max, actorUnits, sceneUnits);
  return {max, used, remaining:used === null ? null : Math.max(0,max-used), actorUnits, sceneUnits,
    maxSpaces: sceneMax !== null && gridDistance > 0 ? sceneMax / gridDistance : 0,
    conversionKnown:used !== null && sceneMax !== null};
}
