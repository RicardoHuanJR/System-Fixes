import { activityById, asArray } from "./model.js";

const pending = new Set();

export function getItem(actor, itemId) {
  if (!actor || !itemId) return null;
  if (typeof actor.items?.get === "function") return actor.items.get(itemId) ?? null;
  return asArray(actor.items).find(i => i.id === itemId) ?? null;
}

export function isAvailable(actor, entry) {
  if (!actor?.isOwner || !entry) return false;
  const item = getItem(actor, entry.itemId);
  if (!item || (item.parent && item.parent !== actor)) return false;
  if (item.flags?.["oprpg-system"]?.hatsu && actor.sheet?._isHatsuItemBlocked?.(item)) return false;
  if (!entry.activityId) return typeof item.use === "function";
  const activity = activityById(item, entry.activityId);
  return Boolean(activity && typeof activity.use === "function" && activity.canUse !== false);
}

/**
 * The OP RPG native activity remains the only authority for consumption, saves,
 * damage, templates and special effects. Never manually spend PP or apply damage here.
 * Fails closed if a multiple-activity Item no longer exposes the selected activity.
 */
export async function executeEntry(actor, entry, {notify = () => {}} = {}) {
  if (!isAvailable(actor, entry)) return {ok:false, reason:"unavailable"};
  const item = getItem(actor, entry.itemId);
  const key = `${actor.uuid ?? actor.id}:${item.id}:${entry.activityId ?? "single"}`;
  if (pending.has(key)) return {ok:false, reason:"pending"};
  pending.add(key);
  try {
    if (entry.activityId) {
      const activity = activityById(item, entry.activityId);
      if (!activity || typeof activity.use !== "function") {
        notify("A atividade selecionada não oferece execução nativa. Abra a ficha do item.");
        return {ok:false, reason:"no-native-use"};
      }
      const result = await activity.use();
      if (!result) return {ok:false, reason:"cancelled"};
      return {ok:true, method:"activity.use", activityId:entry.activityId};
    }
    if (typeof item.use === "function") {
      const result = await item.use();
      if (!result) return {ok:false, reason:"cancelled"};
      return {ok:true, method:"item.use"};
    }
    return {ok:false, reason:"no-native-use"};
  } catch (error) {
    console.error("[System Fixes/Argon] Erro ao executar atividade", {itemId:entry.itemId, activityId:entry.activityId, error});
    notify(`Falha na execução de ${entry.label}. Consulte F12.`);
    return {ok:false, reason:"exception", error};
  } finally {
    pending.delete(key);
  }
}

export function diagnostics({system, core, fixes, hud} = {}) {
  return {
    adapter: `integrado-${fixes?.version ?? "unknown"}`, systemId: system?.id ?? null, systemVersion: system?.version ?? null,
    coreVersion: core?.version ?? null, coreActive: !!core?.active,
    fixesVersion: fixes?.version ?? null, fixesActive: !!fixes?.active,
    hudAvailable: !!hud, actorId: hud?.actor?.id ?? hud?._actor?.id ?? null,
    selectedToken: hud?.token?.id ?? hud?._token?.id ?? null
  };
}
