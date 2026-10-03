import { MODULE_ID } from './shared.js';
import { queueActor, registerActorTimer } from './automation-runtime.js';

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
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=s=>foundry.utils.escapeHTML(String(s??''));
const settings=actor=>actor?.flags?.[MODULE_ID]?.catalogue??{};
export function catalogueSource(actor,preset){return Array.from(actor?.items??[]).find(i=>['feat','race'].includes(i.type)&&preset.aliases.some(n=>normalize(n)===normalize(i.name)));}
export function catalogueLevel(actor,preset,config=settings(actor)[preset.id]){
  const style=Array.from(actor?.items??[]).find(i=>i.type==='class'&&normalize(i.name)===normalize(preset.style));
  return Number(style?.system?.levels??config?.level??0);
}
export function catalogueEffect(actor,id){return Array.from(actor?.effects??[]).find(e=>e.flags?.[MODULE_ID]?.catalogue===id&&!e.disabled&&!e.isSuppressed&&!(e.duration?.seconds>0&&Number.isFinite(e.duration.startTime)&&game.time.worldTime>=e.duration.startTime+e.duration.seconds));}
export function catalogueReady(actor,preset){
  const c=settings(actor)[preset.id];if(!c?.enabled||!catalogueSource(actor,preset)||preset.style&&catalogueLevel(actor,preset,c)<preset.level)return false;
  if(preset.select&&!c.techniqueIds?.length&&!(preset.id==='diable-jambe'&&c.weaponIds?.length))return false;
  return true;
}
export function catalogueChanges(id){
  const resistance=type=>({key:'system.traits.dr.value',mode:CONST.ACTIVE_EFFECT_MODES.ADD,value:type});
  if(['diable-jambe','chamas-lunarianas'].includes(id))return [resistance('fire')];
  if(id==='escudo-maritimo')return ['bludgeoning','slashing','piercing'].map(resistance);
  if(id==='corpo-criatura')return [{key:'system.attributes.hp.bonuses.overall',mode:CONST.ACTIVE_EFFECT_MODES.ADD,value:'60'}];
  return [];
}
export async function configureCatalogue(actor,id,choice){
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  const p=AUTOMATIONS.find(p=>p.id===id);if(!p||!catalogueSource(actor,p))throw Error('Adicione a característica correspondente à ficha primeiro.');
  if(p.style&&(!Number.isInteger(Number(choice.level))||Number(choice.level)<p.level||Number(choice.level)>20))throw Error(`Informe o nível de ${p.style}, de ${p.level} a 20.`);
  const list=(ids,type)=>[...new Set(ids??[])].filter(id=>actor.items.get(id)?.type===type);
  const c={enabled:!!choice.enabled,level:Number(choice.level)||0,weaponIds:list(choice.weaponIds,'weapon'),techniqueIds:list(choice.techniqueIds,'spell')};
  return queueActor(actor,async()=>{await actor.setFlag(MODULE_ID,'catalogue.'+id,c);const effects=Array.from(actor.effects??[]).filter(e=>e.flags?.[MODULE_ID]?.catalogue===id);if(effects.length)await actor.deleteEmbeddedDocuments('ActiveEffect',effects.map(e=>e.id));return c;});
}
export async function toggleCatalogue(actor,id){
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  return queueActor(actor,async()=>{
    const p=AUTOMATIONS.find(p=>p.id===id);if(!p)throw Error('Automação desconhecida.');
    const active=catalogueEffect(actor,id),effects=Array.from(actor.effects??[]).filter(e=>e.flags?.[MODULE_ID]?.catalogue===id);
    if(active){await actor.deleteEmbeddedDocuments('ActiveEffect',effects.map(e=>e.id));return false;}
    if(!catalogueReady(actor,p))throw Error('Habilite a automação e confira os itens e o nível da característica.');
    if(id==='diable-jambe'&&game.modules?.get('oprpg-diable-jambe')?.active)throw Error('Desative o módulo Diable Jambe antigo para evitar duplicação.');
    if(id==='ifrit-jambe'&&!catalogueEffect(actor,'diable-jambe'))throw Error('Ative Diable Jambe primeiro.');
    if(effects.length)await actor.deleteEmbeddedDocuments('ActiveEffect',effects.map(e=>e.id));
    await actor.createEmbeddedDocuments('ActiveEffect',[{name:p.name,img:'icons/svg/upgrade.svg',transfer:false,disabled:false,changes:catalogueChanges(id),duration:p.seconds?{seconds:p.seconds,startTime:game.time.worldTime}:{},flags:{[MODULE_ID]:{catalogue:id}}}]);return true;
  });
}
export function catalogueDamage(activity,config){
  const actor=activity?.actor??activity?.item?.actor,item=activity?.item;if(!actor||!config?.rolls?.length||!['attack','save','damage'].includes(activity.type))return [];
  const selected=(id)=>{const p=AUTOMATIONS.find(p=>p.id===id);return catalogueReady(actor,p)&&catalogueEffect(actor,id);};
  const diable=settings(actor)['diable-jambe'],ultra=settings(actor).ultramarine;
  const part=Array.from(activity.damage?.parts??[])[0],faces=part?.custom?.enabled?Number(String(part.custom.formula).match(/\b\d*d(\d+)\b/i)?.[1]):Number(part?.denomination);
  const grade=Number(item.system?.level),out=[];
  const add=(id,formula,type)=>{if(config.rolls.some(r=>r.options?.oprpgCatalogue===id||id==='diable-jambe'&&r.options?.diableJambe))return;out.push({parts:[formula],data:activity.getRollData?.()??{},options:{type,types:type?[type]:[],oprpgCatalogue:id,flavor:AUTOMATIONS.find(p=>p.id===id).name}});};
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
export function catalogueContent(actor){return `<section class="oprpg-catalogue jujutsu-section op-trainings"><h2 class="divider">Automações</h2><p>Escolha uma característica da ficha e habilite sua automação. Ativar um efeito não paga PP nem consome ações ou usos: registre esses custos na característica original.</p>${AUTOMATIONS.map(p=>{const owned=!!catalogueSource(actor,p),c=settings(actor)[p.id],active=!!catalogueEffect(actor,p.id);return `<article class="op-train-card"><header class="op-train-head"><i class="fas fa-bolt" inert></i><strong class="op-train-name">${esc(p.name)}</strong><span class="op-train-counter">${active?'Ativo':c?.enabled?'Habilitado':'Desabilitado'}</span></header><div class="op-train-meta">${esc(p.source)}</div><p>${esc(p.summary)}</p><p class="oprpg-catalogue-note">${esc(p.manual)}</p><div class="oprpg-catalogue-controls"><button type="button" data-catalogue-action="setup" data-id="${p.id}" ${owned?'':'disabled'}>Opções</button><button type="button" data-catalogue-action="toggle" data-id="${p.id}" ${active||catalogueReady(actor,p)?'':'disabled'}>${active?'Desativar efeito':'Ativar efeito'}</button>${!owned?'<span>Requer a característica na ficha.</span>':''}</div></article>`}).join('')}</section>`;}
export async function catalogueAction(actor,action,id){
  if(action==='toggle')return toggleCatalogue(actor,id);
  if(action!=='setup'||!actor?.isOwner)throw Error('Ação indisponível.');
  const p=AUTOMATIONS.find(p=>p.id===id);if(!p)throw Error('Automação desconhecida.');const c=settings(actor)[id]??{};
  const select=(name,type,label)=>`<label>${label}<select name="${name}" multiple size="4">${Array.from(actor.items??[]).filter(i=>i.type===type).map(i=>`<option value="${esc(i.id)}" ${c[name]?.includes(i.id)?'selected':''}>${esc(i.name)}</option>`).join('')}</select></label>`;
  const choice=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:p.name},content:`<label><input type="checkbox" name="enabled" ${c.enabled?'checked':''}> Habilitar automação</label>${p.style?`<label>Nível de ${esc(p.style)}<input name="level" type="number" min="${p.level}" max="20" value="${catalogueLevel(actor,p)||p.level}"></label>`:''}${p.select?select('techniqueIds','spell',p.id==='diable-jambe'?'Técnicas Black Leg':'Técnicas de combate'):''}${p.id==='diable-jambe'?select('weaponIds','weapon','Ataques desarmados (somente corpo a corpo)'):''}<p>${esc(p.manual)}</p><p>Salvar encerra o efeito atual. Ative-o novamente após ajustar estas opções.</p>`,buttons:[{action:'save',label:'Salvar',callback:(_e,_b,d)=>({enabled:d.element.querySelector('[name=enabled]').checked,level:d.element.querySelector('[name=level]')?.value,techniqueIds:Array.from(d.element.querySelector('[name=techniqueIds]')?.selectedOptions??[],o=>o.value),weaponIds:Array.from(d.element.querySelector('[name=weaponIds]')?.selectedOptions??[],o=>o.value)})},{action:'cancel',label:'Cancelar',callback:()=>null}],rejectClose:false});
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
export function installCatalogueTimers(){registerActorTimer('catalogue-expiration',a=>Array.from(a.effects??[]).some(e=>e.flags?.[MODULE_ID]?.catalogue&&e.duration?.seconds>0),async actor=>{if(!game.user.isGM||game.users?.activeGM&&game.users.activeGM.id!==game.user.id)return;const expired=Array.from(actor.effects??[]).filter(e=>e.flags?.[MODULE_ID]?.catalogue&&e.duration?.seconds>0&&Number.isFinite(e.duration.startTime)&&game.time.worldTime>=e.duration.startTime+e.duration.seconds);if(expired.length)await actor.deleteEmbeddedDocuments('ActiveEffect',expired.map(e=>e.id));});}
