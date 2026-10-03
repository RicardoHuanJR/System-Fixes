// Foundry rejects getFlag against an inactive module. Read legacy data directly
// and write all integrated automation state into the active Fixes namespace.
import { MODULE_ID } from './shared.js';
export const HAKI_SCOPE = MODULE_ID;
export const LEGACY_HAKI_SCOPE = 'oprpg-haki-automations';
export function readHakiFlag(document, key) {
  const current = document?.getFlag?.(HAKI_SCOPE, key);
  const legacy=foundry.utils.getProperty(document.flags?.[LEGACY_HAKI_SCOPE], key);
  if(current && legacy && typeof current==='object' && typeof legacy==='object' && !Array.isArray(current))return {...legacy,...current};
  return current === undefined ? legacy : current;
}
export async function migrateHakiFlags(actor) {
  if (!actor.isOwner) return;
  const updates = {};
  for (const key of ['uses','videnteResults','anteSession','presenceActive']) {
    const legacy = actor.flags?.[LEGACY_HAKI_SCOPE]?.[key];
    if (legacy === undefined) continue;
    const visit = (value, path) => {
      if(value && typeof value === 'object' && !Array.isArray(value)) {
        for(const [k,v] of Object.entries(value)) visit(v,path+'.'+k);
      } else if(actor.getFlag(HAKI_SCOPE,path) === undefined) updates[`flags.${HAKI_SCOPE}.${path}`] = foundry.utils.deepClone(value);
    };
    visit(legacy,key);
  }
  if(Object.keys(updates).length) await actor.update(updates);
}
export const SYSTEM = "oprpg-system";
export const level = (actor, id) => Math.max(0, Math.min(3,
  Number(actor.getFlag(SYSTEM, "haki")?.talentos?.[id]) || 0));

export const RESOURCES = [
  {id: "corpo-armadurado", name: "Corpo Armadurado", scope: SYSTEM, key: "corpoArmaduradoUsado", boolean: true, max: () => 1},
  {id: "ver-o-futuro", name: "Ver o Futuro", scope: SYSTEM, key: "verOFuturoUsos", max: () => 3},
  {id: "emissao-defensiva", name: "Emissão Defensiva", scope: SYSTEM, key: "emissaoDefensivaUsos", max: () => 1, shortAt: 2},
  {id: "antevisao-profetica", name: "Antevisão Profética", scope: SYSTEM, key: "antevisaoProfeticaUsos", max: l => l >= 3 ? 5 : l >= 2 ? 3 : 1, shortAt: 3},
  {id: "previsao-profetica", name: "Previsão Profética", scope: SYSTEM, key: "previsaoProfeticaUsos", max: l => l >= 3 ? 5 : l >= 2 ? 3 : 1, shortAt: 3},
  {id: "clarividencia", button: "clarividencia-sem-pp", name: "Clarividência — não gastar PP", scope: HAKI_SCOPE, key: "uses.clarividencia", min: 2, max: () => 3},
  {id: "impeto-antecipado", name: "Ímpeto Antecipado", scope: HAKI_SCOPE, key: "uses.impeto", max: l => l >= 2 ? Infinity : 3},
  {id: "presenca-esmagadora", button: "presenca-esmagadora-dados", name: "Presença Esmagadora — dados extras", scope: HAKI_SCOPE, key: "uses.presenca", min: 3, max: () => 1},
  {id: "vidente", name: "Vidente — guardar d20", scope: HAKI_SCOPE, key: "uses.vidente", max: l => l >= 2 ? 2 : 1}
];
export const MAJESTY = {id: "superacao-majestosa", name: "Superação Majestosa", scope: HAKI_SCOPE,
  key: "uses.superacao", max: l => l >= 2 ? 2 : 1};

export function resourceState(actor, spec) {
  const rank = level(actor, spec.id);
  if (rank < (spec.min ?? 1)) return null;
  const max = spec.max(rank);
  if (!Number.isFinite(max)) return null;
  const raw = spec.scope === HAKI_SCOPE ? readHakiFlag(actor, spec.key) : actor.getFlag(spec.scope, spec.key);
  const rem = spec.boolean ? (raw ? 0 : 1) : raw == null ? max : Math.max(0, Math.min(max, Number(raw) || 0));
  return {spec, max, rem, rank};
}
export function remainingUpdate(spec, remaining) {
  return {[`flags.${spec.scope}.${spec.key}`]: spec.boolean ? remaining <= 0 : remaining};
}
export function damageDie(actor) {
  const rank = level(actor, "endurecimento-ofensivo");
  if (!rank || !actor.getFlag(SYSTEM, "enduOfensivoAtivo")) return null;
  const boosted = level(actor, "corpo-armadurado") >= 3 && actor.getFlag(SYSTEM, "corpoArmaduradoAtivo");
  return (boosted ? ["", "1d4", "1d6", "1d8"] : ["", "1", "1d4", "1d6"])[rank];
}
export function resetUpdates(actor, short) {
  const result = {};
  for (const spec of [...RESOURCES, MAJESTY]) {
    const state = resourceState(actor, spec);
    if (!state || (short && !(spec.shortAt && state.rank >= spec.shortAt))) continue;
    if (state.rem < state.max) Object.assign(result, remainingUpdate(spec, state.max));
  }
  if (!short) {
    result[`flags.${HAKI_SCOPE}.videnteResults`] = [];
    result[`flags.${SYSTEM}.corpoArmaduradoAtivo`] = false;
  }
  return result;
}
export function hpLoss(oldValue, newValue) {
  if (newValue == null || oldValue == null) return 0;
  const before = Number(oldValue), after = Number(newValue);
  return Number.isFinite(before) && Number.isFinite(after) ? Math.max(0, before - after) : 0;
}
