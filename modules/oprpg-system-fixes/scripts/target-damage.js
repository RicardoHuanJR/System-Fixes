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
      adjustment=await applyTargetCardDamage(actor,{...actorMeta,receiptChanges});
      applied.push(actor.name);
      const audience=messageAudience(message);
      const content=adjustment
        ? rewriteNativeDamageMessage(`🛡️ <strong>${esc(actor.name)}</strong> (${actorMeta.amount} de dano):`,adjustment)
        : `🛡️ <strong>${esc(actor.name)}</strong>: dano aplicado.`;
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
