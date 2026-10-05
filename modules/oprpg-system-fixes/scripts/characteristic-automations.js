import { MODULE_ID, STATE } from './shared.js';
import { catalogueDamage, catalogueEffect } from './automation-catalogue.js';
import { featureEnabled } from './feature-settings.js';
import { queueActor, registerActorTimer } from './automation-runtime.js';

const OLD='oprpg-diable-jambe',mark=Symbol('oprpgCharacteristicDamage');
const esc=s=>foundry.utils.escapeHTML(String(s??''));
let installed=false;
export const DIABLE={id:'diable-jambe',name:'Diable Jambe',preset:'diable',type:'fire',formula:'',seconds:60,itemType:'spell',enabled:true,manual:false};
export function profiles(actor){return actor?.getFlag(MODULE_ID,'characteristics')??[DIABLE];}
export function validateProfile(data){
  if(!/^[a-z0-9-]{1,48}$/.test(data.id??'')||!String(data.name??'').trim())throw Error('Informe identificador e nome da característica.');
  if(!['spell','weapon','both'].includes(data.itemType)||!['diable','degree','formula'].includes(data.preset))throw Error('Categoria de automação inválida.');
  if(!CONFIG.DND5E.damageTypes[data.type])throw Error('Tipo de dano inválido.');
  if(data.preset==='formula'&&(!data.formula||!Roll.validate(data.formula.replace(/@(?:grade|faces)/g,'6'))))throw Error('Fórmula de dano inválida.');
  if(data.attackRange&&!['all','melee','ranged'].includes(data.attackRange))throw Error('Alcance de ataque inválido.');
  if(data.itemIds&&(!Array.isArray(data.itemIds)||data.itemIds.some(id=>typeof id!=='string'||id.length>128)))throw Error('Itens de aplicação inválidos.');
  const seconds=Number(data.seconds);if(!Number.isFinite(seconds)||seconds<0)throw Error('Duração inválida; use zero para permanente.');
  return {...data,name:String(data.name).trim(),seconds,enabled:data.enabled!==false,manual:!!data.manual};
}
export function characteristicActive(actor,profile,now=game.time.worldTime){
  return Array.from(actor?.appliedEffects??actor?.effects??[]).find(e=>{
    const own=e.flags?.[MODULE_ID]?.characteristic===profile.id;
    const legacy=profile.id==='diable-jambe'&&(e.flags?.[OLD]?.enabled||e.name?.trim().toLowerCase()==='diable jambe');
    if(!own&&!legacy||e.disabled||e.isSuppressed)return false;
    const {startTime,seconds}=e.duration??{};
    return !(Number.isFinite(startTime)&&Number.isFinite(seconds)&&seconds>0&&now>=startTime+seconds);
  });
}
export function characteristicBonuses(activity,config,now=game.time.worldTime){
  const actor=activity?.actor??activity?.item?.actor,item=activity?.item;
  if(!actor||!['attack','save','damage'].includes(activity.type)||!config?.rolls?.length)return [];
  const grade=Number(item.system?.level),original=Array.from(activity.damage?.parts??[])[0];
  const faces=original?.custom?.enabled?Number(String(original.custom.formula).match(/\b\d*d(\d+)\b/i)?.[1]):Number(original?.denomination);
  return profiles(actor).flatMap(p=>{
    if(p.id==='diable-jambe'&&catalogueEffect(actor,'diable-jambe'))return [];
    if(!p.enabled||p.manual||p.itemType!=='both'&&p.itemType!==item.type||!characteristicActive(actor,p,now))return [];
    if(p.itemIds?.length&&!p.itemIds.includes(item.id))return [];
    if(p.attackRange&&p.attackRange!=='all'&&(activity.type!=='attack'||activity.attack?.type?.value!==p.attackRange))return [];
    if(p.id==='diable-jambe'&&(game.modules?.get(OLD)?.active||config.rolls.some(r=>r.options?.diableJambe)))return [];
    if(config.rolls.some(r=>r.options?.oprpgCharacteristic===p.id))return [];
    let formula=p.formula;
    if(p.preset==='diable'||p.preset==='degree'){
      if(!Number.isInteger(grade)||grade<1||grade>7||!Number.isInteger(faces)||faces<2)return [];
      formula=`${p.preset==='degree'?grade:Math.max(1,Math.floor(grade/2))}d${faces}`;
    }else{
      if(formula.includes('@faces')&&(!Number.isInteger(faces)||faces<2))return [];
      formula=formula.replace(/@grade\b/g,String(Number.isFinite(grade)?grade:0)).replace(/@faces\b/g,String(faces));
      if(!Roll.validate(formula))return [];
    }
    return [{parts:[formula],data:activity.getRollData?.()??{},options:{type:p.type,types:[p.type],properties:[],oprpgCharacteristic:p.id,flavor:`${p.name} — ${CONFIG.DND5E.damageTypes[p.type]?.label??p.type}`}}];
  });
}
export function augmentCharacteristics(activity,config){
  if(featureEnabled('characteristics'))config?.rolls?.push(...catalogueDamage(activity,config),...characteristicBonuses(activity,config));
  return config;
}
export async function toggleCharacteristic(actor,id){
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  const p=profiles(actor).find(p=>p.id===id);if(!p?.enabled)throw Error('Característica desativada ou não configurada.');
  if(id==='diable-jambe'&&game.modules?.get(OLD)?.active){
    const api=game.modules.get(OLD).api;if(api?.toggle)return api.toggle(actor);
    throw Error('Desative o módulo Diable Jambe antigo e recarregue para usar o integrado.');
  }
  return queueActor(actor,async()=>{
    const active=characteristicActive(actor,p);
    const effects=Array.from(actor.effects??[]).filter(e=>e.flags?.[MODULE_ID]?.characteristic===id||id==='diable-jambe'&&(e.flags?.[OLD]?.enabled||e.name?.trim().toLowerCase()==='diable jambe'));
    if(effects.length)await actor.deleteEmbeddedDocuments('ActiveEffect',effects.map(e=>e.id));
    if(active)return false;
    await actor.createEmbeddedDocuments('ActiveEffect',[{name:p.name,img:'icons/magic/fire/flame-burning-fist-strike.webp',transfer:false,disabled:false,changes:[],duration:p.seconds>0?{seconds:p.seconds,startTime:game.time.worldTime}:{},flags:{[MODULE_ID]:{characteristic:id}}}]);
    return true;
  });
}
export async function saveProfiles(actor,list){
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  if(list.length>30)throw Error('Configure até 30 características por ficha.');
  const validated=list.map(validateProfile);if(new Set(validated.map(p=>p.id)).size!==validated.length)throw Error('Os identificadores devem ser únicos.');
  await actor.setFlag(MODULE_ID,'characteristics',validated);return validated;
}
export async function openCharacteristics(actor){
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  const list=profiles(actor),options=list.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${characteristicActive(actor,p)?' — ativo':''}</option>`).join('');
  const choice=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:`Características — ${actor.name}`},content:`<p>Automações de dano que dependem da técnica usada. Efeitos comuns de atributos e resistências continuam configuráveis pelo DAE.</p><label>Característica <select name="profile">${options}</select></label><p>Diable Jambe usa a fórmula do módulo anterior. Se o bônus já está incluído manualmente no dano, marque essa opção ao editar para evitar somá-lo novamente.</p>`,buttons:[{action:'toggle',label:'Ativar/desativar',callback:(_e,_b,d)=>({action:'toggle',id:d.element.querySelector('[name="profile"]').value})},{action:'edit',label:'Configurar',callback:(_e,_b,d)=>({action:'edit',id:d.element.querySelector('[name="profile"]').value})},{action:'new',label:'Nova característica',callback:()=>({action:'edit'})},{action:'close',label:'Fechar',callback:()=>null}],rejectClose:false});
  if(!choice || typeof choice!=='object')return null;
  if(choice.action==='toggle')return toggleCharacteristic(actor,choice.id);
  return editCharacteristic(actor,choice.id);
}
export async function editCharacteristic(actor,id=null){
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  const list=profiles(actor);
  const p=list.find(p=>p.id===id)??{id:foundry.utils.randomID().toLowerCase(),name:'',preset:'formula',formula:'1d6',type:'fire',seconds:60,itemType:'spell',enabled:true,manual:false};
  const result=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:'Configurar característica'},content:`<label>Nome <input name="name" value="${esc(p.name)}"></label><label>Regra <select name="preset"><option value="formula" ${p.preset==='formula'?'selected':''}>Fórmula configurável</option><option value="diable" ${p.preset==='diable'?'selected':''}>Diable Jambe (metade do grau, mínimo 1)</option><option value="degree" ${p.preset==='degree'?'selected':''}>Grau inteiro em dados extras</option></select></label><label>Fórmula <input name="formula" value="${esc(p.formula)}"></label><p>A fórmula pode usar @grade e @faces, além dos dados de rolagem da ficha.</p><label>Tipo <select name="type">${Object.entries(CONFIG.DND5E.damageTypes).map(([id,v])=>`<option value="${esc(id)}" ${p.type===id?'selected':''}>${esc(v.label??id)}</option>`).join('')}</select></label><label>Aplicar em <select name="itemType">${[['spell','Técnicas'],['weapon','Armas'],['both','Técnicas e armas']].map(([id,label])=>`<option value="${id}" ${p.itemType===id?'selected':''}>${label}</option>`).join('')}</select></label><label>Alcance de ataque <select name="attackRange">${[['all','Todos / técnicas de salvaguarda'],['melee','Somente corpo a corpo'],['ranged','Somente à distância']].map(([id,label])=>`<option value="${id}" ${(p.attackRange??'all')===id?'selected':''}>${label}</option>`).join('')}</select></label><label>Itens autorizados (sem seleção = todos da categoria) <select name="itemIds" multiple size="4">${Array.from(actor.items??[]).filter(i=>['spell','weapon'].includes(i.type)).map(i=>`<option value="${esc(i.id)}" ${p.itemIds?.includes(i.id)?'selected':''}>${esc(i.name)}</option>`).join('')}</select></label><label>Duração (segundos; zero = permanente) <input type="number" min="0" name="seconds" value="${p.seconds}"></label><label><input type="checkbox" name="enabled" ${p.enabled?'checked':''}> Disponível nesta ficha</label><label><input type="checkbox" name="manual" ${p.manual?'checked':''}> Bônus já incluído manualmente (não somar)</label>`,buttons:[{action:'save',label:'Salvar',callback:(_e,_b,d)=>({...p,itemIds:Array.from(d.element.querySelector('[name="itemIds"]').selectedOptions,o=>o.value),...Object.fromEntries(['name','preset','formula','type','itemType','seconds','attackRange'].map(k=>[k,d.element.querySelector(`[name="${k}"]`).value])),...Object.fromEntries(['enabled','manual'].map(k=>[k,d.element.querySelector(`[name="${k}"]`).checked]))})},{action:'cancel',label:'Cancelar',callback:()=>null}],rejectClose:false});
  if(!result||typeof result!=='object')return null;await saveProfiles(actor,[...list.filter(x=>x.id!==p.id),result]);return result;
}
export function installCharacteristics(){
  if(installed)return true;installed=true;
  const seen=new Set();for(const type of Object.values(CONFIG.DND5E.activityTypes??{})){
    const p=type.documentClass?.prototype;if(!p||seen.has(p)||!p.getDamageConfig||p.getDamageConfig[mark])continue;
    seen.add(p);const original=p.getDamageConfig,replacement=function(...args){return augmentCharacteristics(this,original.apply(this,args));};replacement[mark]=true;p.getDamageConfig=replacement;
  }
  registerActorTimer('characteristic-expiration',actor=>Array.from(actor.effects??[]).some(e=>e.flags?.[MODULE_ID]?.characteristic),async actor=>{
    if(!game.user.isGM||game.users?.activeGM&&game.users.activeGM.id!==game.user.id)return;
    const now=game.time.worldTime,expired=Array.from(actor.effects??[]).filter(e=>e.flags?.[MODULE_ID]?.characteristic&&e.duration?.seconds>0&&Number.isFinite(e.duration.startTime)&&now>=e.duration.startTime+e.duration.seconds);
    if(expired.length)await actor.deleteEmbeddedDocuments('ActiveEffect',expired.map(e=>e.id));
  });STATE.characteristics=true;return true;
}
