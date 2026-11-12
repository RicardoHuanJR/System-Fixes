import { MODULE_ID, STATE, getCardActivity } from './shared.js';
import { rollTargetSaves } from './save-workflow.js';
import { areaExecution } from './area-state.js';
import { refundCancelledArea } from './area-refund.js';
import { applyTechniqueEffects } from './technique-effects.js';
import { heightMatches, wallAllows } from './area-obstacles.js';
import { regionDocument, areaAffectedTokenCells, readTemplateHighlights } from './area-grid.js';
import { casterIdentity, isCasterToken, isCasterActor } from './area-caster.js';

const wrapped=Symbol('oprpgAreaPreview');
const batches=new WeakMap(),running=new Set();
let installed=false;
async function cleanupConfirmedTemplates(templates){
  for(const uuid of new Set(templates.map(t=>(t.document??t)?.document??(t.document??t)).map(d=>d?.uuid).filter(Boolean))){try{const doc=await fromUuid(uuid);if(doc?.delete&&doc.isOwner!==false&&['MeasuredTemplate','Region'].includes(doc.documentName))await doc.delete();}catch(error){STATE.warnings.push(`Limpeza de área: ${error.message}`);ui.notifications.warn('Um modelo cancelado não pôde ser removido. Confira a cena.');}}
}
export async function discardCancelledBatchResult(batch,result){
  if(!batch.cancelled)return false;
  if(result)await cleanupConfirmedTemplates((Array.isArray(result)?result:[result]).map(document=>({document})));
  return true;
}

const esc=value=>foundry.utils.escapeHTML(String(value??''));
const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const isNativeEmanation=activity=>['emanation','emanacao'].includes(normalized(activity?.target?.template?.type));

// Foundry V14 uses an attached Region, not a legacy circular MeasuredTemplate.
export async function createNativeEmanation(activity) {
  if(!isNativeEmanation(activity))throw Error('Esta atividade não é uma emanação.');
  if(!canvas?.ready||!canvas.scene)throw Error('Abra uma cena antes de criar a emanação.');
  const create=foundry.documents?.RegionDocument?.createTokenEmanation;
  if(typeof create!=='function')throw Error('A API de emanação nativa do Foundry V14 não está disponível.');
  const actor=activity.actor??activity.item?.actor;
  const available=(canvas.tokens?.placeables??[]).filter(t=>t.actor?.id===actor?.id&&t.document?.parent===canvas.scene);
  const selected=available.filter(t=>t.controlled);
  const token=selected.length===1?selected[0]:available.length===1?available[0]:null;
  if(!token)throw Error('Selecione um único token do lançador na cena para criar a emanação.');
  const size=Number(activity.target?.template?.size);
  const cellDistance=Number(canvas.scene.grid?.distance??canvas.dimensions?.distance);
  if(!(size>0&&cellDistance>0&&Number.isFinite(size)&&Number.isFinite(cellDistance)))throw Error('Configure o tamanho da emanação e a distância da grade.');
  const region=await create.call(foundry.documents.RegionDocument,token.document,size/cellDistance,{
    name:activity.name??activity.item?.name??'Emanação',
    color:game.user.color,
    displayMeasurements:true,
    highlightMode:'coverage',
    ownership:{[game.user.id]:CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER},
    flags:{[MODULE_ID]:{nativeEmanation:true,activityUuid:activity.uuid,sourceTokenUuid:token.document.uuid}}
  });
  if(!region||region.documentName!=='Region')throw Error('O Foundry não conseguiu criar a Região de emanação.');
  return region;
}

// The native Region and legacy templates share the same grid-cell targeting rule.
// True-shape intersection is retained ONLY for scenes without a grid.
function gridlessNativeRegionIntersectsToken(region,token) {
  const mesh=region?.triangulation;
  if(!mesh?.vertices?.length||!mesh?.indices?.length)return false;
  const grid=Number(canvas.grid?.size??canvas.dimensions?.size??100);
  const width=Number(token.w??Number(token.document?.width??1)*grid);
  const height=Number(token.h??Number(token.document?.height??1)*grid);
  const x=Number(token.document?.x??token.x),y=Number(token.document?.y??token.y);
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return false;
  const epsilon=Math.max(1e-8,width*height*1e-10),v=mesh.vertices,indices=mesh.indices;
  for(let i=0;i+2<indices.length;i+=3){
    const triangle=[indices[i],indices[i+1],indices[i+2]].map(j=>({x:Number(v[j*2]),y:Number(v[j*2+1])}));
    if(triangle.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))&&clippedPolygonArea(triangle,x,y,width,height)>epsilon)return true;
  }
  return false;
}


// Only positive-area overlap counts. Touching a token edge or corner is not a hit.
function clippedPolygonArea(vertices,x,y,width,height) {
  let polygon=vertices;
  const boundaries=[
    {inside:p=>p.x>=x,meet:(a,b)=>({x,y:a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x)})},
    {inside:p=>p.x<=x+width,meet:(a,b)=>({x:x+width,y:a.y+(b.y-a.y)*(x+width-a.x)/(b.x-a.x)})},
    {inside:p=>p.y>=y,meet:(a,b)=>({x:a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y),y})},
    {inside:p=>p.y<=y+height,meet:(a,b)=>({x:a.x+(b.x-a.x)*(y+height-a.y)/(b.y-a.y),y:y+height})}
  ];
  for(const boundary of boundaries){
    if(!polygon.length)return 0;
    const clipped=[];
    for(let i=0;i<polygon.length;i++){
      const current=polygon[i],previous=polygon[(i+polygon.length-1)%polygon.length];
      const inside=boundary.inside(current),wasInside=boundary.inside(previous);
      if(inside!==wasInside)clipped.push(boundary.meet(previous,current));
      if(inside)clipped.push(current);
    }
    polygon=clipped;
  }
  if(polygon.length<3)return 0;
  let twiceArea=0;
  for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length];
    twiceArea+=p.x*q.y-q.x*p.y;
  }
  return Math.abs(twiceArea)/2;
}
function gridlessTokenIntersectsArea(template,token) {
  const region=regionDocument(template);
  if(region)return !!token?.actor&&gridlessNativeRegionIntersectsToken(region,token);
  const shape=template?.shape,origin=template?.document??template;
  if(!shape||!token?.actor)return false;
  const grid=Number(canvas.grid?.size??canvas.dimensions?.size??100);
  const width=Number(token.w??Number(token.document?.width??1)*grid);
  const height=Number(token.h??Number(token.document?.height??1)*grid);
  const x=Number(token.document?.x??token.x??token.center?.x-width/2)-Number(origin.x??0);
  const y=Number(token.document?.y??token.y??token.center?.y-height/2)-Number(origin.y??0);
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return false;
  const epsilon=Math.max(1e-8,width*height*1e-10);
  if(Number.isFinite(shape.radius)) {
    const cx=Number(shape.x??0),cy=Number(shape.y??0);
    const dx=cx-Math.max(x,Math.min(x+width,cx)),dy=cy-Math.max(y,Math.min(y+height,cy));
    // Strict inequality excludes tokens tangent to the circle.
    return dx*dx+dy*dy<shape.radius*shape.radius-1e-8;
  }
  let points=shape.points;
  if(!points&&Number.isFinite(shape.width)&&Number.isFinite(shape.height)) {
    const sx=shape.x??0,sy=shape.y??0;
    points=[sx,sy,sx+shape.width,sy,sx+shape.width,sy+shape.height,sx,sy+shape.height];
  }
  if(!points||points.length<6)return false;
  const vertices=Array.from({length:points.length/2},(_,i)=>({x:Number(points[2*i]),y:Number(points[2*i+1])}));
  if(vertices.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return false;
  return clippedPolygonArea(vertices,x,y,width,height)>epsilon;
}

export { regionDocument };
export function nativeRegionIntersectsToken(region,token) {
  if(!token?.actor)return false;
  const affected=areaAffectedTokenCells({document:region},token);
  return affected===null?gridlessNativeRegionIntersectsToken(region,token):affected.length>0;
}
export function tokenIntersectsArea(template,token) {
  if(!token?.actor)return false;
  const affected=areaAffectedTokenCells(template,token);
  return affected===null?gridlessTokenIntersectsArea(template,token):affected.length>0;
}
export function tokensInAreas(templates,tokens=canvas.tokens?.placeables??[],user=game.user,caster={}) {
  return tokens.filter(t=>t.actor&&!isCasterToken(t,caster)&&(user.isGM||t.visible!==false)&&(!t.document?.hidden||user.isGM)&&templates.some(a=>tokenIntersectsArea(a,t)));
}
export function surgicalConfiguration(activity) {
  const explicit=activity?.item?.getFlag?.(MODULE_ID,`surgicalActivities.${activity.id}`);
  const enabled=explicit?.enabled===true;
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
    // A message may contain several activity cards. The selected activity
    // might be in a later card rather than the first one in the HTML.
    return Array.from(root.querySelectorAll('.jujutsu-card[data-item-id]'))
      .some(card=>getCardActivity(card).activity?.uuid===activity.uuid);
  });
}
export async function finalizeAreaExecution(activity,templates,message=findAreaSource(activity),{protectedSelection}={}) {
  if(!message||message.isContentVisible===false||(!game.user.isGM&&message.author?.id!==game.user.id))throw Error('Cartão de origem da área indisponível.');
  if(running.has(message.id)||areaExecution(message)?.status==='ready')return null;
  running.add(message.id);
  try {
    const automation=activity.item?.getFlag?.(MODULE_ID,'techniqueAutomation')??{};
    const caster=casterIdentity(activity,templates);
    if(!caster.casterUuid&&!caster.casterActorId&&!caster.sourceTokenUuid)
      throw Error('Não foi possível identificar o lançador da técnica de área.');
    // Never include the caster, even if their square is highlighted.
    const tokens=tokensInAreas(templates,canvas.tokens?.placeables??[],game.user,caster)
      .filter(t=>heightMatches(t,automation)&&templates.some(a=>tokenIntersectsArea(a,t)&&wallAllows(a,t,automation))),config=surgicalConfiguration(activity);
    if(config&&!config.costIncluded)throw Error('Inclua o custo de Controle Cirúrgico no consumo da atividade antes de executar.');
    const targets=[...new Set(tokens.map(t=>t.actor.uuid))];
    const state={status:'choosing',sourceId:message.id,activityId:activity.id,activityUuid:activity.uuid,scene:canvas.scene?.id,
      templates:templates.map(t=>(t.document??t).uuid).filter(Boolean),targets,protected:[],prolonged:!!config?.prolonged,
      ...caster};
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
      const saveCard=Array.from(root.querySelectorAll('.jujutsu-card[data-card-type="save"]'))
        .find(card=>card.dataset.activityId===activity.id);
      if(!saveCard)throw Error('Cartão da atividade de salvaguarda selecionada não foi encontrado.');
      await rollTargetSaves(saveCard,message,actors,{individual:true});
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
    this._oprpgGridHighlights=readTemplateHighlights(this);
    return finish.apply(this,args);
  };
  const replacement=async function(...args) {
    const activity=this.activity;
    if(activity?.item?.type!=='spell')return original.apply(this,args);
    const batch=batches.get(this)??{activity,expected:1,done:0,templates:[],message:findAreaSource(activity)};
    if(batch.done===0&&batch.message)await batch.message.setFlag(MODULE_ID,'areaExecution',{status:'placing',activityId:activity.id,activityUuid:activity.uuid,targets:[],protected:[]});
    let result;
    try{result=isNativeEmanation(activity)?await createNativeEmanation(activity):await original.apply(this,args);}
    catch(error){
      batch.cancelled=true;
      await cleanupConfirmedTemplates(batch.templates);
      if(batch.message)await batch.message.setFlag(MODULE_ID,'areaExecution',{status:'cancelled',activityId:activity.id,activityUuid:activity.uuid,targets:[],protected:[]});
      if(batch.message)await refundCancelledArea(activity,batch.message);
      throw error;
    }
    batch.done++;
    // Another preview in this batch may have been cancelled while this one
    // was still placing. A late completion must never leave an orphan Region
    // or template in the scene.
    if(await discardCancelledBatchResult(batch,result))return result;
    if(!result||Array.isArray(result)&&!result.length){batch.cancelled=true;await cleanupConfirmedTemplates(batch.templates);if(batch.message){await batch.message.setFlag(MODULE_ID,'areaExecution',{status:'cancelled',activityId:activity.id,activityUuid:activity.uuid,targets:[],protected:[]});await refundCancelledArea(activity,batch.message);}return result;}
    // For V14 emanations, use the Region's native geometry, not the legacy PIXI circle.
    const placed=Array.isArray(result)?result[0]:result;
    // Foundry and OPRPG integrations may return a Canvas placeable or a
    // Document; persist the underlying Document UUID in both cases.
    const document=placed?.document??placed;
    const region=regionDocument(document);
    const shape=region?null:(this._oprpgAreaGeometry??this.shape);
    if(!region&&!shape?.contains){
      batch.cancelled=true;
      await cleanupConfirmedTemplates([...batch.templates,{document:(Array.isArray(result)?result[0]:result)??this.document}]);
      if(batch.message){await batch.message.setFlag(MODULE_ID,'areaExecution',{status:'cancelled',activityId:activity.id,activityUuid:activity.uuid,targets:[],protected:[]});await refundCancelledArea(activity,batch.message);}
      throw Error('Não foi possível ler a geometria da área confirmada.');
    }
    batch.templates.push({shape,document:document??this.document,gridHighlights:region?null:(this._oprpgGridHighlights??readTemplateHighlights(this))});
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
    if(execution&&isCasterActor(effect.parent,execution))return false;
    if(execution?.protected?.includes(effect.parent?.uuid)&&options?.oprpgBeneficial!==true)return false;
  });
  installed=true;STATE.areaWorkflowPatch=true;return true;
}

export async function configureSurgicalControl(subject) {
  const item=subject?.item??subject;
  if(!item?.isOwner||item.type!=='spell')throw Error('Abra uma técnica que você controla.');
  let activity=subject?.item?subject:null;
  if(!activity){
    const choices=Array.from(item.system.activities??[]).filter(a=>a.type==='save'&&a.target?.template?.type);
    if(!choices.length)throw Error('Configure uma atividade de salvaguarda com área nesta técnica.');
    const id=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:'Controle Cirúrgico — escolher atividade'},content:`<label>Atividade <select name="activity">${choices.map(a=>`<option value="${esc(a.id)}">${esc(a.name||a.id)}</option>`).join('')}</select></label>`,buttons:[{action:'next',label:'Configurar atividade',callback:(_e,_b,d)=>d.element.querySelector('[name="activity"]').value},{action:'cancel',label:'Cancelar',callback:()=>null}],rejectClose:false});
    if(!id)return null;activity=choices.find(a=>a.id===id);
  }
  if(activity.type!=='save'||!activity.target?.template?.type)throw Error('Controle Cirúrgico exige salvaguarda e área nesta atividade.');
  const current=item.getFlag(MODULE_ID,`surgicalActivities.${activity.id}`)??{};
  const legacy=item.getFlag(MODULE_ID,'surgicalControl');
  const result=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:`Controle Cirúrgico — ${activity.name||activity.id}`},rejectClose:false,
    content:`<label><input type="checkbox" name="enabled" ${current.enabled?'checked':''}> Ativar nesta atividade</label><label><input type="checkbox" name="costIncluded" ${current.costIncluded!==false?'checked':''}> O consumo desta atividade já inclui 1 PP do efeito</label><label><input type="checkbox" name="prolonged" ${current.prolonged?'checked':''}> Proteção prolongada (incluir o PP adicional nesta atividade)</label><p>Protege até o modificador de Destreza, mínimo de um aliado. As outras atividades da técnica permanecem independentes.</p>${legacy?.enabled?'<p>Existe configuração antiga no item. Ela não ativa todas as atividades automaticamente; configure as desejadas aqui.</p>':''}`,
    buttons:[{action:'save',label:'Salvar',callback:(_e,_b,d)=>Object.fromEntries(['enabled','costIncluded','prolonged'].map(key=>[key,d.element.querySelector(`[name="${key}"]`).checked]))},{action:'cancel',label:'Cancelar',callback:()=>null}]});
  if(result)await item.setFlag(MODULE_ID,`surgicalActivities.${activity.id}`,result);return result;
}
