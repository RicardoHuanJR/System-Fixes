import { MODULE_ID } from './shared.js';
import { queueActor } from './automation-runtime.js';
const busy=new Map();
let historyInstalled=false;
export function actorOperationBusy(actor) { return busy.has(actor?.uuid??actor?.id); }
export const HISTORY_LIMIT=100;
export function resourceHistory(actor,changes,options={},userId=game.user.id) {
  if(userId!==game.user.id||!actor?.isOwner||changes[`flags.${MODULE_ID}.history`])return;
  const fields={'system.attributes.hp.value':'PV','system.attributes.hp.temp':'PV temporários','system.attributes.hp.tempmax':'Máximo temporário de PV','system.attributes.pve.value':'Vitalidade','system.energy.total':'PP','system.energy.generated':'PP gerados','system.shieldPoints.value':'Escudo','system.armorPoints.value':'Armadura','system.curseResources.trainingPoints':'PT'};
  const changed=[];
  for(const [path,label] of Object.entries(fields)){
    const after=changes[path]??foundry.utils.getProperty(changes,path),before=foundry.utils.getProperty(actor,path);
    if(after===undefined||!Number.isFinite(Number(after))||Number(after)===Number(before))continue;
    changed.push({path,before:Number(before)||0,after:Number(after),label});
  }
  if(changed.length){
    const receiptPath=`flags.${MODULE_ID}.damageReceipts`;
    const receiptAfter=changes[receiptPath]??foundry.utils.getProperty(changes,receiptPath);
    if(receiptAfter!==undefined)changed.push({path:receiptPath,before:foundry.utils.deepClone(actor.getFlag(MODULE_ID,'damageReceipts')??[]),after:foundry.utils.deepClone(receiptAfter),label:'Registro de aplicação'});
    Object.assign(changes,historyUpdate(actor,{kind:'resources',label:changed.filter(c=>c.path!==receiptPath).map(c=>`${c.label}: ${c.before} → ${c.after}`).join('; '),changes:changed}));
  }
}
export function installResourceHistory(){
  if(historyInstalled)return;historyInstalled=true;
  Hooks.on('preUpdateActor',resourceHistory);
}
export async function undoResources(actor){
  return withActorOperation(actor,async()=>{
    const last=(actor.getFlag(MODULE_ID,'history')??[]).at(-1);
    if(last?.kind!=='resources'||!last.changes?.length)throw Error('O último registro não é uma alteração de recursos que possa ser desfeita.');
    const allowed=new Set(['system.attributes.hp.value','system.attributes.hp.temp','system.attributes.hp.tempmax','system.attributes.pve.value','system.energy.total','system.energy.generated','system.shieldPoints.value','system.armorPoints.value','system.curseResources.trainingPoints',`flags.${MODULE_ID}.damageReceipts`]);
    for(const c of last.changes){
      if(!allowed.has(c.path))throw Error('Registro incompatível com a reversão de recursos.');
      const current=foundry.utils.getProperty(actor,c.path)??(c.path.endsWith('.damageReceipts')?[]:null);
      if(JSON.stringify(current)!==JSON.stringify(c.after))throw Error('Os recursos mudaram após este registro. A reversão foi bloqueada para preservar alterações posteriores.');
    }
    const updates=Object.fromEntries(last.changes.map(c=>[c.path,foundry.utils.deepClone(c.before)]));
    Object.assign(updates,historyUpdate(actor,{kind:'undo-resources',label:`Recursos restaurados: ${last.label}`,undoOf:last.id}));
    await actor.update(updates,{oprpgFixesResourceUndo:true,dnd5e:{concentrationCheck:false}});return true;
  });
}
export function recordChanges(actor,updates) {
  return Object.entries(updates).filter(([path])=>!path.includes('.-=')).map(([path,after])=>({path,before:foundry.utils.getProperty(actor,path)??null,after:foundry.utils.deepClone(after)}));
}
export async function undoTraining(actor) {
  return withActorOperation(actor,async()=>{
    const history=actor.getFlag(MODULE_ID,'history')??[],last=history.at(-1);
    if(last?.kind!=='training'||!last.changes?.length)throw Error('O último registro não é um aprendizado que possa ser desfeito.');
    if(last.trainingKind==='genius')throw Error('Use o controle nativo para desfazer Genialidade após verificar as técnicas dependentes.');
    for(const change of last.changes)if(JSON.stringify(foundry.utils.getProperty(actor,change.path)??null)!==JSON.stringify(change.after))throw Error('A ficha mudou desde este treino. Desfaça pelo controle do treinamento para preservar alterações posteriores.');
    if(last.itemIds&&JSON.stringify(Array.from(actor.items??[],i=>i.id).sort())!==JSON.stringify(last.itemIds))throw Error('Os itens da ficha mudaram após o treino. Verifique dependências antes de desfazer.');
    const updates={};
    for(const {path,before} of last.changes){
      if(before===null){const parts=path.split('.');const key=parts.pop();updates[parts.join('.')+'.-='+key]=null;}
      else updates[path]=before;
    }
    Object.assign(updates,historyUpdate(actor,{kind:'undo-training',label:`Desfeito: ${last.label}`,undoOf:last.id,refunded:last.paid??0}));
    await actor.update(updates);return true;
  });
}
export function historyUpdate(actor,entry) {
  const history=actor.getFlag(MODULE_ID,'history')??[];
  const event={id:foundry.utils.randomID(),at:Date.now(),worldTime:Number(game.time?.worldTime??0),user:game.user?.id,...entry};
  return {[`flags.${MODULE_ID}.history`]:[...history,event].slice(-HISTORY_LIMIT)};
}
export async function withActorOperation(actor,fn) {
  if(!actor?.isOwner)throw Error('Você não tem permissão para alterar esta ficha.');
  const key=actor.uuid??actor.id;
  if(busy.has(key))throw Error('Uma operação desta ficha já está aberta. Conclua ou cancele a janela anterior.');
  busy.set(key,true);
  try{return await queueActor(actor,fn);}finally{busy.delete(key);}
}
export function downloadBackup(documents,label='backup') {
  if(!game.user.isGM)throw Error('Somente o mestre pode exportar este backup.');
  const data={format:'oprpg-fixes-backup',version:1,createdAt:new Date().toISOString(),system:game.system?.version,module:game.modules.get(MODULE_ID)?.version,
    documents:documents.map(d=>({uuid:d.uuid,type:d.documentName,data:d.toObject()}))};
  const json=JSON.stringify(documents.length===1?data.documents[0].data:data,null,2);
  if(typeof saveDataToFile!=='function')throw Error('O exportador de arquivos do Foundry não está disponível.');
  saveDataToFile(json,'application/json',`oprpg-${label}-${Date.now()}.json`);
  return data;
}
