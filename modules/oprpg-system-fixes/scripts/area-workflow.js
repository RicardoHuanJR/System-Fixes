import { MODULE_ID, STATE, getCardActivity } from './shared.js';
import { rollTargetSaves } from './save-workflow.js';
import { areaExecution } from './area-state.js';
import { refundCancelledArea } from './area-refund.js';
import { applyTechniqueEffects } from './technique-effects.js';
import { heightMatches, wallAllows } from './area-obstacles.js';

const wrapped=Symbol('oprpgAreaPreview');
const batches=new WeakMap(),running=new Set();
let installed=false;
async function cleanupConfirmedTemplates(templates){
  for(const uuid of new Set(templates.map(t=>(t.document??t).uuid).filter(Boolean))){try{const doc=await fromUuid(uuid);if(doc?.delete&&doc.isOwner!==false&&['MeasuredTemplate','Region'].includes(doc.documentName))await doc.delete();}catch(error){STATE.warnings.push(`Limpeza de área: ${error.message}`);ui.notifications.warn('Um modelo cancelado não pôde ser removido. Confira a cena.');}}
}
const esc=value=>foundry.utils.escapeHTML(String(value??''));
const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function segmentsIntersect(a,b,c,d) {
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);
  return p*q<=0&&r*s<=0&&Math.max(a.x,b.x)>=Math.min(c.x,d.x)&&Math.max(c.x,d.x)>=Math.min(a.x,b.x)&&Math.max(a.y,b.y)>=Math.min(c.y,d.y)&&Math.max(c.y,d.y)>=Math.min(a.y,b.y);
}
export function tokenIntersectsArea(template,token) {
  const shape=template?.shape,origin=template?.document??template;
  if(!shape?.contains||!token?.actor)return false;
  const grid=Number(canvas.grid?.size??canvas.dimensions?.size??100);
  const width=Number(token.w??Number(token.document?.width??1)*grid);
  const height=Number(token.h??Number(token.document?.height??1)*grid);
  const x=Number(token.document?.x??token.x??token.center?.x-width/2)-Number(origin.x??0);
  const y=Number(token.document?.y??token.y??token.center?.y-height/2)-Number(origin.y??0);
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return false;
  if(Number.isFinite(shape.radius)) {
    const cx=shape.x??0,cy=shape.y??0;
    const dx=cx-Math.max(x,Math.min(x+width,cx)),dy=cy-Math.max(y,Math.min(y+height,cy));
    return dx*dx+dy*dy<=shape.radius*shape.radius;
  }
  const corners=[{x,y},{x:x+width,y},{x:x+width,y:y+height},{x,y:y+height}];
  if(corners.some(p=>shape.contains(p.x,p.y))||shape.contains(x+width/2,y+height/2))return true;
  let points=shape.points;
  if(!points&&Number.isFinite(shape.width)&&Number.isFinite(shape.height)) {
    const sx=shape.x??0,sy=shape.y??0;
    points=[sx,sy,sx+shape.width,sy,sx+shape.width,sy+shape.height,sx,sy+shape.height];
  }
  if(!points?.length)return false;
  const vertices=Array.from({length:points.length/2},(_,i)=>({x:points[2*i],y:points[2*i+1]}));
  if(vertices.some(p=>p.x>=x&&p.x<=x+width&&p.y>=y&&p.y<=y+height))return true;
  return vertices.some((a,i)=>corners.some((c,j)=>segmentsIntersect(a,vertices[(i+1)%vertices.length],c,corners[(j+1)%4])));
}
export function tokensInAreas(templates,tokens=canvas.tokens?.placeables??[],user=game.user) {
  return tokens.filter(t=>t.actor&&t.visible!==false&&(!t.document?.hidden||user.isGM)&&templates.some(a=>tokenIntersectsArea(a,t)));
}
export function surgicalConfiguration(activity) {
  const explicit=activity?.item?.getFlag?.(MODULE_ID,'surgicalControl');
  const description=normalized(activity?.item?.system?.description?.value);
  const enabled=explicit?.enabled??description.includes('controle cirurgico');
  if(!enabled||activity?.type!=='save'||!activity.target?.template?.type)return null;
  const dex=activity.actor?.system?.abilities?.dex;
  const mod=Number(dex?.mod??Math.floor((Number(dex?.value??10)-10)/2));
  return {limit:Math.max(1,Number.isFinite(mod)?Math.floor(mod):1),costIncluded:explicit?.costIncluded!==false,
    prolonged:explicit?.prolonged===true};
}
export function validateProtectedSelection(tokens,selected,limit) {
  const unique=[...new Set(selected)];
  if(unique.length>limit||unique.some(uuid=>!tokens.some(t=>t.actor.uuid===uuid)))throw Error(`Escolha até ${limit} aliados presentes na área.`);
  return unique;
}
async function chooseProtected(activity,tokens,config) {
  const unique=[...new Map(tokens.map(t=>[t.actor.uuid,t])).values()];
  // Disposition alone cannot establish an alliance with a hostile NPC caster:
  // the caster confirms which of the listed creatures are allies.
  return foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:'Controle Cirúrgico'},rejectClose:false,
    content:`<p>Escolha os aliados protegidos de dano e condições maléficas (até ${config.limit}).</p>${unique.map(t=>`<label style="display:block"><input type="checkbox" name="protected" value="${esc(t.actor.uuid)}"> ${esc(t.actor.name)}</label>`).join('')}<p>O custo configurado na técnica não será cobrado novamente.</p>`,
    buttons:[{action:'continue',label:'Confirmar alvos',callback:(_e,_b,d)=>validateProtectedSelection(tokens,[...d.element.querySelectorAll('[name="protected"]:checked')].map(el=>el.value),config.limit)},
      {action:'cancel',label:'Cancelar',callback:()=>null}],close:()=>null});
}
export function findAreaSource(activity) {
  return Array.from(game.messages??[]).reverse().find(message=>{
    if(message.getFlag?.(MODULE_ID,'areaCycle'))return false;
    if(message.author?.id!==game.user.id&&message.user?.id!==game.user.id)return false;
    const root=document.createElement('div');root.innerHTML=message.content??'';
    const card=root.querySelector('.jujutsu-card[data-item-id]');
    return card&&getCardActivity(card).activity?.uuid===activity.uuid;
  });
}
export async function finalizeAreaExecution(activity,templates,message=findAreaSource(activity),{protectedSelection}={}) {
  if(!message||message.isContentVisible===false||(!game.user.isGM&&message.author?.id!==game.user.id))throw Error('Cartão de origem da área indisponível.');
  if(running.has(message.id)||areaExecution(message)?.status==='ready')return null;
  running.add(message.id);
  try {
    const automation=activity.item?.getFlag?.(MODULE_ID,'techniqueAutomation')??{};
    const tokens=tokensInAreas(templates).filter(t=>heightMatches(t,automation)&&templates.some(a=>tokenIntersectsArea(a,t)&&wallAllows(a,t,automation))),config=surgicalConfiguration(activity);
    if(config&&!config.costIncluded)throw Error('Inclua o custo de Controle Cirúrgico no consumo da atividade antes de executar.');
    const targets=[...new Set(tokens.map(t=>t.actor.uuid))];
    const state={status:'choosing',sourceId:message.id,activityId:activity.id,activityUuid:activity.uuid,scene:canvas.scene?.id,
      templates:templates.map(t=>(t.document??t).uuid).filter(Boolean),targets,protected:[],prolonged:!!config?.prolonged};
    await message.setFlag(MODULE_ID,'areaExecution',state);
    const selected=config?(protectedSelection??await chooseProtected(activity,tokens,config)):[];
    if(selected===null){await message.setFlag(MODULE_ID,'areaExecution',{...state,status:'cancelled'});await cleanupConfirmedTemplates(templates);await refundCancelledArea(activity,message);return null;}
    state.protected=validateProtectedSelection(tokens,selected,config?.limit??0);state.status='ready';
    await message.setFlag(MODULE_ID,'areaExecution',state);
    Hooks.callAll('oprpgFixes.areaConfirmed',{activity,templates,message,state});
    for(const token of [...new Map(tokens.map(t=>[t.actor.uuid,t])).values()])if(activity.type==='utility'||state.protected.includes(token.actor.uuid))await applyTechniqueEffects(activity,token.actor,message);
    // Replace unrelated targets once, then broadcast one batch. Never retarget on refresh.
    for(const old of Array.from(game.user.targets??[]))old.setTarget(false,{user:game.user,releaseOthers:false,groupSelection:true});
    for(const token of tokens)token.setTarget(true,{user:game.user,releaseOthers:false,groupSelection:true});
    game.user.broadcastActivity?.({targets:Array.from(game.user.targets??[],t=>t.id)});
    if(activity.type==='save'&&targets.some(uuid=>!state.protected.includes(uuid))) {
      const root=document.createElement('div');root.innerHTML=message.content??'';
      const actors=[...new Map(tokens.filter(t=>!state.protected.includes(t.actor.uuid)).map(t=>[t.actor.uuid,t.actor])).values()];
      await rollTargetSaves(root.querySelector('.jujutsu-card[data-card-type="save"]'),message,actors,{individual:true});
    }
    STATE.areaExecutionLast={message:message.id,targets:targets.length,protected:state.protected.length};
    return state;
  }finally{running.delete(message.id);}
}
export function wrapAreaPreview(proto) {
  if(!proto?.drawPreview||proto.drawPreview[wrapped])return false;
  const original=proto.drawPreview;
  const finish=proto._finishPlacement;
  if(typeof finish==='function')proto._finishPlacement=function(...args){
    this._oprpgAreaGeometry=this.shape?.clone?.()??this.shape;
    return finish.apply(this,args);
  };
  const replacement=async function(...args) {
    const activity=this.activity;
    if(activity?.item?.type!=='spell')return original.apply(this,args);
    const batch=batches.get(this)??{activity,expected:1,done:0,templates:[],message:findAreaSource(activity)};
    if(batch.done===0&&batch.message)await batch.message.setFlag(MODULE_ID,'areaExecution',{status:'placing',activityId:activity.id,activityUuid:activity.uuid,targets:[],protected:[]});
    let result;
    try{result=await original.apply(this,args);}
    catch(error){
      batch.cancelled=true;
      await cleanupConfirmedTemplates(batch.templates);
      if(batch.message)await batch.message.setFlag(MODULE_ID,'areaExecution',{status:'cancelled',activityId:activity.id,activityUuid:activity.uuid,targets:[],protected:[]});
      if(batch.message)await refundCancelledArea(activity,batch.message);
      throw error;
    }
    batch.done++;
    if(!result||Array.isArray(result)&&!result.length){batch.cancelled=true;await cleanupConfirmedTemplates(batch.templates);if(batch.message){await batch.message.setFlag(MODULE_ID,'areaExecution',{status:'cancelled',activityId:activity.id,activityUuid:activity.uuid,targets:[],protected:[]});await refundCancelledArea(activity,batch.message);}return result;}
    // The preview already owns the exact PIXI geometry, including rotation.
    const shape=this._oprpgAreaGeometry??this.shape;
    if(!shape?.contains){
      batch.cancelled=true;
      await cleanupConfirmedTemplates([...batch.templates,{document:(Array.isArray(result)?result[0]:result)??this.document}]);
      if(batch.message){await batch.message.setFlag(MODULE_ID,'areaExecution',{status:'cancelled',activityId:activity.id,activityUuid:activity.uuid,targets:[],protected:[]});await refundCancelledArea(activity,batch.message);}
      throw Error('Não foi possível ler a geometria da área confirmada.');
    }
    batch.templates.push({shape,document:(Array.isArray(result)?result[0]:result)??this.document});
    if(batch.done===batch.expected&&!batch.cancelled) {
      try{await finalizeAreaExecution(activity,batch.templates,batch.message??findAreaSource(activity));}
      catch(error){STATE.warnings.push(`Área: ${error.message}`);ui.notifications.error(error.message);}
    }
    return result;
  };
  replacement[wrapped]=true;proto.drawPreview=replacement;return true;
}
export async function installAreaWorkflow() {
  if(installed)return true;
  const {default:AbilityTemplate}=await import('/systems/oprpg-system/module/canvas/ability-template.mjs');
  if(!wrapAreaPreview(AbilityTemplate.prototype))return false;
  Hooks.on('dnd5e.createActivityTemplate',(activity,templates)=>{
    const batch={activity,expected:templates.length,done:0,templates:[],message:findAreaSource(activity)};
    for(const template of templates)batches.set(template,batch);
  });
  Hooks.on('renderApplicationV2',app=>{
    const item=app.item??app.document,root=app.element instanceof HTMLElement?app.element:app.element?.[0];
    if(item?.documentName!=='Item'||item.type!=='spell'||!item.isOwner||!root||root.querySelector('.oprpg-surgical-config'))return;
    const header=root.querySelector('.window-header');if(!header)return;
    const button=document.createElement('button');button.type='button';button.className='oprpg-surgical-config';button.title='Configurar Controle Cirúrgico';button.setAttribute('aria-label',button.title);button.innerHTML='<i class="fas fa-crosshairs" inert></i>';
    button.addEventListener('click',()=>void configureSurgicalControl(item).catch(error=>ui.notifications.error(error.message)));header.append(button);
  });
  // Only block effects explicitly associated with this card. Unrelated healing,
  // buffs and manually created conditions never inherit a stale protection.
  Hooks.on('preCreateActiveEffect',(effect,data,options)=>{
    const sourceId=options?.oprpgAreaSource??data.flags?.[MODULE_ID]?.areaSource;
    const execution=sourceId&&areaExecution(game.messages.get(sourceId));
    if(execution?.protected?.includes(effect.parent?.uuid)&&options?.oprpgBeneficial!==true)return false;
  });
  installed=true;STATE.areaWorkflowPatch=true;return true;
}

export async function configureSurgicalControl(item) {
  if(!item?.isOwner||item.type!=='spell')throw Error('Abra uma técnica que você controla.');
  const current=item.getFlag(MODULE_ID,'surgicalControl')??{};
  const result=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:'Controle Cirúrgico — técnica'},rejectClose:false,
    content:`<label style="display:block"><input type="checkbox" name="enabled" ${current.enabled?'checked':''}> Esta técnica tem Controle Cirúrgico</label><label style="display:block"><input type="checkbox" name="costIncluded" ${current.costIncluded!==false?'checked':''}> O consumo da atividade já inclui 1 PP deste efeito</label><label style="display:block"><input type="checkbox" name="prolonged" ${current.prolonged?'checked':''}> Proteção durante a duração prolongada (incluir o PP adicional no consumo)</label><p>Aplica-se a técnicas de área com salvaguarda. Configure os PP na atividade; o módulo não cobra novamente. Protege até o modificador de Destreza, mínimo de um aliado.</p>`,
    buttons:[{action:'save',label:'Salvar',callback:(_e,_b,d)=>Object.fromEntries(['enabled','costIncluded','prolonged'].map(key=>[key,d.element.querySelector(`[name="${key}"]`).checked]))},
      {action:'cancel',label:'Cancelar',callback:()=>null}],close:()=>null});
  if(result)await item.setFlag(MODULE_ID,'surgicalControl',result);
  return result;
}
