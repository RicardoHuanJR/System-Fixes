import { withActorOperation, actorOperationBusy } from './operation-history.js';
import { MODULE_ID, STATE, canAct } from "./shared.js";
import { connectLiveSheets, registeredCharacterSheets } from "./live-sheet-bridge.js";
import { registerActorTimer, queueActor, changeTouches } from './automation-runtime.js';

const S='oprpg-system', image='systems/oprpg-system/assets/akuma/Akuma-Color.webp';
const installed=new WeakSet(), syncing=new WeakSet();
const creationBound=new WeakSet();
let hooksInstalled=false;
const fruit=a=>a.getFlag(S,'akuma') ?? {};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function exclusive(actor,fn){if(!actor?.isOwner||actorOperationBusy(actor))return false;return withActorOperation(actor,fn)}
const kinds={utility:'Utilidade',attack:'Ataque',save:'Salvaguarda',heal:'Cura'};

export function buildFruitTechnique({grade='aux',manifestation=false,name,kind='utility',formula='0',cost=0,durationUnits='inst',durationValue=null,range=0,targetCount=1,damageType='bludgeoning',activation='',virtualCost=0,virtualReduction=0,uses=0,exception='',awakened=false}={}){
  grade=String(grade);
  if(!['aux','1','2','3','4','5','6','7'].includes(grade)||!kinds[kind])throw Error('Grau ou atividade inválida.');
  cost=Number(cost);range=Number(range);
  if(!Number.isFinite(cost)||cost<0||!Number.isFinite(range)||range<0)throw Error('Custo e alcance devem ser números positivos ou zero.');
  if(!['inst','round','turn','second','minute','hour','day','perm'].includes(durationUnits))throw Error('Duração inválida.');
  if(!['inst','perm'].includes(durationUnits)&&(!Number.isFinite(Number(durationValue))||Number(durationValue)<=0))throw Error('Informe a duração maior que zero.');
  formula=String(formula||'0').trim();
  if(typeof Roll.validate==='function'&&!Roll.validate(formula))throw Error('Fórmula inválida.');
  targetCount=Number(targetCount);
  if(!Number.isInteger(targetCount)||targetCount<1)throw Error('Quantidade de alvos inválida.');
  if(!['acid','bludgeoning','slashing','piercing','fire','cold','lightning','poison','force','psychic','thunder','radiant'].includes(damageType))throw Error('Tipo de dano inválido.');
  activation ||= manifestation?'bonus':grade==='aux'?'bonus':'powerful';
  if(!['action','powerful','bonus','reaction','none','special'].includes(activation))throw Error('Ativação inválida.');
  exception=String(exception||'').trim();
  if(exception&&!game.user.isGM)throw Error('Somente o mestre pode registrar uma exceção às regras.');
  const violations=[];
  if(manifestation){
    if(kind==='attack'||(kind==='save'&&formula!=='0'))violations.push('MP comum não pode causar dano diretamente.');
    if(cost!==0)violations.push('MP não consome PP; use o orçamento virtual.');
    const budget={none:3,special:5,bonus:8,reaction:8,powerful:9}[activation];
    if(budget===undefined)violations.push('Escolha Passiva, Inação, Bônus, Reação ou Poderosa para a MP.');
    virtualCost=Number(virtualCost);virtualReduction=Number(virtualReduction);uses=Number(uses);
    if(![virtualCost,virtualReduction,uses].every(v=>Number.isFinite(v)&&v>=0)||!Number.isInteger(uses))throw Error('Pontos virtuais e usos inválidos.');
    if(virtualCost>12||virtualCost>budget+virtualReduction)violations.push('Efeitos da MP excedem o orçamento virtual ou o teto bruto de 12.');
    if(kind==='heal'&&uses<1)violations.push('MP de cura exige um limite de usos.');
  }else{
    if(grade==='aux'&&(kind==='attack'||(kind==='save'&&formula!=='0')))violations.push('Auxiliar não pode causar dano diretamente.');
    if(grade==='1'&&kind==='heal')violations.push('Cura não está disponível no 1º grau.');
    if(cost>(grade==='aux'?(awakened?15:10):2*Number(grade)))violations.push('Custo excede o limite do grau.');
    if(grade==='aux'&&!['bonus','reaction'].includes(activation))violations.push('Auxiliar exige Ação Bônus ou Reação.');
  }
  if(violations.length&&!exception)throw Error(violations.join(' '));
  const draft=(!manifestation&&cost===0)||(kind==='save')||(manifestation&&virtualCost===0);
  const id=foundry.utils.randomID();
  const activity={_id:id,type:kind,name:kinds[kind],activation:{type:activation,value:['none','special'].includes(activation)?null:1},target:{override:true,affects:{count:range?String(targetCount):'',type:range?'creature':'self'}},duration:{units:durationUnits,value:['inst','perm'].includes(durationUnits)?null:Number(durationValue),override:true},range:{value:range,units:range?'m':'self',override:true},consumption:{spellSlot:false,targets:!manifestation&&cost?[{type:'attribute',target:'energy.total',value:String(cost),scaling:{mode:'',formula:''}}]:[]}};
  if(activation==='none'){activity.activation.type='special';activity.name+=' (Passiva)';}
  if(manifestation&&uses>0){activity.uses={max:String(uses),spent:0,recovery:[]};activity.consumption.targets.push({type:'activityUses',target:'',value:'1',scaling:{mode:'',formula:''}});}
  // Use the system's native fields so its editor and rollers share the same data.
  const part={number:0,denomination:6,bonus:'',types:[kind==='heal'?'healing':damageType],custom:{enabled:true,formula}};
  if(kind==='heal')activity.healing=part;
  if(kind==='attack'||kind==='save')activity.damage={parts:[part]};
  return {name:String(name|| (manifestation?'Nova Manifestação de Poder':`Nova Técnica (${grade==='aux'?'Auxiliar':grade+'º Grau'})`)).trim(),type:'spell',img:image,
    system:{level:manifestation||grade==='aux'?0:Number(grade),description:{value:`<p>${draft?'Rascunho: confira custo, efeitos, alvo, CD e recuperação de usos no editor.':'Confira os efeitos e requisitos no editor antes de usar.'}</p>${exception?`<p>Exceção autorizada pelo mestre: ${escape(exception)}</p>`:''}`},activities:{[id]:activity}},
    flags:{[S]:manifestation?{akumaManif:true}:{akumaTec:grade},[MODULE_ID]:{fruitRules:{draft,exception,violations,virtualCost,virtualReduction,uses,activation}}}};
}

export function checkFruitCreation(actor,grade,manifestation=false){
  const f=fruit(actor);
  if(!['logia','paramecia','zoan'].includes(f.tipo))throw Error('Selecione o tipo da fruta primeiro.');
  if(manifestation){
    const mythical=f.tipo==='zoan'&&f.zoanSub==='mitica';
    if(f.tipo==='zoan'&&!mythical)throw Error('Somente Zoan Mítica possui Manifestações de Poder.');
    const max=mythical?(f.despertar?2:1):(f.despertar?3:2);
    if(actor.items.filter(i=>i.getFlag(S,'akumaManif')).length>=max)throw Error(`Limite de ${max} Manifestações de Poder atingido.`);
  }else{
    if(!['aux','1','2','3','4','5','6','7'].includes(String(grade)))throw Error('Grau inválido.');
    if(String(grade)==='aux'&&actor.items.filter(i=>String(i.getFlag(S,'akumaTec'))==='aux').length>=5)throw Error('Máximo de 5 Técnicas Auxiliares.');
  }
}

export async function createFruitTechnique(sheet,grade='aux',manifestation=false,choice=null){
  return exclusive(sheet.actor,async()=>{
    checkFruitCreation(sheet.actor,grade,manifestation);
    choice ??= await foundry.applications.api.DialogV2.prompt({classes:['oprpg-fixes-dialog','oprpg-fixes-form'],position:{width:520},window:{title:manifestation?'Criar manifestação':'Criar técnica da fruta'},
      content:'<p>Escolha a atividade inicial. Confira a fórmula, custo e duração. Os demais detalhes continuam disponíveis no editor.</p><label>Nome <input type="text" name="techniqueName"></label><label>Atividade <select name="techniqueKind"><option value="utility">Utilidade</option><option value="attack">Ataque</option><option value="save">Salvaguarda</option><option value="heal">Cura</option></select></label><label>Fórmula de dano/cura <input name="formula" value="0"></label><label>Tipo de dano <select name="damageType"><option value="bludgeoning">Contundente</option><option value="slashing">Cortante</option><option value="piercing">Perfurante</option><option value="fire">Fogo</option><option value="cold">Frio</option><option value="lightning">Elétrico</option><option value="poison">Veneno</option><option value="force">Verdadeiro</option><option value="acid">Ácido</option><option value="psychic">Psíquico</option><option value="thunder">Trovejante</option><option value="radiant">Energia</option></select></label><label>Quantidade de alvos <input name="targetCount" type="number" min="1" value="1"></label><label>Custo PP <input name="cost" type="number" min="0" value="0"></label><label>Alcance (metros; 0 = pessoal) <input name="range" type="number" min="0" value="0"></label><label>Duração <select name="durationUnits"><option value="inst">Instantânea</option><option value="round">Rodadas</option><option value="turn">Turnos</option><option value="minute">Minutos</option><option value="hour">Horas</option><option value="perm">Permanente</option></select></label><label>Quantidade da duração <input name="durationValue" type="number" min="1" value="1"></label>' + `<label>Ativação <select name="activation"><option value="">Padrão da categoria</option><option value="powerful">Ação Poderosa</option><option value="bonus">Ação Bônus</option><option value="reaction">Reação</option><option value="none">Passiva (MP)</option><option value="special">Inação (MP)</option><option value="action">Ação (regra específica)</option></select></label>${manifestation?'<p>MP não gasta PP. Informe a soma bruta dos custos dos efeitos e as reduções separadamente. Configure a recuperação dos usos no editor.</p><label>Custo virtual dos efeitos <input name="virtualCost" type="number" min="0" max="12" value="0"></label><label>Redução virtual <input name="virtualReduction" type="number" min="0" value="0"></label><label>Limite de usos (obrigatório para cura) <input name="uses" type="number" min="0" value="0"></label>':''}${game.user.isGM?'<label>Exceção do mestre, se houver <input name="exception" placeholder="Explique a regra específica ou concessão"></label>':''}` ,
      ok:{label:'Criar e editar',callback:(_event,button,dialog)=>{
        const form=button.form ?? dialog?.element?.querySelector('form');
        if(!form)throw Error('Não foi possível ler o formulário da técnica.');
        return {name:form.elements.namedItem('techniqueName').value,kind:form.elements.namedItem('techniqueKind').value,...Object.fromEntries(['formula','cost','range','durationUnits','durationValue','damageType','targetCount','activation','virtualCost','virtualReduction','uses','exception'].map(k=>[k,form.elements.namedItem(k)?.value]))};
      }},rejectClose:false});
    if(!choice)return false;
    checkFruitCreation(sheet.actor,grade,manifestation);
    const level=Number(sheet.actor.system.details?.level)||1,awakened=!!fruit(sheet.actor).despertar;
    if(!manifestation&&grade!=='aux'&&sheet.actor.type==='character'&&!(game.user.isGM&&choice.exception?.trim())){
      const minimum=[0,1,3,6,9,12,16,20][Number(grade)];
      if(level<minimum)throw Error(`Este grau exige nível ${minimum}.`);
      if(Number(grade)>=6&&!awakened)throw Error('Este grau exige o despertar da fruta.');
    }
    const [item]=await sheet.actor.createEmbeddedDocuments('Item',[buildFruitTechnique({...choice,grade,manifestation,awakened})]);
    if(!item)throw Error('O sistema não retornou a técnica criada.');
    if(item.getFlag?.(MODULE_ID,'fruitRules')?.draft)ui.notifications.warn('Técnica criada como rascunho. Confira custo, CD, efeitos e recuperação de usos no editor.');
    item.sheet?.render(true);return item;
  });
}

export async function deleteFruitTechnique(sheet,itemId){
  return exclusive(sheet.actor,async()=>{
    const actor=sheet.actor;
    const resolve=()=>{
      const item=actor.items.get(itemId);
      if(!item)return null;
      if(!item.getFlag(S,'akumaTec')&&!item.getFlag(S,'akumaManif'))throw Error('Este item não é uma técnica ou manifestação da fruta.');
      return item;
    };
    let item=resolve();if(!item)return false;
    const confirmed=await foundry.applications.api.DialogV2.confirm({classes:['oprpg-fixes-dialog'],window:{title:'Excluir técnica da fruta'},
      content:`<p>Excluir <strong>${escape(item.name)}</strong> desta ficha?</p><p>Manutenções vinculadas: ${Object.values(actor.getFlag(S,'upkeep')??{}).filter(e=>e.itemId===itemId).length}. Elas serão encerradas.</p><p>Efeitos vinculados na ficha: ${actor.effects.filter(e=>e.origin===item.uuid||e.origin?.startsWith(item.uuid+'.')).length}. Revise esses efeitos na aba Efeitos antes de excluir.</p>`,
      yes:{label:'Excluir'},no:{label:'Cancelar'},rejectClose:false});
    if(!confirmed)return false;
    if(!actor.isOwner)return false;
    item=resolve();if(!item)return false;
    await item.delete();
    if(actor.items.get(itemId))throw Error('O sistema ou outro módulo impediu a exclusão.');
    const updates={};
    for(const [id,entry] of Object.entries(actor.getFlag(S,'upkeep') ?? {}))if(entry.itemId===itemId)updates[`flags.${S}.upkeep.-=${id}`]=null;
    try{if(Object.keys(updates).length)await actor.update(updates)}
    catch(error){ui.notifications.warn(`Técnica excluída; não foi possível limpar sua manutenção: ${error.message}`)}
    sheet.render(false);return true;
  });
}

export function selectedZoanTraits(actor,rules){
  const f=fruit(actor);if(f.tipo!=='zoan')return [];
  const t=f.tracos ?? {},myth=f.zoanSub==='mitica',anc=f.zoanSub==='ancestral',extra=f.despertar?1:0;
  const pool=myth?3+extra:f.predador?3:5;
  const valid=cat=>[...new Set(Array.isArray(t[cat])?t[cat]:[])].filter(id=>rules.TRACOS_BY_ID[id]?.cat===cat);
  const common=valid('comuns').slice(0,myth?2:3),specific=valid('especificos').slice(0,myth?2+extra:pool);
  const ancestral=valid('ancestrais').slice(0,Math.min(pool-specific.length,myth?1+extra:anc?pool:0));
  return [...common,...specific,...ancestral];
}

export function zoanEffectChanges(actor,rules){
  const f=fruit(actor),selected=new Set(selectedZoanTraits(actor,rules)),form=f.forma ?? 'humana',animal=form==='animal',transformed=animal||form==='hibrida';
  const result=[],add=(key,value,mode=4)=>result.push({key,value:String(value),mode,priority:20});
  const moves=actor.system.attributes?.movement ?? {},senses=actor.system.attributes?.senses ?? {};
  const distance=(n,unit)=>unit==='ft'?n/0.3:n;
  if(selected.has('criatura-robusta'))add('system.attributes.hp.bonuses.overall','+ 20',2);
  if(selected.has('visao-noturna'))add('system.attributes.senses.ranges.darkvision',distance(18,senses.units));
  if(animal&&selected.has('animal-grande'))add('system.traits.size','lg',5);
  if(transformed){
    let walk=Number(actor._source?.system?.attributes?.movement?.walk ?? moves.walk ?? 0);
    if(selected.has('deslocamento-animal')){const n=distance(animal?18:15,moves.units);add('system.attributes.movement.walk',n);walk=Math.max(walk,n)}
    if(selected.has('voo'))add('system.attributes.movement.fly',distance(animal?15:9,moves.units));
    if(selected.has('percepcao-as-cegas'))add('system.attributes.senses.ranges.blindsight',distance(6,senses.units));
    if(selected.has('eco-localizacao')&&!actor.statuses?.has('deafened'))add('system.attributes.senses.ranges.blindsight',distance(9,senses.units));
    if(selected.has('escalador'))add('system.attributes.movement.climb',walk);
    else if(selected.has('escalada-aracnidea'))add('system.attributes.movement.climb',walk/2);
    if(selected.has('casco-protetor'))add('system.attributes.ac.bonus',2,2);
  }
  return result;
}

export async function syncZoanEffects(actor,rules){
  if(!canAct(actor)||syncing.has(actor))return false;syncing.add(actor);
  try{
    const changes=zoanEffectChanges(actor,rules),effects=actor.effects.filter(e=>e.getFlag(S,'akumaTracosEffect'));
    if(!changes.length){for(const effect of effects)await effect.delete();return true}
    const names=selectedZoanTraits(actor,rules).map(id=>rules.TRACOS_BY_ID[id]?.nome ?? id);
    const data={name:'Traços Zoan (automático)',img:image,description:`<p>Forma: ${escape(fruit(actor).forma ?? 'humana')}.</p><p>${names.map(escape).join(', ')}.</p><p>Este efeito aplica os bônus fixos suportados. Condições de uso e ações descritas nos traços continuam exigindo resolução na mesa.</p>`,changes,flags:{[S]:{akumaTracosEffect:true}}};
    if(effects[0]){if(JSON.stringify(effects[0].changes)!==JSON.stringify(changes)||effects[0].description!==data.description)await effects[0].update(data)}
    else await actor.createEmbeddedDocuments('ActiveEffect',[data]);
    for(const effect of effects.slice(1))await effect.delete();return true;
  }finally{syncing.delete(actor)}
}

export async function swapPowerUpTokens(actor,form){
  for(const token of actor.getActiveTokens?.(false,true) ?? []){
    const original=token.getFlag(MODULE_ID,'powerUpTexture');
    if(form){
      const texture=token.texture ?? token._source?.texture ?? {};
      const saved=original ?? {src:texture.src,scaleX:texture.scaleX ?? 1,scaleY:texture.scaleY ?? 1};
      await token.update({[`flags.${MODULE_ID}.powerUpTexture`]:saved,'texture.src':form.img,'texture.scaleX':form.scale,'texture.scaleY':form.scale});
    }else if(original){await token.update({'texture.src':original.src,'texture.scaleX':original.scaleX,'texture.scaleY':original.scaleY,[`flags.${MODULE_ID}.-=powerUpTexture`]:null})}
  }
}

export async function toggleFruitPowerUp(sheet){
  return exclusive(sheet.actor,async()=>{
    const a=sheet.actor,f=fruit(a),pu=f.powerUp ?? {};
    if(pu.active){await a.update({'flags.oprpg-system.akuma.powerUp.active':false});for(const e of a.effects.filter(e=>e.getFlag(S,'akumaPowerUp')))await e.delete();await swapPowerUpTokens(a,null);return true}
    if(f.tipo!=='logia'||f.aspecto!=='corpo-elemental')throw Error('Power Up requer Logia com Corpo Elemental.');
    if(a.getFlag(MODULE_ID,'powerUpUsed'))throw Error('Power Up já usado. Faça um descanso curto ou longo.');
    const costs={sav:2,tam:1,dmg:3,red:4},total=3+Object.entries(costs).reduce((n,[k,v])=>n+(pu[k]?v:0),0);
    const energy=Number(a.system.energy?.total ?? 0);if(energy<total)throw Error(`Power Up requer ${total} PP.`);
    const changes=[],order=['tiny','sm','med','lg','huge','grg'],cur=order.indexOf(a.system.traits?.size ?? 'med');
    if(pu.tam&&cur<4)changes.push({key:'system.traits.size',mode:5,value:order[Math.min((cur<0?2:cur)+1,4)],priority:20});
    const [effect]=await a.createEmbeddedDocuments('ActiveEffect',[{name:'Power Up — Forma de Combate',img:image,duration:{seconds:60,startTime:Number(game.time?.worldTime ?? 0)},changes,flags:{[S]:{akumaPowerUp:true}}}]);
    if(!effect)throw Error('Não foi possível criar o efeito Power Up.');
    try{await a.update({'system.energy.total':energy-total,'flags.oprpg-system.akuma.powerUp.active':true,[`flags.${MODULE_ID}.powerUpUsed`]:true})}
    catch(error){await effect.delete();throw error}
    if(pu.tokenImg)await swapPowerUpTokens(a,{img:pu.tokenImg,scale:Math.max(0.2,Math.min(3,Number(pu.tokenScale)||1))});
    return true;
  });
}

export async function fruitRest(actor,result={},config={}){
  if(!actor||!canAct(actor))return;
  const long=result.longRest===true||config.longRest===true||[result.type,config.type,result.restType,config.restType].includes('long');
  const short=long||result.longRest===false||config.longRest===false||[result.type,config.type,result.restType,config.restType].includes('short');
  if(!short)return;
  const update={[`flags.${MODULE_ID}.-=powerUpUsed`]:null,'flags.oprpg-system.akuma.intangUsos':0};
  if(long){update['flags.oprpg-system.akuma.vigorUsado']=false;update['flags.oprpg-system.akuma.usoAltUsado']=false}
  await actor.update(update);
}

export function installFruitSheetOnClass(Sheet,rules){
  const p=Sheet?.prototype;if(!p||installed.has(p))return !!p;
  if(typeof p._onAkumaCreateTecnica!=='function'||typeof p._syncAkumaTracosEffect!=='function')return false;
  p._onAkumaCreateTecnica=function(grade){return createFruitTechnique(this,grade).catch(e=>ui.notifications.warn(e.message))};
  p._onAkumaCreateManif=function(){return createFruitTechnique(this,'aux',true).catch(e=>ui.notifications.warn(e.message))};
  p._onAkumaDeleteTecnica=function(id){return deleteFruitTechnique(this,id).catch(e=>ui.notifications.error(e.message))};
  const render=p._onRender;
  if(typeof render==='function')p._onRender=function(...args){const result=render.apply(this,args);if(result?.then)return result.then(value=>{bindFruitCreation(this);return value});bindFruitCreation(this);return result};
  p._syncAkumaTracosEffect=function(){return syncZoanEffects(this.actor,rules)};
  p._akumaSwapToken=swapPowerUpTokens;
  p._onAkumaPowerUpToggle=function(){return toggleFruitPowerUp(this).catch(e=>ui.notifications.warn(e.message))};
  p._onAkumaPowerUpItem=async function(){
    return exclusive(this.actor,async()=>{
      const old=this.actor.items.find(i=>i.getFlag(S,'akumaPowerUp'));
      const id=foundry.utils.randomID();
      const activity={_id:id,type:'utility',name:'Ativar ou encerrar Power Up',activation:{type:'action',value:1},flags:{[MODULE_ID]:{powerUpControl:true}}};
      const data={name:'Power Up — Forma de Combate',type:'feat',img:image,system:{description:{value:'<p>Use a atividade para ativar ou encerrar a forma com as opções da aba Fruta. Cobra PP apenas na ativação. Recupera o uso em descanso curto ou longo.</p>'},activities:{[id]:activity}},flags:{[S]:{akumaPowerUp:true,featureSection:'jj-combat'}}};
      if(old){
        const existing=Array.from(old.system.activities ?? []).find(a=>a.getFlag?.(MODULE_ID,'powerUpControl')||a.flags?.[MODULE_ID]?.powerUpControl);
        await old.update({'system.description.value':data.system.description.value,...(!existing?{[`system.activities.${id}`]:activity}:{})});return old;
      }
      return (await this.actor.createEmbeddedDocuments('Item',[data]))[0];
    });
  };
  for(const [name,eligible] of Object.entries({_onAkumaForma:f=>f.tipo==='zoan',_onAkumaToggleTraco:f=>f.tipo==='zoan',_onAkumaVigor:f=>f.aspecto==='vigor-animalesco',_onAkumaUsoAlternativo:f=>f.aspecto==='uso-alternativo',_onAkumaIntangibilidade:f=>f.tipo==='logia'})){
    const original=p[name];if(typeof original!=='function')continue;
    p[name]=function(...args){return exclusive(this.actor,async()=>{
      if(!eligible(fruit(this.actor)))throw Error('Esta ação não está disponível para a fruta/aspecto atual.');
      if(name==='_onAkumaToggleTraco'&&rules.TRACOS_BY_ID[args[1]]?.cat!==args[0])throw Error('Traço ou categoria inválida.');
      return original.apply(this,args);
    }).catch(e=>ui.notifications.warn(e.message))};
  }
  installed.add(p);return true;
}

export async function installFruitSheetFix(){
  if(hooksInstalled)return true;
  const rules=await import('/systems/oprpg-system/module/systems/akuma-tracos.mjs');
  for(const Sheet of registeredCharacterSheets())installFruitSheetOnClass(Sheet,rules);
  connectLiveSheets(app=>!!app.element?.querySelector?.('[data-action="akuma-create-tecnica"], [data-action="akuma-create-manif"], [data-action="akuma-delete-tecnica"]')||typeof app._onAkumaCreateTecnica==='function',app=>{installFruitSheetOnClass(app.constructor,rules);bindFruitCreation(app)});
  const guard=fn=>(...args)=>Promise.resolve(fn(...args)).catch(e=>{STATE.warnings.push(`Aba Fruta: ${e.message}`);console.error(e)});
  Hooks.on('updateActor',guard(async(actor,changes)=>{
    if(!canAct(actor))return;
    const relevant=changeTouches(changes,['flags.oprpg-system.akuma','system.attributes.movement']);
    if(!relevant)return;
    await syncZoanEffects(actor,rules);
    if(!fruit(actor).powerUp?.active)await swapPowerUpTokens(actor,null);
    if(fruit(actor).tipo!=='logia'&&fruit(actor).powerUp?.active){await actor.update({'flags.oprpg-system.akuma.powerUp.active':false});for(const e of actor.effects.filter(e=>e.getFlag(S,'akumaPowerUp')))await e.delete()}
  }));
  Hooks.on('dnd5e.restCompleted',guard(fruitRest));
  const control=Hooks.on('dnd5e.preUseActivity',activity=>{
    if(!(activity?.getFlag?.(MODULE_ID,'powerUpControl')||activity?.flags?.[MODULE_ID]?.powerUpControl))return;
    const actor=activity.item?.actor;if(actor)void toggleFruitPowerUp({actor}).catch(e=>ui.notifications.warn(e.message));
    return false;
  });
  const list=Hooks.events?.['dnd5e.preUseActivity'];
  if(Array.isArray(list)){const at=list.findIndex(e=>e.id===control);if(at>0)list.unshift(...list.splice(at,1))}
  for(const event of ['createActiveEffect','updateActiveEffect','deleteActiveEffect'])Hooks.on(event,guard(effect=>{
    const actor=effect.parent;if(!actor||effect.getFlag?.(S,'akumaTracosEffect'))return;
    return syncZoanEffects(actor,rules);
  }));
  registerActorTimer('fruit-power-up',actor=>Array.from(actor.effects??[]).some(e=>e.getFlag(S,'akumaPowerUp')),actor=>queueActor(actor,async()=>{
    if(canAct(actor))for(const effect of actor.effects ?? []){
      if(!effect.getFlag(S,'akumaPowerUp'))continue;
      const duration=effect.duration ?? {};
      if(duration.startTime!=null && Number(game.time?.worldTime)-Number(duration.startTime)>=Number(duration.seconds ?? 60)){
        await effect.delete();await actor.update({'flags.oprpg-system.akuma.powerUp.active':false});await swapPowerUpTokens(actor,null);
      }
    }
  }));
  hooksInstalled=true;STATE.fruitSheetPatch=true;return true;
}

export function bindFruitCreation(sheet){
  const root=sheet.element;if(!root?.addEventListener||creationBound.has(root))return;
  creationBound.add(root);
  root.addEventListener('click',event=>{
    if(event.button>0)return;
    const button=event.target.closest?.('[data-action="akuma-create-tecnica"], [data-action="akuma-create-manif"], [data-action="akuma-delete-tecnica"]');
    if(!button||!root.contains(button)||button.disabled)return;
    event.preventDefault();event.stopImmediatePropagation();
    const manifestation=button.dataset.action==='akuma-create-manif';
    const deleting=button.dataset.action==='akuma-delete-tecnica';
    const job=deleting?deleteFruitTechnique(sheet,button.dataset.itemId ?? button.closest('[data-item-id]')?.dataset.itemId):createFruitTechnique(sheet,manifestation?'aux':button.dataset.grade,manifestation);
    void job.catch(error=>{
      console.error(`${MODULE_ID} | Ação na aba Fruta`,error);
      ui.notifications.error(`Não foi possível ${deleting?'excluir':'criar'} a técnica: ${error.message ?? error}`);
    });
  },{capture:true});
}
