import { MODULE_ID, STATE } from './shared.js';

const watchers=new Map();
let installed=false;
export async function persistNativeCard(message,card) {
  if(!message || message.isContentVisible===false || (!game.user.isGM&&message.author?.id!==game.user.id))return false;
  if(card.dataset.oprpgFixesMultiActivityDamage==='1')return false;
  const displayed=card.querySelector('#jj-dmg-val, #jj-extra-val')?.textContent?.trim();
  if(!displayed || !Number.isFinite(Number(displayed)))return false;
  const root=document.createElement('div');root.innerHTML=message.content;
  const original=Array.from(root.querySelectorAll('.jujutsu-card')).find(c=>c.dataset.itemId===card.dataset.itemId&&c.dataset.activityId===card.dataset.activityId);
  if(!original)return false;
  const copy=card.cloneNode(true);copy.querySelectorAll('.oprpg-activity-guide').forEach(e=>e.remove());
  original.replaceWith(copy);
  if(root.innerHTML===message.content)return false;
  // Only the author or GM writes the source document; its audience is unchanged.
  await message.update({content:root.innerHTML});
  STATE.nativeCardSyncs=Number(STATE.nativeCardSyncs??0)+1;
  return true;
}
function forget(id) {
  const watcher=watchers.get(id);if(!watcher)return;
  watcher.observer.disconnect();clearTimeout(watcher.timer);watchers.delete(id);
}
export function installCardSync() {
  if(installed)return;installed=true;
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-action]');
    if(!['jj-damage','jj-extra-roll'].includes(button?.dataset.action))return;
    const card=button.closest('.jujutsu-card');
    if(!card || ['save','heal'].includes(card.dataset.cardType))return;
    const message=game.messages.get(card.closest('[data-message-id]')?.dataset.messageId);
    if(!message || message.isContentVisible===false || (!game.user.isGM&&message.author?.id!==game.user.id))return;
    forget(message.id);
    // Observe only this active roll's card, never the document or token canvas.
    if(watchers.size>=20)forget(watchers.keys().next().value);
    const watcher={timer:null,observer:null};
    watcher.observer=new MutationObserver(()=>{
      clearTimeout(watcher.timer);
      watcher.timer=setTimeout(async()=>{
        try{if(await persistNativeCard(message,card))forget(message.id);}
        catch(error){forget(message.id);STATE.warnings.push(`Resultado do dano não compartilhado: ${error.message}`);ui.notifications.error('Não foi possível compartilhar o resultado do dano. Tente novamente.');}
      },150);
    });
    watchers.set(message.id,watcher);watcher.observer.observe(card,{subtree:true,childList:true,characterData:true,attributes:true});
  },true);
  Hooks.on('deleteChatMessage',m=>forget(m.id));
  Hooks.on('renderChatMessageHTML',m=>forget(m.id));
}
