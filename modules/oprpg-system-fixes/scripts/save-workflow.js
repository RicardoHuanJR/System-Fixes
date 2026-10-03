import { MODULE_ID, STATE, getCardActivity } from './shared.js';
import { messageAudience, showPrivateDice } from './roll-privacy.js';
import { rollSelectedActivityDamage, applyDamageState, prepareSaveDamageCard } from './multi-activity-damage-fix.js';
import { targetActors } from './target-damage.js';
import { styleSaveDamageButton } from './presentation.js';
import { areaExecution, areaProtected, executionActors } from './area-state.js';

const busy=new Set();
let installed=false;
const esc=value=>foundry.utils.escapeHTML(String(value??''));
function sourceCard(message) {
  const root=document.createElement('div');root.innerHTML=message?.content??'';
  return root.querySelector('.jujutsu-card[data-card-type="save"]');
}
export function hasCompletedSave(message,card,extra=null) {
  if(!message?.id || !card?.dataset.activityId)return false;
  const matches=result=>{
    const info=result?.getFlag?.(MODULE_ID,'saveResult');
    return info?.source===message.id && info.key?.startsWith(`${message.id}:${card.dataset.activityId}:`) && Number.isFinite(info.total);
  };
  return matches(extra)||Array.from(game.messages??[]).some(matches);
}
export function refreshSaveDamageButton(message,card,extra=null) {
  const ready=hasCompletedSave(message,card,extra);
  const existing=card.querySelector('[data-action="jj-save-damage"]');
  if(!ready){existing?.remove();return false;}
  const {activity}=getCardActivity(card);
  if(activity?.damage?.parts?.length && !existing){
    const button=document.createElement('button');button.type='button';button.dataset.action='jj-save-damage';card.append(button);styleSaveDamageButton(button);
  }
  if(existing)styleSaveDamageButton(existing);
  return ready;
}
function refreshSourceForResult(result,includeResult=true) {
  const info=result?.getFlag?.(MODULE_ID,'saveResult'),source=info&&game.messages.get(info.source);
  if(!source || source.isContentVisible===false)return;
  for(const element of document.querySelectorAll('[data-message-id]')){
    if(element.dataset.messageId!==source.id)continue;
    const card=element.querySelector('.jujutsu-card[data-card-type="save"]');
    if(card)refreshSaveDamageButton(source,card,includeResult?result:null);
  }
}
export function saveConfiguration(card) {
  const {activity}=getCardActivity(card);
  const abilities=activity?.save?.ability;
  const ability=typeof abilities==='string'?abilities:Array.from(abilities??[])[0];
  const dc=Number(activity?.save?.dc?.value ?? activity?.save?.dc);
  if(!ability || !CONFIG.DND5E.abilities[ability] || !Number.isFinite(dc) || dc<=0)throw Error('Configure o atributo e a CD da salvaguarda na atividade.');
  return {ability,dc};
}
export async function rollSaveForActor(actor,source) {
  if(!actor?.isOwner || source?.isContentVisible===false)throw Error('Você precisa controlar a ficha e poder ver o cartão da técnica.');
  const execution=areaExecution(source);
  if(execution&&(execution.status!=='ready'||!execution.targets.includes(actor.uuid)||areaProtected(source,actor)))throw Error('Este alvo não precisa rolar a salvaguarda desta execução.');
  const card=sourceCard(source),{ability,dc}=saveConfiguration(card);
  const key=`${source.id}:${card.dataset.activityId}:${actor.uuid}`;
  if(busy.has(key))return null;
  const previous=Array.from(game.messages??[]).find(m=>m.getFlag?.(MODULE_ID,'saveResult')?.key===key);
  if(previous){ui.notifications.info(`${actor.name}: salvaguarda já registrada para este cartão.`);return previous;}
  busy.add(key);
  try {
    // Native saves include proficiency, effects, advantage and Haki modifiers.
    const rolls=await actor.rollSavingThrow({ability,target:dc}, {}, {create:false});
    if(!rolls?.length)return null;
    const audience=messageAudience(source);
    const total=Number(rolls[0].total);
    const result=await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),rolls,
      whisper:audience.whisper,blind:audience.blind,
      flavor:`${esc(actor.name)} — Salvaguarda ${esc(CONFIG.DND5E.abilities[ability].label??ability)} · CD ${dc} · ${total>=dc?'Sucesso':'Falha'}`,
      flags:{[MODULE_ID]:{saveResult:{key,source:source.id,actor:actor.uuid,ability,dc,total,success:total>=dc}},dnd5e:{messageType:'roll',roll:{type:'save',ability}},OPRPG:{roll:{type:'save',ability}}}});
    refreshSourceForResult(result);
    for(const roll of rolls)await showPrivateDice(roll,{actor,message:source});
    return result;
  } finally {busy.delete(key);}
}
export function saveRequestRecipients(actor,source,users=game.users) {
  const audience=messageAudience(source);
  const allowed=audience.whisper.length?new Set(audience.whisper):null;
  return Array.from(users??[]).filter(u=>(u.isGM||!audience.blind&&actor.testUserPermission?.(u,'OWNER'))&&(!allowed||allowed.has(u.id))).map(u=>u.id);
}
export async function requestIndividualSaves(card,source,actors) {
  if(!game.user.isGM&&source.author?.id!==game.user.id)throw Error('O autor da técnica ou o mestre deve solicitar os testes; use o seu pedido individual para rolar.');
  const results=[];
  for(const actor of actors) {
    const key=`${source.id}:${card.dataset.activityId}:${actor.uuid}`;
    const previous=Array.from(game.messages??[]).find(m=>m.getFlag?.(MODULE_ID,'saveRequest')?.key===key||m.getFlag?.(MODULE_ID,'saveResult')?.key===key);
    if(previous){results.push(previous);continue;}
    const recipients=saveRequestRecipients(actor,source);
    if(!recipients.length){ui.notifications.warn(`${actor.name}: nenhum responsável pode ver o cartão de origem. A visibilidade não foi ampliada.`);continue;}
    const {ability,dc}=saveConfiguration(card);
    results.push(await ChatMessage.create({whisper:recipients,blind:false,
      content:`<div class="jujutsu-card oprpg-fixes-notice oprpg-save-request"><div class="jj-top"><strong class="jj-top-name">${esc(actor.name)} — Salvaguarda</strong></div><div class="jj-description"><p>${esc(CONFIG.DND5E.abilities[ability].label??ability)} · CD ${dc}</p></div><button class="oprpg-fixes-notice-action" type="button" data-fixes-save-actor="${esc(actor.uuid)}">Rolar salvaguarda</button></div>`,
      flags:{[MODULE_ID]:{saveRequest:{key,source:source.id,targets:[actor.uuid]}}}}));
  }
  return results;
}
export async function rollTargetSaves(card,source,actors=targetActors(),{individual=false}={}) {
  actors=await executionActors(source,actors);
  if(!actors.length)throw Error('Marque todos os alvos da técnica com T antes de pedir as salvaguardas.');
  saveConfiguration(card);
  if(!source || source.isContentVisible===false)throw Error('Cartão de origem indisponível.');
  if(individual||areaExecution(source))return requestIndividualSaves(card,source,actors);
  const pending=actors.filter(a=>!a.isOwner);
  if(pending.length) {
    const audience=messageAudience(source);
    // A request does not grant permission: each button checks the target owner.
    await ChatMessage.create({whisper:audience.whisper,blind:audience.blind,
      content:`<div class="oprpg-save-request"><strong>Salvaguardas pendentes</strong>${pending.map(a=>`<p>${esc(a.name)} <button type="button" data-fixes-save-actor="${esc(a.uuid)}">Rolar salvaguarda</button></p>`).join('')}</div>`,
      flags:{[MODULE_ID]:{saveRequest:{source:source.id,targets:pending.map(a=>a.uuid)}}}});
  }
  const results=[];
  for(const actor of actors)if(actor.isOwner) {
    try {results.push(await rollSaveForActor(actor,source));}
    catch(error){STATE.warnings.push(`Salvaguarda de ${actor.name}: ${error.message}`);ui.notifications.error(`${actor.name}: ${error.message}. Os demais alvos continuam.`);}
  }
  return results;
}
export async function resolveSaveRequest(request,uuid) {
  const info=request?.getFlag(MODULE_ID,'saveRequest');
  if(!info?.targets?.includes(uuid) || request.isContentVisible===false)throw Error('Alvo ausente desta solicitação.');
  const actor=await fromUuid(uuid),source=game.messages.get(info.source);
  if(!source || source.isContentVisible===false)throw Error('Cartão de origem indisponível.');
  if(areaProtected(source,actor))throw Error('Alvo protegido pelo Controle Cirúrgico.');
  return rollSaveForActor(actor,source);
}
export async function rollSaveDamage(card,message,{scalePrompt=null}={}) {
  const {actor,item,activity}=getCardActivity(card);
  if(!actor?.isOwner || message.isContentVisible===false || (!game.user.isGM&&message.author?.id!==game.user.id))throw Error('O dano deve ser rolado pelo autor da técnica ou pelo mestre.');
  if(!hasCompletedSave(message,card))throw Error('Conclua uma salvaguarda desta técnica antes de rolar o dano.');
  if(!scalePrompt){const native=await import('/systems/oprpg-system/module/applications/actor/jj/jj-scale.mjs');scalePrompt=native.promptJJScale;}
  const scale=await scalePrompt({actor,activity});
  if(scale===null)return null;
  card.dataset.isSpell=String(item.type==='spell');
  card.dataset.jjScaleBonus=scale?.bonusFormula??'';
  prepareSaveDamageCard(card);
  return rollSelectedActivityDamage(card,actor,item,activity);
}
export function installSaveWorkflow() {
  if(installed)return;installed=true;
  Hooks.on('renderChatMessageHTML',(message,html)=>{
    const root=html instanceof HTMLElement?html:html?.[0],card=root?.querySelector('.jujutsu-card[data-card-type="save"]');
    if(!card || message.isContentVisible===false)return;
    refreshSaveDamageButton(message,card);
    const state=message.getFlag(MODULE_ID,'multiActivityDamage');
    if(state){prepareSaveDamageCard(card);applyDamageState(card,state);card.querySelector('[data-fixes-save-footer]')?.classList.add('visible');}
  });
  // A target owner may finish the save on a different client. Unlock the source
  // card when that result reaches this client, without changing its document.
  Hooks.on('createChatMessage',result=>refreshSourceForResult(result));
  Hooks.on('deleteChatMessage',result=>refreshSourceForResult(result,false));
  document.addEventListener('click',event=>{
    const requestButton=event.target.closest?.('[data-fixes-save-actor]');
    if(requestButton){event.preventDefault();event.stopImmediatePropagation();const request=game.messages.get(requestButton.closest('[data-message-id]')?.dataset.messageId);
      void resolveSaveRequest(request,requestButton.dataset.fixesSaveActor).catch(e=>ui.notifications.error(e.message));return;}
    const button=event.target.closest?.('[data-action]'),card=button?.closest('.jujutsu-card[data-card-type="save"]');
    if(!card || !['jj-extra-roll','jj-save-damage'].includes(button.dataset.action))return;
    event.preventDefault();event.stopImmediatePropagation();
    const message=game.messages.get(card.closest('[data-message-id]')?.dataset.messageId),key=message?.id+':'+button.dataset.action;
    if(busy.has(key))return;busy.add(key);button.disabled=true;
    const action=button.dataset.action==='jj-extra-roll'?rollTargetSaves(card,message):rollSaveDamage(card,message);
    void action.catch(e=>{STATE.warnings.push(e.message);ui.notifications.error(e.message)}).finally(()=>{busy.delete(key);button.disabled=false});
  },true);
  STATE.saveWorkflowPatch=true;
}
