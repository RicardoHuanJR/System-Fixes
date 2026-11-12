import { heightMatches, wallAllows } from './area-obstacles.js';

import { MODULE_ID, STATE } from './shared.js';
import { registerActorTimer, queueActor, changeTouches } from './automation-runtime.js';
import { tokenIntersectsArea, findAreaSource, regionDocument } from './area-workflow.js';
import { readTemplateHighlights } from './area-grid.js';
import { isCasterActor, isCasterToken } from './area-caster.js';
import { rollTargetSaves } from './save-workflow.js';
import { applyTechniqueEffects, responsibleExecutor } from './technique-effects.js';
import { messageAudience } from './roll-privacy.js';

const active=new Map(),pending=new Set(),ending=new Set();
let installed=false;
export function serializeGeometry(template){
  const region=regionDocument(template);
  if(region)return {shape:{kind:'native-region'},document:{uuid:region.uuid}};
  const s=template.shape,d=template.document??template;
  if(!s)throw Error('Geometria de área ausente.');
  const shape=s.points?{kind:'polygon',points:Array.from(s.points)}:Number.isFinite(s.radius)?{kind:'circle',x:s.x??0,y:s.y??0,radius:s.radius}:{kind:'rect',x:s.x??0,y:s.y??0,width:s.width,height:s.height};
  if(shape.kind==='rect'&&(!Number.isFinite(shape.width)||!Number.isFinite(shape.height)))throw Error('Forma de área não suportada.');
  return {shape,document:{x:d.x??0,y:d.y??0,uuid:d.uuid},gridHighlights:template.gridHighlights??readTemplateHighlights(template)};
}
export function restoreGeometry(data){
  if(data.shape?.kind==='native-region'){
    const uuid=data.document?.uuid??'';
    // Never use a Region from another scene with the same short id.
    const prefix=`Scene.${canvas.scene?.id}.Region.`;
    if(!uuid.startsWith(prefix))return null;
    const region=canvas.scene?.regions?.get(uuid.slice(prefix.length));
    return region?{document:region}:null;
  }
  const s={...data.shape};
  s.contains=(x,y)=>{
    if(s.kind==='circle')return (x-s.x)**2+(y-s.y)**2<=s.radius**2;
    if(s.kind==='rect')return x>=s.x&&x<=s.x+s.width&&y>=s.y&&y<=s.y+s.height;
    let inside=false;const p=s.points;
    for(let i=0,j=p.length-2;i<p.length;j=i,i+=2){const xi=p[i],yi=p[i+1],xj=p[j],yj=p[j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}
    return inside;
  };return {...data,shape:s};
}
export function areaMembers(area,tokens=canvas.tokens?.placeables??[],fallbackCaster={}){
  if(area.scene!==canvas.scene?.id)return [];
  const caster={casterUuid:area.casterUuid??fallbackCaster.casterUuid,
    casterActorId:area.casterActorId??fallbackCaster.casterActorId,
    casterTokenActorUuid:area.casterTokenActorUuid??fallbackCaster.casterTokenActorUuid,
    sourceTokenUuid:area.sourceTokenUuid??fallbackCaster.sourceTokenUuid};
  const shapes=area.geometry.map(restoreGeometry).filter(Boolean);
  return tokens.filter(t=>t.actor&&!isCasterToken(t,caster)&&(game.user.isGM||t.visible!==false)&&(!t.document?.hidden||game.user.isGM)&&heightMatches(t,area.config)&&shapes.some(s=>tokenIntersectsArea(s,t)&&wallAllows(s,t,area.config)));
}
export function areaExpired(area,now=game.time.worldTime){return Number.isFinite(area.expires)&&now>=area.expires;}
export async function registerPersistentArea({activity,templates,message,state}){
  const config=activity.item.getFlag(MODULE_ID,'techniqueAutomation');if(!config?.persistent)return null;
  const actor=activity.actor??activity.item.actor;
  if(!actor?.isOwner)return null;
  const area={id:message.id,activityUuid:activity.uuid,scene:canvas.scene.id,geometry:templates.map(serializeGeometry),config,
    upkeepId:actor.getFlag('oprpg-system','upkeep')?.[activity.id]?activity.id:null,
    members:state.targets.filter(uuid=>!new Set([actor.uuid,state.casterUuid,state.casterTokenActorUuid]).has(uuid)),
    protected:[...state.protected],prolonged:state.prolonged,
    casterUuid:state.casterUuid??actor.uuid,casterActorId:state.casterActorId??actor.id,
    casterTokenActorUuid:state.casterTokenActorUuid??null,
    sourceTokenUuid:state.sourceTokenUuid??null,created:game.time.worldTime,
    expires:config.seconds>0?game.time.worldTime+config.seconds:null,lastCombat:null};
  await actor.setFlag(MODULE_ID,`persistentAreas.${area.id}`,area);active.set(area.id,{actor,area});return area;
}
export async function removeAreaEffects(actor,source){
  const effects=Array.from(actor.effects??[]).filter(e=>(e.flags?.[MODULE_ID]?.areaSource===source||e.flags?.[MODULE_ID]?.areaRoot===source)&&e.flags?.[MODULE_ID]?.removeOnExit);
  if(effects.length)await actor.deleteEmbeddedDocuments('ActiveEffect',effects.map(e=>e.id));
}
export async function endPersistentArea(actor,id){
  if(!actor?.isOwner)throw Error('Você precisa controlar a ficha do lançador.');
  const key=`${actor.uuid??actor.id}:${id}`;
  if(ending.has(key))return false;
  const area=actor.getFlag(MODULE_ID,`persistentAreas.${id}`);if(!area)return false;
  ending.add(key);
  try{
    // Finish reversible effect cleanup first. If it fails, leave the stored
    // area intact so a retry can complete instead of orphaning those effects.
    const uuids=area.members??[];
    for(const uuid of uuids){const target=await fromUuid(uuid);if(target){
      if(!target.isOwner)throw Error(`Sem permissão para remover os efeitos de ${target.name??uuid}; peça ao mestre para encerrar a área.`);
      await removeAreaEffects(target,id);
    }}
    await actor.unsetFlag(MODULE_ID,`persistentAreas.${id}`);
    active.delete(id);
    // Documents are deleted only after removing the area record: deleteRegion /
    // deleteMeasuredTemplate hooks must not trigger a second teardown.
    for(const uuid of new Set((area.geometry??[]).map(g=>g.document?.uuid).filter(Boolean))){
      try{
        const doc=await fromUuid(uuid);
        if(doc?.delete&&doc.isOwner!==false&&['MeasuredTemplate','Region'].includes(doc.documentName))await doc.delete();
      }catch(error){
        STATE.warnings.push(`Área ${id}: não foi possível apagar o modelo ${uuid}: ${error.message}`);
        ui.notifications.warn('Área encerrada, mas um modelo não pôde ser removido. Confira a cena.');
      }
    }
    return true;
  }finally{ending.delete(key);}
}
export async function requestAreaCycle(owner,area,actors,key){
  const caster={casterUuid:area.casterUuid??owner?.uuid,casterActorId:area.casterActorId??owner?.id,
    casterTokenActorUuid:area.casterTokenActorUuid,sourceTokenUuid:area.sourceTokenUuid};
  actors=actors.filter(actor=>!isCasterActor(actor,caster));
  if(!actors.length||!responsibleExecutor(owner))return null;
  // A caller awaiting this cycle must not interpret an in-flight operation as
  // success and commit membership before the first caller finishes.
  if(pending.has(key))throw Error('Este ciclo da área ainda está em processamento. Tente novamente.');
  pending.add(key);
  try{
    const original=game.messages.get(area.id),activity=await fromUuid(area.activityUuid);
    if(areaExpired(area))return null;
    if(!original||!activity)throw Error('Não foi possível recuperar a origem da área persistente; o estado será preservado.');
    if(original.isContentVisible===false)throw Error('O executor não tem acesso ao cartão original da área; peça ao mestre para reconciliar os alvos.');
    // A previous attempt may have created the cycle card and failed before
    // requesting every save/effect. Reuse the card and finish its idempotent
    // work instead of returning early and permanently skipping its targets.
    const previous=Array.from(game.messages??[]).find(m=>m.getFlag?.(MODULE_ID,'areaCycle')===key&&m.getFlag?.(MODULE_ID,'areaParent')===area.id);
    const targets=[...new Set(actors.map(a=>a.uuid))],protectedIds=area.prolonged?area.protected.filter(u=>targets.includes(u)):[];
    const audience=messageAudience(original);
    const message=previous??await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:owner}),content:freshAreaContent(original.content),whisper:audience.whisper,blind:audience.blind,
      flags:{[MODULE_ID]:{areaCycle:key,areaParent:area.id,areaExecution:{status:'ready',activityId:activity.id,activityUuid:activity.uuid,sourceId:null,targets,protected:protectedIds,scene:area.scene,templates:area.geometry.map(g=>g.document.uuid),
        casterUuid:caster.casterUuid,casterActorId:caster.casterActorId,
        casterTokenActorUuid:caster.casterTokenActorUuid,sourceTokenUuid:caster.sourceTokenUuid}}}});
    const state=message.getFlag(MODULE_ID,'areaExecution');
    if(!state||state.activityUuid!==activity.uuid||!Array.isArray(state.targets))throw Error('Cartão de ciclo incompatível com a área persistente.');
    // If occupancy changed between failed attempts, an old card must not be
    // recycled with a different target set. Leave membership untouched and
    // surface the conflict for the GM to resolve instead of changing victims.
    if(previous&&JSON.stringify([...state.targets].sort())!==JSON.stringify([...targets].sort()))
      throw Error('Os alvos da área mudaram durante uma tentativa incompleta. Revise o ciclo no chat antes de continuar.');
    if(state.sourceId!==message.id)await message.setFlag(MODULE_ID,'areaExecution',{...state,sourceId:message.id});
    if(activity.type==='save'){
      const root=document.createElement('div');root.innerHTML=message.content;
      const eligible=actors.filter(a=>!protectedIds.includes(a.uuid));
      if(eligible.length){
        const saveCard=Array.from(root.querySelectorAll('.jujutsu-card[data-card-type="save"]'))
          .find(card=>card.dataset.activityId===activity.id);
        if(!saveCard)throw Error('Cartão da salvaguarda persistente selecionada não foi encontrado.');
        await rollTargetSaves(saveCard,message,eligible,{individual:true});
      }
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
  // A temporarily unavailable V14 Region is not an empty area. Avoid silently
  // clearing all members and their effects during a scene/Region reload.
  if(!area.geometry?.length||area.geometry.some(g=>g.shape?.kind==='native-region'&&!restoreGeometry(g))){
    STATE.warnings.push(`Área persistente ${area.id}: Região indisponível; manutenção de alvos adiada.`);
    return;
  }
  // Backward compatibility: exclude the owner from areas stored by older versions.
  const caster={casterUuid:area.casterUuid??owner.uuid,casterActorId:area.casterActorId??owner.id,
    casterTokenActorUuid:area.casterTokenActorUuid,sourceTokenUuid:area.sourceTokenUuid};
  const tokens=areaMembers(area,canvas.tokens?.placeables??[],caster),members=[...new Set(tokens.map(t=>t.actor.uuid))],old=area.members??[];
  const entered=members.filter(u=>!old.includes(u)),left=old.filter(u=>!members.includes(u));
  if(!entered.length&&!left.length)return;
  const revision=Number(area.revision??0)+1,next={...area,members,revision,
    casterUuid:area.casterUuid??owner.uuid,casterActorId:area.casterActorId??owner.id,
    casterTokenActorUuid:area.casterTokenActorUuid??null};
  // Remove exit effects *before* committing the new membership. If an Active
  // Effect deletion fails, the previous members are kept for safe retry on the
  // next updateWorldTime / token event. Deletion is idempotent.
  const childCycles=left.length?Array.from(game.messages??[]).filter(message=>message.getFlag?.(MODULE_ID,'areaParent')===area.id):[];
  for(const uuid of left){
    const actor=await fromUuid(uuid);
    if(!actor)continue; // Actor deleted: there are no effects left to clean.
    if(!actor.isOwner)throw Error(`Sem permissão para remover os efeitos de ${actor.name??uuid}; o mestre deve resolver a saída da área.`);
    await removeAreaEffects(actor,area.id);
    for(const message of childCycles)await removeAreaEffects(actor,message.id);
  }
  // Only commit membership after scheduling the entry cycle. A failed chat
  // creation or save request must not mark targets as successfully processed;
  // otherwise the next refresh sees no new entrants and never retries. Cycle
  // requests are idempotent by key, including after a partial chat creation.
  if(trigger&&area.config.enter&&entered.length)
    await requestAreaCycle(owner,next,tokens.filter(t=>entered.includes(t.actor.uuid)).map(t=>t.actor),`${area.id}:enter:${revision}`);
  await owner.setFlag(MODULE_ID,`persistentAreas.${area.id}`,next);
  active.set(area.id,{actor:owner,area:next});
}
export async function persistentCombatTurn(combat,prior,current){
  if(!combat||!prior||!current||Number(current.round)<Number(prior.round)||current.round===prior.round&&current.turn<=prior.turn)return;
  const turnKey=`${combat.id}:${current.round}:${current.turn}`,started=combat.turns?.[current.turn]?.actor,ended=combat.turns?.[prior.turn]?.actor;
  for(const {actor:owner,area} of [...active.values()]){
    if(!responsibleExecutor(owner)||areaExpired(area)){if(responsibleExecutor(owner)&&areaExpired(area))await endPersistentArea(owner,area.id);continue;}
    if(area.scene!==canvas.scene?.id||area.lastCombat===turnKey)continue;
    await updateAreaMembership(owner,area,{trigger:false});
    const updated=owner.getFlag(MODULE_ID,`persistentAreas.${area.id}`);if(!updated)continue;
    // Membership reconciliation intentionally stops while a native Region is
    // unavailable. Do not consume this turn with a stale member list: that
    // would prevent periodic saves/effects from being retried after reload.
    if(!updated.geometry?.length||updated.geometry.some(g=>g.shape?.kind==='native-region'&&!restoreGeometry(g)))continue;
    // A failed periodic cycle must be retried on the next reconciliation,
    // instead of being recorded as successfully run for this combat turn.
    if(updated.config.start&&updated.members.includes(started?.uuid))await requestAreaCycle(owner,updated,[started],`${area.id}:start:${turnKey}`);
    if(updated.config.end&&updated.members.includes(ended?.uuid))await requestAreaCycle(owner,updated,[ended],`${area.id}:end:${turnKey}`);
    await owner.setFlag(MODULE_ID,`persistentAreas.${area.id}.lastCombat`,turnKey);
    updated.lastCombat=turnKey;
  }
}
function indexActor(actor){
  for(const [id,entry]of active)if(entry.actor.uuid===actor.uuid)active.delete(id);
  for(const area of Object.values(actor.getFlag?.(MODULE_ID,'persistentAreas')??{}))active.set(area.id,{actor,area});
}
export async function updatePersistentTemplate(doc){
  if(doc.documentName!=='Region'&&!doc.object?.shape)return;
  for(const {actor,area}of [...active.values()])if(responsibleExecutor(actor)&&area.geometry.some(g=>g.document.uuid===doc.uuid)){
    const geometry=area.geometry.map(g=>g.document.uuid===doc.uuid?serializeGeometry(doc.documentName==='Region'?doc:doc.object):g);
    const updated={...area,geometry};await actor.setFlag(MODULE_ID,`persistentAreas.${area.id}`,updated);await updateAreaMembership(actor,updated);
  }
}
export function installPersistentAreas(){
  if(installed)return;installed=true;
  registerActorTimer('persistent-areas',actor=>Object.keys(actor.getFlag(MODULE_ID,'persistentAreas')??{}).length>0,async actor=>{
    indexActor(actor);for(const {area} of [...active.values()].filter(v=>v.actor.uuid===actor.uuid))if(responsibleExecutor(actor))await updateAreaMembership(actor,area);
  });
  for(const actor of game.actors??[])indexActor(actor);
  Hooks.on('updateActor',(actor,changes)=>{
    // HP, PP, effects and cosmetic updates are common. Reindex areas only when
    // their stored flags actually change; upkeep checks only on upkeep changes.
    if(changeTouches(changes,[`flags.${MODULE_ID}.persistentAreas`]))indexActor(actor);
    if(changeTouches(changes,['flags.oprpg-system.upkeep'])){
      for(const {area}of [...active.values()].filter(v=>v.actor.uuid===actor.uuid))
        if(area.upkeepId&&!actor.getFlag('oprpg-system','upkeep')?.[area.upkeepId])
          void updateAreaMembership(actor,area).catch(e=>ui.notifications.error(e.message));
    }
  });
  Hooks.on('deleteActor',actor=>{for(const [id,v]of active)if(v.actor.uuid===actor.uuid)active.delete(id);});
  const guarded=task=>void task.catch(e=>{STATE.warnings.push(`Área persistente: ${e.message}`);ui.notifications.error(e.message);});
  Hooks.on('oprpgFixes.areaConfirmed',data=>guarded(registerPersistentArea(data)));
  // Create/delete change occupancy just as movement does. Do not rescan all
  // areas on unrelated token changes (e.g. vision, display name or texture).
  const refreshSceneAreas=()=>{
    for(const {actor,area} of [...active.values()])
      if(area.scene===canvas.scene?.id&&responsibleExecutor(actor))guarded(updateAreaMembership(actor,area));
  };
  let tokenRefreshQueued=false;
  const scheduleTokenRefresh=()=>{
    if(tokenRefreshQueued)return;
    tokenRefreshQueued=true;
    const run=()=>{tokenRefreshQueued=false;refreshSceneAreas();};
    // Allow canvas placeables to be added/removed before checking occupancy.
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);
    else queueMicrotask(run);
  };
  Hooks.on('updateToken',(doc,changes)=>{
    if(doc.parent?.id!==canvas.scene?.id)return;
    if(!['x','y','width','height','elevation','rotation','shape'].some(k=>Object.hasOwn(changes??{},k)))return;
    scheduleTokenRefresh();
  });
  Hooks.on('createToken',doc=>{
    if(doc.parent?.id!==canvas.scene?.id)return;
    if(doc.actor)indexActor(doc.actor);
    scheduleTokenRefresh();
  });
  Hooks.on('deleteToken',doc=>{
    if(doc.parent?.id!==canvas.scene?.id)return;
    scheduleTokenRefresh();
  });
  Hooks.on('combatTurnChange',(combat,prior,current)=>guarded(persistentCombatTurn(combat,prior,current)));
  Hooks.on('canvasReady',()=>{for(const sceneToken of canvas.tokens?.placeables??[])if(sceneToken.actor)indexActor(sceneToken.actor);for(const {actor,area}of [...active.values()])guarded(updateAreaMembership(actor,area));});
  Hooks.on('deleteMeasuredTemplate',doc=>{for(const {actor,area}of [...active.values()])if(responsibleExecutor(actor)&&area.geometry.some(g=>g.document.uuid===doc.uuid))guarded(endPersistentArea(actor,area.id));});
  Hooks.on('updateMeasuredTemplate',doc=>guarded(new Promise(resolve=>requestAnimationFrame(resolve)).then(()=>updatePersistentTemplate(doc))));
  Hooks.on('deleteRegion',doc=>{for(const {actor,area}of [...active.values()])if(responsibleExecutor(actor)&&area.geometry.some(g=>g.document.uuid===doc.uuid))guarded(endPersistentArea(actor,area.id));});
  Hooks.on('updateRegion',doc=>guarded(Promise.resolve().then(()=>updatePersistentTemplate(doc))));
  STATE.persistentAreas=true;
}


