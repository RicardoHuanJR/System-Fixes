import { MODULE_ID, STATE } from './shared.js';
import { queueActor } from './automation-runtime.js';
import { responsibleExecutor } from './technique-effects.js';
import { messageAudience, showPrivateDice } from './roll-privacy.js';
import { featureEnabled } from './feature-settings.js';

const inflight=new Set();let installed=false;
const esc=s=>foundry.utils.escapeHTML(String(s??''));
export function parseOverTime(value){
  if(typeof value!=='string'||!value.trim())return null;
  const fields={};for(const entry of value.split(/,(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/)){
    const at=entry.indexOf('=');if(at<1)throw Error('Configuração OverTime inválida.');
    const k=entry.slice(0,at).trim(),v=entry.slice(at+1).trim().replace(/^(["'])(.*)\1$/,'$2');fields[k]=v;
  }
  const supported=['turn','label','damageRoll','damageType','saveDC','saveAbility','saveDamage','saveRemove','damageBeforeSave'];
  const unsupported=Object.keys(fields).filter(k=>!supported.includes(k));if(unsupported.length)throw Error(`OverTime precisa de adaptação para: ${unsupported.join(', ')}.`);
  if(fields.damageBeforeSave==='true')throw Error('OverTime com dano antes da salvaguarda precisa de configuração própria.');
  return validatePeriodic({turn:fields.turn??'start',name:fields.label??'Efeito periódico',formula:fields.damageRoll,type:fields.damageType,
    ability:fields.saveAbility??'',dc:fields.saveDC?Number(fields.saveDC):0,onSave:fields.saveDamage==='nodamage'?'none':fields.saveDamage==='fulldamage'?'full':'half',removeOnSuccess:fields.saveRemove==='true',enabled:true});
}
export function validatePeriodic(data){
  if(!['start','end'].includes(data.turn)||!['half','none','full'].includes(data.onSave??'half'))throw Error('Etapa ou resultado periódico inválido.');
  if(data.formula&&(!Roll.validate(data.formula)||!CONFIG.DND5E.damageTypes[data.type]))throw Error('Fórmula ou tipo de dano periódico inválido.');
  const dc=Number(data.dc??0);if(!Number.isFinite(dc)||dc<0||dc>0&&!CONFIG.DND5E.abilities[data.ability])throw Error('Salvaguarda periódica inválida.');
  if(!data.formula&&dc===0)throw Error('Configure dano ou salvaguarda periódica.');
  return {...data,dc,onSave:data.onSave??'half',enabled:data.enabled!==false};
}
export function periodicSpecs(effect){
  if(effect.disabled||effect.isSuppressed)return [];
  const direct=effect.flags?.[MODULE_ID]?.periodic;if(direct)return [validatePeriodic(direct)].filter(s=>s.enabled);
  if(game.modules?.get('midi-qol')?.active&&globalThis.MidiQOL?.Workflow)return [];
  return Array.from(effect.changes??[]).filter(c=>c.key==='flags.midi-qol.OverTime').map(c=>parseOverTime(c.value)).filter(Boolean);
}
export async function requestPeriodic(actor,effect,spec,key){
  if(!responsibleExecutor(actor))return null;
  const previous=Array.from(game.messages??[]).find(m=>m.getFlag?.(MODULE_ID,'periodicRequest')?.key===key);if(previous)return previous;
  const source=game.messages.get(effect.flags?.[MODULE_ID]?.areaSource),audience=source?messageAudience(source):null;
  let whisper=Array.from(game.users??[]).filter(u=>u.isGM||actor.testUserPermission?.(u,'OWNER')).map(u=>u.id);
  if(audience?.whisper.length)whisper=whisper.filter(id=>audience.whisper.includes(id));
  if(!whisper.length)return null;
  const resolver=Array.from(game.users??[]).find(u=>u.active&&!u.isGM&&whisper.includes(u.id)&&actor.testUserPermission?.(u,'OWNER'))??game.users?.activeGM??game.user;
  return ChatMessage.create({whisper,blind:false,content:`<div class="jujutsu-card oprpg-fixes-notice"><div class="jj-top"><strong class="jj-top-name">${esc(actor.name)} — ${esc(spec.name??effect.name)}</strong></div><div class="jj-description"><p>${spec.dc?`${esc(CONFIG.DND5E.abilities[spec.ability].label??spec.ability)} · CD ${spec.dc}`:'Dano periódico'}${spec.formula?` · ${esc(spec.formula)}`:''}</p></div><button type="button" class="oprpg-fixes-notice-action" data-fixes-periodic="1">Resolver efeito</button></div>`,flags:{[MODULE_ID]:{periodicRequest:{key,resolver:resolver.id,actor:actor.uuid,effect:effect.id,spec,source:source?.id??null}}}});
}
export async function resolvePeriodic(request){
  const info=request?.getFlag(MODULE_ID,'periodicRequest');if(!info||request.isContentVisible===false)throw Error('Pedido periódico indisponível.');
  const actor=await fromUuid(info.actor);if(!actor?.isOwner)throw Error('Você precisa controlar a ficha afetada.');
  const assigned=info.resolver&&game.users?.get?.(info.resolver);
  if(info.resolver&&info.resolver!==game.user.id&&(assigned?.active||!responsibleExecutor(actor)))throw Error('Este pedido está atribuído ao controlador da ficha. O mestre pode assumir se ele desconectar.');
  const effect=actor.effects.get(info.effect);if(!effect||effect.disabled||effect.isSuppressed)throw Error('O efeito não está mais ativo.');
  const actual=periodicSpecs(effect).find(s=>JSON.stringify(s)===JSON.stringify(info.spec));if(!actual)throw Error('O efeito mudou; gere um novo pedido.');
  if(inflight.has(info.key))return null;inflight.add(info.key);
  try{return await queueActor(actor,async()=>{
    if((actor.getFlag(MODULE_ID,'periodicReceipts')??[]).includes(info.key))return null;
    const source=info.source&&game.messages.get(info.source);if(info.source&&(!source||source.isContentVisible===false))throw Error('Cartão de origem indisponível.');
    const rolls=[];let success=false;
    if(actual.dc>0){const save=await actor.rollSavingThrow({ability:actual.ability,target:actual.dc},{},{create:false});if(!save?.length)return null;rolls.push(...save);success=Number(save[0].total)>=actual.dc;}
    const multiplier=success?(actual.onSave==='none'?0:actual.onSave==='half'?0.5:1):1;
    let damage=0;if(actual.formula){const roll=await new Roll(actual.formula,actor.getRollData()).evaluate();rolls.push(roll);damage=Math.floor(Number(roll.total)*multiplier);if(!Number.isFinite(damage)||damage<0)throw Error('Resultado de dano periódico inválido.');}
    const changes={[`flags.${MODULE_ID}.periodicReceipts`]:[...(actor.getFlag(MODULE_ID,'periodicReceipts')??[]),info.key].slice(-200)};
    if(damage>0){
      let committed=false;
      const hook=Hooks.on('dnd5e.preApplyDamage',(target,_amount,updates,options)=>{if(target===actor&&options.oprpgPeriodic===info.key){Object.assign(updates,changes);committed=true;}});
      try{await actor.applyDamage([{value:damage,type:actual.type}],{multiplier:1,isDelta:true,oprpgPeriodic:info.key,origin:source});}finally{Hooks.off('dnd5e.preApplyDamage',hook);}
      if(!committed)return null;
    }else await actor.update(changes);
    const audience=source?messageAudience(source):{whisper:[],blind:false};
    const data={speaker:ChatMessage.getSpeaker({actor}),rolls,whisper:audience.whisper,blind:audience.blind,flavor:`${actor.name} — ${effect.name}${actual.dc?success?' — sucesso':' — falha':''} — ${damage} de dano`,flags:{[MODULE_ID]:{periodicResult:{key:info.key,damage,success}}}};
    if(!source)ChatMessage.applyRollMode?.(data,game.settings.get('core','rollMode'));
    const result=await ChatMessage.create(data);for(const roll of rolls)await showPrivateDice(roll,{actor,message:result});
    if(success&&actual.removeOnSuccess)await actor.deleteEmbeddedDocuments('ActiveEffect',[effect.id]);return result;
  },'periodic');}finally{inflight.delete(info.key);}
}
export async function periodicCombatTurn(combat,prior,current){
  if(!prior||!current||current.round<prior.round||current.round===prior.round&&current.turn<=prior.turn)return;
  for(const [turn,actor] of [['start',combat.turns?.[current.turn]?.actor],['end',combat.turns?.[prior.turn]?.actor]]){
    if(!actor||!responsibleExecutor(actor))continue;
    for(const effect of actor.effects??[]){
      let specs;try{specs=periodicSpecs(effect);}catch(e){ui.notifications.warn(`${effect.name}: ${e.message}`);continue;}
      for(const [i,spec] of specs.entries())if(spec.turn===turn)await requestPeriodic(actor,effect,spec,`${combat.id}:${current.round}:${current.turn}:${actor.uuid}:${effect.id}:${i}:${turn}`);
    }
  }
}
export async function configurePeriodic(effect){
  if(!effect?.parent?.isOwner)throw Error('Você precisa controlar a ficha deste efeito.');
  const p=effect.flags?.[MODULE_ID]?.periodic??{turn:'start',formula:'1d6',type:'poison',dc:0,ability:'con',onSave:'half',enabled:false};
  const result=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:'Efeito periódico'},content:`<label><input type="checkbox" name="enabled" ${p.enabled?'checked':''}> Ativar resolução periódica</label><label>Etapa <select name="turn"><option value="start" ${p.turn==='start'?'selected':''}>Início do turno</option><option value="end" ${p.turn==='end'?'selected':''}>Fim do turno</option></select></label><label>Dano <input name="formula" value="${esc(p.formula)}"></label><label>Tipo <select name="type">${Object.entries(CONFIG.DND5E.damageTypes).map(([id,v])=>`<option value="${id}" ${id===p.type?'selected':''}>${esc(v.label??id)}</option>`).join('')}</select></label><label>CD (zero = sem teste) <input name="dc" type="number" min="0" value="${p.dc}"></label><label>Salvaguarda <select name="ability">${Object.entries(CONFIG.DND5E.abilities).map(([id,v])=>`<option value="${id}" ${id===p.ability?'selected':''}>${esc(v.label??id)}</option>`).join('')}</select></label><label>No sucesso <select name="onSave">${[['half','Metade'],['none','Nenhum dano'],['full','Dano completo']].map(([id,l])=>`<option value="${id}" ${id===p.onSave?'selected':''}>${l}</option>`).join('')}</select></label><label><input name="removeOnSuccess" type="checkbox" ${p.removeOnSuccess?'checked':''}> Encerrar efeito no sucesso</label>`,buttons:[{action:'save',label:'Salvar',callback:(_e,_b,d)=>{const q=k=>d.element.querySelector(`[name="${k}"]`);return validatePeriodic({...Object.fromEntries(['turn','formula','type','dc','ability','onSave'].map(k=>[k,q(k).value])),name:effect.name,enabled:q('enabled').checked,removeOnSuccess:q('removeOnSuccess').checked});}},{action:'cancel',label:'Cancelar',callback:()=>null}],rejectClose:false});
  if(!result||typeof result!=='object')return null;await effect.setFlag(MODULE_ID,'periodic',result);return result;
}
export function installPeriodicEffects(){
  if(installed)return;installed=true;
  Hooks.on('combatTurnChange',(combat,prior,current)=>{if(featureEnabled('periodicEffects'))void periodicCombatTurn(combat,prior,current).catch(e=>ui.notifications.error(e.message));});
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-fixes-periodic]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();const message=game.messages.get(button.closest('[data-message-id]')?.dataset.messageId);void resolvePeriodic(message).catch(e=>ui.notifications.error(e.message));},true);
  Hooks.on('renderApplicationV2',app=>{const effect=app.document,root=app.element instanceof HTMLElement?app.element:app.element?.[0];if(effect?.documentName!=='ActiveEffect'||!effect.parent?.isOwner||!root||root.querySelector('.oprpg-periodic-config'))return;const header=root.querySelector('.window-header');if(!header)return;const button=document.createElement('button');button.type='button';button.className='header-control oprpg-periodic-config';button.title='Configurar efeito periódico';button.setAttribute('aria-label',button.title);button.innerHTML='<i class="fas fa-clock" inert></i>';button.onclick=()=>void configurePeriodic(effect).catch(e=>ui.notifications.error(e.message));header.append(button);});STATE.periodicEffects=true;
}
