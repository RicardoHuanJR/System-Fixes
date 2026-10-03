import { MODULE_ID, STATE, getActivityActor } from './shared.js';

const modes=new Set(['publicroll','gmroll','blindroll','selfroll']);
const contexts=new Map();
const tagged=new WeakMap();
const patched=new WeakSet();
let installed=false;
const ids=list=>Array.from(list??[],u=>typeof u==='string'?u:u?.id).filter(Boolean);
const modeAliases={public:'publicroll',ic:'publicroll',gm:'gmroll',blind:'blindroll',self:'selfroll'};
export function normalizeRollMode(mode) { return modeAliases[mode]??(modes.has(mode)?mode:null); }
const legacyMode=()=>{try{return normalizeRollMode(game.settings?.get('core','rollMode'));}catch(_){return null;}};
export function currentRollMode() {
  // V14's messageMode is the actual toolbar state. The deprecated rollMode can
  // retain an old client value, including selfroll while the toolbar is public.
  try { const current=normalizeRollMode(game.settings?.get('core','messageMode'));if(current)return current; } catch(_) {}
  return legacyMode()??'publicroll';
}
const coreMode=currentRollMode;
export function rollAudience(mode=coreMode(),user=game.user) {
  if(mode==='roll')mode=coreMode();
  mode=normalizeRollMode(mode)??mode;
  if(!modes.has(mode))mode='selfroll';
  const gms=Array.from(game.users??[]).filter(u=>u.isGM).map(u=>u.id);
  return {mode,whisper:mode==='selfroll'?[user.id]:mode==='gmroll'?[...new Set([...gms,user.id])]:mode==='blindroll'?gms:[],blind:mode==='blindroll'};
}
export function messageAudience(message) {
  if(!message)return rollAudience();
  return {whisper:ids(message.whisper),blind:!!message.blind,mode:message.blind?'blindroll':message.whisper?.length?'private':'publicroll'};
}
export function intersectAudiences(audiences) {
  const restricted=audiences.filter(a=>a && (a.whisper?.length||a.blind||a.mode==='selfroll'||a.mode==='blindroll'));
  if(!restricted.length)return audiences[0]??rollAudience();
  let allowed=ids(restricted[0].whisper);
  for(const a of restricted.slice(1))allowed=allowed.filter(id=>ids(a.whisper).includes(id));
  return {whisper:allowed,blind:restricted.some(a=>a.blind),mode:'private',suppressed:allowed.length===0};
}
export function captureCardAudience(message,actor) {
  if(!message?.id)return;
  contexts.set(message.id,{actor:actor?.uuid??actor?.id,audience:messageAudience(message)});
}
export function releaseCardAudience(id) { contexts.delete(id); }
export async function privacyDialogWait(original,receiver,args) {
  // These are the two native OPRPG dialogs which abort a card roll on null.
  // Ambiguous overlapping operations remain restricted rather than guessing.
  const title=args[0]?.window?.title;
  const contextId=contexts.size===1&&['⚡ Dados de Dano','⚡ Escala de Energia'].includes(title)?contexts.keys().next().value:null;
  try{
    const result=await original.apply(receiver,args);
    if(contextId&&result==null)releaseCardAudience(contextId);
    return result;
  }catch(error){if(contextId)releaseCardAudience(contextId);throw error;}
}
function pendingAudience(actor=null) {
  const relevant=[...contexts.values()].filter(c=>!actor||c.actor===(actor.uuid??actor.id));
  return relevant.length?intersectAudiences(relevant.map(c=>c.audience)):null;
}
export function privateDiceArguments(args) {
  const [roll,user=game.user,synchronize=false]=args;
  // The automatic DSN integration already passes the message audience explicitly.
  // Never replace those recipients with this client's current roll preference.
  if(!synchronize || user?.id!==game.user.id || args.length>3)return args;
  const audience=tagged.get(roll)??roll?.data?.oprpgFixesAudience??rollAudience();
  if(audience.suppressed || (audience.blind&&!audience.whisper.length))return null;
  return [roll,user,synchronize,audience.whisper.length?audience.whisper:null,audience.blind,null,null,{ghost:false,secret:!!audience.blind}];
}
export function patchDicePrivacy(dice=game.dice3d) {
  if(!dice?.showForRoll)return false;
  if(patched.has(dice))return true;
  const original=dice.showForRoll;
  dice.showForRoll=function(...args){
    const safe=privateDiceArguments(args);
    if(!safe){STATE.privateDiceSuppressed=(STATE.privateDiceSuppressed??0)+1;return Promise.resolve(false);}
    if(safe!==args)STATE.privateDiceProtected=(STATE.privateDiceProtected??0)+1;
    return original.apply(this,safe);
  };
  patched.add(dice);STATE.rollPrivacyDice=true;return true;
}
export async function showPrivateDice(roll,{card=null,actor=null,message=null,mode=null}={}) {
  if(!game.dice3d?.showForRoll)return false;
  message??=card?game.messages?.get(card.closest?.('[data-message-id]')?.dataset?.messageId):null;
  const audience=message?messageAudience(message):rollAudience(mode??coreMode());
  tagged.set(roll,audience);
  if(audience.blind&&!audience.whisper.length)return false;
  try{return await game.dice3d.showForRoll(roll,game.user,true,audience.whisper.length?audience.whisper:null,audience.blind,message?.id??null,actor?ChatMessage.getSpeaker({actor}):null,{ghost:false,secret:audience.blind});}
  catch(error){console.warn(`${MODULE_ID} | Animação de dados indisponível; a rolagem continua sem animação.`,error);return false;}
}
export function protectCustomMessage(message,data,options={}) {
  // Invitations deliberately notify target owners even when the GM attacks privately.
  // Never replace their explicit recipients with the toolbar's roll mode.
  if(data.flags?.[MODULE_ID]?.saveRequest||message.flags?.[MODULE_ID]?.saveRequest)return;
  if(!/jujutsu-card|jj-heal-card|jj-extra-card/.test(String(data.content??message.content??'')))return;
  const explicit=normalizeRollMode(options.messageMode)??normalizeRollMode(options.rollMode);
  const existing={whisper:ids(data.whisper??message.whisper),blind:!!(data.blind??message.blind)};
  const legacy=legacyMode();
  const oldAudience=legacy?rollAudience(legacy):null;
  const staleLegacy=!explicit&&legacy!==coreMode()&&oldAudience
    &&existing.blind===oldAudience.blind
    &&JSON.stringify([...existing.whisper].sort())===JSON.stringify([...oldAudience.whisper].sort());
  // Preserve deliberate custom recipients. Correct only a recognized legacy
  // audience, or apply a visibility mode supplied explicitly by the caller.
  if(!explicit&&!staleLegacy&&(existing.whisper.length||existing.blind))return;
  const mode=explicit??coreMode();
  const audience=rollAudience(mode);
  message.updateSource({whisper:audience.whisper,blind:audience.blind,[`flags.${MODULE_ID}.rollPrivacy`]:{mode}});
}
export function rollPrivacyStatus() {
  return {installed,dice:!!STATE.rollPrivacyDice,pendingCards:contexts.size,protected:Number(STATE.privateDiceProtected??0),suppressed:Number(STATE.privateDiceSuppressed??0)};
}
export function installRollPrivacy() {
  if(installed)return true;installed=true;
  Hooks.on('preCreateChatMessage',protectCustomMessage);
  // Sender-side enforcement, before the socket transmission; no hiding after disclosure.
  patchDicePrivacy();Hooks.on('diceSoNiceReady',dice=>patchDicePrivacy(dice));Hooks.once('ready',()=>patchDicePrivacy());
  const Dialog=foundry.applications.api.DialogV2;
  if(typeof Dialog?.wait==='function'){
    const original=Dialog.wait;Dialog.wait=function(...args){return privacyDialogWait(original,this,args);};
  }
  const p=CONFIG.Actor?.documentClass?.prototype;
  if(p?.getRollData){
    const original=p.getRollData;
    p.getRollData=function(...args){const data=original.apply(this,args);const audience=pendingAudience(this);return audience?{...data,oprpgFixesAudience:audience}:data;};
  }
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-action]');
    const card=button?.closest('.jujutsu-card, .jj-extra-card');
    if(!card||!['jj-attack','jj-damage','jj-extra-roll','jj-save'].includes(button.dataset.action))return;
    const message=game.messages?.get(card.closest('[data-message-id]')?.dataset.messageId);
    captureCardAudience(message,getActivityActor(card));
  },{capture:true});
  Hooks.on('updateChatMessage',(message,changes)=>{if(typeof changes.content==='string'||changes.flags?.[MODULE_ID]?.multiActivityDamage||changes[`flags.${MODULE_ID}.multiActivityDamage`])releaseCardAudience(message.id);});
  Hooks.on('deleteChatMessage',message=>releaseCardAudience(message.id));
  STATE.rollPrivacyPatch=true;return true;
}
