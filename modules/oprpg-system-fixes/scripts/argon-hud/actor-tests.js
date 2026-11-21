import { finiteValue } from "./model.js";

/** Prepared values and native skill associations only; never roll to draw the HUD. */
export function actorAbilities(actor, config = {}, localize = value => value) {
  return Object.entries(actor?.system?.abilities ?? {}).filter(([,data]) => data && typeof data === "object").map(([key,data]) => {
    const definition = config.abilities?.[key];
    const label = localize(definition?.label ?? key);
    return {key, label, short:localize(definition?.abbreviation ?? key).toLocaleUpperCase(), value:finiteValue(data.value), mod:finiteValue(data.mod)};
  });
}

export function relatedSkills(actor, ability, config = {}) {
  return Object.entries(actor?.system?.skills ?? {}).filter(([key,data]) => (data?.ability ?? config.skills?.[key]?.ability) === ability).map(([key]) => key);
}

/** Display prepared numeric bonuses; a base modifier is explicitly identified. */
export function rollBonusLabel(actor,kind,key) {
  const ability=actor?.system?.abilities?.[key];
  const prepared=kind==="skill"?actor?.system?.skills?.[key]?.total:kind==="save"?ability?.save?.value:ability?.check?.value;
  const value=finiteValue(prepared), mod=kind==="check"?finiteValue(ability?.mod):null;
  const number=value ?? mod;
  return number===null?"":(value===null?"Mod. ":"")+(number>=0?"+":"")+number;
}
