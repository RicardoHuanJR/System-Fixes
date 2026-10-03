import { MODULE_ID, STATE } from './shared.js';
import { withActorOperation } from './operation-history.js';

const mark=Symbol.for('oprpg-fixes.book21');
const value=(o,p)=>foundry.utils.getProperty(o,p);
const setting=(key,fallback)=>{try{return game.settings.get(MODULE_ID,key)??fallback}catch{return fallback}};
const tracked=a=>a?.type==='character'||(a?.type==='npc'&&a.getFlag?.(MODULE_ID,'trackNegativeHP')===true);
let installed=false;

export function registerBookSettings(){
  game.settings.register(MODULE_ID,'exhaustedRestPP',{name:'PP no descanso com Exaustão',hint:'O livro diverge: p. 278 verifica o início; p. 36 prevê metade se exausto ao final. Perguntar não escolhe uma regra silenciosamente.',scope:'world',config:true,type:String,default:'ask',choices:{ask:'Perguntar em cada descanso exausto',page278:'Página 278: nenhum PP se iniciou exausto',page36:'Página 36: metade se terminou exausto'}});
}

export function lifeUpdates(actor,{damage=0,hpBefore,nonlethal=false}={}){
  if(!tracked(actor))return {};
  const hp=actor.system.attributes.hp;
  hpBefore=Number(hpBefore??hp.value);
  const max=Math.max(0,Number(hp.effectiveMax??hp.max)||0);
  damage=Math.max(0,Number(damage)||0);
  if(!damage||!max)return {};
  const previous=Math.max(0,Number(actor.getFlag?.(MODULE_ID,'negativeHP'))||0);
  const negative=hpBefore<=0?previous+damage:0;
  const dead=!nonlethal&&(hpBefore<=0?negative>=max:damage-hpBefore>=max);
  const updates={};
  if(hpBefore<=0)updates[`flags.${MODULE_ID}.negativeHP`]=negative;
  if(dead)updates[`flags.${MODULE_ID}.deathByDamage`]=true;
  return updates;
}

export function restPP({current=0,max=0,startExhaustion=0,endExhaustion=0,mode='page278',blocked=false}){
  if(blocked||(mode==='page278'&&startExhaustion>0))return current;
  if(mode==='page36'&&endExhaustion>0)return Math.min(max,current+Math.floor(max/2));
  return max;
}

export function installLegendaryRules(Model){
  const p=Model?.prototype;if(!p||p[mark])return !!p;
  const recover=p.recoverCombatUses;
  if(typeof recover==='function')p.recoverCombatUses=async function(periods,results){
    const shifted=periods.filter(x=>x!=='turnStart'&&x!=='turnEnd');
    await recover.call(this,shifted,results);
    if(this.resources.legact.max&&periods.includes('turnStart'))results.actor['system.resources.legact.spent']=0;
  };
  if(typeof p.resistSave==='function')p.resistSave=async function(message){
    return withActorOperation(this.parent,async()=>{
      const current=message.flags?.['oprpg-system']?.roll,legacy=message.flags?.JujutsuLegacy?.roll,older=message.flags?.OPRPG?.roll;
      if((current?.type??legacy?.type??older?.type)!=='save')throw Error('A mensagem não contém uma salvaguarda.');
      if(current?.forceSuccess||legacy?.forceSuccess||older?.forceSuccess)throw Error('Esta salvaguarda já foi convertida em sucesso.');
      if(!(this.resources.legres.value>0))throw Error('Sem resistências lendárias disponíveis.');
      const spent=Number(this.resources.legres.spent)||0;
      await this.parent.update({'system.resources.legres.spent':spent+1});
      try{await message.setFlag('oprpg-system','roll',{...(older??{}),...(legacy??{}),...(current??{}),type:'save',forceSuccess:true})}
      catch(error){await this.parent.update({'system.resources.legres.spent':spent});throw error;}
    });
  };
  p[mark]=true;return true;
}

function nightChild(actor){
  const names=[actor.system.details?.race?.name,...Array.from(actor.items??[]).filter(i=>i.type==='race').map(i=>i.name)];
  return names.some(n=>/filh[oa].*noite/i.test(String(n??'')));
}

export function installRestRules(Actor){
  const p=Actor?.prototype;if(!p||p[Symbol.for('oprpg-fixes.rest21')])return !!p;
  const original=p._rest;if(typeof original!=='function')return false;
  p._rest=async function(config={},result={}){
    if(this.type!=='character')return original.call(this,config,result);
    return withActorOperation(this,async()=>{
    config={...config,autoEnergyED:false,fraction:0.5};
    const start=config.oprpgRestStart??{hp:this.system.attributes.hp.value,exhaustion:this.system.attributes.exhaustion??0};
    if(config.type==='long'){
      if(nightChild(this)){ui.notifications.warn('Filho da Noite usa meditação com benefícios próprios. Aplique a opção de meditação escolhida, em vez de descanso longo.');return;}
      if(!(start.hp>0)){ui.notifications.warn('O descanso longo exige pelo menos 1 PV no início.');return;}
      const now=Number(game.time.worldTime)||0,last=this.getFlag(MODULE_ID,'lastLongRest');
      const end=now+(config.advanceTime?60*(Number(config.duration)||480):0);
      if(Number.isFinite(last)&&end-last<86400){ui.notifications.warn('Ainda não passaram 24 horas desde o último benefício de descanso longo.');return;}
      let mode=setting('exhaustedRestPP','ask');
      if(mode==='ask'&&start.exhaustion>0){
        mode=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:'Descanso: PP e Exaustão'},content:'<p>O livro possui duas regras. Qual interpretação aplicar neste descanso?</p>',buttons:[{action:'page278',label:'P. 278: verificar início',callback:()=> 'page278'},{action:'page36',label:'P. 36: verificar final',callback:()=> 'page36'}],close:()=>null,rejectClose:false});
        if(!mode)return;
      }
      config.oprpgRestRule=mode==='ask'?'page278':mode;
      config.oprpgRestStart=start;config.exhaustionDelta=-1;config.oprpgRestEnd=end;
    }
    return original.call(this,config,result);
    });
  };
  // Native aura dice belong to the inherited system, not the OPRPG rest rule.
  const energyRecovery=p._getRestEnergyDiceRecovery;
  if(typeof energyRecovery==='function')p._getRestEnergyDiceRecovery=function(config,result){if(this.type==='character')return;return energyRecovery.call(this,config,result)};
  p[Symbol.for('oprpg-fixes.rest21')]=true;return true;
}

export async function installBookRules(){
  if(installed)return true;installed=true;
  let Model=CONFIG.Actor?.dataModels?.npc;
  if(!Model){try{Model=(await import('/systems/oprpg-system/module/data/actor/npc.mjs')).default}catch(error){STATE.warnings.push('Regras lendárias: '+error.message)}}
  installLegendaryRules(Model);installRestRules(CONFIG.Actor?.documentClass);
  Hooks.on('renderChatMessageHTML',(message,element)=>{
    if(message.isContentVisible===false||!message.flags?.['oprpg-system']?.roll?.forceSuccess)return;
    for(const total of (element?.[0]??element)?.querySelectorAll?.('.dice-total')??[]){total.classList.remove('failure','fumble');total.classList.add('success');}
  });
  if(CONFIG.DND5E?.restTypes?.short?.duration)CONFIG.DND5E.restTypes.short.duration.normal=30;
  for(const name of ['dnd5e.preShortRest','dnd5e.preLongRest','dnd5e.shortRest','dnd5e.longRest'])Hooks.on(name,(actor,config)=>{
    if(actor.type!=='character')return;
    config.autoEnergyED=false;
    config.oprpgRestStart??={hp:actor.system.attributes.hp.value,exhaustion:actor.system.attributes.exhaustion??0};
  });
  Hooks.on('dnd5e.preRestCompleted',(actor,result,config)=>{
    if(actor.type!=='character'||config.type!=='long'||!config.oprpgRestRule)return;
    const start=config.oprpgRestStart.exhaustion;
    const end=Number(result.updateData['system.attributes.exhaustion']??value(result.updateData,'system.attributes.exhaustion')??start);
    result.updateData['system.energy.total']=restPP({current:actor.system.energy.total,max:actor.system.energy.max,startExhaustion:start,endExhaustion:end,mode:config.oprpgRestRule,blocked:actor.getFlag(MODULE_ID,'blockPPRest')===true});
    result.updateData[`flags.${MODULE_ID}.lastLongRest`]=config.oprpgRestEnd;
  });
  Hooks.on('renderShortRestDialog',(_app,element)=>{
    const root=element?.[0]??element;
    root?.querySelector('[data-action="rollEnergyDie"]')?.closest('fieldset')?.remove();
  });
  Hooks.on('dnd5e.preApplyDamage',(actor,amount,updates,options={})=>{
    const hp=actor.system.attributes.hp;
    const shieldSpent=Math.max(0,Number(actor.system.shieldPoints?.value??0)-Number(updates['system.shieldPoints.value']??actor.system.shieldPoints?.value??0));
    const tempSpent=Math.max(0,Number(hp.temp??0)-Number(updates['system.attributes.hp.temp']??hp.temp??0));
    Object.assign(updates,lifeUpdates(actor,{damage:Math.max(0,amount-shieldSpent-tempSpent),nonlethal:options.nonlethal===true}));
  });
  Hooks.on('oprpgFixes.preShieldDamageApplied',({actor,changes,adjustment:a})=>{
    // Final HP/overflow values can be changed by native repair extensions.
    if(a.hpAfter>0)return;
    Object.assign(changes,lifeUpdates(actor,{hpBefore:a.hpBefore,damage:Number(a.hpLoss||0)+Number(a.unabsorbed||0)}));
  });
  Hooks.on('preUpdateActor',(actor,changes)=>{
    const next=changes['system.attributes.hp.value']??value(changes,'system.attributes.hp.value');
    if(tracked(actor)&&Number(next)>0&&actor.system.attributes.hp.value<=0){
      changes[`flags.${MODULE_ID}.negativeHP`]=0;
      changes[`flags.${MODULE_ID}.deathByDamage`]=false;
    }
  });
  Hooks.on('updateActor',(actor,changes,_options,userId)=>{
    if(userId!==game.user.id||!tracked(actor))return;
    const death=changes[`flags.${MODULE_ID}.deathByDamage`]??value(changes,`flags.${MODULE_ID}.deathByDamage`);
    if(death===true)ui.notifications.warn(`${actor.name}: atingiu o limite de morte por dano. Confira nocaute ou efeitos especiais antes de encerrar a ficha.`);
  });
  const renderControls=(sheet,element=sheet.element)=>{
    const actor=sheet.actor;if(!actor||!['character','npc'].includes(actor.type))return;
    const root=element?.[0]??element;if(!root?.querySelector)return;
    root.querySelector('.oprpg-negative-hp')?.remove();
    root.querySelectorAll('.oprpg-book-controls').forEach(button=>button.remove());
    const n=Number(actor.getFlag(MODULE_ID,'negativeHP'))||0;
    if(tracked(actor)&&n>0){const line=document.createElement('p');line.className='oprpg-negative-hp';line.textContent=`PV negativos: ${n} / ${actor.system.attributes.hp.max}`;root.append(line);}

  };
  for(const event of ['renderActorSheetV2','renderActorSheet','renderCharacterActorSheet','renderApplicationV2'])Hooks.on(event,renderControls);
  STATE.bookRulesPatch=true;return true;
}

