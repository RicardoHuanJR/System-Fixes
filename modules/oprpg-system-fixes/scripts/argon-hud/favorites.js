import { asArray } from "./model.js";
import { getItem } from "./execute.js";

function favoriteIds(actor, entry) {
  const item = getItem(actor, entry?.itemId);
  if (!item) return [];
  const ids = [item.getRelativeUUID?.(actor), item.uuid, item.id].filter(Boolean);
  return entry.activityId ? ids.map(id => `${id}.Activity.${entry.activityId}`) : ids;
}

export function isFavoriteEntry(actor, entry) {
  if (!entry?.itemId) return false;
  const ids = favoriteIds(actor, entry);
  const itemIds = favoriteIds(actor, {...entry, activityId:null});
  return asArray(actor.system?.favorites).some(favorite =>
    favorite.type === "activity" && ids.includes(favorite.id) || favorite.type === "item" && itemIds.includes(favorite.id));
}

export async function toggleFavoriteEntry(actor, entry) {
  if (!actor?.isOwner || !entry?.itemId) return false;
  const ids = favoriteIds(actor, entry);
  const itemIds = favoriteIds(actor, {...entry, activityId:null});
  if (!ids.length) return false;
  const existing = asArray(actor.system?.favorites).find(favorite =>
    favorite.type === "activity" && ids.includes(favorite.id) || favorite.type === "item" && itemIds.includes(favorite.id));
  if (existing) {
    if (typeof actor.system.removeFavorite !== "function") return false;
    await actor.system.removeFavorite(existing.id);
  } else {
    if (typeof actor.system.addFavorite !== "function") return false;
    await actor.system.addFavorite({type:entry.activityId ? "activity" : "item", id:ids[0]});
  }
  return true;
}
