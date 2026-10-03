import { MODULE_ID, STATE, getCardActivity } from './shared.js';
import { captureCardMeta } from './shield-points-fix.js';
import { applyDamageState } from './multi-activity-damage-fix.js';

const resolving=new Set();
let installed=false,applyRequest;
const esc=value=>foundry.utils.escapeHTML(String(value??''));
const activeGM=()=>game.users?.activeGM;
export async function requestTargetDamage(button,card,actors){
  if(game.user.isGM)throw Error('O mestre precisa ter permissão sobre os alvos.');
  if(!activeGM())throw Error('Não há mestre conectado para receber a solicitação de dano.');
  const meta=captureCardMeta(button,card),source=game.messages?.get(meta.messageId);
  const {actor}=getCardActivity(card);
  if(!source||source.isContentVisible===false||!actor?.isOwner)throw Error('Solicite dano a partir do cartão de uma ficha que você controla.');
  if(!Number.isFinite(meta.amount)||meta.amount<0)throw Error('Role o dano antes de solicitar.');
  // Persist only identifiers and a proposed amount, never executable data or Document objects.
  const request={source:source.id,requester:game.user.id,targets:actors.map(a=>a.uuid),itemId:meta.itemId,activityId:meta.activityId,action:meta.action,amount:meta.amount,state:'pending'};
  const message=await ChatMessage.create({
    content:`<div class="oprpg-damage-request"><strong>Solicitação de dano</strong><p>${esc(game.user.name)} solicita ${meta.amount} de dano em ${actors.map(a=>esc(a.name)).join(', ')}.</p><button type="button" data-fixes-damage-request="approve">Revisar e aplicar (mestre)</button><button type="button" data-fixes-damage-request="reject">Recusar (mestre)</button></div>`,
    whisper:[...new Set([game.user.id,...game.users.filter(u=>u.isGM).map(u=>u.id)])],
    flags:{[MODULE_ID]:{damageRequest:request}}
  });
  ui.notifications.info('Solicitação enviada ao mestre. Os alvos ainda não receberam dano.');
  return message;
}
export async function resolveDamageRequest(message,approve=true){
  if(!game.user.isGM||activeGM()?.id!==game.user.id)throw Error('Apenas o mestre ativo pode resolver esta solicitação.');
  const request=message?.getFlag(MODULE_ID,'damageRequest');
  if(!request||request.state!=='pending'||resolving.has(message.id))return [];
  resolving.add(message.id);
  try{
    if(!approve){await message.update({[`flags.${MODULE_ID}.damageRequest.state`]:'rejected',content:'Solicitação de dano recusada pelo mestre.'});return [];}
    const requester=game.users.get(request.requester),source=game.messages?.get(request.source);
    if(!source||!requester||message.author?.id!==request.requester)throw Error('Origem ou autor da solicitação inválido.');
    const holder=document.createElement('article');holder.dataset.messageId=source.id;holder.innerHTML=source.content;
    const card=[...holder.querySelectorAll('.jujutsu-card, .jj-card, [data-item-id]')].find(c=>c.dataset.itemId===request.itemId&&(c.dataset.activityId??null)===(request.activityId??null));
    const damageState=source.getFlag?.(MODULE_ID,'multiActivityDamage');
    if(card&&damageState)applyDamageState(card,damageState);
    const button=[...(card?.querySelectorAll('[data-action]')??[])].find(b=>b.dataset.action===request.action);
    if(!card||!button)throw Error('O cartão de dano original não está mais disponível.');
    const {actor}=getCardActivity(card);
    if(!actor?.testUserPermission(requester,'OWNER'))throw Error('O solicitante não controla a ficha de origem.');
    const meta=captureCardMeta(button,card);
    if(meta.activityId!==request.activityId)throw Error('A atividade de origem mudou. Aplique pelo cartão após conferir.');
    // Modified card totals are not silently accepted from another client.
    if(!Number.isFinite(meta.amount)||meta.amount<0||meta.amount!==request.amount)throw Error('O total solicitado difere do cartão original. O mestre deve conferir os modificadores e aplicar pelo cartão.');
    if(!Array.isArray(request.targets)||!request.targets.length||request.targets.length>100)throw Error('Lista de alvos inválida.');
    const actors=[...new Map((await Promise.all(request.targets.map(uuid=>fromUuid(uuid)))).map(a=>[a?.uuid,a])).values()];
    if(actors.some(a=>!a||a.documentName!=='Actor'||!a.isOwner))throw Error('Um dos alvos não existe mais ou não pode ser alterado.');
    const confirmed=await foundry.applications.api.DialogV2.confirm({classes:['oprpg-fixes-dialog'],window:{title:'Aplicar dano solicitado'},content:`<p>Aplicar <strong>${meta.amount}</strong> de dano de ${esc(actor.name)} em ${actors.map(a=>esc(a.name)).join(', ')}?</p><p>As defesas atuais de cada alvo serão usadas. A solicitação não consome novamente a técnica.</p>`,rejectClose:false});
    if(!confirmed)return [];
    const applied=await applyRequest(button,card,actors);
    await message.update({[`flags.${MODULE_ID}.damageRequest.state`]:'resolved',content:`Solicitação resolvida pelo mestre. ${applied.length?`Dano aplicado em ${applied.map(esc).join(', ')}.`:'Sem nova aplicação: cancelada ou já registrada.'}`});
    return applied;
  }finally{resolving.delete(message.id)}
}
export function installDamageRequests(apply){
  applyRequest=apply;if(installed)return;installed=true;
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-fixes-damage-request]');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    const message=game.messages?.get(button.closest('[data-message-id]')?.dataset.messageId);
    void resolveDamageRequest(message,button.dataset.fixesDamageRequest==='approve').catch(e=>ui.notifications.error(e.message));
  },true);
  STATE.damageRequestsPatch=true;
}
