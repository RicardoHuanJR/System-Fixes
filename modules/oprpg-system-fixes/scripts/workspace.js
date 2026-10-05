import { moduleCompatibility, compatibilityHTML } from './module-compatibility.js';
import { openEffectsWindow } from './effect-automations.js';
import { readHakiFlag } from './haki-unified-rules.js';
import { MODULE_ID, STATE } from './shared.js';
import { FEATURES, featureEnabled } from './feature-settings.js';
import { historyUpdate, undoTraining, undoResources, downloadBackup, withActorOperation, installResourceHistory } from './operation-history.js';
import { automationStatus } from './automation-runtime.js';
import { pendingConcentration, resolvePendingConcentration } from './haki-unified-fix.js';
import { hakiCheckMessages, rerollPerito } from './haki-perito-fix.js';
import { rollPrivacyStatus } from './roll-privacy.js';
import { previewShieldDamage } from './shield-points-fix.js';
import { checkFruitCreation } from './fruit-sheet-fix.js';
import { externalCompatibilityStatus, openDAEEffects } from './external-compatibility.js';
import { openCharacteristics } from './characteristic-automations.js';
import { endPersistentArea } from './persistent-areas.js';
import { configurePeriodic } from './periodic-effects.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S='oprpg-system';
const seconds={second:1,minute:60,hour:3600,day:86400,week:604800,month:2592000,year:31536000};
const labels={round:'rodadas',turn:'turnos',second:'segundos',minute:'minutos',hour:'horas',day:'dias'};
let installed=false;
export function durationLabel(clock,combat=null,now=Number(game.time?.worldTime??0)) {
  if(!clock)return 'Relógio ainda não registrado';
  if(['perm','disp','dstr'].includes(clock.units))return 'Permanente — sem expiração automática';
  if(!clock.value)return 'Duração especial';
  if(['round','turn'].includes(clock.units)&&combat&&combat.id===clock.combatId){
    const elapsed=(Number(combat.round)-clock.round)*clock.turnCount+Number(combat.turn)-clock.turn;
    const remaining=Math.max(0,clock.value*(clock.units==='round'?clock.turnCount:1)-elapsed);
    return `${clock.units==='round'?Math.ceil(remaining/clock.turnCount):remaining} ${labels[clock.units]} restantes`;
  }
  const scale=seconds[clock.units]??(['round','turn'].includes(clock.units)?Number(CONFIG.time?.roundTime)||6:0);
  return scale?`${Math.max(0,Math.ceil(clock.value*scale-(now-clock.startTime)))} segundos restantes`:`${clock.value} ${clock.units}`;
}
export async function changeSustained(actor,id,action) {
  return withActorOperation(actor,async()=>{
    const info=actor.getFlag(S,'upkeep')?.[id];if(!info)throw Error('Essa manutenção já foi encerrada.');
    const clock=info.oprpgFixesDuration;
    const updates={};
    if(action==='end')updates[`flags.${S}.upkeep.-=${id}`]=null;
    else if(action==='extend'){
      if(!clock?.value||['perm','disp','dstr','spec','inst'].includes(clock.units))throw Error('Somente durações finitas podem ser prolongadas.');
      updates[`flags.${S}.upkeep.${id}.oprpgFixesDuration.value`]=Number(clock.value)+1;
    }else throw Error('Ação inválida.');
    Object.assign(updates,historyUpdate(actor,{kind:'sustained',label:action==='end'?'Manutenção encerrada':'Duração prolongada',activityId:id}));
    await actor.update(updates);return true;
  });
}
export function healingPreview(actor,amount,{temporary=false}={}) {
  amount=Number(amount);if(!Number.isFinite(amount)||amount<0)throw Error('Informe um valor válido.');
  const hp=actor.system.attributes.hp,before=Number(temporary?hp.temp:hp.value)||0;
  const after=temporary?Math.max(before,amount):Math.max(before,Math.min(Number(hp.effectiveMax??hp.max),before+amount));
  return {before,after,gained:after-before,unused:Math.max(0,amount-(after-before))};
}
export async function duplicateTechnique(actor,id) {
  return withActorOperation(actor,async()=>{
    const item=actor.items.get(id);if(!item)throw Error('Técnica não encontrada.');
    const manifestation=!!item.getFlag(S,'akumaManif'),grade=item.getFlag(S,'akumaTec');
    if(!manifestation&&!grade)throw Error('Selecione uma técnica da fruta.');
    checkFruitCreation(actor,grade??'aux',manifestation);
    const data=item.toObject();delete data._id;delete data._stats;data.name=`${item.name} (cópia)`;
    // OPRPG upkeep uses activity IDs as Actor-wide keys, so a duplicate must get
    // new IDs even though Foundry itself scopes activities to their Item.
    const old=data.system?.activities??{},mapping=new Map(Object.keys(old).map(key=>[key,foundry.utils.randomID()]));
    const remap=value=>{
      if(typeof value==='string')return mapping.get(value)??value;
      if(Array.isArray(value))return value.map(remap);
      if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[mapping.get(k)??k,remap(v)]));
      return value;
    };
    data.system.activities=remap(old);
    const [copy]=await actor.createEmbeddedDocuments('Item',[data]);copy?.sheet?.render(true);return copy;
  });
}
export async function openPreview(actor) {
  if(!actor?.isOwner)throw Error('Selecione uma ficha que você possa controlar.');
  const choice=await foundry.applications.api.DialogV2.prompt({classes:['oprpg-fixes-dialog'],window:{title:'Prévia de dano ou cura'},content:'<p>Simulação das camadas de dano. Informe o dano já ajustado pelas resistências e vulnerabilidades do alvo; sem cobrança ou aplicação.</p><label>Valor <input name="amount" type="number" min="0" value="10"></label><label>Operação <select name="kind"><option value="damage">Dano comum</option><option value="force">Dano irredutível</option><option value="heal">Cura</option><option value="temp">PV temporários</option></select></label>',ok:{label:'Calcular',callback:(_,b)=>({amount:Number(b.form.elements.namedItem('amount').value),kind:b.form.elements.namedItem('kind').value})},rejectClose:false});
  if(!choice)return false;
  if(!Number.isFinite(choice.amount)||choice.amount<0)throw Error('Valor inválido.');
  let content;
  if(['heal','temp'].includes(choice.kind)){
    const r=healingPreview(actor,choice.amount,{temporary:choice.kind==='temp'});
    content=`<p>${choice.kind==='temp'?'PV temporários':'PV'}: ${r.before} → ${r.after}. Ganho: ${r.gained}; excedente: ${r.unused}.</p>`;
  }else{
    const r=previewShieldDamage(actor,choice.amount,{damageTypes:choice.kind==='force'?['force']:[]});
    content=`<table><tr><th>Camada</th><th>Antes</th><th>Depois</th></tr>${[['Armadura',r.armorBefore,r.armorAfter],['Escudo',r.shieldBefore,r.shieldAfter],['PV temporários',r.tempBefore,r.tempAfter],['PV',r.hpBefore,r.hpAfter]].map(row=>'<tr>'+row.map(v=>`<td>${esc(v)}</td>`).join('')+'</tr>').join('')}</table><p>Redução absorvida: ${r.reductionAbsorbed}. O resultado real pode incluir efeitos condicionais de Haki, fruta e outros módulos.</p>`;
  }
  return foundry.applications.api.DialogV2.prompt({classes:['oprpg-fixes-dialog'],window:{title:`Prévia — ${actor.name}`},content,ok:{label:'Fechar'},rejectClose:false});
}
export async function openWorkspace(actor=null) {
  actor??=canvas.tokens?.controlled?.[0]?.actor??game.user.character;
  if(!actor?.isOwner){
    const available=Array.from(game.actors??[]).filter(a=>a.isOwner);
    if(!available.length)throw Error('Nenhuma ficha disponível.');
    const id=await foundry.applications.api.DialogV2.prompt({classes:['oprpg-fixes-dialog'],window:{title:'Painel Fixes — escolher ficha'},content:`<label>Ficha <select name="actor">${available.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></label>`,ok:{label:'Abrir',callback:(_,b)=>b.form.elements.namedItem('actor').value},rejectClose:false});
    if(!id)return;actor=game.actors.get(id);
  }
  if(!actor?.isOwner)return;
  const entries=Object.entries(actor.getFlag(S,'upkeep')??{}),history=actor.getFlag(MODULE_ID,'history')??[];
  const techniques=actor.items.filter(i=>i.getFlag(S,'akumaTec')||i.getFlag(S,'akumaManif'));
  const recharge=actor.getFlag(MODULE_ID,'shieldRecharge'),privacy=rollPrivacyStatus();
  const pending=pendingConcentration(actor),runtime=automationStatus(),checks=hakiCheckMessages(actor);
  const content=`<h3>Efeitos e manutenção</h3>${entries.length?entries.map(([id,info])=>{
    const activity=actor.items.get(info.itemId)?.system.activities?.get(id),cost=activity?.getConstantUpkeep?.();
    return `<p><strong>${esc(activity?.item?.name??'Técnica')} — ${esc(activity?.name??id)}</strong><br>${esc(durationLabel(info.oprpgFixesDuration,game.combats?.get(info.oprpgFixesDuration?.combatId)))}; manutenção: ${Number(cost?.value)||0} PP por turno. Próxima cobrança/cura: início do próximo turno do personagem.</p>`;
  }).join(''):'<p>Sem manutenções ativas.</p>'}<label>Manutenção <select name="upkeep">${entries.map(([id,info])=>`<option value="${esc(id)}">${esc(actor.items.get(info.itemId)?.name??id)}</option>`).join('')}</select></label>
  <p>Efeitos da ficha: ${actor.effects.map(e=>`${esc(e.name)} (${esc(e.duration?.label||'sem duração cronometrada')})`).join('; ')||'nenhum'}.</p>
  <p>Recarga do escudo: ${recharge?`${Math.max(0,Math.ceil(600-(Number(game.time.worldTime)-Number(recharge.start))))} segundos no relógio do mundo; requer estar fora de combate e Endurecimento ativo.`:'sem contagem ativa'}.</p>
  <h3>Áreas persistentes</h3><label>Área <select name="area">${Object.values(actor.getFlag(MODULE_ID,'persistentAreas')??{}).map(a=>`<option value="${esc(a.id)}">${esc(game.messages.get(a.id)?.speaker?.alias??a.id)} — ${a.members?.length??0} alvo(s)</option>`).join('')}</select></label>
  <label>Efeito periódico <select name="periodic">${Array.from(actor.effects??[]).map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select></label>
  <h3>Técnicas da fruta</h3><label>Duplicar <select name="technique">${techniques.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</select></label>
  <h3>Concentração pendente</h3><label>Teste <select name="concentration">${pending.map(m=>`<option value="${esc(m.id)}">CD ${esc(readHakiFlag(m,'check')?.dc)}</option>`).join('')}</select></label><p>${pending.length} teste(s) pendente(s). Cada dano mantém sua própria CD.</p>
  <h3>Perito — Haki</h3><label>Teste que falhou <select name="hakiCheck">${checks.map(m=>`<option value="${esc(m.id)}">${esc(m.rolls?.[0]?.total??'?')} — ${esc(m.flavor??m.id)}</option>`).join('')}</select></label><p>Uma repetição por dia do mundo; o segundo resultado é obrigatório. A falha será confirmada antes de rolar.</p>
  <h3>Histórico recente</h3><ol>${history.slice(-15).reverse().map(e=>`<li>${esc(new Date(e.at).toLocaleString())} — ${esc(e.label)}${e.kind==='training'?` — ${Number(e.paid)||0} PT; ${esc(e.origin)} ${esc(e.note)}`:''}</li>`).join('')}</ol><p>A reversão de recursos exige os valores registrados e restaura apenas recursos; não reativa efeitos ou concentração encerrados. Não é possível desfazer novamente o mesmo registro.</p><p>Automação: ${runtime.passes} verificações do relógio, ${runtime.visited} fichas visitadas; ${runtime.queues} operação(ões) na fila. Índices ativos: ${esc(JSON.stringify(runtime.timers))}.</p>
  <details><summary>Diagnóstico e correções</summary>${compatibilityHTML(moduleCompatibility())}<p>Privacidade: ${privacy.installed?'instalada':'inativa'}; dados 3D: ${privacy.dice?'protegidos':'não detectados'}; exibições protegidas nesta sessão: ${privacy.protected}.</p><p>${Object.entries(FEATURES).map(([key,label])=>`${esc(label)}: ${featureEnabled(key)?'habilitado':'desabilitado'}`).join('<br>')}</p><p>${(STATE.warnings??[]).map(esc).join('<br>')||'Sem avisos registrados.'}</p><p>Os grupos podem ser ligados ou desligados em Configurações de Jogo → OPRPG System Fixes.</p></details>`;
  const field=(b,n)=>b.form.elements.namedItem(n)?.value;
  const choice=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog','oprpg-fixes-workspace'],window:{title:`Painel Fixes — ${actor.name}`},position:{width:650},content,buttons:[
    ...(featureEnabled('characteristics')?[{action:'characteristics',label:'Efeitos OPRPG',callback:()=>({action:'characteristics'})}]:[]),
    ...(featureEnabled('persistentAreas')?[{action:'areaEnd',label:'Encerrar área',callback:(_,b)=>({action:'areaEnd',id:field(b,'area')})}]:[]),
    ...(featureEnabled('periodicEffects')?[{action:'periodic',label:'Configurar periódico',callback:(_,b)=>({action:'periodic',id:field(b,'periodic')})}]:[]),
    ...(externalCompatibilityStatus().enabled&&externalCompatibilityStatus().dae.apiReady
      ?[{action:'dae',label:'Editar efeitos (DAE)',callback:()=>({action:'dae'})}]:[]),
    {action:'preview',label:'Prévia de dano/cura',callback:()=>({action:'preview'})},
    {action:'extend',label:'Prolongar +1 unidade',callback:(_,b)=>({action:'extend',id:field(b,'upkeep')})},
    {action:'end',label:'Encerrar manutenção',callback:(_,b)=>({action:'end',id:field(b,'upkeep')})},
    {action:'duplicate',label:'Duplicar técnica',callback:(_,b)=>({action:'duplicate',id:field(b,'technique')})},
    {action:'undo',label:'Desfazer último treino',callback:()=>({action:'undo'})},
    {action:'resources',label:'Desfazer últimos recursos',callback:()=>({action:'resources'})},
    {action:'concentration',label:'Rolar concentração',callback:(_,b)=>({action:'concentration',id:field(b,'concentration')})},
    {action:'perito',label:'Perito: repetir Haki',callback:(_,b)=>({action:'perito',id:field(b,'hakiCheck')})},
    ...(game.user.isGM?[{action:'backup',label:'Backup desta ficha',callback:()=>({action:'backup'})}]:[]),
    {action:'close',label:'Fechar',callback:()=>null}],rejectClose:false});
  if(!choice||typeof choice!=='object'||!actor.isOwner)return;
  if(choice.action==='characteristics')return openEffectsWindow(actor);
  if(choice.action==='areaEnd')return endPersistentArea(actor,choice.id);
  if(choice.action==='periodic')return configurePeriodic(actor.effects.get(choice.id));
  if(choice.action==='preview')return openPreview(actor);
  if(choice.action==='backup')return downloadBackup([actor],'ficha');
  if(choice.action==='duplicate')return duplicateTechnique(actor,choice.id);
  if(choice.action==='concentration')return resolvePendingConcentration(actor,game.messages.get(choice.id));
  if(choice.action==='perito')return rerollPerito(actor,game.messages.get(choice.id));
  if(choice.action==='dae')return openDAEEffects(actor);
  if(!await foundry.applications.api.DialogV2.confirm({classes:['oprpg-fixes-dialog'],window:{title:'Confirmar alteração'},content:`<p>${choice.action==='resources'?'Restaurar os últimos recursos registrados (efeitos encerrados permanecem encerrados)':choice.action==='undo'?'Desfazer o último treino registrado':choice.action==='end'?'Encerrar a manutenção selecionada':'Adicionar uma unidade à duração selecionada'} em ${esc(actor.name)}?</p>`,rejectClose:false}))return false;
  if(choice.action==='undo')return undoTraining(actor);
  if(choice.action==='resources')return undoResources(actor);
  return changeSustained(actor,choice.id,choice.action);
}
export function installWorkspace() {
  if(installed)return true;installed=true;
  game.oprpgFixes??={};game.oprpgFixes.openWorkspace=openWorkspace;
  installResourceHistory();
  const run=actor=>openWorkspace(actor).catch(e=>ui.notifications.warn(e.message));
  Hooks.on('renderSettings',(_app,html)=>{
    const root=html?.[0]??html;if(!root?.querySelector||root.querySelector('[data-fixes-panel]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.fixesPanel='1';button.textContent='Painel System Fixes';button.onclick=()=>run();root.append(button);
  });
  Hooks.on('renderApplicationV2',(app,html)=>{
    if(app.document?.documentName!=='Actor'||!app.actor?.isOwner)return;
    const root=html?.[0]??html??app.element,header=root?.querySelector?.('.window-header');
    if(!header||header.querySelector('[data-fixes-panel]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.fixesPanel='1';button.className='header-control';button.title='Painel System Fixes';button.setAttribute('aria-label','Painel System Fixes');button.innerHTML='<i class="fa-solid fa-toolbox"></i>';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void run(app.actor);});header.append(button);
  });
  STATE.workspacePatch=true;return true;
}
