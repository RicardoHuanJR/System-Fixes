import { MODULE_ID, STATE, activitiesOf, getCardActivity } from './shared.js';

let installed=false;
const esc=value=>foundry.utils.escapeHTML(String(value??''));
export function renderActivityGuide(message,card){
  // Keep receipts internal; the native card already communicates its result.
  card?.querySelectorAll('[data-fixes-activity-guide], .oprpg-activity-guide').forEach(guide=>guide.remove());
  return false;
}
export async function recordActivityApplication(message,activityId,names){
  if(!activityId||!names.length||typeof message?.update!=='function'||!(message.isOwner||game.user.isGM))return;
  const previous=message.getFlag?.(MODULE_ID,'activityApplied')?.[activityId]??[];
  await message.update({[`flags.${MODULE_ID}.activityApplied.${activityId}`]:[...new Set([...previous,...names])].slice(-100)});
}
export function installActivityGuide(){
  if(installed)return;installed=true;
  Hooks.on('renderChatMessageHTML',(message,html)=>{
    const root=html?.[0]??html;if(!root?.querySelectorAll)return;
    for(const card of root.querySelectorAll('.jujutsu-card[data-item-id]'))renderActivityGuide(message,card);
  });
  STATE.activityGuidePatch=false;
}
