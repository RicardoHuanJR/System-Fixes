import { MODULE_ID, STATE } from './shared.js';
import { withActorOperation } from './operation-history.js';
import { messageAudience, showPrivateDice } from './roll-privacy.js';

const rollData=message=>message?.getFlag?.('OPRPG','roll')??message?.getFlag?.('dnd5e','roll')??message?.getFlag?.('JujutsuLegacy','roll');
export function hakiSpent(actor,trees){
  const selected=actor.getFlag('oprpg-system','haki')?.talentos??{};
  return Object.values(trees??{}).reduce((sum,tree)=>sum+(tree.talentos??[]).reduce((n,t)=>n+Math.max(0,Math.min(3,Number(selected[t.id])||0))*Number(t.custo||0),0),0);
}
export function hakiCheckMessages(actor){
  return Array.from(game.messages??[]).filter(m=>{
    const r=rollData(m);
    return r?.type==='skill'&&r.skillId==='haki'&&m.speaker?.actor===actor.id&&m.isContentVisible!==false&&!m.getFlag?.(MODULE_ID,'peritoReroll');
  }).slice(-15).reverse();
}
export async function rerollPerito(actor,message){
  return withActorOperation(actor,async()=>{
    if(!hakiCheckMessages(actor).includes(message))throw Error('Selecione um teste de Haki desta ficha.');
    // Also distinguish unlinked tokens which share the base Actor ID.
    if(actor.isToken&&message.speaker?.token!==actor.token?.id)throw Error('O teste pertence a outro token.');
    const {HAKI_TREES}=await import('/systems/oprpg-system/module/systems/haki-talentos.mjs');
    if(!HAKI_TREES)throw Error('O catálogo nativo de Haki não está disponível.');
    if(hakiSpent(actor,HAKI_TREES)<71)throw Error('A ficha ainda não alcançou o estágio Perito (71 PA distribuídos).');
    const day=Math.floor(Number(game.time?.worldTime??0)/(Number(CONFIG.time?.dayTime)||86400));
    if(actor.getFlag(MODULE_ID,'peritoDay')===day)throw Error('A repetição de Perito já foi usada neste dia do mundo.');
    const roll=message.rolls?.[0];
    if(!roll||!Number.isFinite(roll.total))throw Error('O teste não possui um resultado válido.');
    if(roll.isSuccess===true)throw Error('Perito só pode repetir um teste que falhou.');
    const confirmed=await foundry.applications.api.DialogV2.confirm({classes:['oprpg-fixes-dialog'],window:{title:'Perito — repetir Haki'},content:'<p>Confirma que este teste de Haki falhou? A repetição gasta o uso diário e o segundo resultado deve ser usado, mesmo que seja menor.</p>',rejectClose:false});
    if(!confirmed)return null;
    const audience=messageAudience(message);
    const ability=roll.options?.ability??roll.data?.abilityId;
    const config={skill:'haki',...(ability?{ability}:{}),...(Number.isFinite(roll.options?.target)?{target:roll.options.target}:{}),...(Number.isFinite(roll.options?.advantageMode)?{rolls:[{options:{advantageMode:roll.options.advantageMode}}]}:{})};
    const result=await actor.rollSkill(config,{options:{window:{title:'Perito — segundo resultado obrigatório'}}},{create:false,rollMode:'selfroll'});
    const second=Array.isArray(result)?result[0]:result;
    if(!second||!Number.isFinite(second.total))return null;
    // Store the charge before touching the source message: a chat permission failure
    // must never grant a free daily reroll.
    await actor.update({[`flags.${MODULE_ID}.peritoDay`]:day});
    const rollFlags={messageType:'roll',roll:{type:'skill',skillId:'haki'}};
    const rerollMessage=await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),rolls:[second],sound:CONFIG.sounds?.dice,flavor:'Perito — Haki: segundo resultado obrigatório',whisper:audience.whisper,blind:audience.blind,flags:{OPRPG:rollFlags,dnd5e:rollFlags,[MODULE_ID]:{peritoReroll:message.id}}});
    await showPrivateDice(second,{message:rerollMessage,actor});
    if(message.isOwner||game.user.isGM)await message.update({[`flags.${MODULE_ID}.peritoReroll`]:{day,total:second.total}});
    STATE.peritoRerolls=Number(STATE.peritoRerolls??0)+1;
    return second;
  });
}
