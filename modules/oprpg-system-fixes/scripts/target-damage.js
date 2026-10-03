import { MODULE_ID, STATE, getCardActivity } from './shared.js';
import { captureCardMeta, applyTargetCardDamage, rewriteNativeDamageMessage } from './shield-points-fix.js';
import { messageAudience } from './roll-privacy.js';
import { withActorOperation } from './operation-history.js';
import { requestTargetDamage, installDamageRequests } from './damage-requests.js';
import { recordActivityApplication } from './activity-guide.js';
import { executionActors, areaSaveMultiplier } from './area-state.js';
import { applyTechniqueEffects } from './technique-effects.js';

const inflight = new Set();
let installed = false;
const esc = value => foundry.utils.escapeHTML(String(value ?? ''));

export function targetActors(tokens = game.user.targets) {
  return [...new Map(Array.from(tokens ?? []).filter(t => t.actor).map(t => [t.actor.uuid ?? t.actor.id, t.actor])).values()];
}
export function isDamageButton(button, card) {
  return ['jj-apply-damage', 'jj-apply-save-dmg'].includes(button?.dataset?.action)
    || button?.dataset?.action === 'jj-extra-apply' && card?.dataset?.cardType === 'damage';
}

export function vitalityUpdate(actor, choice) {
  const attributes = actor.system.attributes;
  if (!attributes.pve) throw Error('A ficha não possui Vitalidade. Verifique o sistema instalado.');
  if (choice.nat20 && choice.aura) return {'system.attributes.hp.value':0, 'system.attributes.pve.value':0};
  let loss = choice.grade > 0 ? choice.grade : choice.firearm ? 2 : 1;
  loss *= (choice.crit ? 2 : 1) * (choice.aura ? 2 : 1);
  if(choice.loss!==undefined){if(!Number.isFinite(choice.loss)||choice.loss<0||!Number.isInteger(choice.loss))throw Error('Informe uma perda de Vitalidade inteira e não negativa.');loss=choice.loss;}
  const current = Math.max(0, Number(attributes.pve.value ?? attributes.pve.max ?? 0));
  const lost = Math.min(current, loss);
  const updates = {'system.attributes.pve.value': current - lost};
  if (attributes.auraActive === false && lost > 0) {
    updates['system.attributes.hp.value'] = Math.max(0, Number(attributes.hp.value ?? 0) - 15 * lost);
    updates['system.attributes.hp.tempmax'] = Number(actor.system._source?.attributes?.hp?.tempmax ?? attributes.hp.tempmax ?? 0) - 15 * lost;
  }
  return updates;
}
export async function promptVitality(actor, card, factor=1) {
  const { item } = getCardActivity(card);
  const grade = Number(item?.system?.level ?? 0);
  const crit = !!card?.querySelector('[data-mod="crit"]:checked, [data-save-mod="crit"]:checked');
  return foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],
    window:{title:`Vitalidade — ${actor.name}`}, rejectClose:false,
    content:`<p>A aura de <strong>${esc(actor.name)}</strong> está inativa. Resolva o dano em Vitalidade.</p>
      <p>Multiplicador individual por salvaguarda: ${factor}. A redução numérica não determina sozinha a perda por grau. Confirme a perda final com o mestre.</p>
      <label>Origem <select name="source"><option value="normal">Normal (1 PVE)</option><option value="firearm">Arma de fogo (2 PVE)</option><option value="technique" ${grade > 0 ? 'selected' : ''}>Técnica (grau em PVE)</option></select></label>
      <label>Grau <input name="grade" type="number" min="1" step="1" value="${Math.max(1,grade)}"></label>
      <label><input name="crit" type="checkbox" ${crit?'checked':''}> Crítico (×2)</label>
      <label><input name="aura" type="checkbox"> Ataque com aura (×2)</label>
      <label><input name="nat20" type="checkbox"> 20 natural com aura: morte instantânea</label>
      <label>Perda final de PVE (opcional; em branco usa a regra por grau) <input name="loss" type="number" min="0" step="1" placeholder="Confirmar com o mestre"></label>`,
    buttons:[{action:'apply',label:'Aplicar',callback:(_e,_b,d)=>{
      const root=d.element, source=root.querySelector('[name="source"]').value;
      const loss=root.querySelector('[name="loss"]')?.value;
      return {...(loss!==undefined&&loss!==''?{loss:Number(loss)}:{}),grade:source==='technique'?Math.max(1,Math.floor(Number(root.querySelector('[name="grade"]').value)||1)):0,
        firearm:source==='firearm',...Object.fromEntries(['crit','aura','nat20'].map(k=>[k,root.querySelector(`[name="${k}"]`).checked]))};
    }},{action:'cancel',label:'Cancelar',callback:()=>null}],close:()=>null
  });
}

export async function applyDamageTargets(button, card, actors=targetActors()) {
  const sourceId=button.closest?.('[data-message-id]')?.dataset?.messageId;
  const source=game.messages?.get(sourceId);
  actors=await executionActors(source,actors);
  const {activity}=getCardActivity(card);
  // Validate all responses before changing any resource.
  const factors=new Map(actors.map(a=>[a.uuid,areaSaveMultiplier(source,a,activity)]));
  if (!actors.length) throw Error('Marque um alvo com a ferramenta de alvo (T) antes de aplicar o dano.');
  if (actors.some(a=>!a.isOwner)) {
    await requestTargetDamage(button,card,actors);return [];
  }
  const meta=captureCardMeta(button,card);
  if (!Number.isFinite(meta.amount) || meta.amount < 0) throw Error('Role o dano antes de aplicá-lo.');
  const message=game.messages?.get(meta.messageId);
  if (!message) throw Error('O cartão de origem não foi encontrado. Role novamente.');
  // Receipt is stored atomically with the damage on each actor, including synthetic actors.
  const receipt=[message.id,meta.activityId??'',meta.action].join(':');
  const key=receipt;
  if (inflight.has(key)) return [];
  inflight.add(key);button.disabled=true;
  const applied=[];
  try {
    for (const actor of actors) await withActorOperation(actor,async()=>{
      const receipts=actor.getFlag(MODULE_ID,'damageReceipts')??[];
      if (receipts.includes(receipt)) return;
      let adjustment;
      const factor=factors.get(actor.uuid)??1;
      const actorMeta={...meta,amount:Math.floor(meta.amount*factor)};
      if(meta.typedDamage?.length){
        const parts=meta.typedDamage.map((part,index)=>({...part,index,value:Math.floor(part.value*factor),remainder:part.value*factor%1}));
        let extra=actorMeta.amount-parts.reduce((sum,part)=>sum+part.value,0);
        for(const part of [...parts].sort((a,b)=>b.remainder-a.remainder||a.index-b.index))if(extra-->0)part.value++;
        actorMeta.typedDamage=parts.map(({value,type})=>({value,type}));
      }
      const receiptChanges={[`flags.${MODULE_ID}.damageReceipts`]:[...receipts,receipt].slice(-100)};
      if(factor===0)return;
      if (actor.type==='character' && actor.system.attributes?.auraOn===false) {
        const choice=await promptVitality(actor,card,factor);
        if (!choice) return;
        await actor.update({...vitalityUpdate(actor,choice),...receiptChanges});
      } else adjustment=await applyTargetCardDamage(actor,{...actorMeta,receiptChanges});
      applied.push(actor.name);
      const audience=messageAudience(message);
      const content=adjustment
        ? rewriteNativeDamageMessage(`🛡️ <strong>${esc(actor.name)}</strong> (${actorMeta.amount} de dano):`,adjustment)
        : `🌀 <strong>${esc(actor.name)}</strong>: dano resolvido em Vitalidade.`;
      try { await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content,whisper:audience.whisper,blind:audience.blind}); }
      catch(error){ui.notifications.warn('Dano aplicado, mas não foi possível publicar o resumo.');console.error(error);}
    });
    if(applied.length){
      if(activity?.type!=='save')for(const actor of actors.filter(a=>applied.includes(a.name)))await applyTechniqueEffects(activity,actor,message,{receipt:receipt});
      try{await recordActivityApplication(message,meta.activityId,applied)}catch(error){console.warn('Registro das etapas do cartão indisponível',error)}
      ui.notifications.info(`Dano aplicado em: ${applied.join(', ')}.`);
    }
    else ui.notifications.info('Nenhum dano novo aplicado: aplicação cancelada ou já registrada para estes alvos.');
    return applied;
  } finally {inflight.delete(key);button.disabled=false;}
}
export function installTargetDamage() {
  if(installed)return true;
  installed=true;
  installDamageRequests(applyDamageTargets);
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-action]');
    const card=button?.closest('.jujutsu-card, .jj-card, [data-item-id]');
    if(!card||!isDamageButton(button,card))return;
    event.preventDefault();event.stopImmediatePropagation();
    void applyDamageTargets(button,card).catch(error=>{ui.notifications.error(error.message);console.error(error);});
  },true);
  STATE.targetDamagePatch=true;
  return true;
}
