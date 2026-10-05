import { STATE } from './shared.js';

const queues = new Map(), timers = new Map(), preparations = new WeakSet();
let installed = false, running = null, dirty = false;
const metrics = {passes:0,visited:0,executed:0,errors:0,queued:0,lastMs:0,maxMs:0};
const keyOf = actor => actor?.uuid ?? actor?.id;
const elapsedTime=()=>globalThis.performance?.now?.()??Date.now();

// Different channels keep a human roll dialog from blocking resource updates.
export function queueActor(actor, task, channel='resources') {
  const key=keyOf(actor);
  if(!key)return Promise.reject(Error('Personagem inválido.'));
  const id=key+':'+channel;
  const next=(queues.get(id)??Promise.resolve()).catch(()=>{}).then(task);
  queues.set(id,next);metrics.queued++;
  next.finally(()=>{if(queues.get(id)===next)queues.delete(id)}).catch(()=>{});
  return next;
}

export function changeTouches(changes, paths) {
  const leaves=[];
  const visit=(value,prefix='')=>{
    for(const [key,next] of Object.entries(value??{})){
      const path=prefix?prefix+'.'+key:key;
      if(next&&typeof next==='object'&&!Array.isArray(next)&&Object.keys(next).length)visit(next,path);
      else leaves.push(path.replace(/\.-=/g,'.'));
    }
  };
  visit(changes);
  return leaves.some(key=>paths.some(path=>key===path||key.startsWith(path+'.')||path.startsWith(key+'.')));
}
export function refreshTimedActor(actor) {
  const key=keyOf(actor);if(!key)return;
  for(const timer of timers.values()){
    if(timer.matches(actor))timer.actors.set(key,actor);else timer.actors.delete(key);
  }
}
function forgetActor(actor) {
  const key=keyOf(actor);for(const timer of timers.values())timer.actors.delete(key);
}
function allActors() {
  const actors=new Map();
  const add=actor=>{const key=keyOf(actor);if(key)actors.set(key,actor)};
  for(const actor of game.actors??[])add(actor);
  for(const scene of game.scenes??[])for(const token of scene.tokens??[])add(token.actor);
  for(const combat of game.combats??[])for(const entry of combat.combatants??[])add(entry.actor);
  for(const token of globalThis.canvas?.tokens?.placeables??[])add(token.actor);
  return actors.values();
}
export function registerActorTimer(name, matches, run) {
  const timer={matches,run,actors:new Map()};timers.set(name,timer);
  for(const actor of allActors())if(matches(actor))timer.actors.set(keyOf(actor),actor);
  installAutomationRuntime();
}
export function runWorldTimers() {
  dirty=true;
  if(running)return running;
  running=Promise.resolve().then(async()=>{
    while(dirty){
      dirty=false;const start=elapsedTime();metrics.passes++;
      for(const [name,timer] of timers)for(const [key,actor] of [...timer.actors]){
        metrics.visited++;
        try{
          if(!timer.matches(actor)){timer.actors.delete(key);continue;}
          await timer.run(actor);metrics.executed++;
        }
        catch(error){metrics.errors++;STATE.warnings.push(`${name}: ${error.message??error}`);console.error(error)}
      }
      metrics.lastMs=elapsedTime()-start;metrics.maxMs=Math.max(metrics.maxMs,metrics.lastMs);
    }
  }).finally(()=>{running=null});
  return running;
}
export function automationStatus() {
  return {...metrics,queues:queues.size,timers:Object.fromEntries([...timers].map(([name,t])=>[name,t.actors.size]))};
}
export function installAutomationRuntime() {
  if(installed)return;installed=true;
  Hooks.on('updateWorldTime',()=>runWorldTimers());
  for(const event of ['createActor','updateActor'])Hooks.on(event,refreshTimedActor);
  Hooks.on('deleteActor',forgetActor);
  for(const event of ['createActiveEffect','updateActiveEffect','deleteActiveEffect'])Hooks.on(event,e=>refreshTimedActor(e.parent));
  for(const event of ['createToken','updateToken'])Hooks.on(event,t=>refreshTimedActor(t.actor));
  Hooks.on('deleteToken',t=>{if(!t.actorLink)forgetActor(t.actor)});
  Hooks.on('canvasReady',()=>{for(const actor of allActors())refreshTimedActor(actor)});
  for(const event of ['createCombat','updateCombat','deleteCombat'])Hooks.on(event,combat=>{for(const entry of combat.combatants??[])refreshTimedActor(entry.actor)});
  for(const event of ['createCombatant','updateCombatant','deleteCombatant'])Hooks.on(event,entry=>refreshTimedActor(entry.actor));
  STATE.automationRuntime=true;
}

// Batch embedded-effect hooks without sharing state between synthetic actors.
export function scheduleActorPreparation(actor) {
  if(!actor?.prepareData || preparations.has(actor))return false;
  preparations.add(actor);
  queueMicrotask(()=>{
    try{actor.prepareData();}
    catch(error){STATE.warnings.push(`Recalcular ficha: ${error.message}`);console.warn(error);}
    finally{preparations.delete(actor);}
  });
  return true;
}
