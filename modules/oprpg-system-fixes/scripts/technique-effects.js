import { MODULE_ID, STATE, getCardActivity } from './shared.js';
import { queueActor } from './automation-runtime.js';
import { featureEnabled } from './feature-settings.js';
import { areaExecution, areaProtected } from './area-state.js';
import { messageAudience } from './roll-privacy.js';

let installed=false;
const esc=s=>foundry.utils.escapeHTML(String(s??''));
export function responsibleExecutor(actor){
  const gm=game.users?.activeGM??Array.from(game.users??[]).filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0];
  if(gm)return gm.id===game.user.id;
  const owner=Array.from(game.users??[]).filter(u=>u.active&&actor.testUserPermission?.(u,'OWNER')).sort((a,b)=>a.id.localeCompare(b.id))[0];
  return owner?owner.id===game.user.id:actor.isOwner;
}
export function linkedEffects(activity){
  return Array.from(activity?.effects??[]).map(entry=>({entry,effect:entry.effect??activity.item?.effects?.get(entry._id??entry.id)})).filter(({effect})=>effect&&!effect.transfer);
}
export function effectRules(activity){return activity?.item?.getFlag(MODULE_ID,'techniqueAutomation')?.effects??{};}
export function effectQualifies(rule,success,hasSave){
  if(rule?.when==='off')return false;
  const when=rule?.when??(hasSave?'failure':'always');
  return when==='always'||hasSave&&(when==='success'?success:!success);
}
export async function applyTechniqueEffects(activity,actor,source,{success=false,receipt=source.id}={}){
  if(!featureEnabled('techniqueEffects')||!actor?.isOwner||!source||source.isContentVisible===false)return [];
  const config=activity?.item?.getFlag(MODULE_ID,'techniqueAutomation');
  if(!config?.effectsEnabled)return [];
  const execution=areaExecution(source);if(execution&&(!['ready','complete'].includes(execution.status)||!execution.targets.includes(actor.uuid)))return [];
  return queueActor(actor,async()=>{
    const applied=[];
    for(const {entry,effect} of linkedEffects(activity)){
      const rule=effectRules(activity)[effect.id]??{when:entry.onSave?'always':activity.type==='save'?'failure':'always',beneficial:false};
      if(!effectQualifies(rule,success,activity.type==='save')||areaProtected(source,actor)&&!rule.beneficial)continue;
      const key=`${receipt}:${activity.id}:${effect.id}`;
      if((actor.getFlag(MODULE_ID,'techniqueEffectReceipts')??[]).includes(key))continue;
      if(Array.from(actor.effects??[]).some(e=>e.flags?.[MODULE_ID]?.techniqueReceipt===key))continue;
      const data=foundry.utils.deepClone(effect.toObject());delete data._id;delete data._stats;data.transfer=false;data.disabled=false;data.origin=activity.item.uuid;
      const areaRoot=source.getFlag(MODULE_ID,'areaParent')??source.id;
      data.flags??={};data.flags[MODULE_ID]={...data.flags[MODULE_ID],areaSource:source.id,areaRoot,linkedEffect:effect.uuid??effect.id,techniqueReceipt:key,removeOnExit:!!rule.removeOnExit};
      data.duration??={};data.duration.startTime=game.time.worldTime;
      if(game.combat){data.duration.startRound=game.combat.round;data.duration.startTurn=game.combat.turn;data.duration.combat=game.combat.id;}
      // DAE hooks receive ordinary native ActiveEffects, retaining their changes,
      // durations and effect macros. Creating directly makes protection/receipt atomic.
      const existing=Array.from(actor.effects??[]).find(e=>e.flags?.[MODULE_ID]?.areaRoot===areaRoot&&e.flags?.[MODULE_ID]?.linkedEffect===(effect.uuid??effect.id));
      const created=existing?.update?[await existing.update(data)]:await actor.createEmbeddedDocuments('ActiveEffect',[data],{oprpgAreaSource:source.id,oprpgBeneficial:!!rule.beneficial});
      if(!created?.length)continue;
      await actor.setFlag(MODULE_ID,'techniqueEffectReceipts',[...(actor.getFlag(MODULE_ID,'techniqueEffectReceipts')??[]),key].slice(-200));applied.push(effect.name);
    }
    if(applied.length)Hooks.callAll('oprpgFixes.postActiveEffects',{activity,actor,source,success,effects:applied});
    return applied;
  });
}
export async function resolveTechniqueSaveEffects(result){
  const info=result?.getFlag?.(MODULE_ID,'saveResult');if(!info||!Number.isFinite(info.total))return [];
  const source=game.messages.get(info.source),actor=await fromUuid(info.actor);
  if(!source||!actor||!responsibleExecutor(actor))return [];
  const root=document.createElement('div');root.innerHTML=source.content??'';
  const {activity}=getCardActivity(root.querySelector('.jujutsu-card[data-card-type="save"]'));
  if(!activity||!info.key?.startsWith(`${source.id}:${activity.id}:`))return [];
  // Respect the configured DC rather than trusting an imported success boolean.
  const dc=Number(activity.save?.dc?.value??activity.save?.dc?.target??info.dc);
  if(!Number.isFinite(dc))return [];
  return applyTechniqueEffects(activity,actor,source,{success:info.total>=dc,receipt:info.key});
}
export async function configureTechniqueAutomation(item){
  if(!item?.isOwner||item.type!=='spell')throw Error('Abra uma técnica que você controla.');
  const current=item.getFlag(MODULE_ID,'techniqueAutomation')??{};
  const effects=Array.from(item.effects??[]).filter(e=>!e.transfer);
  const result=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:'Automação da técnica'},position:{width:600},rejectClose:false,
    content:`<label><input name="effectsEnabled" type="checkbox" ${current.effectsEnabled?'checked':''}> Aplicar efeitos vinculados automaticamente</label>${effects.map(e=>{const rule=current.effects?.[e.id]??{};return `<fieldset><legend>${esc(e.name)}</legend><label>Aplicação <select name="when-${esc(e.id)}">${[['failure','Na falha da salvaguarda'],['success','No sucesso'],['always','Sempre'],['off','Não automatizar']].map(([v,l])=>`<option value="${v}" ${rule.when===v?'selected':''}>${l}</option>`).join('')}</select></label><label><input type="checkbox" name="beneficial-${esc(e.id)}" ${rule.beneficial?'checked':''}> Benéfico (pode afetar aliados protegidos)</label><label><input type="checkbox" name="exit-${esc(e.id)}" ${rule.removeOnExit?'checked':''}> Remover ao sair da área</label></fieldset>`}).join('')}<label><input type="checkbox" name="persistent" ${current.persistent?'checked':''}> Área persistente</label><label><input type="checkbox" name="enter" ${current.enter?'checked':''}> Testar ao entrar</label><label><input type="checkbox" name="start" ${current.start?'checked':''}> Testar no início do turno</label><label><input type="checkbox" name="end" ${current.end?'checked':''}> Testar no fim do turno</label><label>Duração da área em segundos (zero = até encerrar) <input name="seconds" type="number" min="0" value="${Number(current.seconds)||0}"></label><label><input name="walls" type="checkbox" ${current.walls?'checked':''}> Respeitar paredes que bloqueiam efeitos</label><label>Altura mínima <input type="number" name="bottom" value="${Number(current.bottom)||0}"></label><label>Altura máxima <input type="number" name="top" value="${Number(current.top)||0}"></label><p>Alturas iguais deixam a área sem filtro de altura. Ajuste estas regras à descrição da técnica. Os efeitos precisam estar vinculados à atividade.</p>`,
    buttons:[{action:'save',label:'Salvar',callback:(_e,_b,d)=>{
      const root=d.element,value=k=>root.querySelector(`[name="${k}"]`),data={...current};
      for(const k of ['effectsEnabled','persistent','enter','start','end','walls'])data[k]=value(k).checked;
      for(const k of ['seconds','bottom','top']){data[k]=Number(value(k).value);if(!Number.isFinite(data[k]))throw Error('Informe duração e alturas válidas.');}
      if(data.seconds<0||data.top<data.bottom)throw Error('Intervalo de altura ou duração inválido.');
      data.effects=Object.fromEntries(effects.map(e=>[e.id,{when:value('when-'+e.id).value,beneficial:value('beneficial-'+e.id).checked,removeOnExit:value('exit-'+e.id).checked}]));return data;
    }},{action:'cancel',label:'Cancelar',callback:()=>null}]});
  if(result)await item.setFlag(MODULE_ID,'techniqueAutomation',result);return result;
}
export function installTechniqueEffects(){
  if(installed)return;installed=true;
  Hooks.on('createChatMessage',result=>void resolveTechniqueSaveEffects(result).catch(e=>{STATE.warnings.push(`Efeitos da técnica: ${e.message}`);ui.notifications.error(e.message);}));
  Hooks.on('renderApplicationV2',app=>{
    const item=app.item??app.document,root=app.element instanceof HTMLElement?app.element:app.element?.[0];
    if(item?.documentName!=='Item'||item.type!=='spell'||!item.isOwner||!root||root.querySelector('.oprpg-technique-automation'))return;
    const header=root.querySelector('.window-header');if(!header)return;
    const button=document.createElement('button');button.type='button';button.className='header-control oprpg-technique-automation';button.title='Automação da técnica';button.setAttribute('aria-label',button.title);button.innerHTML='<i class="fas fa-gears" inert></i>';button.onclick=()=>void configureTechniqueAutomation(item).catch(e=>ui.notifications.error(e.message));header.append(button);
  });STATE.techniqueEffects=true;
}
