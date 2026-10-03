import { MODULE_ID, STATE, getCardActivity } from './shared.js';
import { captureCardMeta, applyTargetCardDamage, rewriteNativeDamageMessage } from './shield-points-fix.js';
import { messageAudience } from './roll-privacy.js';
import { withActorOperation } from './operation-history.js';
import { requestTargetDamage, installDamageRequests } from './damage-requests.js';
import { recordActivityApplication } from './activity-guide.js';

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
  const current = Math.max(0, Number(attributes.pve.value ?? attributes.pve.max ?? 0));
  const lost = Math.min(current, loss);
  const updates = {'system.attributes.pve.value': current - lost};
  if (attributes.auraActive === false && lost > 0) {
    updates['system.attributes.hp.value'] = Math.max(0, Number(attributes.hp.value ?? 0) - 15 * lost);
    updates['system.attributes.hp.tempmax'] = Number(actor.system._source?.attributes?.hp?.tempmax ?? attributes.hp.tempmax ?? 0) - 15 * lost;
  }
  return updates;
}
async function promptVitality(actor, card) {
  const { item } = getCardActivity(card);
  const grade = Number(item?.system?.level ?? 0);
  const crit = !!card.querySelector('[data-mod="crit"]:checked, [data-save-mod="crit"]:checked');
  return foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],
    window:{title:`Vitalidade — ${actor.name}`}, rejectClose:false,
    content:`<p>A aura de <strong>${esc(actor.name)}</strong> está inativa. Resolva o dano em Vitalidade.</p>
      <label>Origem <select name="source"><option value="normal">Normal (1 PVE)</option><option value="firearm">Arma de fogo (2 PVE)</option><option value="technique" ${grade > 0 ? 'selected' : ''}>Técnica (grau em PVE)</option></select></label>
      <label>Grau <input name="grade" type="number" min="1" step="1" value="${Math.max(1,grade)}"></label>
      <label><input name="crit" type="checkbox" ${crit?'checked':''}> Crítico (×2)</label>
      <label><input name="aura" type="checkbox"> Ataque com aura (×2)</label>
      <label><input name="nat20" type="checkbox"> 20 natural com aura: morte instantânea</label>`,
    buttons:[{action:'apply',label:'Aplicar',callback:(_e,_b,d)=>{
      const root=d.element, source=root.querySelector('[name="source"]').value;
      return {grade:source==='technique'?Math.max(1,Math.floor(Number(root.querySelector('[name="grade"]').value)||1)):0,
        firearm:source==='firearm',...Object.fromEntries(['crit','aura','nat20'].map(k=>[k,root.querySelector(`[name="${k}"]`).checked]))};
    }},{action:'cancel',label:'Cancelar',callback:()=>null}],close:()=>null
  });
}

export async function applyDamageTargets(button, card, actors=targetActors()) {
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
      const receiptChanges={[`flags.${MODULE_ID}.damageReceipts`]:[...receipts,receipt].slice(-100)};
      if (actor.type==='character' && actor.system.attributes?.auraOn===false) {
        const choice=await promptVitality(actor,card);
        if (!choice) return;
        await actor.update({...vitalityUpdate(actor,choice),...receiptChanges});
      } else adjustment=await applyTargetCardDamage(actor,{...meta,receiptChanges});
      applied.push(actor.name);
      const audience=messageAudience(message);
      const content=adjustment
        ? rewriteNativeDamageMessage(`🛡️ <strong>${esc(actor.name)}</strong> (${meta.amount} de dano):`,adjustment)
        : `🌀 <strong>${esc(actor.name)}</strong>: dano resolvido em Vitalidade.`;
      try { await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content,whisper:audience.whisper,blind:audience.blind}); }
      catch(error){ui.notifications.warn('Dano aplicado, mas não foi possível publicar o resumo.');console.error(error);}
    });
    if(applied.length){
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
