import { MODULE_ID, STATE } from './shared.js';
import { featureEnabled } from './feature-settings.js';
import { runItemMacros } from './external-compatibility.js';

const mark=Symbol('oprpgCompatibilityMacro');let installed=false;
const enabled=()=>featureEnabled('externalCompatibility')&&game.settings.get(MODULE_ID,'compatibilityMacros')===true&&!(game.modules?.get('midi-qol')?.active&&globalThis.MidiQOL?.Workflow);
export function validateMacroDamage(value){
  if(value==null)return [];
  const rows=Array.isArray(value)?value:[value];
  return rows.map(row=>{
    const formula=row.damageRoll??row.formula,type=row.type??row.damageType;
    if(!Roll.validate(String(formula??''))||!CONFIG.DND5E.damageTypes[type])throw Error('A macro deve retornar uma fórmula de dano e um tipo válidos.');
    return {parts:[formula],options:{type,types:[type],oprpgMacroBonus:true,flavor:row.flavor??'Bônus de característica'},data:{}};
  });
}
export async function damageMacroBonuses(activity){
  if(!enabled()||!activity?.item?.isOwner)return [];
  const names=activity.item.flags?.['midi-qol']?.damageBonusMacro??activity.actor?.flags?.['midi-qol']?.DamageBonusMacro??activity.actor?.flags?.dnd5e?.DamageBonusMacro;
  if(!names)return [];
  const item=activity.item,temporary={...item,actor:item.actor,uuid:item.uuid,isOwner:item.isOwner,executeMacro:item.executeMacro?.bind(item),flags:{...item.flags,'midi-qol':{...item.flags?.['midi-qol'],onUseMacroName:String(names).split(',').map(n=>`[DamageBonus]${n.trim()}`).join(',')}}};
  const results=await runItemMacros(temporary,'DamageBonus',{activity,targets:Array.from(game.user.targets??[],t=>t.actor?.uuid).filter(Boolean)});
  return results.flatMap(validateMacroDamage);
}
export function wrapMacroActivity(proto){
  if(!proto)return false;let changed=false;
  for(const [method,phase]of [['use','preItemRoll'],['rollAttack','preAttackRoll'],['rollDamage','preDamageRoll']]){
    const original=proto[method];if(typeof original!=='function'||original[mark])continue;
    const replacement=async function(...args){
      if(enabled()&&this.item?.flags?.['midi-qol']?.onUseMacroName){const results=await runItemMacros(this.item,phase,{activity:this,config:args[0],targets:Array.from(game.user.targets??[],t=>t.actor?.uuid).filter(Boolean)});if(results.some(r=>r===false))return null;}
      if(method==='rollDamage'&&enabled()){
        const bonuses=await damageMacroBonuses(this),previous=this._oprpgDamageMacroBonuses;
        this._oprpgDamageMacroBonuses=bonuses;
        try{return await original.apply(this,args);}finally{this._oprpgDamageMacroBonuses=previous;}
      }
      return original.apply(this,args);
    };replacement[mark]=true;proto[method]=replacement;changed=true;
  }
  const original=proto.getDamageConfig;
  if(typeof original==='function'&&!original[mark]){
    const replacement=function(...args){const config=original.apply(this,args);if(config?.rolls&&!config.rolls.some(r=>r.options?.oprpgMacroBonus))config.rolls.push(...(this._oprpgDamageMacroBonuses??[]).map(r=>({...r,data:this.getRollData?.()??{}})));return config;};replacement[mark]=true;proto.getDamageConfig=replacement;changed=true;
  }return changed;
}
export function installCompatibilityMacros(){
  if(installed)return;installed=true;
  for(const entry of Object.values(CONFIG.DND5E.activityTypes??{}))wrapMacroActivity(entry.documentClass?.prototype);
  STATE.compatibilityMacroPhases=true;
}
