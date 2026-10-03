import { MODULE_ID, STATE } from "./shared.js";

const NEEDS_PERSIST = new WeakSet();
const PENDING_PERSIST = new Set();
const ORIGINAL_SOURCE = new WeakMap();
function backupFormulaBatch(items) {
  if(!items.length)return;
  if(typeof saveDataToFile!=="function")throw Error("Backup indisponível; reparo persistente adiado.");
  const data={format:"oprpg-formula-backup",createdAt:new Date().toISOString(),items:items.map(item=>({uuid:item.uuid,source:ORIGINAL_SOURCE.get(item)??item.toObject?.()??item._source}))};
  saveDataToFile(JSON.stringify(data,null,2),"application/json",`oprpg-formulas-${Date.now()}.json`);
}


const FORMULA_PATHS = [
  /^attack\.bonus$/,
  /^damage\.critical\.bonus$/,
  /^damage\.parts\.\d+\.(?:bonus|custom\.formula|scaling\.formula)$/,
  /^healing\.(?:bonus|custom\.formula|scaling\.formula)$/,
  /^consumption\.scaling\.max$/,
  /^consumption\.targets\.\d+\.(?:value|scaling\.formula)$/,
  /^jjScale\.formula$/,
  /^constantCost\.value$/,
  /^healLimit\.formula$/,
  /^duration\.value$/,
  /^range\.value$/,
  /^target\.(?:affects\.count|template\.(?:size|width|height))$/,
  /^uses\.max$/,
  /^uses\.recovery\.\d+\.formula$/,
  /^check\.dc\.formula$/,
  /^save\.dc\.formula$/,
  /^roll\.formula$/,
  /^reduction\.formula$/,
  /^transform\.cr$/,
  /^bonuses\.(?:ac|hd|hp|attackDamage|saveDamage|healing)$/,
  /^profiles\.\d+\.(?:count|cr)$/,
  /^tempHP$/
];

export function normalizeFormulaReferences(value) {
  if (typeof value !== "string" || !value) return value;
  return value.replace(
    /(^|[^@A-Za-z0-9_.])((?:abilities|attributes|details|skills|bonuses|resources|spells|classes|scale)\.[A-Za-z0-9_.-]+)/g,
    "$1@$2"
  );
}

function isFormulaPath(path) {
  return FORMULA_PATHS.some(re => re.test(path));
}

function visitActivity(node, path="") {
  if (!node || typeof node !== "object") return false;
  let changed = false;
  for (const [key, value] of Object.entries(node)) {
    const child = path ? `${path}.${key}` : key;
    if (typeof value === "string") {
      if (!isFormulaPath(child)) continue;
      const normalized = normalizeFormulaReferences(value);
      if (normalized !== value) {
        node[key] = normalized;
        changed = true;
      }
    } else if (value && typeof value === "object") {
      if (visitActivity(value, child)) changed = true;
    }
  }
  return changed;
}

export function normalizeActivities(activities) {
  if (!activities || typeof activities !== "object") return false;
  let changed = false;
  const iterable = activities instanceof Map ? activities.values() : Object.values(activities);
  for (const activity of iterable) if (visitActivity(activity)) changed = true;
  return changed;
}

function normalizeFlattenedUpdate(update) {
  if (!update || typeof update !== "object") return false;
  let changed = false;
  for (const [key, value] of Object.entries(update)) {
    if (key === "system.activities" && value && typeof value === "object") {
      if (normalizeActivities(value)) changed = true;
      continue;
    }
    const m = key.match(/^system\.activities\.[^.]+\.(.+)$/);
    if (m && typeof value === "string" && isFormulaPath(m[1])) {
      const n = normalizeFormulaReferences(value);
      if (n !== value) { update[key] = n; changed = true; }
      continue;
    }
    if (key === "system" && value?.activities && normalizeActivities(value.activities)) changed = true;
  }
  return changed;
}

export function installFormulaPatches() {
  const ItemClass = CONFIG.Item?.documentClass;
  if (!ItemClass?.prototype) {
    STATE.warnings.push("CONFIG.Item.documentClass indisponível no init.");
    return false;
  }
  if (ItemClass.prototype.__oprpgFixesFormulaPatch) return true;

  const originalInitialize = ItemClass.prototype._initializeSource;
  if (typeof originalInitialize === "function") {
    ItemClass.prototype._initializeSource = function(data, options={}) {
      if (data instanceof foundry.abstract.DataModel) data = data.toObject();
      const originalActivities=foundry.utils.deepClone(data?.system?.activities);
      if (normalizeActivities(data?.system?.activities)) {
        if(!ORIGINAL_SOURCE.has(this)){const originalSource=foundry.utils.deepClone(data);originalSource.system.activities=originalActivities;ORIGINAL_SOURCE.set(this,originalSource);}
        NEEDS_PERSIST.add(this);
        // Startup migration queue only. Documents loaded later still receive the
        // in-memory normalization, but are not retained strongly for the rest of
        // the session. Their next normal update is normalized by the update patch.
        if (!globalThis.game?.ready) PENDING_PERSIST.add(this);
      }
      return originalInitialize.call(this, data, options);
    };
  }

  const originalCreateActivity = ItemClass.prototype.createActivity;
  if (typeof originalCreateActivity === "function") {
    ItemClass.prototype.createActivity = function(type, data={}, options={}) {
      const copy = foundry.utils.deepClone(data ?? {});
      visitActivity(copy);
      return originalCreateActivity.call(this, type, copy, options);
    };
  }

  const originalUpdateActivity = ItemClass.prototype.updateActivity;
  if (typeof originalUpdateActivity === "function") {
    ItemClass.prototype.updateActivity = function(id, updates={}, ...options) {
      const copy = foundry.utils.deepClone(updates ?? {});
      visitActivity(copy);
      return originalUpdateActivity.call(this, id, copy, ...options);
    };
  }

  const originalUpdate = ItemClass.prototype.update;
  if (typeof originalUpdate === "function") {
    ItemClass.prototype.update = function(data={}, options={}) {
      const copy = foundry.utils.deepClone(data ?? {});
      normalizeFlattenedUpdate(copy);
      return originalUpdate.call(this, copy, options);
    };
  }

  Object.defineProperty(ItemClass.prototype, "__oprpgFixesFormulaPatch", { value: true });
  STATE.itemPatch = true;
  return true;
}

async function persistItem(item) {
  if (!item || !NEEDS_PERSIST.has(item)) { PENDING_PERSIST.delete(item); return false; }
  // The old implementation rescanned every world Actor/Item on each startup.
  // _initializeSource already tells us exactly which loaded Items needed a repair,
  // so only persist those pending documents. Compendium Items remain opt-in via
  // repairCompendium(), matching the previous behavior.
  if (item.pack) { PENDING_PERSIST.delete(item); return false; }
  const raw = foundry.utils.deepClone(item._source?.system?.activities ?? {});
  if (!raw || typeof raw !== "object") return false;
  try {
    await item.update({ "system.activities": raw }, { diff: false, recursive: false, render: false });
    NEEDS_PERSIST.delete(item);
    PENDING_PERSIST.delete(item);
    return true;
  } catch (error) {
    console.error(`${MODULE_ID} | Falha ao persistir fórmula corrigida em ${item.uuid}`, error);
    return false;
  }
}

export async function persistWorldFormulaRepairs() {
  if (!game.user?.isGM) return 0;
  let count = 0;
  const pending = Array.from(PENDING_PERSIST).filter(item=>!item.pack);
  backupFormulaBatch(pending);
  for (const item of pending) if (await persistItem(item)) count++;
  PENDING_PERSIST.clear();
  STATE.formulaPersisted += count;
  if (count) {
    ui.notifications.info(game.i18n.format("OPRPGFIXES.FormulaMigration", { count }));
  }
  return count;
}

export async function repairLoadedCompendium(pack) {
  if (!game.user?.isGM || !pack || pack.documentName !== "Item") return { scanned: 0, repaired: 0 };
  const docs = await pack.getDocuments();
  if(pack.locked)throw Error("Desbloqueie o compêndio antes de repará-lo.");
  const pending=docs.filter(item=>NEEDS_PERSIST.has(item)||normalizeActivities(foundry.utils.deepClone(item._source?.system?.activities??{})));
  backupFormulaBatch(pending);
  let repaired = 0;
  for (const item of pending) {
    const raw = foundry.utils.deepClone(item._source?.system?.activities ?? {});
    const changed = normalizeActivities(raw);
    if (!changed && !NEEDS_PERSIST.has(item)) continue;
    await item.update({ "system.activities": raw }, { diff: false, recursive: false, render: false });
    NEEDS_PERSIST.delete(item);
    repaired++;
  }
  return { scanned: docs.length, repaired };
}
