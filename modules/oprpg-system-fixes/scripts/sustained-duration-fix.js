import { STATE, canAct } from "./shared.js";
import { replacementAutoHeal } from "./healing-fix.js";
import { queueActor, registerActorTimer } from './automation-runtime.js';

const SCOPE = "oprpg-system", FLAG = "upkeep", CLOCK = "oprpgFixesDuration";
const permanent = new Set(["perm", "disp", "dstr"]);
const seconds = {second:1, minute:60, hour:3600, day:86400, week:604800, month:2592000, year:31536000};
let installed = false;
const worldTime = () => Number(game.time?.worldTime ?? 0);
const entries = actor => actor.getFlag?.(SCOPE, FLAG) ?? {};
const activityFor = (actor,id,info) => actor.items?.get(info?.itemId)?.system?.activities?.get(id);
const pathFor = id => `flags.${SCOPE}.${FLAG}.${id}`;
const removePath = id => `flags.${SCOPE}.${FLAG}.-=${id}`;

export function sustainedDuration(activity) {
  // Prepared activity duration already incorporates item inheritance. An explicit
  // instantaneous override must not fall back to the item's permanent duration.
  const duration = activity?.duration?.units ? activity.duration : activity?.item?.system?.duration ?? {};
  const units = duration.units ?? "inst";
  const value = Number(duration.value);
  return {units, value:Number.isFinite(value) && value > 0 ? value : null};
}

function upkeepCost(activity) {
  const cost = activity?.getConstantUpkeep?.();
  if (cost?.active) return {...cost, value:Math.max(0, Number(cost.value) || 0)};
  const {units} = sustainedDuration(activity);
  return {active:!!activity && units !== "inst", value:0, pool:"generated", type:"duration"};
}

function combatFor(actor) {
  if(!actor)return null;
  return Array.from(game.combats ?? []).find(c=>c.started && Array.from(c.combatants ?? []).some(x=>x.actor?.uuid === actor.uuid));
}

export function durationClock(activity, combat=undefined) {
  combat ??= combatFor(activity?.item?.actor);
  return {...sustainedDuration(activity), startTime:worldTime(), combatId:combat?.id ?? null,
    round:Number(combat?.round ?? 0), turn:Number(combat?.turn ?? 0), turnCount:Math.max(1,combat?.turns?.length ?? combat?.combatants?.size ?? 1)};
}

export function durationExpired(clock, combat=null) {
  if (!clock || permanent.has(clock.units) || clock.units === "spec" || !clock.value) return false;
  if (["round","turn"].includes(clock.units)) {
    if (combat?.id === clock.combatId && combat.started) {
      const elapsed = (Number(combat.round)-clock.round)*clock.turnCount + Number(combat.turn)-clock.turn;
      return elapsed >= clock.value*(clock.units === "round" ? clock.turnCount : 1);
    }
    return worldTime()-clock.startTime >= clock.value*(Number(CONFIG.time?.roundTime) || 6);
  }
  return seconds[clock.units] ? worldTime()-clock.startTime >= clock.value*seconds[clock.units] : false;
}

function enqueue(actor, task) {
  return queueActor(actor,task);
}

export function stampActivation(actor, changes) {
  const nested = foundry.utils.getProperty(changes,`flags.${SCOPE}.${FLAG}`) ?? changes[`flags.${SCOPE}.${FLAG}`];
  const candidates = new Map(Object.entries(nested ?? {}).filter(([id])=>!id.startsWith("-=")));
  for (const [key,value] of Object.entries(changes)) {
    const prefix=`flags.${SCOPE}.${FLAG}.`;
    if(key.startsWith(prefix) && !key.slice(prefix.length).includes(".") && !key.slice(prefix.length).startsWith("-=")) candidates.set(key.slice(prefix.length),value);
  }
  for(const [id,info] of candidates) {
    if(!info || typeof info!=="object" || info[CLOCK])continue;
    const activity=activityFor(actor,id,info);
    if(activity)info[CLOCK]=entries(actor)[id]?.[CLOCK] ?? durationClock(activity);
  }
}

async function processActor(actor,{combat=null,turnKey=null,heal=false,end=false}={}) {
  if(!actor || !canAct(actor))return;
  return enqueue(actor,async()=>{
    for(const [id,initial] of Object.entries(entries(actor))) {
      let info=entries(actor)[id];
      if(!info || info.itemId!==initial.itemId)continue;
      const activity=activityFor(actor,id,info);
      const cost=upkeepCost(activity);
      const clock=info[CLOCK] ?? durationClock(activity,combat);
      // End of combat is not dispelling: permanent and real-time durations
      // survive, but turn/round durations and cost-only instant techniques end.
      const ended=end && (["round","turn"].includes(clock.units) || clock.units === "inst");
      if(!activity || !cost.active || ended || durationExpired(clock,combat)) {
        await actor.update({[removePath(id)]:null});
        continue;
      }
      if(!info[CLOCK]) {
        await actor.update({[pathFor(id)+'.'+CLOCK]:clock});
        info=entries(actor)[id];
      }
      const processed=info?.oprpgFixesProcessedTurns ?? [];
      if(!heal || !turnKey || info?.oprpgFixesLastTurn===turnKey || processed.includes(turnKey))continue;
      const field=cost.pool === "total" ? "total" : "generated";
      const available=Math.max(0,Number(actor.system.energy?.[field]) || 0);
      if(available<cost.value) {
        await actor.update({[removePath(id)]:null});
        ui.notifications?.warn?.(`${activity.item.name}: técnica desativada por falta de energia para manutenção.`);
        continue;
      }
      const update={[pathFor(id)+'.oprpgFixesLastTurn']:turnKey,
        [pathFor(id)+'.oprpgFixesProcessedTurns']:[...processed,turnKey].slice(-200)};
      if(cost.value>0)update[`system.energy.${field}`]=available-cost.value;
      await actor.update(update,{isEnergySystem:true});
      // Healing follows successful payment, never an independently racing hook.
      if(entries(actor)[id] && activity.type === "heal" && activity.healLimit?.autoHeal)await replacementAutoHeal(actor,activity);
    }
  });
}

export async function sustainedTurn(combat,prior,current) {
  const currentId=current?.combatantId ?? combat.combatant?.id;
  const owner=combat.combatants?.get(currentId)?.actor;
  const actors=new Set(Array.from(combat.combatants ?? [],c=>c.actor).filter(Boolean));
  const turnKey=`${combat.id}:${current?.round ?? combat.round}:${current?.turn ?? combat.turn}:${currentId}`;
  const snapshot={id:combat.id,started:combat.started,round:current?.round ?? combat.round,turn:current?.turn ?? combat.turn,
    turns:combat.turns,combatants:combat.combatants};
  for(const actor of actors)await processActor(actor,{combat:snapshot,turnKey,heal:actor===owner});
}

export async function sustainedCombatDeleted(combat) {
  for(const actor of new Set(Array.from(combat.combatants ?? [],c=>c.actor).filter(Boolean)))await processActor(actor,{combat,end:true});
}

export async function checkSustainedDurations() {
  const actors=new Set(Array.from(game.actors ?? []));
  for(const c of game.combats ?? [])for(const entry of c.combatants ?? [])if(entry.actor)actors.add(entry.actor);
  for(const actor of actors)if(Object.keys(entries(actor)).length)await processActor(actor,{combat:combatFor(actor)});
}

export function installSustainedDurationFix() {
  if(installed)return true;
  const turn=Hooks.events?.combatTurnChange ?? [], deletion=Hooks.events?.deleteCombat ?? [];
  const maintenance=turn.filter(e=>String(e.fn).includes('act?.getConstantUpkeep?.()') && String(e.fn).includes('genLeft') && String(e.fn).includes('deactivated'));
  const healing=turn.filter(e=>String(e.fn).includes('act.healLimit?.autoHeal') && (String(e.fn).includes('_autoHeal(actor, act)') || String(e.fn).includes('replacementAutoHeal(actor, act)')));
  const cleanup=deletion.filter(e=>String(e.fn).includes('actor.unsetFlag(SCOPE, FLAG)') && String(e.fn).includes('combat?.combatants'));
  if(maintenance.length!==1 || healing.length!==1 || cleanup.length!==1) {
    STATE.warnings.push('Duração sustentada: handlers nativos não reconhecidos; preservados para evitar dupla manutenção/cura.');
    return false;
  }
  Hooks.off('combatTurnChange',maintenance[0].id);
  Hooks.off('combatTurnChange',healing[0].id);
  Hooks.off('deleteCombat',cleanup[0].id);
  const guarded=fn=>(...args)=>fn(...args).catch(error=>{STATE.warnings.push(`Duração sustentada: ${error.message ?? error}`);console.error(error)});
  Hooks.on('combatTurnChange',guarded(sustainedTurn));
  Hooks.on('deleteCombat',guarded(sustainedCombatDeleted));
  registerActorTimer('sustained',actor=>Object.keys(entries(actor)).length>0,actor=>processActor(actor,{combat:combatFor(actor)}));
  Hooks.on('preUpdateActor',stampActivation);
  installed=true;
  STATE.sustainedDurationPatch=true;
  STATE.autoHealPatch=true;
  void guarded(checkSustainedDurations)();
  return true;
}
