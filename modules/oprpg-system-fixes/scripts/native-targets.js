import { targetActors } from './target-damage.js';
import { withActorOperation } from './operation-history.js';
import { STATE, MODULE_ID } from './shared.js';
import { executionActors, areaExecution, areaSaveMultiplier } from './area-state.js';

const patched=Symbol('oprpgFixesNativeTargets');
const pending=new Set();
const isHealingTray=tray=>tray.damages?.length>0&&tray.damages.every(d=>d.value<0||d.type in CONFIG.DND5E.healingTypes);
export async function applyNativeTargetDamage(message,damages,optionsFor=()=>({})) {
  if(!message?.id)throw Error('O cartão de origem não foi encontrado.');
  const actors=await executionActors(message,targetActors());
  const execution=areaExecution(message),activity=execution?await fromUuid(execution.activityUuid):null;
  if(execution&&!activity)throw Error('A atividade de origem da área não está disponível.');
  const factors=new Map(actors.map(a=>[a.uuid,areaSaveMultiplier(message,a,activity)]));
  if(!actors.length)throw Error('Marque um alvo (T) antes de aplicar o dano.');
  if(actors.some(a=>!a.isOwner))throw Error('Peça ao mestre para aplicar o dano: você não pode alterar todos os alvos.');
  const key=message?.id??message;
  if(pending.has(key))return [];
  pending.add(key);
  try{const results=[];for(const actor of actors)await withActorOperation(actor,async()=>{
    const receipt=`${message.id}:native-damage`;
    if((actor.getFlag(MODULE_ID,'damageReceipts')??[]).includes(receipt))return;
    const factor=factors.get(actor.uuid)??1;if(factor===0)return;
    const hook=Hooks.on('dnd5e.preApplyDamage',(target,_amount,updates,options)=>{
      if(target!==actor||options.oprpgFixesNativeReceipt!==receipt)return;
      updates[`flags.${MODULE_ID}.damageReceipts`]=[...(actor.getFlag(MODULE_ID,'damageReceipts')??[]),receipt].slice(-100);
    });
    try{const options=optionsFor(actor);results.push(await actor.applyDamage(damages,{...options,multiplier:(options.multiplier??1)*factor,oprpgFixesNativeReceipt:receipt,isDelta:true,originatingMessage:message,origin:message}));}
    finally{Hooks.off('dnd5e.preApplyDamage',hook);}
  });return results;}
  finally{pending.delete(key);}
}
export function patchNativeDamageTray(proto) {
  if(!proto||proto[patched])return false;
  proto[patched]=true;
  const originalBuild=proto.buildTargetsList, originalApply=proto._onApplyDamage,originalCalculate=proto.calculateDamage;
  if(originalCalculate)proto.calculateDamage=function(actor,options){
    const execution=areaExecution(this.chatMessage);
    if(!execution)return originalCalculate.call(this,actor,options);
    const activity=globalThis.fromUuidSync?.(execution.activityUuid);
    const multiplier=areaSaveMultiplier(this.chatMessage,actor,activity);
    return originalCalculate.call(this,actor,{...options,multiplier:(options?.multiplier??1)*multiplier});
  };
  proto.buildTargetsList=function(){
    if(isHealingTray(this))return originalBuild.call(this);
    if(this.shouldBuildTargetList===false||!this.targetList)return;
    if(this.targetSourceControl)this.targetSourceControl.hidden=true;
    const execution=areaExecution(this.chatMessage);
    const targets=execution?execution.targets.filter(uuid=>!execution.protected.includes(uuid)).map(uuid=>({uuid,name:globalThis.fromUuidSync?.(uuid)?.name??'Alvo da técnica'})):targetActors();
    const entries=targets.map(actor=>{try{return this.buildTargetListEntry({uuid:actor.uuid,name:actor.name});}catch(_){return null;}}).filter(Boolean);
    if(entries.length)this.targetList.replaceChildren(...entries);
    else{const li=document.createElement('li');li.textContent=execution?'Conclua as salvaguardas dos alvos registrados na técnica.':'Marque os alvos atuais no mapa (T).';this.targetList.replaceChildren(li);}
  };
  proto._onApplyDamage=async function(event){
    if(isHealingTray(this))return originalApply.call(this,event);
    event.preventDefault();
    try{await applyNativeTargetDamage(this.chatMessage,this.damages,actor=>this.getTargetOptions(actor.uuid));}
    catch(error){ui.notifications.error(error.message);}
    this.buildTargetsList();
  };
  return true;
}
export async function installNativeTargets() {
  const proto=CONFIG.ChatMessage?.documentClass?.prototype;
  if(proto?.applyChatCardDamage&&!proto.applyChatCardDamage[patched]) {
    const {default:aggregate}=await import('/systems/oprpg-system/module/dice/aggregate-damage-rolls.mjs');
    const original=proto.applyChatCardDamage;
    const replacement=async function(li,multiplier){
      // Preserve the explicit heal option in the roll context menu.
      if(Number(multiplier)<0)return original.call(this,li,multiplier);
      const damages=aggregate(this.rolls,{respectProperties:true}).map(roll=>({value:Math.max(0,roll.total)*(roll.options.type in CONFIG.DND5E.healingTypes?-1:1),type:roll.options.type,properties:new Set(roll.options.properties??[])}));
      try{return await applyNativeTargetDamage(this,damages,()=>({multiplier}));}
      catch(error){ui.notifications.error(error.message);return [];}
    };
    replacement[patched]=true;proto.applyChatCardDamage=replacement;
    const descriptor=Object.getOwnPropertyDescriptor(proto,'canApplyDamage');
    if(descriptor?.configurable)Object.defineProperty(proto,'canApplyDamage',{...descriptor,get(){const type=this.flags.OPRPG?.roll?.type;return (!type||type==='damage')&&this.isRoll&&this.isContentVisible&&(targetActors().length>0||descriptor.get.call(this));}});
  }
  const tray=customElements.get('damage-application');
  patchNativeDamageTray(tray?.prototype);
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-action="applyDamage"]'),element=button?.closest('damage-application');
    if(!element||isHealingTray(element))return;
    event.preventDefault();event.stopImmediatePropagation();void element._onApplyDamage(event);
  },true);
  Hooks.on('targetToken',(user)=>{if(user.id!==game.user.id)return;for(const element of document.querySelectorAll('damage-application'))element.buildTargetsList?.();});
  for(const element of document.querySelectorAll('damage-application'))element.buildTargetsList?.();
  STATE.nativeTargetDamagePatch=!!tray;
  return !!tray;
}
