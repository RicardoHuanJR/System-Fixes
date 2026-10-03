import { MODULE_ID, SYSTEM_ID, STATE } from './shared.js';
import { featureEnabled } from './feature-settings.js';
import { queueActor } from './automation-runtime.js';

// This is an OPRPG adapter, not a replacement MidiQOL global or D&D5e workflow.
const finalFields = new Set(['system.attributes.ac.value', 'system.attributes.hp.max',
  'system.shieldPoints.max', 'system.armorPoints.max', 'system.energy.max']);
const labels = {
  'system.attributes.ac.bonus':'Classe de Resistência — bônus',
  'system.shieldPoints.value':'Pontos de Escudo — atuais',
  'system.shieldPoints.max':'Pontos de Escudo — máximo',
  'system.armorPoints.value':'Pontos de Armadura — atuais',
  'system.armorPoints.max':'Pontos de Armadura — máximo',
  'system.energy.total':'Pontos de Poder — atuais',
  'system.energy.max':'Pontos de Poder — máximo',
  'system.energy.bonuses.overall':'Pontos de Poder — bônus'
};
const phases = new Set(['preItemRoll','preAttackRoll','preDamageRoll','preSave','postAttackRoll','postDamageRoll','postSave','postItemRoll','postActiveEffects','DamageBonus']);
let installed=false;
const get=(object,path)=>foundry.utils.getProperty(object,path);
const enabled=()=>game.system?.id===SYSTEM_ID && featureEnabled('externalCompatibility');
const truth=value=>value===true || value===1 || value==='true';
const daeAPI=()=>game.modules?.get('dae')?.active
  ? game.modules.get('dae').api ?? globalThis.DAE : null;

export function externalCompatibilityStatus() {
  const dae=game.modules?.get('dae'),midi=game.modules?.get('midi-qol');
  return {installed,enabled:enabled(),dae:{active:!!dae?.active,version:dae?.version??null,
    apiReady:!!daeAPI(),adapter:'generic-oprpg',requiresUntestedSystems:true},
    midi:{active:!!midi?.active,version:midi?.version??null,fullWorkflowSupported:false,
      supported:['advantage','disadvantage','typed-damage-api','world-on-use-macros','item-macro-api','damage-bonus','simple-over-time','pre-roll-phases','post-active-effects']},
    automaticMacros:game.settings.get(MODULE_ID,'compatibilityMacros')===true};
}

export function adaptDAESpecs(_type,specs) {
  if(!enabled())return;
  for(const [key,spec] of Object.entries(specs)) {
    if(finalFields.has(key))spec.phase='final';
    if(labels[key]){spec.label=labels[key];spec.description=labels[key];}
  }
}

export function addMidiFlagSpecs(_type,specials) {
  if(!enabled())return;
  for(const mode of ['advantage','disadvantage'])for(const kind of ['all','attack.all',
    'attack.mwak','attack.rwak','attack.msak','attack.rsak',
    'ability.save.all','ability.check.all','skill.all',
    ...Object.keys(CONFIG.DND5E?.abilities??{}).flatMap(id=>[`ability.save.${id}`,`ability.check.${id}`]),
    ...Object.keys(CONFIG.DND5E?.skills??{}).map(id=>`skill.${id}`)]) {
    const key=`flags.midi-qol.${mode}.${kind}`;
    specials[key]??=[new foundry.data.fields.BooleanField({label:`${mode==='advantage'?'Vantagem':'Desvantagem'} — ${kind}`}), ''];
  }
}

export function applyMidiRollFlags(config,kind) {
  if(!enabled())return;
  // If the real Midi workflow is running, it owns its flags; never apply twice.
  if(game.modules?.get('midi-qol')?.active && globalThis.MidiQOL?.Workflow)return;
  const subject=config?.subject,actor=subject?.actor??(subject?.documentName==='Actor'?subject:null);
  if(!actor)return;
  const suffixes=['all'];
  if(kind==='attack') {
    suffixes.push('attack.all');
    const range=subject.attack?.type?.value, classification=subject.attack?.type?.classification;
    const action=subject.item?.system?.actionType ?? (['melee','ranged'].includes(range)
      ? (range==='melee'?'m':'r')+(classification==='spell'?'sak':'wak') : null);
    if(['mwak','rwak','msak','rsak'].includes(action))suffixes.push(`attack.${action}`);
  } else if(kind==='save'||kind==='check') {
    suffixes.push(`ability.${kind}.all`);
    if(config.ability)suffixes.push(`ability.${kind}.${config.ability}`);
  } else if(kind==='skill') {
    suffixes.push('skill.all','ability.check.all');
    if(config.skill)suffixes.push(`skill.${config.skill}`);
    if(config.ability)suffixes.push(`ability.check.${config.ability}`);
  }
  for(const mode of ['advantage','disadvantage'])if(suffixes.some(path=>truth(get(actor.flags?.['midi-qol'],`${mode}.${path}`))
    || truth(get(subject.item?.flags?.['midi-qol'],`${mode}.${path}`))))config[mode]=true;
  // Leave simultaneous advantage/disadvantage for native cancellation and dialog overrides.
}

export function parseOnUseMacros(value) {
  if(typeof value!=='string')return [];
  return value.split(',').map(entry=>{
    const match=entry.trim().match(/^(?:\[([^\]]+)\])?(.+)$/);
    return match?{phase:match[1]??'postActiveEffects',name:match[2].trim()}:null;
  }).filter(Boolean);
}
export async function runItemMacros(item,phase,context={}) {
  if(!enabled())throw Error('Compatibilidade externa desativada.');
  if(!item?.isOwner)throw Error('Você precisa controlar o item para executar suas macros.');
  if(!phases.has(phase))throw Error('Esta etapa de macro ainda não possui adaptação OPRPG.');
  if(game.modules?.get('midi-qol')?.active && globalThis.MidiQOL?.Workflow)
    throw Error('O Midi-QOL ativo deve executar suas próprias macros.');
  const entries=parseOnUseMacros(item.flags?.['midi-qol']?.onUseMacroName)
    .filter(entry=>entry.phase===phase || entry.phase==='all');
  const results=[];
  for(const entry of entries) {
    // Never evaluate imported source strings or pretend to implement ItemMacro.
    let macro;
    if(entry.name==='ItemMacro'||entry.name.startsWith('ItemMacro.')){
      const target=entry.name==='ItemMacro'?item:await fromUuid(entry.name.slice('ItemMacro.'.length));
      if(!target?.isOwner||typeof target.executeMacro!=='function')throw Error('ItemMacro precisa do módulo Item Macro e de um item que você controla.');
      macro={documentName:'Macro',canExecute:true,execute:data=>target.executeMacro(data)};
    }else macro=entry.name.startsWith('Macro.')?await fromUuid(entry.name):game.macros?.getName?.(entry.name);
    if(!macro || macro.documentName!=='Macro' || !macro.canExecute)
      throw Error(`Macro indisponível ou sem permissão: ${entry.name}`);
    const actor=item.actor;
    results.push(await macro.execute({actor,item,token:actor?.getActiveTokens?.()[0]??null,
      args:[{...context,tag:'OnUse',macroPass:phase,actorUuid:actor?.uuid,itemUuid:item.uuid,
        oprpgCompatibility:true}]}));
  }
  return results;
}

export function compatibilityTargets(targets=game.user.targets) {
  return [...new Map(Array.from(targets??[],target=>target?.actor??target)
    .filter(actor=>actor?.documentName==='Actor').map(actor=>[actor.uuid,actor])).values()];
}
export async function applyCompatibilityDamage(damage,targets,{multiplier=1,operationId}={}) {
  if(!enabled())throw Error('Compatibilidade externa desativada.');
  if(!Array.isArray(damage)||!damage.length||damage.some(part=>!Number.isFinite(part.value)||part.value<0
    || !(part.type in (CONFIG.DND5E?.damageTypes??{}))))throw Error('Informe dano numérico com tipos válidos do OPRPG.');
  if(![0,0.25,0.5,1,2].includes(multiplier))throw Error('Multiplicador de dano inválido.');
  if(operationId!==undefined && (typeof operationId!=='string'||!operationId||operationId.length>160))throw Error('Identificador da aplicação inválido.');
  const actors=compatibilityTargets(targets);
  if(!actors.length)throw Error('Marque pelo menos um alvo.');
  if(actors.some(actor=>!actor.isOwner||typeof actor.applyDamage!=='function'))throw Error('O mestre ou dono dos alvos deve aplicar este dano.');
  const results=[];
  for(const actor of actors)results.push(await queueActor(actor,async()=>{
    const receipts=actor.getFlag(MODULE_ID,'externalDamageReceipts')??[];
    if(operationId && receipts.includes(operationId))return {actorUuid:actor.uuid,duplicate:true};
    const options={multiplier,oprpgCompatibility:true};
    const hook=operationId?Hooks.on('dnd5e.preApplyDamage',(target,_amount,updates,context)=>{
      if(target===actor && context===options)updates[`flags.${MODULE_ID}.externalDamageReceipts`]=[...receipts,operationId].slice(-100);
    }):null;
    try{await actor.applyDamage(foundry.utils.deepClone(damage),options);}
    finally{if(hook!==null)Hooks.off('dnd5e.preApplyDamage',hook);}
    return {actorUuid:actor.uuid,duplicate:false};
  }));
  return results;
}

export async function applyCompatibilityEffects(activity,targets,{effectUuids,activate=true,sourceMessage=null}={}) {
  if(!enabled())throw Error('Compatibilidade externa desativada.');
  if(!activity?.item?.isOwner)throw Error('Você precisa controlar o item de origem.');
  const api=daeAPI();
  if(!api?.doActivityEffects)throw Error('Ative o DAE e permita sistemas não testados nas configurações dele; depois recarregue.');
  const linked=Array.from(activity.effects??[],entry=>entry.effect).filter(effect=>effect&&!effect.transfer);
  const ids=effectUuids??linked.map(effect=>effect.uuid);
  if(!ids.length || ids.some(id=>!linked.some(effect=>effect.uuid===id)))throw Error('Selecione apenas efeitos vinculados a esta atividade.');
  let actors=compatibilityTargets(targets);
  if(sourceMessage){
    const execution=sourceMessage.getFlag?.('oprpg-system-fixes','areaExecution');
    if(execution){
      if(execution.status!=='ready'||execution.activityUuid!==activity.uuid)throw Error('Execução da área inválida para estes efeitos.');
      actors=actors.filter(actor=>execution.targets.includes(actor.uuid)&&!execution.protected.includes(actor.uuid));
      if(!actors.length)return [];
    }
  }
  if(!actors.length)throw Error('Marque pelo menos um alvo.');
  // Delegate creation, durations, effect macros and GM routing to DAE itself.
  return api.doActivityEffects(activity,activate,actors,ids,{
    origin:activity.item.uuid,context:{},selfEffects:'none',toggleEffect:false});
}

export function openDAEEffects(actor) {
  if(!enabled())throw Error('Compatibilidade externa desativada.');
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  const api=daeAPI();if(!api?.ActiveEffects)throw Error('O editor do DAE não está disponível.');
  return api.ActiveEffects(actor).render(true);
}

export function installExternalCompatibility() {
  if(installed)return true;if(!enabled())return false;installed=true;
  Hooks.on('dae.modifySpecs',adaptDAESpecs);
  Hooks.on('dae.modifySpecials',addMidiFlagSpecs);
  for(const [hook,kind] of [['Attack','attack'],['SavingThrow','save'],['AbilityCheck','check'],['Skill','skill']])
    Hooks.on(`dnd5e.preRoll${hook}V2`,config=>applyMidiRollFlags(config,kind));
  const macros=(item,phase,context)=>{
    if(!enabled()||!game.settings.get(MODULE_ID,'compatibilityMacros')||!item?.flags?.['midi-qol']?.onUseMacroName)return;
    if(game.modules?.get('midi-qol')?.active && globalThis.MidiQOL?.Workflow)return;
    runItemMacros(item,phase,context).catch(error=>{
      STATE.warnings.push(`Macro de compatibilidade: ${error.message}`);console.error(error);
    });
  };
  for(const [hook,phase] of [['Attack','postAttackRoll'],['Damage','postDamageRoll'],['SavingThrow','postSave']])
    Hooks.on(`dnd5e.roll${hook}V2`,(rolls,{subject}={})=>macros(subject?.item,phase,{rolls}));
  Hooks.on('oprpgFixes.postActiveEffects',context=>macros(context.activity?.item,'postActiveEffects',context));
  Hooks.on('dnd5e.postUseActivity',(activity,_config,results)=>macros(activity?.item,'postItemRoll',{results}));
  STATE.externalCompatibilityPatch=true;return true;
}
