import { MODULE_ID, STATE } from './shared.js';
import { featureEnabled } from './feature-settings.js';
import { bonuses, paMaxBonus, applicableEffects } from './effect-automation-rules.js';
import { catalogueContent, catalogueAction, renderCatalogueTab, installCatalogueTimers } from './automation-catalogue.js';

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
  return [{parts:[b.damageFormula],data:activity.getRollData?.()??actor.getRollData?.()??{},options:{type,types:type?[type]:[],oprpgEffectAutomation:true,flavor:'AutomaÃ§Ãµes de efeitos'}}];
}
export function wrapEffectDamage(proto){
  const original=proto?.getDamageConfig;if(typeof original!=='function'||original[mark])return false;
  const replacement=function(...args){const config=original.apply(this,args);if(config?.rolls&&!config.rolls.some(r=>r.options?.oprpgEffectAutomation))config.rolls.push(...automationDamageSpecs(this.actor??this.item?.actor,this));return config;};replacement[mark]=true;proto.getDamageConfig=replacement;return true;
}
export function installAutomationCapacity(Data){
  const original=Data?.prototype?.prepareDerivedData;if(typeof original!=='function'||original[mark])return false;
  const replacement=function(...args){const result=original.apply(this,args);if(featureEnabled('characteristics')&&!game.modules?.get(OLD)?.active){const n=paMaxBonus(this.parent);if(Number.isFinite(this.energy?.max))this.energy.max+=n;}return result;};replacement[mark]=true;Data.prototype.prepareDerivedData=replacement;return true;
}
export function effectsWindowContent(actor){return catalogueContent(actor);}
export async function handleEffectsWindowAction(actor,action,id){return catalogueAction(actor,action,id);}
export async function openEffectsWindow(actor){
  if(!actor?.isOwner)throw Error('VocÃª precisa controlar esta ficha.');
  const dialog=new foundry.applications.api.DialogV2({classes:['oprpg-fixes-dialog','oprpg-effects-dialog'],window:{title:`Efeitos OPRPG â€” ${actor.name}`},position:{width:660},content:effectsWindowContent(actor),modal:false,buttons:[{action:'close',label:'Fechar',callback:()=>null}]});
  await dialog.render({force:true});const root=dialog.element instanceof HTMLElement?dialog.element:dialog.element?.[0];
  root.addEventListener('click',async event=>{const button=event.target.closest?.('[data-catalogue-action]');if(!button)return;event.preventDefault();if(button.disabled)return;button.disabled=true;try{await handleEffectsWindowAction(actor,button.dataset.catalogueAction,button.dataset.id);const section=root.querySelector('.oprpg-catalogue');if(section){const box=document.createElement('div');box.innerHTML=effectsWindowContent(actor);section.replaceWith(box.firstElementChild);}}catch(error){ui.notifications.error(error.message);}finally{button.disabled=false;}});return dialog;
}
export function installEffectAutomations(){
  if(installed)return;installed=true;installCatalogueTimers();
  for(const config of Object.values(CONFIG.DND5E.activityTypes??{}))wrapEffectDamage(config.documentClass?.prototype);
  installAutomationCapacity(CONFIG.Actor?.dataModels?.character);
  Hooks.on('dnd5e.preRollAttackV2',config=>{const activity=config.subject,b=automationBonuses(activity?.actor??activity?.item?.actor,activity);if(b?.hit&&config.rolls?.[0]&&!config.rolls[0].options?.oprpgEffectHit){config.rolls[0].parts??=[];config.rolls[0].parts.push(String(b.hit));config.rolls[0].options??={};config.rolls[0].options.oprpgEffectHit=true;}});
  Hooks.on('renderApplicationV2',app=>{
    const root=app.element instanceof HTMLElement?app.element:app.element?.[0];if(!root)return;
    renderCatalogueTab(app,root);
  });
  for(const name of ['createActiveEffect','updateActiveEffect','deleteActiveEffect','updateItem'])Hooks.on(name,doc=>{const actor=doc.documentName==='Item'?doc.actor:doc.parent?.documentName==='Actor'?doc.parent:doc.parent?.actor;if(actor)queueMicrotask(()=>{try{actor.prepareData();}catch(error){console.warn('OPRPG: recÃ¡lculo de automaÃ§Ã£o',error);}});});
  if(game.modules?.get(OLD)?.active)ui.notifications.warn('AutomaÃ§Ãµes de Efeitos antigo estÃ¡ ativo: desative-o e recarregue para usar a integraÃ§Ã£o do Fixes.');
  STATE.effectAutomations=true;
}
