import { MODULE_ID } from './shared.js';

export function areaExecution(message) {
  const direct=message?.getFlag?.(MODULE_ID,'areaExecution');if(direct)return direct;
  const source=message?.flags?.OPRPG?.originatingMessage??message?.flags?.dnd5e?.originatingMessage;
  return source?game.messages?.get(source)?.getFlag?.(MODULE_ID,'areaExecution')??null:null;
}
export function areaProtected(message,actor) { return !!areaExecution(message)?.protected?.includes(actor?.uuid); }
export async function executionActors(message,fallback) {
  const state=areaExecution(message);
  if(!state)return fallback;
  if(state.status!=='ready')throw Error('Conclua a escolha dos alvos da área antes de resolver esta técnica.');
  const actors=await Promise.all(state.targets.map(uuid=>fromUuid(uuid)));
  if(actors.some(a=>!a||a.documentName!=='Actor'))throw Error('Um alvo da execução não existe mais. Confira o cartão antes de aplicar.');
  return actors.filter(a=>!areaProtected(message,a));
}
export function areaSaveMultiplier(message,actor,activity,messages=game.messages) {
  if(areaProtected(message,actor))return 0;
  const state=areaExecution(message);
  if(!state)return 1;
  if(state.status!=='ready'||!state.targets.includes(actor.uuid))throw Error('Alvo não pertence a esta execução da área.');
  if(activity?.type!=='save')return 1;
  const result=Array.from(messages??[]).find(m=>{
    const flag=m.getFlag?.(MODULE_ID,'saveResult');
    const source=state.sourceId??message.id;
    return flag?.source===source&&flag.actor===actor.uuid&&flag.key?.startsWith(`${source}:${state.activityId}:`)&&Number.isFinite(flag.total);
  })?.getFlag(MODULE_ID,'saveResult');
  if(!result)throw Error(`${actor.name}: conclua a salvaguarda antes de aplicar o dano.`);
  if(!result.success)return 1;
  return activity.damage?.onSave==='none'?0:activity.damage?.onSave==='half'?0.5:1;
}
