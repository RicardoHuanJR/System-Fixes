import { heightMatches, wallAllows } from './area-obstacles.js';

import { MODULE_ID, STATE } from './shared.js';
import { registerActorTimer, queueActor } from './automation-runtime.js';
import { tokenIntersectsArea, findAreaSource } from './area-workflow.js';
import { rollTargetSaves } from './save-workflow.js';
import { applyTechniqueEffects, responsibleExecutor } from './technique-effects.js';
import { messageAudience } from './roll-privacy.js';

const active=new Map(),pending=new Set();
let installed=false;
export function serializeGeometry(template){
  const s=template.shape,d=template.document??template;
  if(!s)throw Error('Geometria de área ausente.');
  const shape=s.points?{kind:'polygon',points:Array.from(s.points)}:Number.isFinite(s.radius)?{kind:'circle',x:s.x??0,y:s.y??0,radius:s.radius}:{kind:'rect',x:s.x??0,y:s.y??0,width:s.width,height:s.height};
  if(shape.kind==='rect'&&(!Number.isFinite(shape.width)||!Number.isFinite(shape.height)))throw Error('Forma de área não suportada.');
  return {shape,document:{x:d.x??0,y:d.y??0,uuid:d.uuid}};
}
export function restoreGeometry(data){
  const s={...data.shape};
  s.contains=(x,y)=>{
    if(s.kind==='circle')return (x-s.x)**2+(y-s.y)**2<=s.radius**2;
    if(s.kind==='rect')return x>=s.x&&x<=s.x+s.width&&y>=s.y&&y<=s.y+s.height;
    let inside=false;const p=s.points;
    for(let i=0,j=p.length-2;i<p.length;j=i,i+=2){const xi=p[i],yi=p[i+1],xj=p[j],yj=p[j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}
    return inside;
  };return {...data,shape:s};
}
export function areaMembers(area,tokens=canvas.tokens?.placeables??[]){
  if(area.scene!==canvas.scene?.id)return [];
  const shapes=area.geometry.map(restoreGeometry);
  return tokens.filter(t=>t.actor&&t.visible!==false&&(!t.document?.hidden||game.user.isGM)&&heightMatches(t,area.config)&&shapes.some(s=>tokenIntersectsArea(s,t)&&wallAllows(s,t,area.config)));
}
export function areaExpired(area,now=game.time.worldTime){return Number.isFinite(area.expires)&&now>=area.expires;}
export async function registerPersistentArea({activity,templates,message,state}){
  const config=activity.item.getFlag(MODULE_ID,'techniqueAutomation');if(!config?.persistent)return null;
  const actor=activity.actor??activity.item.actor;
  if(!actor?.isOwner)return null;
  const area={id:message.id,activityUuid:activity.uuid,scene:canvas.scene.id,geometry:templates.map(serializeGeometry),config,
    upkeepId:actor.getFlag('oprpg-system','upkeep')?.[activity.id]?activity.id:null,
    members:[...state.targets],protected:[...state.protected],prolonged:state.prolonged,created:game.time.worldTime,
    expires:config.seconds>0?game.time.worldTime+config.seconds:null,lastCombat:null};
  await actor.setFlag(MODULE_ID,`persistentAreas.${area.id}`,area);active.set(area.id,{actor,area});return area;
}
export async function removeAreaEffects(actor,source){
  const effects=Array.from(actor.effects??[]).filter(e=>(e.flags?.[MODULE_ID]?.areaSource===source||e.flags?.[MODULE_ID]?.areaRoot===source)&&e.flags?.[MODULE_ID]?.removeOnExit);
  if(effects.length)await actor.deleteEmbeddedDocuments('ActiveEffect',effects.map(e=>e.id));
}
export async function endPersistentArea(actor,id){
  if(!actor?.isOwner)throw Error('Você precisa controlar a ficha do lançador.');
  const area=actor.getFlag(MODULE_ID,`persistentAreas.${id}`);if(!area)return false;
  active.delete(id);await actor.unsetFlag(MODULE_ID,`persistentAreas.${id}`);
  const uuids=area.members??[];for(const uuid of uuids){const target=await fromUuid(uuid);if(target?.isOwner)await removeAreaEffects(target,id);}
  for(const uuid of new Set(area.geometry.map(g=>g.document.uuid).filter(Boolean))){const doc=await fromUuid(uuid);if(doc?.delete&&doc.isOwner!==false&&['MeasuredTemplate','Region'].includes(doc.documentName))await doc.delete();}
  return true;
}
export async function requestAreaCycle(owner,area,actors,key){
  if(!actors.length||!responsibleExecutor(owner)||pending.has(key))return null;
  pending.add(key);
  try{
    const original=game.messages.get(area.id),activity=await fromUuid(area.activityUuid);
    if(!original||original.isContentVisible===false||!activity||areaExpired(area))return null;
    const previous=Array.from(game.messages??[]).find(m=>m.getFlag?.(MODULE_ID,'areaCycle')===key);if(previous)return previous;
    const targets=[...new Set(actors.map(a=>a.uuid))],protectedIds=area.prolonged?area.protected.filter(u=>targets.includes(u)):[];
    const audience=messageAudience(original);
    const message=await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:owner}),content:freshAreaContent(original.content),whisper:audience.whisper,blind:audience.blind,
      flags:{[MODULE_ID]:{areaCycle:key,areaParent:area.id,areaExecution:{status:'ready',activityId:activity.id,activityUuid:activity.uuid,sourceId:null,targets,protected:protectedIds,scene:area.scene,templates:area.geometry.map(g=>g.document.uuid)}}}});
    const state=message.getFlag(MODULE_ID,'areaExecution');await message.setFlag(MODULE_ID,'areaExecution',{...state,sourceId:message.id});
    if(activity.type==='save'){
      const root=document.createElement('div');root.innerHTML=message.content;
      const eligible=actors.filter(a=>!protectedIds.includes(a.uuid));if(eligible.length)await rollTargetSaves(root.querySelector('.jujutsu-card[data-card-type="save"]'),message,eligible,{individual:true});
    }else if(activity.type==='utility')for(const target of actors)await applyTechniqueEffects(activity,target,message,{receipt:key});
    for(const target of actors.filter(a=>protectedIds.includes(a.uuid)))await applyTechniqueEffects(activity,target,message,{receipt:key});
    return message;
  }finally{pending.delete(key);}
}
export function freshAreaContent(content){
  const root=document.createElement('div');root.innerHTML=content??'';
  for(const card of root.querySelectorAll('.jujutsu-card')){
    for(const key of Object.keys(card.dataset))if(/^(total|crit|damageParts|oprpgFixesDamage|oprpgFixesTyped|oprpgFixesMultiActivityDamage|oprpgFixesDamageWithout)/.test(key))delete card.dataset[key];
    for(const element of card.querySelectorAll('#jj-dmg-val,#jj-dmg-break,#jj-total-display,#jj-damage-separate'))element.replaceChildren();
    for(const element of card.querySelectorAll('#jj-dmg-panel,.jj-footer')){element.classList.remove('visible');element.style.display='none';}
    for(const button of card.querySelectorAll('[data-action="jj-damage"],[data-action="jj-apply-damage"]'))button.disabled=card.dataset.cardType==='save';
    for(const input of card.querySelectorAll('.jj-mod-check input,[data-save-mod]')){input.checked=false;input.disabled=false;}
  }
  return root.innerHTML;
}
export async function updateAreaMembership(owner,area,options={}){
  return queueActor(owner,async()=>{
    const latest=owner.getFlag(MODULE_ID,`persistentAreas.${area.id}`);
    if(latest)return processAreaMembership(owner,latest,options);
  },'area-membership');
}
async function processAreaMembership(owner,area,{trigger=true}={}){
  if(!responsibleExecutor(owner)||area.scene!==canvas.scene?.id)return;
  if(area.upkeepId&&!owner.getFlag('oprpg-system','upkeep')?.[area.upkeepId])return endPersistentArea(owner,area.id);
  if(areaExpired(area))return endPersistentArea(owner,area.id);
  const tokens=areaMembers(area),members=[...new Set(tokens.map(t=>t.actor.uuid))],old=area.members??[];
  const entered=members.filter(u=>!old.includes(u)),left=old.filter(u=>!members.includes(u));
  if(!entered.length&&!left.length)return;
  const revision=Number(area.revision??0)+1,next={...area,members,revision};
  await owner.setFlag(MODULE_ID,`persistentAreas.${area.id}`,next);active.set(area.id,{actor:owner,area:next});
  for(const uuid of left){const actor=await fromUuid(uuid);if(actor?.isOwner){await removeAreaEffects(actor,area.id);for(const message of game.messages??[])if(message.getFlag?.(MODULE_ID,'areaParent')===area.id)await removeAreaEffects(actor,message.id);}}
  if(trigger&&area.config.enter)await requestAreaCycle(owner,next,tokens.filter(t=>entered.includes(t.actor.uuid)).map(t=>t.actor),`${area.id}:enter:${revision}`);
}
export async function persistentCombatTurn(combat,prior,current){
  if(!combat||!prior||!current||Number(current.round)<Number(prior.round)||current.round===prior.round&&current.turn<=prior.turn)return;
  const turnKey=`${combat.id}:${current.round}:${current.turn}`,started=combat.turns?.[current.turn]?.actor,ended=combat.turns?.[prior.turn]?.actor;
  for(const {actor:owner,area} of [...active.values()]){
    if(!responsibleExecutor(owner)||areaExpired(area)){if(responsibleExecutor(owner)&&areaExpired(area))await endPersistentArea(owner,area.id);continue;}
    if(area.scene!==canvas.scene?.id||area.lastCombat===turnKey)continue;
    await updateAreaMembership(owner,area,{trigger:false});
    const updated=owner.getFlag(MODULE_ID,`persistentAreas.${area.id}`);if(!updated)continue;
    await owner.setFlag(MODULE_ID,`persistentAreas.${area.id}.lastCombat`,turnKey);updated.lastCombat=turnKey;
    if(updated.config.start&&updated.members.includes(started?.uuid))await requestAreaCycle(owner,updated,[started],`${area.id}:start:${turnKey}`);
    if(updated.config.end&&updated.members.includes(ended?.uuid))await requestAreaCycle(owner,updated,[ended],`${area.id}:end:${turnKey}`);
  }
}
function indexActor(actor){
  for(const [id,entry]of active)if(entry.actor.uuid===actor.uuid)active.delete(id);
  for(const area of Object.values(actor.getFlag?.(MODULE_ID,'persistentAreas')??{}))active.set(area.id,{actor,area});
}
export async function updatePersistentTemplate(doc){
  if(!doc.object?.shape)return;
  for(const {actor,area}of [...active.values()])if(responsibleExecutor(actor)&&area.geometry.some(g=>g.document.uuid===doc.uuid)){
    const geometry=area.geometry.map(g=>g.document.uuid===doc.uuid?serializeGeometry(doc.object):g);
    const updated={...area,geometry};await actor.setFlag(MODULE_ID,`persistentAreas.${area.id}`,updated);await updateAreaMembership(actor,updated);
  }
}
export function installPersistentAreas(){
  if(installed)return;installed=true;
  registerActorTimer('persistent-areas',actor=>Object.keys(actor.getFlag(MODULE_ID,'persistentAreas')??{}).length>0,async actor=>{
    indexActor(actor);for(const {area} of [...active.values()].filter(v=>v.actor.uuid===actor.uuid))if(responsibleExecutor(actor))await updateAreaMembership(actor,area);
  });
  for(const actor of game.actors??[])indexActor(actor);
  Hooks.on('updateActor',actor=>{indexActor(actor);for(const {area}of [...active.values()].filter(v=>v.actor.uuid===actor.uuid))if(area.upkeepId&&!actor.getFlag('oprpg-system','upkeep')?.[area.upkeepId])void updateAreaMembership(actor,area).catch(e=>ui.notifications.error(e.message));});Hooks.on('deleteActor',actor=>{for(const [id,v]of active)if(v.actor.uuid===actor.uuid)active.delete(id);});
  const guarded=task=>void task.catch(e=>{STATE.warnings.push(`Área persistente: ${e.message}`);ui.notifications.error(e.message);});
  Hooks.on('oprpgFixes.areaConfirmed',data=>guarded(registerPersistentArea(data)));
  Hooks.on('updateToken',()=>{for(const {actor,area}of [...active.values()])guarded(queueActor(actor,()=>updateAreaMembership(actor,area),'areas'));});
  Hooks.on('combatTurnChange',(combat,prior,current)=>guarded(persistentCombatTurn(combat,prior,current)));
  Hooks.on('canvasReady',()=>{for(const sceneToken of canvas.tokens?.placeables??[])if(sceneToken.actor)indexActor(sceneToken.actor);for(const {actor,area}of [...active.values()])guarded(updateAreaMembership(actor,area));});
  Hooks.on('deleteMeasuredTemplate',doc=>{for(const {actor,area}of [...active.values()])if(responsibleExecutor(actor)&&area.geometry.some(g=>g.document.uuid===doc.uuid))guarded(endPersistentArea(actor,area.id));});
  Hooks.on('updateMeasuredTemplate',doc=>guarded(new Promise(resolve=>requestAnimationFrame(resolve)).then(()=>updatePersistentTemplate(doc))));
  STATE.persistentAreas=true;
}


