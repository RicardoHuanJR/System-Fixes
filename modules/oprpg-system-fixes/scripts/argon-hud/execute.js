import { activityById, asArray } from "./model.js";

const pending = new Set();
const pendingKey = (actor, entry) => `${actor?.uuid ?? actor?.id}:${entry?.itemId}`;

export function isEntryPending(actor, entry) { return pending.has(pendingKey(actor,entry)); }

export function getItem(actor, itemId) {
  if (!actor || !itemId) return null;
  if (typeof actor.items?.get === "function") return actor.items.get(itemId) ?? null;
  return asArray(actor.items).find(i => i.id === itemId) ?? null;
}

export function unavailableReason(actor, entry) {
  if (!actor?.isOwner) return "Sem permissão para usar esta ficha.";
  if (!entry) return "Atividade não encontrada.";
  const item = getItem(actor, entry.itemId);
  if (!item || (item.parent && item.parent !== actor)) return "O item não pertence mais a esta ficha.";
  try {
    const blocked = item.flags?.["oprpg-system"]?.hatsu && actor.sheet?._isHatsuItemBlocked?.(item);
    if (blocked) return String(blocked);
    if (!entry.activityId) return typeof item.use === "function" ? null : "Abra a ficha para consultar este item.";
    const activity = activityById(item, entry.activityId);
    if (!activity) return "A atividade foi removida. Abra a ficha do item.";
    if (typeof activity.use !== "function") return "A atividade não oferece execução nativa. Abra a ficha do item.";
    if (activity.canUse === false) return "Atividade indisponível no sistema. Abra a ficha para conferir os requisitos.";
    return null;
  } catch (_) { return "Não foi possível consultar a atividade. Abra a ficha do item."; }
}

export function isAvailable(actor, entry) { return unavailableReason(actor, entry) === null; }

/**
 * The OP RPG native activity remains the only authority for consumption, saves,
 * damage, templates and special effects. Never manually spend PP or apply damage here.
 * Fails closed if a multiple-activity Item no longer exposes the selected activity.
 */
export async function executeEntry(actor, entry, {notify = () => {}, usageConfig, messageConfig} = {}) {
  if (!isAvailable(actor, entry)) return {ok:false, reason:"unavailable"};
  const item = getItem(actor, entry.itemId);
  // Activities of one item can share uses and PP; allow only one native usage dialog at a time.
  const key = pendingKey(actor,entry);
  if (pending.has(key)) return {ok:false, reason:"pending"};
  pending.add(key);
  try {
    if (entry.activityId) {
      const activity = activityById(item, entry.activityId);
      if (!activity || typeof activity.use !== "function") {
        notify("A atividade selecionada não oferece execução nativa. Abra a ficha do item.");
        return {ok:false, reason:"no-native-use"};
      }
      const result = usageConfig ? await activity.use(usageConfig, {}, messageConfig ?? {}) : await activity.use();
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
