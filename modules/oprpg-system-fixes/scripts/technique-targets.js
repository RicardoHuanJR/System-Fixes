import { STATE, getCardActivity } from './shared.js';

const wrapped=Symbol('oprpgFixesTargetPrompt');
const busy=new Set();
let queue=Promise.resolve(), nativePlacement=false, installed=false;

export function needsTechniqueTargets(activity) {
  if(activity.target?.template?.type)return false;
  const affects=activity.target?.affects?.type;
  if(affects==='self')return false;
  if(activity.range?.units==='self' && !affects)return false;
  if(['creature','ally','enemy','object'].includes(affects))return true;
  return ['attack','damage','save','heal'].includes(activity.type);
}
export function validTechniqueTargets(activity, tokens=game.user.targets) {
  const targets=Array.from(tokens??[]).filter(t=>t?.actor);
  if(!targets.length)return false;
  const count=Number(activity.target?.affects?.count);
  return !Number.isFinite(count)||count<=0||targets.length<=count;
}
async function requestTargets(activity) {
  if(validTechniqueTargets(activity))return true;
  const count=Number(activity.target?.affects?.count);
  const limit=Number.isFinite(count)&&count>0?` (máximo: ${count})`:'';
  const result=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],
    window:{title:'Escolha os alvos da técnica'},rejectClose:false,modal:false,
    content:`<p>Marque os alvos no mapa com a ferramenta de alvo (T)${limit}. Depois clique em continuar.</p><p>Selecionar o seu personagem não marca um alvo.</p>`,
    buttons:[{action:'continue',label:'Continuar',callback:()=>validTechniqueTargets(activity)},
      {action:'cancel',label:'Cancelar',callback:()=>false}],close:()=>false
  });
  if(result!==true)ui.notifications.warn('Técnica não ativada: selecione alvos válidos e tente novamente.');
  return result===true;
}
export function validateTechniqueArea(activity) {
  if(!activity.target?.template?.type)return;
  if(!canvas?.ready||!canvas.scene)throw Error('Abra uma cena antes de ativar uma técnica de área.');
  const size=Number(activity.target.template.size);
  if(!Number.isFinite(size)||size<=0)throw Error('Configure um tamanho de área maior que zero na atividade.');
  const permission=Number(game.release?.generation)>=14?'REGION_CREATE':'TEMPLATE_CREATE';
  if(!game.user.isGM&&!game.user.can(permission))throw Error('O mestre precisa permitir a criação de áreas para este usuário.');
}
export function wrapTechniqueUse(proto) {
  if(!proto||typeof proto.use!=='function'||proto.use[wrapped])return false;
  const original=proto.use;
  const replacement=async function(...args){
    const key=this.uuid??this;
    if(busy.has(key))return;
    busy.add(key);
    try {
      if(this.item?.type==='spell'&&args[0]?.create!==false) {
        validateTechniqueArea(this);
        if(needsTechniqueTargets(this)&&!await requestTargets(this))return;
      }
      return await original.apply(this,args);
    } catch(error){ui.notifications.error(error.message);console.error(error);return undefined;}
    finally{busy.delete(key);}
  };
  replacement[wrapped]=true;proto.use=replacement;return true;
}
export async function placeCardArea(message, {force=false}={}) {
  if(nativePlacement&&!force)return [];
  const flags=message?.flags?.['oprpg-system'];
  if(!flags?.jujutsuCard&&!flags?.jujutsuExtraCard)return [];
  const container=document.createElement('div');container.innerHTML=message.content??'';
  const card=container.querySelector('[data-item-id]');
  const {activity}=getCardActivity(card);
  if(!activity?.target?.template?.type)return [];
  const run=async()=>{
    validateTechniqueArea(activity);
    const {default:AbilityTemplate}=await import('/systems/oprpg-system/module/canvas/ability-template.mjs');
    const templates=AbilityTemplate.fromActivity(activity)??[];
    if(!templates.length)throw Error('O sistema não reconheceu o formato da área desta técnica.');
    const placed=[];
    for(const template of templates){const result=await template.drawPreview();if(!result)break;placed.push(...(Array.isArray(result)?result:[result]));}
    return placed;
  };
  const operation=queue.then(run,run);queue=operation.catch(()=>{});return operation;
}
export async function installTechniqueTargets() {
  if(installed)return true;installed=true;
  let count=0;
  for(const config of Object.values(CONFIG.DND5E.activityTypes??{}))if(wrapTechniqueUse(config.documentClass?.prototype))count++;
  try {
    const native=await import('/systems/oprpg-system/module/canvas/technique-templates.mjs');
    nativePlacement=typeof native.placeTechniqueTemplates==='function';
  } catch(_){nativePlacement=false;}
  Hooks.on('createChatMessage',(message,_options,userId)=>{
    if(userId!==game.user.id||nativePlacement)return;
    void placeCardArea(message).catch(error=>{ui.notifications.error(`Área da técnica: ${error.message}`);console.error(error);});
  });
  Hooks.on('renderChatMessageHTML',(message,html)=>{
    const root=html instanceof HTMLElement?html:html?.[0];
    // Also remove serialized buttons in cards produced by older releases.
    root?.querySelectorAll('[data-fixes-area]').forEach(button=>button.remove());
  });
  STATE.techniqueTargetsPatch=count>0;STATE.techniqueAreaMode=nativePlacement?'native':'custom-card-fallback';
  return count>0;
}
