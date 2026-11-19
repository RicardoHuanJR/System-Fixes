import { asArray } from "./model.js";
import { getItem } from "./execute.js";

export function weaponsForActor(actor) {
  return asArray(actor?.items).filter(item => item?.type === "weapon" && item.parent === actor);
}

/** Reuse CORE flags without changing equipped state or accepting another actor's UUID. */
export function weaponSetsForActor(actor) {
  const weapons = weaponsForActor(actor);
  const equipped = weapons.filter(item => item.system?.equipped);
  const saved = actor?.getFlag?.("enhancedcombathud", "weaponSets") ?? {};
  const active = String(actor?.getFlag?.("enhancedcombathud", "activeWeaponSet") ?? "1");
  const resolve = uuid => uuid ? weapons.find(item => item.uuid === uuid || item.getRelativeUUID?.(actor) === uuid) ?? null : null;
  return {active:["1","2","3"].includes(active) ? active : "1", sets:["1","2","3"].map(id => ({id,
    primary:Object.hasOwn(saved[id] ?? {}, "primary") ? resolve(saved[id].primary) : id === "1" ? equipped[0] ?? null : null,
    secondary:Object.hasOwn(saved[id] ?? {}, "secondary") ? resolve(saved[id].secondary) : id === "1" ? equipped[1] ?? null : null
  }))};
}

export async function setWeaponSlot(actor, set, slot, itemId) {
  if (!actor?.isOwner || !["1","2","3"].includes(set) || !["primary","secondary"].includes(slot)) return false;
  const item = itemId ? getItem(actor, itemId) : null;
  if (itemId && (!item || item.type !== "weapon" || item.parent !== actor || !item.uuid)) return false;
  await actor.update({[`flags.enhancedcombathud.weaponSets.${set}.${slot}`]:item?.uuid ?? null});
  return true;
}

export async function selectWeaponSet(actor, set) {
  if (!actor?.isOwner || !["1","2","3"].includes(set)) return false;
  await actor.setFlag("enhancedcombathud", "activeWeaponSet", set);
  return true;
}
