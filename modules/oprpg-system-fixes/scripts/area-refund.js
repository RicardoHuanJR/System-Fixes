import { MODULE_ID } from './shared.js';
import { queueActor } from './automation-runtime.js';

export function ppDeltas(message){
  const consumed=message?.system?.deltas??message?.flags?.[MODULE_ID]?.consumed;
  return (consumed?.actor??[]).filter(row=>['system.energy.total','system.energy.generated'].includes(row.keyPath)&&Number.isFinite(row.delta)&&row.delta<0);
}
export async function refundCancelledArea(activity,message){
  if(!message||game.settings.get(MODULE_ID,'refundCancelledAreas')===false)return {refunded:false,reason:'disabled'};
  const actor=activity?.actor??activity?.item?.actor;
  if(!actor?.isOwner||!game.user.isGM&&message.author?.id!==game.user.id)throw Error('Somente o autor ou mestre pode cancelar e devolver PP.');
  if(message.getFlag(MODULE_ID,'areaExecution')?.status==='ready')throw Error('Não é possível reembolsar uma execução já confirmada.');
  if(Array.from(game.messages??[]).some(m=>m.getFlag?.(MODULE_ID,'saveResult')?.source===message.id))throw Error('Uma salvaguarda já foi resolvida para esta técnica.');
  const deltas=ppDeltas(message);if(!deltas.length)return {refunded:false,reason:'no-recorded-consumption'};
  return queueActor(actor,async()=>{
    const receipts=actor.getFlag(MODULE_ID,'cancelledAreaRefunds')??[];
    if(receipts.includes(message.id))return {refunded:false,reason:'already-refunded'};
    const changes={[`flags.${MODULE_ID}.cancelledAreaRefunds`]:[...receipts,message.id].slice(-200)};
    let restored=0;
    for(const row of deltas){
      const current=Number(foundry.utils.getProperty(actor,row.keyPath));
      const cap=Number(actor.system.energy.max);
      if(!Number.isFinite(current)||!Number.isFinite(cap)||cap<0)throw Error('Recursos de PP inválidos; confira a ficha antes de devolver.');
      const next=Math.max(current,Math.min(cap,current-row.delta));changes[row.keyPath]=next;restored+=Math.max(0,next-current);
    }
    await actor.update(changes,{oprpgFixesRefund:true});return {refunded:true,restored};
  });
}
export function installAreaRefund(){
  Hooks.on('dnd5e.postActivityConsumption',(_activity,_usage,messageConfig)=>{
    const consumed=messageConfig?.data?.system?.deltas;
    if(consumed)foundry.utils.setProperty(messageConfig,`data.flags.${MODULE_ID}.consumed`,foundry.utils.deepClone(consumed));
  });
}
