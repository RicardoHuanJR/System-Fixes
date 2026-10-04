import { MODULE_ID } from './shared.js';
import { queueActor, registerActorTimer } from './automation-runtime.js';
import { CHARACTER_RULES, characterRuleChanges, ruleDamage } from './catalogue-rules.js';

// Fixed rules from the books. Stored choices identify owned items, never formulas.
export const AUTOMATIONS = [
  {id:'diable-jambe',name:'Diable Jambe',source:'Estilos exclusivos 2.1, p. 3',aliases:['Diable Jambe'],level:3,seconds:60,style:'Black Leg',select:true,summary:'Resistência a fogo; dano de fogo nas técnicas e ataques desarmados selecionados.',manual:'A sequência de dois acertos e a ação bônus/reação adicional continuam sob confirmação da mesa.'},
  {id:'ifrit-jambe',name:'Ifrit Jambe',source:'Estilos exclusivos 2.1, p. 4',aliases:['Ifrit Jambe'],level:15,seconds:60,style:'Black Leg',summary:'Enquanto Diable estiver ativo, seu bônus nos ataques desarmados passa a 1d12 + 5 de fogo.',manual:'Vantagem, salvaguarda para Queimado e ignorar resistência precisam ser resolvidos pela mesa.'},
  {id:'hell-memories',name:'Hell Memories',source:'Estilos exclusivos 2.1, p. 4',aliases:['Hell Memories'],level:19,style:'Black Leg',summary:'Com Diable ativo, técnicas Black Leg selecionadas recebem o grau inteiro em dados de fogo.',manual:'Queimado, vulnerabilidade e ignorar invulnerabilidade precisam ser resolvidos pela mesa.'},
  {id:'escudo-maritimo',name:'Escudo Marítimo',source:'Livro do Jogador 2.1, p. 63',aliases:['Escudo Marítimo','Filho do Mar'],level:6,style:'Carateca',summary:'Resistência a dano contundente, cortante e perfurante.',manual:'Ative somente submerso ou após pagar a opção apropriada de Manipulação da Água.'},
  {id:'ultramarine',name:'Ultramarine',source:'Livro do Jogador 2.1, p. 63',aliases:['Ultramarine','Mizugokoro'],level:14,style:'Carateca',select:true,summary:'Mais dois dados nas técnicas de combate selecionadas cujo alcance não seja Toque.',manual:'Ative somente submerso ou após pagar a opção apropriada de Manipulação da Água.'},
  {id:'corpo-criatura',name:'Corpo de Criatura',source:'Livro do Jogador 2.1, p. 57',aliases:['Corpo de Criatura'],level:6,style:'Brutamontes',summary:'Mais 60 PV máximos, sem curar os PV atuais.',manual:'A reação para reduzir um dano a zero continua manual; não concedida automaticamente.'},
  {id:'chamas-lunarianas',name:'Manipulação do Fogo — resistência',source:'Livro do Jogador 2.1, p. 25',aliases:['Manipulação do Fogo','Lunariano','Lunarianos'],level:1,summary:'Resistência a fogo enquanto as chamas nas costas estiverem presentes.',manual:'A luz e a esfera de fogo não são alteradas por esta automação.'}
];
AUTOMATIONS.push(...CHARACTER_RULES);
AUTOMATIONS.find(p=>p.id==='diable-jambe').uses=true;
AUTOMATIONS.find(p=>p.id==='corpo-criatura').passive=true;
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=s=>foundry.utils.escapeHTML(String(s??''));
const settings=actor=>actor?.flags?.[MODULE_ID]?.catalogue??{};
const activations=new Map();
export function catalogueCandidates(actor,preset){return Array.from(actor?.items??[]).filter(i=>['feat','race'].includes(i.type)&&preset.aliases.some(n=>normalize(n)===normalize(i.name)));}
export function catalogueSource(actor,preset){
  const candidates=catalogueCandidates(actor,preset);
  const selected=settings(actor)[preset.id]?.sourceItemId;
  return selected?candidates.find(i=>i.id===selected):candidates.length===1?candidates[0]:null;
}
export function catalogueLevel(actor,preset,config=settings(actor)[preset.id]){
  const style=Array.from(actor?.items??[]).find(i=>i.type==='class'&&normalize(i.name)===normalize(preset.style));
  return Number(style?.system?.levels??config?.level??0);
}
export function catalogueEffect(actor,id){return Array.from(actor?.effects??[]).find(e=>e.flags?.[MODULE_ID]?.catalogue===id&&!e.disabled&&!e.isSuppressed&&!(e.duration?.seconds>0&&Number.isFinite(e.duration.startTime)&&game.time.worldTime>=e.duration.startTime+e.duration.seconds));}
export function catalogueReady(actor,preset){
  const c=settings(actor)[preset.id];if(preset.weaponSelect&&!c?.weaponIds?.length)return false;
  if(!c?.enabled||!catalogueSource(actor,preset)||preset.style&&catalogueLevel(actor,preset,c)<preset.level)return false;
  if(preset.select&&!c.techniqueIds?.length&&!(preset.id==='diable-jambe'&&c.weaponIds?.length)&&!(preset.formChoice&&c.form==='large'))return false;
  return true;
}
export function catalogueChanges(id,actor,config=settings(actor)[id]??{}){
  const resistance=type=>({key:'system.traits.dr.value',mode:CONST.ACTIVE_EFFECT_MODES.ADD,value:type});
  if(['diable-jambe','chamas-lunarianas'].includes(id))return [resistance('fire')];
  if(id==='escudo-maritimo')return ['bludgeoning','slashing','piercing'].map(resistance);
  if(id==='corpo-criatura')return [{key:Number.isFinite(actor?._source?.system?.attributes?.hp?.max)?'system.attributes.hp.max':'system.attributes.hp.bonuses.overall',mode:CONST.ACTIVE_EFFECT_MODES.ADD,value:'60'}];
  return actor?characterRuleChanges(id,actor,config,CONST.ACTIVE_EFFECT_MODES):[];
}
export async function configureCatalogue(actor,id,choice){
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  const p=AUTOMATIONS.find(p=>p.id===id),source=p&&(choice.sourceItemId?catalogueCandidates(actor,p).find(i=>i.id===choice.sourceItemId):catalogueSource(actor,p));if(!p||!source)throw Error('Escolha uma característica correspondente da ficha.');
  if(p.style&&(!Number.isInteger(Number(choice.level))||Number(choice.level)<p.level||Number(choice.level)>20))throw Error(`Informe o nível de ${p.style}, de ${p.level} a 20.`);
  const list=(ids,type)=>[...new Set(ids??[])].filter(id=>actor.items.get(id)?.type===type);
  const c={enabled:!!choice.enabled,level:Number(choice.level)||0,sourceItemId:source.id,weaponIds:list(choice.weaponIds,'weapon'),techniqueIds:list(choice.techniqueIds,'spell'),ability:choice.ability??'',form:choice.form??''};
  if(p.formChoice&&!['wide','large'].includes(c.form))throw Error('Escolha Corpo Largo ou Corpo Grande.');
  if(p.abilityChoice&&!Object.hasOwn(actor.system.abilities??{},c.ability))throw Error('Escolha uma salvaguarda válida.');
  catalogueChanges(id,actor,c);
  return queueActor(actor,async()=>{await actor.setFlag(MODULE_ID,'catalogue.'+id,c);const effects=Array.from(actor.effects??[]).filter(e=>e.flags?.[MODULE_ID]?.catalogue===id);if(effects.length)await actor.deleteEmbeddedDocuments('ActiveEffect',effects.map(e=>e.id));return c;});
}
export async function toggleCatalogue(actor,id,{desired,hybridConfirmed=false}={}){
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  if(!game.user.isGM)return requestCatalogueActivation(actor,id);
  const key=actor.uuid+':'+id;
  if(activations.has(key))return activations.get(key);
  const operation=queueActor(actor,async()=>{
    const p=AUTOMATIONS.find(p=>p.id===id);if(!p)throw Error('Automação desconhecida.');
    const active=catalogueEffect(actor,id),effects=Array.from(actor.effects??[]).filter(e=>e.flags?.[MODULE_ID]?.catalogue===id);
    if(typeof desired==='boolean'&&!!active===desired)return desired;
    if(active){if(id==='diable-jambe')for(const e of actor.effects)if(e.flags?.[MODULE_ID]?.catalogue==='ifrit-jambe')effects.push(e);await actor.deleteEmbeddedDocuments('ActiveEffect',effects.map(e=>e.id));return false;}
    if(!catalogueReady(actor,p))throw Error('Habilite a automação e confira os itens e o nível da característica.');
    if(id==='diable-jambe'&&game.modules?.get('oprpg-diable-jambe')?.active)throw Error('Desative o módulo Diable Jambe antigo para evitar duplicação.');
    if(id==='ifrit-jambe'&&!catalogueEffect(actor,'diable-jambe'))throw Error('Ative Diable Jambe primeiro.');
    const source=catalogueSource(actor,p),config=settings(actor)[id],changes=catalogueChanges(id,actor);
    let spent=null;
    if(p.uses){
      const uses=source.system?.uses,max=Number(uses?.max),current=Number(uses?.spent);
      if(!Number.isInteger(max)||max<1||!Number.isInteger(current)||current<0)throw Error('Configure os usos e a recuperação na característica original antes de ativar.');
      if(current>=max)throw Error('A característica não tem usos restantes.');
      spent=current;
    }
    if(p.formChoice&&!hybridConfirmed&&config.form==='large'){
      const answer=await foundry.applications.api.DialogV2.confirm({window:{title:p.name},content:'<p>Você está na forma híbrida Zoan? Corpo Grande concede 20 PV temporários; eles não se somam aos existentes.</p>'});
      if(!answer)return false;
    }else if(p.formChoice&&!hybridConfirmed){
      const answer=await foundry.applications.api.DialogV2.confirm({window:{title:p.name},content:'<p>Confirma que está na forma híbrida Zoan?</p>'});if(!answer)return false;
    }
    const now=game.time.worldTime;
    const effect={name:p.name,img:source.img??'icons/svg/upgrade.svg',origin:source.uuid,transfer:false,disabled:false,changes,duration:p.seconds?{seconds:p.seconds,startTime:now}:{},flags:{[MODULE_ID]:{catalogue:id,ruleVersion:1,sourceItemId:source.id}}};
    let created=[];
    try{
      if(spent!==null){
        spent=Number(source.system.uses.spent);
        if(!Number.isInteger(spent)||spent<0||spent>=Number(source.system.uses.max))throw Error('A característica não tem usos restantes.');
        await source.update({'system.uses.spent':spent+1});
      }
      created=await actor.createEmbeddedDocuments('ActiveEffect',[effect]);
      if(!created?.length)throw Error('O efeito não foi criado.');
      if(p.formChoice&&config.form==='large')await actor.update({'system.attributes.hp.temp':Math.max(Number(actor.system.attributes.hp.temp)||0,20)});
      if(effects.length)await actor.deleteEmbeddedDocuments('ActiveEffect',effects.map(e=>e.id));
      return true;
    }catch(error){
      if(created?.length)await actor.deleteEmbeddedDocuments('ActiveEffect',created.map(e=>e.id));
      if(spent!==null)await source.update({'system.uses.spent':spent});
      throw error;
    }
  });
  activations.set(key,operation);
  try{return await operation;}finally{if(activations.get(key)===operation)activations.delete(key);}
}

export async function requestCatalogueActivation(actor,id){
  const gm=game.users?.activeGM;
  if(!gm)throw Error('É necessário um mestre conectado para coordenar a ativação.');
  if(!AUTOMATIONS.some(p=>p.id===id))throw Error('Automação desconhecida.');
  const key=actor.uuid+':'+id;if(activations.has(key))return activations.get(key);
  const pending=(async()=>{
    const desired=!catalogueEffect(actor,id),p=AUTOMATIONS.find(p=>p.id===id),config=settings(actor)[id];
    let hybridConfirmed=false;
    if(desired&&p.formChoice){hybridConfirmed=await foundry.applications.api.DialogV2.confirm({window:{title:p.name},content:'<p>Confirma que está na forma híbrida Zoan?</p>'});if(!hybridConfirmed)return false;}
    const message=await ChatMessage.create({content:'<p>Processando automação da ficha…</p>',whisper:[game.user.id,gm.id],flags:{[MODULE_ID]:{catalogueRequest:{actorUuid:actor.uuid,id,desired,sourceItemId:config?.sourceItemId,form:config?.form,hybridConfirmed,state:'pending'}}}});
    const result=()=>message.getFlag(MODULE_ID,'catalogueRequest');
    if(result()?.state==='resolved')return result().active;
    if(result()?.state==='failed')throw Error(result().error);
    return new Promise((resolve,reject)=>{
      let timer;const hook=Hooks.on('updateChatMessage',updated=>{
        if(updated.id!==message.id)return;const request=updated.getFlag(MODULE_ID,'catalogueRequest');
        if(!['resolved','failed'].includes(request?.state))return;
        clearTimeout(timer);Hooks.off('updateChatMessage',hook);
        if(request.state==='failed')reject(Error(request.error));else resolve(request.active);
      });
      timer=setTimeout(()=>{Hooks.off('updateChatMessage',hook);reject(Error('A ativação continua pendente no chat. Confira o resultado antes de tentar novamente.'));},15000);
      // Catch completion between the first read and listener registration.
      const request=result();if(['resolved','failed'].includes(request?.state)){clearTimeout(timer);Hooks.off('updateChatMessage',hook);if(request.state==='failed')reject(Error(request.error));else resolve(request.active);}
    });
  })();
  activations.set(key,pending);try{return await pending;}finally{if(activations.get(key)===pending)activations.delete(key);}
}

export async function resolveCatalogueRequest(message){
  if(!game.user.isGM||game.users?.activeGM?.id!==game.user.id)return;
  const request=message.getFlag?.(MODULE_ID,'catalogueRequest');if(request?.state!=='pending')return;
  try{
    const actor=await fromUuid(request.actorUuid),author=message.author;
    if(actor?.documentName!=='Actor'||!author||!actor.testUserPermission(author,'OWNER')||typeof request.desired!=='boolean')throw Error('Solicitação de automação inválida.');
    const config=settings(actor)[request.id];
    if(config?.sourceItemId!==request.sourceItemId||config?.form!==request.form)throw Error('As opções mudaram após o pedido. Confira a ficha e tente novamente.');
    await message.update({[`flags.${MODULE_ID}.catalogueRequest.state`]:'processing'});
    const active=await toggleCatalogue(actor,request.id,{desired:request.desired,hybridConfirmed:request.hybridConfirmed===true});
    await message.update({[`flags.${MODULE_ID}.catalogueRequest`]:{...request,state:'resolved',active},content:`<p>${esc(AUTOMATIONS.find(p=>p.id===request.id)?.name)}: ${active?'ativado':'desativado'}.</p>`});
  }catch(error){await message.update({[`flags.${MODULE_ID}.catalogueRequest`]:{...request,state:'failed',error:String(error.message).slice(0,300)},content:`<p>Automação não aplicada: ${esc(error.message)}</p>`});}
}
export function catalogueDamage(activity,config){
  const actor=activity?.actor??activity?.item?.actor,item=activity?.item;if(!actor||!config?.rolls?.length||!['attack','save','damage'].includes(activity.type))return [];
  const selected=(id)=>{const p=AUTOMATIONS.find(p=>p.id===id);return catalogueReady(actor,p)&&catalogueEffect(actor,id);};
  const diable=settings(actor)['diable-jambe'],ultra=settings(actor).ultramarine;
  const part=Array.from(activity.damage?.parts??[])[0],faces=part?.custom?.enabled?Number(String(part.custom.formula).match(/\b\d*d(\d+)\b/i)?.[1]):Number(part?.denomination);
  const grade=Number(item.system?.level),out=[];
  const add=(id,formula,type)=>{if(config.rolls.some(r=>r.options?.oprpgCatalogue===id||id==='diable-jambe'&&r.options?.diableJambe))return;out.push({parts:[formula],data:activity.getRollData?.()??{},options:{type,types:type?[type]:[],oprpgCatalogue:id,flavor:AUTOMATIONS.find(p=>p.id===id).name}});};
  for(const p of CHARACTER_RULES){
    if(!selected(p.id))continue;
    const extra=ruleDamage(p.id,item,activity,settings(actor)[p.id],faces);
    if(extra){const type=extra.type??Array.from(part?.types??[])[0];add(p.id,extra.formula,type);}
  }
  if(selected('diable-jambe')&&!game.modules?.get('oprpg-diable-jambe')?.active){
    if(item.type==='weapon'&&diable.weaponIds?.includes(item.id)&&activity.type==='attack'&&activity.attack?.type?.value==='melee'){
      const level=catalogueLevel(actor,AUTOMATIONS[0]);add('diable-jambe',selected('ifrit-jambe')?'1d12 + 5':`1d${level>=11?8:level>=7?6:4}`,'fire');
    }else if(item.type==='spell'&&diable.techniqueIds?.includes(item.id)&&Number.isInteger(grade)&&grade>=1&&grade<=7&&Number.isInteger(faces)&&faces>=2){
      add('diable-jambe',`${selected('hell-memories')?grade:Math.max(1,Math.floor(grade/2))}d${faces}`,'fire');
    }
  }
  const reach=activity.range??item.system?.range;
  if(selected('ultramarine')&&item.type==='spell'&&ultra.techniqueIds?.includes(item.id)&&reach?.units&&reach.units!=='touch'&&Number.isInteger(grade)&&grade>=1&&grade<=7&&Number.isInteger(faces)&&faces>=2){
    const types=part.types,type=typeof types==='string'?types:Array.from(types??[])[0];add('ultramarine',`2d${faces}`,type??'');
  }
  return out;
}
export function catalogueContent(actor){return `<section class="oprpg-catalogue jujutsu-section op-trainings"><h2 class="divider">Automações</h2><p>Escolha uma característica da ficha e habilite sua automação. Diable Jambe, Overclock e Controle Corporal consomem um uso do item original; desativar não consome. Ações e PP continuam no fluxo da característica.</p>${AUTOMATIONS.filter(p=>Array.from(actor.items??[]).some(i=>['feat','race'].includes(i.type)&&p.aliases.some(n=>normalize(n)===normalize(i.name)))).map(p=>{const owned=!!catalogueCandidates(actor,p).length,c=settings(actor)[p.id],active=!!catalogueEffect(actor,p.id);return `<article class="op-train-card"><header class="op-train-head"><i class="fas fa-bolt" inert></i><strong class="op-train-name">${esc(p.name)}</strong><span class="op-train-counter">${active?'Ativo':c?.enabled?'Habilitado':'Desabilitado'}</span></header><div class="op-train-meta">${esc(p.source)}</div><p>${esc(p.summary)}</p>${p.uses&&catalogueSource(actor,p)?.system.uses?`<p>Usos: ${esc(catalogueSource(actor,p).system.uses.value??Math.max(0,Number(catalogueSource(actor,p).system.uses.max)-Number(catalogueSource(actor,p).system.uses.spent)))} / ${esc(catalogueSource(actor,p).system.uses.max)}</p>`:''}<p class="oprpg-catalogue-note">${esc(p.manual??'')}</p><div class="oprpg-catalogue-controls"><button type="button" data-catalogue-action="setup" data-id="${p.id}" ${owned?'':'disabled'}>Opções</button><button type="button" data-catalogue-action="toggle" data-id="${p.id}" ${active||catalogueReady(actor,p)?'':'disabled'}>${active?'Desativar efeito':'Ativar efeito'}</button>${!owned?'<span>Requer a característica na ficha.</span>':''}</div></article>`}).join('')}</section>`;}
export async function catalogueAction(actor,action,id){
  if(action==='toggle')return toggleCatalogue(actor,id);
  if(action!=='setup'||!actor?.isOwner)throw Error('Ação indisponível.');
  const p=AUTOMATIONS.find(p=>p.id===id);if(!p)throw Error('Automação desconhecida.');const c=settings(actor)[id]??{};
  const select=(name,type,label)=>`<label>${label}<select name="${name}" multiple size="4">${Array.from(actor.items??[]).filter(i=>i.type===type).map(i=>`<option value="${esc(i.id)}" ${c[name]?.includes(i.id)?'selected':''}>${esc(i.name)}</option>`).join('')}</select></label>`;
  const choice=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:p.name},content:`<label>Característica original<select name="sourceItemId">${catalogueCandidates(actor,p).map(i=>`<option value="${esc(i.id)}" ${c.sourceItemId===i.id?'selected':''}>${esc(i.name)} (${esc(i.id)})</option>`).join('')}</select></label><label><input type="checkbox" name="enabled" ${c.enabled?'checked':''}> Habilitar automação</label>${p.style?`<label>Nível de ${esc(p.style)}<input name="level" type="number" min="${p.level}" max="20" value="${catalogueLevel(actor,p)||p.level}"></label>`:''}${p.select?select('techniqueIds','spell',p.id==='diable-jambe'?'Técnicas Black Leg':'Técnicas de combate'):''}${p.id==='diable-jambe'||p.weaponSelect?select('weaponIds','weapon',p.id==='diable-jambe'?'Ataques desarmados (somente corpo a corpo)':'Ataques comuns'):''}${p.abilityChoice?`<label>Salvaguarda<select name="ability">${Object.keys(actor.system.abilities??{}).map(key=>`<option value="${esc(key)}" ${c.ability===key?'selected':''}>${esc(CONFIG.DND5E.abilities[key]?.label??key)}</option>`).join('')}</select></label>`:''}${p.formChoice?`<label>Forma<select name="form"><option value="wide" ${c.form==='wide'?'selected':''}>Corpo Largo</option><option value="large" ${c.form==='large'?'selected':''}>Corpo Grande</option></select></label>`:''}<p>${esc(p.manual??'')}</p><p>Salvar encerra o efeito atual. Ative-o novamente após ajustar estas opções.</p>`,buttons:[{action:'save',label:'Salvar',callback:(_e,_b,d)=>({sourceItemId:d.element.querySelector('[name=sourceItemId]')?.value,ability:d.element.querySelector('[name=ability]')?.value,form:d.element.querySelector('[name=form]')?.value,enabled:d.element.querySelector('[name=enabled]').checked,level:d.element.querySelector('[name=level]')?.value,techniqueIds:Array.from(d.element.querySelector('[name=techniqueIds]')?.selectedOptions??[],o=>o.value),weaponIds:Array.from(d.element.querySelector('[name=weaponIds]')?.selectedOptions??[],o=>o.value)})},{action:'cancel',label:'Cancelar',callback:()=>null}],rejectClose:false});
  if(choice)return configureCatalogue(actor,id,choice);return null;
}
export function renderCatalogueTab(app,root){
  const actor=app.actor??app.document;if(actor?.documentName!=='Actor'||!actor.isOwner)return false;
  const nav=root.querySelector('nav.tabs[data-group="primary"]'),personal=nav?.querySelector('[data-tab="biography"]'),body=root.querySelector('.tab-body');if(!personal||!body)return false;
  let button=nav.querySelector('[data-tab="oprpg-automations"]');if(!button){button=document.createElement('a');button.className='item control';button.dataset.tab='oprpg-automations';button.dataset.group='primary';button.setAttribute('aria-label','Automações');button.title='Automações';button.innerHTML='<i class="fas fa-wand-magic-sparkles" inert></i>';personal.after(button);}
  let tab=body.querySelector('[data-tab="oprpg-automations"]');if(!tab){tab=document.createElement('section');tab.className='tab oprpg-automations-tab';tab.dataset.tab='oprpg-automations';tab.dataset.group='primary';body.append(tab);}
  tab.innerHTML=catalogueContent(actor);
  const activate=()=>{for(const e of [...nav.querySelectorAll('[data-tab]'),...body.querySelectorAll('.tab[data-group="primary"]')])e.classList.toggle('active',e.dataset.tab==='oprpg-automations');if(app.tabGroups)app.tabGroups.primary='oprpg-automations';};
  button.onclick=event=>{event.preventDefault();event.stopPropagation();activate();};if(app.tabGroups?.primary==='oprpg-automations')activate();
  tab.onclick=async event=>{const b=event.target.closest?.('[data-catalogue-action]');if(!b||b.disabled)return;event.preventDefault();event.stopPropagation();b.disabled=true;try{await catalogueAction(actor,b.dataset.catalogueAction,b.dataset.id);if(tab.isConnected)tab.innerHTML=catalogueContent(actor);}catch(error){ui.notifications.error(error.message);}finally{b.disabled=false;}};
  return true;
}
let catalogueInstalled=false;
const catalogueAuthority=()=>game.user.isGM&&(!game.users?.activeGM||game.users.activeGM.id===game.user.id);
export async function refreshCatalogueActor(actor){
  if(!catalogueAuthority()||!actor?.effects)return;
  return queueActor(actor,async()=>{
    const effects=Array.from(actor.effects).filter(e=>e.flags?.[MODULE_ID]?.catalogue),remove=[],updates=[];
    for(const effect of effects){
      const id=effect.flags[MODULE_ID].catalogue,p=AUTOMATIONS.find(p=>p.id===id);
      if(!p)continue;
      if(!catalogueReady(actor,p)||(id==='musculo-aco'&&actor.statuses?.has('unconscious'))){remove.push(effect.id);continue;}
      if(p.passive){const changes=catalogueChanges(id,actor);if(JSON.stringify(changes)!==JSON.stringify(effect.changes))updates.push({_id:effect.id,changes});}
    }
    if(remove.length)await actor.deleteEmbeddedDocuments('ActiveEffect',remove);
    if(updates.length)await actor.updateEmbeddedDocuments('ActiveEffect',updates);
  });
}
export function installCatalogueTimers(){
  if(catalogueInstalled)return;catalogueInstalled=true;
  const report=error=>{console.error(MODULE_ID+' | Automações',error);};
  Hooks.on('createChatMessage',message=>resolveCatalogueRequest(message).catch(report));
  for(const message of game.messages??[])if(message.getFlag?.(MODULE_ID,'catalogueRequest')?.state==='pending')resolveCatalogueRequest(message).catch(report);
  Hooks.on('updateActor',(actor,changes)=>{
    const keys=Object.keys(changes??{});
    if(keys.some(k=>k==='system'||k==='flags'||k.startsWith('system.details')||k.startsWith('flags.'+MODULE_ID)))refreshCatalogueActor(actor).catch(report);
  });
  for(const event of ['updateItem','deleteItem','createItem'])Hooks.on(event,item=>refreshCatalogueActor(item.parent).catch(report));
  for(const event of ['createActiveEffect','updateActiveEffect','deleteActiveEffect'])Hooks.on(event,e=>{
    if(e.statuses?.has?.('unconscious'))refreshCatalogueActor(e.parent).catch(report);
  });
  registerActorTimer('catalogue-expiration',a=>Array.from(a.effects??[]).some(e=>e.flags?.[MODULE_ID]?.catalogue&&e.duration?.seconds>0),async actor=>{
    if(!catalogueAuthority())return;
    await queueActor(actor,async()=>{
      const expired=Array.from(actor.effects??[]).filter(e=>e.flags?.[MODULE_ID]?.catalogue&&e.duration?.seconds>0&&Number.isFinite(e.duration.startTime)&&game.time.worldTime>=e.duration.startTime+e.duration.seconds);
      if(expired.some(e=>e.flags[MODULE_ID].catalogue==='diable-jambe'))for(const e of actor.effects)if(e.flags?.[MODULE_ID]?.catalogue==='ifrit-jambe'&&!expired.some(x=>x.id===e.id))expired.push(e);
      if(expired.length)await actor.deleteEmbeddedDocuments('ActiveEffect',expired.map(e=>e.id));
    });
  });
}
