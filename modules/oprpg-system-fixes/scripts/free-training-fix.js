import { historyUpdate, recordChanges, withActorOperation, actorOperationBusy } from './operation-history.js';
import { MODULE_ID, STATE } from "./shared.js";
import { connectLiveSheets, registeredCharacterSheets } from "./live-sheet-bridge.js";

const installed=new WeakSet(), bound=new WeakSet();
const scope="oprpg-system", abilities=["str","dex","con","int","wis","cha"];
const abilityLabels={str:'Força',dex:'Destreza',con:'Constituição',int:'Vontade',wis:'Sabedoria',cha:'Presença'};
const flag=a=>a.getFlag(MODULE_ID,"freeTraining") ?? {};
const learned=a=>a.getFlag(scope,"training") ?? {};
let liveInstalled=false;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function locked(actor,fn){if(!actor?.isOwner||actorOperationBusy(actor))return false;return withActorOperation(actor,fn)}

function freePlan(sheet,kind,id,rules) {
  const actor=sheet.actor,training=learned(actor),value=k=>Number(actor.system.abilities?.[k]?.value ?? 10);
  if(kind==="simple") {
    const t=rules.TREINAMENTOS_BY_ID[id],list=training.simples ?? [];
    if(!t || list.includes(id))throw Error("Treinamento inexistente ou já aprendido.");
    if(!rules.treinoReqMet(actor,t.req) || (t.requires&&!list.includes(t.requires)))throw Error("Os requisitos deste treinamento ainda não foram cumpridos.");
    if(t.especie && sheet._actorSpeciesKey()!==t.especie)throw Error("Treinamento de outra espécie.");
    return {cost:Number(t.custo),label:t.nome,details:`${t.tempo}${t.tutor?' · exige tutor':''}`,update:{'flags.oprpg-system.training.simples':[...list,id],[`flags.${MODULE_ID}.freeTraining.simple.${id}`]:true}};
  }
  if(kind==="attribute") {
    if(!abilities.includes(id))throw Error("Selecione um atributo.");
    if(Math.max(...abilities.map(value))<16 || value(id)>=20)throw Error("Requer algum atributo em 16 e o atributo escolhido abaixo de 20.");
    return {cost:5,label:`Auto-Aperfeiçoamento (${abilityLabels[id]} ${value(id)} → ${value(id)+1})`,details:'15 dias',update:{[`system.abilities.${id}.value`]:value(id)+1,'flags.oprpg-system.training.auto':Number(training.auto ?? 0)+1,[`flags.${MODULE_ID}.freeTraining.auto`]:Number(flag(actor).auto ?? 0)+1}};
  }
  if(kind==="genius") {
    const grade=Number(id);
    if(!Number.isInteger(grade)||grade<1||grade>7)throw Error("Grau inválido.");
    if(value('con')<12&&value('wis')<12)throw Error("Requer Constituição ou Sabedoria 12.");
    return {cost:grade<=2?1:grade<=5?2:3,label:`Genialidade Inusitada — ${grade}º grau`,details:`${grade<=2?5:grade<=5?10:15} dias; libera uma técnica para criação`,update:{'flags.oprpg-system.training.genialidade':Number(training.genialidade ?? 0)+1,[`flags.${MODULE_ID}.freeTraining.genius`]:Number(flag(actor).genius ?? 0)+1}};
  }
  throw Error("Tipo de treino inválido.");
}

export async function learnTrainingWithChoice(sheet,kind,id,rules){
  return locked(sheet.actor,async()=>{
    let plan=freePlan(sheet,kind,id,rules);
    const choice=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:'Aprender treinamento'},
      content:`<p><strong>${escape(plan.label)}</strong></p><p>${escape(plan.details)}.</p><p>Escolha gastar ${plan.cost} PT ou registrar o benefício recebido gratuitamente.</p><label>Origem da gratuidade <select name="trainingOrigin"><option value="mestre">Concedido pelo mestre</option><option value="caracteristica">Recebido de uma característica</option></select></label><label>Nome da característica ou observação <input name="trainingNote" maxlength="200"></label>`,
      buttons:[{action:'paid',label:`Gastar ${plan.cost} PT`,callback:()=>({mode:'paid'})},
        {action:'free',label:'Recebido gratuitamente',callback:(_event,button)=>({mode:'free',origin:button.form?.elements.namedItem('trainingOrigin')?.value ?? 'mestre',note:button.form?.elements.namedItem('trainingNote')?.value ?? ''})},
        {action:'cancel',label:'Cancelar',callback:()=>null}],rejectClose:false});
    if(!choice||!['paid','free'].includes(choice.mode))return false;
    plan=freePlan(sheet,kind,id,rules);
    const actor=sheet.actor,free=choice.mode==='free',update={...plan.update};
    if(!free){
      const pt=Number(actor.system.curseResources?.trainingPoints ?? 0);
      if(pt<plan.cost)throw Error(`PT insuficientes: precisa ${plan.cost}, disponível ${pt}.`);
      for(const key of Object.keys(update))if(key.startsWith(`flags.${MODULE_ID}.freeTraining.`))delete update[key];
      update['system.curseResources.trainingPoints']=pt-plan.cost;
      if(kind==='genius')update['flags.oprpg-system.training.genGasto']=Number(learned(actor).genGasto ?? 0)+plan.cost;
    }else{
      const origin=choice.origin==='caracteristica'?'caracteristica':'mestre';
      update[`flags.${MODULE_ID}.freeTraining.lastOrigin`]=origin;
      if(kind==='simple')update[`flags.${MODULE_ID}.freeTraining.origins.${id}`]=origin;
    }
    Object.assign(update,historyUpdate(actor,{kind:"training",label:plan.label,trainingKind:kind,trainingId:id,itemIds:Array.from(actor.items??[],i=>i.id).sort(),paid:free?0:plan.cost,origin:free?choice.origin:"pontos",note:String(choice.note??"").slice(0,200),changes:recordChanges(actor,update)}));
    await actor.update(update);
    ui.notifications.info(`${plan.label}: ${free?'recebido gratuitamente':`${plan.cost} PT gastos`}.`);
    sheet.render(false);return true;
  });
}

export function installFreeTrainingOnSheet(Sheet,rules){
  const p=Sheet?.prototype;if(!p||installed.has(p))return !!p;
  if(typeof p._prepareTrainingsContext!=='function'||typeof p._onRender!=='function'||typeof p._onUnlearnTraining!=='function')return false;
  const prepare=p._prepareTrainingsContext,render=p._onRender,unlearn=p._onUnlearnTraining;
  const invoke=(sheet,kind,id)=>learnTrainingWithChoice(sheet,kind,id,rules).catch(e=>{ui.notifications.warn(e.message);return false});
  p._onLearnTraining=function(id){return invoke(this,'simple',id)};
  p._onTrainAttribute=function(){return invoke(this,'attribute',this._selectedAttrToTrain)};
  p._onTrainGenialidade=function(){return invoke(this,'genius',this._selectedGenGrade ?? 1)};
  p._prepareTrainingsContext=async function(...args){
    const c=await prepare.apply(this,args),f=flag(this.actor),t=learned(this.actor);
    const freeSpent=Number(f.auto ?? 0)*5+Object.keys(f.simple ?? {}).filter(id=>f.simple[id]&&(t.simples ?? []).includes(id)).reduce((n,id)=>n+Number(rules.TREINAMENTOS_BY_ID[id]?.custo ?? 0),0);
    if(c.training)c.training.gastos=Math.max(0,c.training.gastos-freeSpent);
    // Lack of PT must not hide the dialog's free acquisition choice.
    const visit=x=>{if(!x||typeof x!=='object')return;if('canLearn'in x)x.canLearn=!x.learned&&x.reqMet&&x.prereqOk;for(const value of Object.values(x))if(typeof value==='object')visit(value)};
    visit(c.treinamentos);
    if(c.genialidade)c.genialidade.canTrain=c.genialidade.reqMet;
    if(c.autoAperf)for(const ab of c.autoAperf.abilities ?? [])ab.canTrain=c.autoAperf.reqMet&&!ab.maxed;
    return c;
  };
  p._onUnlearnTraining=function(id){return locked(this.actor,async()=>{
    let list=learned(this.actor).simples ?? [];
    const dependent=()=>list.some(other=>rules.TREINAMENTOS_BY_ID[other]?.requires===id);
    if(dependent()){ui.notifications.warn('Desfaça primeiro os treinamentos dependentes.');return false}
    if(!flag(this.actor).simple?.[id])return unlearn.call(this,id);
    if(!list.includes(id))return false;
    if(!await foundry.applications.api.DialogV2.confirm({classes:['oprpg-fixes-dialog'],window:{title:'Desfazer treinamento gratuito'},content:'<p>Esquecer este treinamento recebido gratuitamente? Nenhum PT será devolvido.</p>'}))return false;
    list=learned(this.actor).simples ?? [];
    if(!list.includes(id)||dependent()||!flag(this.actor).simple?.[id])return false;
    await this.actor.update({'flags.oprpg-system.training.simples':list.filter(x=>x!==id),[`flags.${MODULE_ID}.freeTraining.simple.-=${id}`]:null,[`flags.${MODULE_ID}.freeTraining.origins.-=${id}`]:null});return true;
  })};
  p._onRender=function(...args){const result=render.apply(this,args);if(result?.then)return result.then(x=>{decorateTraining(this,rules);return x});decorateTraining(this,rules);return result};
  installed.add(p);return true;
}

export function decorateTraining(sheet,rules){
  const root=sheet.element;if(!root?.querySelector)return;
  root.querySelectorAll('[data-fixes-training-ui]').forEach(el=>el.remove());
  for(const button of root.querySelectorAll('[data-action="learnTraining"], [data-action="trainAttribute"], [data-action="trainGenialidade"]')){
    button.disabled=!sheet.actor.isOwner;
    button.title='Escolher: gastar PT ou recebido gratuitamente';
    if(button.dataset.action==='learnTraining')button.textContent='Aprender';
    if(button.dataset.action==='trainGenialidade')button.textContent='Aprender técnica — escolher pagamento';
  }
  if(bound.has(root))return;bound.add(root);
  root.addEventListener('click',event=>{
    if(event.button>0)return;
    const button=event.target.closest?.('[data-action="learnTraining"], [data-action="trainAttribute"], [data-action="trainGenialidade"]');
    if(!button||!root.contains(button)||button.disabled)return;
    event.preventDefault();event.stopImmediatePropagation();
    const action=button.dataset.action,kind=action==='learnTraining'?'simple':action==='trainAttribute'?'attribute':'genius';
    const id=kind==='simple'?button.dataset.id:kind==='attribute'?sheet._selectedAttrToTrain:sheet._selectedGenGrade ?? 1;
    void learnTrainingWithChoice(sheet,kind,id,rules).catch(e=>ui.notifications.warn(e.message));
  },{capture:true});
}

export async function installFreeTrainingFix(){
  if(liveInstalled)return true;
  const rules=await import('/systems/oprpg-system/module/systems/treinamentos.mjs');
  for(const Sheet of registeredCharacterSheets())installFreeTrainingOnSheet(Sheet,rules);
  connectLiveSheets(app=>typeof app._prepareTrainingsContext==='function',app=>{installFreeTrainingOnSheet(app.constructor,rules);decorateTraining(app,rules)});
  liveInstalled=true;STATE.freeTrainingPatch=true;return true;
}
