import { MODULE_ID, STATE } from './shared.js';
import { featureEnabled } from './feature-settings.js';
import { bonuses, paMaxBonus, applicableEffects } from './effect-automation-rules.js';
import { renderEffectEditor } from './effect-automation-editor.js';
import { profiles, characteristicActive, toggleCharacteristic, editCharacteristic, saveProfiles } from './characteristic-automations.js';

const OLD='oprpg-automacoes-efeitos', mark=Symbol('oprpgEffectAutomation');let installed=false;
const esc=s=>foundry.utils.escapeHTML(String(s??''));
export function automationBonuses(actor,activity){
  if(!featureEnabled('characteristics')||game.modules?.get(OLD)?.active)return null;
  return bonuses(actor,activity);
}
export function automationDamageSpecs(actor,activity){
  const b=automationBonuses(actor,activity);if(!b?.damageFormula)return [];
  const types=Array.from(activity.damage?.parts??[])[0]?.types;
  const type=(typeof types==='string'?types:Array.from(types??[])[0])??'';
  return [{parts:[b.damageFormula],data:activity.getRollData?.()??actor.getRollData?.()??{},options:{type,types:type?[type]:[],oprpgEffectAutomation:true,flavor:'Automações de efeitos'}}];
}
export function wrapEffectDamage(proto){
  const original=proto?.getDamageConfig;if(typeof original!=='function'||original[mark])return false;
  const replacement=function(...args){const config=original.apply(this,args);if(config?.rolls&&!config.rolls.some(r=>r.options?.oprpgEffectAutomation))config.rolls.push(...automationDamageSpecs(this.actor??this.item?.actor,this));return config;};replacement[mark]=true;proto.getDamageConfig=replacement;return true;
}
export function installAutomationCapacity(Data){
  const original=Data?.prototype?.prepareDerivedData;if(typeof original!=='function'||original[mark])return false;
  const replacement=function(...args){const result=original.apply(this,args);if(featureEnabled('characteristics')&&!game.modules?.get(OLD)?.active){const n=paMaxBonus(this.parent);if(Number.isFinite(this.energy?.max))this.energy.max+=n;}return result;};replacement[mark]=true;Data.prototype.prepareDerivedData=replacement;return true;
}
export function effectsWindowContent(actor){
  const effects=applicableEffects(actor).filter(e=>e.flags?.[MODULE_ID]?.automationConfig||e.flags?.[OLD]?.config);
  const entries=profiles(actor).map(p=>`<article class="oprpg-effect-row"><div><strong>${esc(p.name)}</strong><span>${characteristicActive(actor,p)?'Ativo':'Inativo'} · ${p.itemType==='spell'?'Técnicas':p.itemType==='weapon'?'Armas':'Técnicas e armas'}</span></div><div class="oprpg-effect-actions"><button type="button" data-effect-action="toggle-profile" data-id="${esc(p.id)}">${characteristicActive(actor,p)?'Desativar':'Ativar'}</button><button type="button" data-effect-action="edit-profile" data-id="${esc(p.id)}">Configurar</button><button type="button" data-effect-action="delete-profile" data-id="${esc(p.id)}" aria-label="Remover ${esc(p.name)}">Remover</button></div></article>`).join('');
  const rows=effects.map((e,i)=>`<article class="oprpg-effect-row"><div><strong>${esc(e.name)}</strong><span>${e.disabled?'Desativado':e.isSuppressed?'Suprimido pelo item':'Ativo'} · ${esc(e.parent?.documentName==='Item'?e.parent.name:'Ficha')}</span></div><div class="oprpg-effect-actions"><button type="button" data-effect-action="toggle-effect" data-id="${i}">${e.disabled?'Ativar':'Desativar'}</button><button type="button" data-effect-action="edit-effect" data-id="${i}">Configurar</button></div></article>`).join('');
  return `<section class="oprpg-effects-window" data-actor="${esc(actor.uuid)}"><p>Configure bônus de acerto, dados, dano, usos restantes e PP máximo. Apenas efeitos ativos contribuem.</p>${game.modules?.get(OLD)?.active?'<p class="oprpg-effects-warning">Desative Automações de Efeitos antigo e recarregue para utilizar a integração do Fixes sem duplicação.</p>':''}<h3>Características especiais</h3>${entries||'<p>Nenhuma característica configurada.</p>'}<button type="button" data-effect-action="new-profile">Nova característica</button><h3>Automações dos efeitos</h3>${rows||'<p>Nenhum efeito de automação cadastrado.</p>'}<button type="button" data-effect-action="new-effect">Novo efeito de automação</button><p>Diable Jambe usa o grau e o dado da técnica. Os demais bônus podem ser cadastrados nos efeitos da ficha ou de suas características.</p></section>`;
}
export async function handleEffectsWindowAction(actor,action,id){
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  if(action==='new-profile')return editCharacteristic(actor);
  if(action==='edit-profile')return editCharacteristic(actor,id);
  if(action==='toggle-profile')return toggleCharacteristic(actor,id);
  if(action==='delete-profile'){
    if(await foundry.applications.api.DialogV2.confirm({classes:['oprpg-fixes-dialog'],window:{title:'Remover característica'},content:'<p>Remover esta configuração e seu efeito ativo?</p>'})){const active=characteristicActive(actor,profiles(actor).find(p=>p.id===id)??{});if(active?.flags?.[MODULE_ID]?.characteristic===id)await actor.deleteEmbeddedDocuments('ActiveEffect',[active.id]);return saveProfiles(actor,profiles(actor).filter(p=>p.id!==id));}return null;
  }
  if(action==='new-effect'){
    const [effect]=await actor.createEmbeddedDocuments('ActiveEffect',[{name:'Nova automação OPRPG',img:'icons/svg/upgrade.svg',transfer:false,disabled:true,changes:[],flags:{[MODULE_ID]:{automationConfig:{}}}}]);
    return effect.sheet.render(true);
  }
  const effects=applicableEffects(actor).filter(e=>e.flags?.[MODULE_ID]?.automationConfig||e.flags?.[OLD]?.config),effect=effects[Number(id)];
  if(!effect||effect.parent?.isOwner===false)throw Error('Efeito indisponível para edição.');
  if(action==='toggle-effect')return effect.update({disabled:!effect.disabled});
  if(action==='edit-effect')return effect.sheet.render(true);
  throw Error('Ação de efeito desconhecida.');
}
export async function openEffectsWindow(actor){
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  const dialog=new foundry.applications.api.DialogV2({classes:['oprpg-fixes-dialog','oprpg-effects-dialog'],window:{title:`Efeitos OPRPG — ${actor.name}`},position:{width:660},content:effectsWindowContent(actor),modal:false,buttons:[{action:'close',label:'Fechar',callback:()=>null}]});
  await dialog.render({force:true});const root=dialog.element instanceof HTMLElement?dialog.element:dialog.element?.[0];
  root.addEventListener('click',async event=>{const button=event.target.closest?.('[data-effect-action]');if(!button)return;event.preventDefault();if(button.disabled)return;button.disabled=true;try{await handleEffectsWindowAction(actor,button.dataset.effectAction,button.dataset.id);const section=root.querySelector('.oprpg-effects-window');if(section){const box=document.createElement('div');box.innerHTML=effectsWindowContent(actor);section.replaceWith(box.firstElementChild);}}catch(error){ui.notifications.error(error.message);}finally{button.disabled=false;}});return dialog;
}
export function installEffectAutomations(){
  if(installed)return;installed=true;
  for(const config of Object.values(CONFIG.DND5E.activityTypes??{}))wrapEffectDamage(config.documentClass?.prototype);
  installAutomationCapacity(CONFIG.Actor?.dataModels?.character);
  Hooks.on('dnd5e.preRollAttackV2',config=>{const activity=config.subject,b=automationBonuses(activity?.actor??activity?.item?.actor,activity);if(b?.hit&&config.rolls?.[0]&&!config.rolls[0].options?.oprpgEffectHit){config.rolls[0].parts??=[];config.rolls[0].parts.push(String(b.hit));config.rolls[0].options??={};config.rolls[0].options.oprpgEffectHit=true;}});
  Hooks.on('renderApplicationV2',app=>{
    const root=app.element instanceof HTMLElement?app.element:app.element?.[0];if(!root)return;
    if(app.document?.documentName==='ActiveEffect'){renderEffectEditor(app,root);return;}
    const actor=app.actor??app.document;if(actor?.documentName!=='Actor'||!actor.isOwner||root.querySelector('[data-oprpg-effects]'))return;
    const header=root.querySelector('.window-header');if(!header)return;const button=document.createElement('button');button.type='button';button.className='header-control';button.dataset.oprpgEffects='1';button.title='Efeitos OPRPG';button.setAttribute('aria-label',button.title);button.innerHTML='<i class="fas fa-wand-magic-sparkles" inert></i> Efeitos OPRPG';button.onclick=()=>void openEffectsWindow(actor).catch(e=>ui.notifications.error(e.message));header.append(button);
  });
  for(const name of ['createActiveEffect','updateActiveEffect','deleteActiveEffect','updateItem'])Hooks.on(name,doc=>{const actor=doc.documentName==='Item'?doc.actor:doc.parent?.documentName==='Actor'?doc.parent:doc.parent?.actor;if(actor)queueMicrotask(()=>{try{actor.prepareData();}catch(error){console.warn('OPRPG: recálculo de automação',error);}});});
  if(game.modules?.get(OLD)?.active)ui.notifications.warn('Automações de Efeitos antigo está ativo: desative-o e recarregue para usar a integração do Fixes.');
  STATE.effectAutomations=true;
}
