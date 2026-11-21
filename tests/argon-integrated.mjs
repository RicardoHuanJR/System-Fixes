import test from 'node:test';
import assert from 'node:assert/strict';
import { entriesForActor, economyOf, groupOf, finiteValue, resourceLabel, escapeHTML, matchesEntry, activityImage } from '../modules/oprpg-system-fixes/scripts/argon-hud/model.js';
import { executeEntry, isAvailable, diagnostics, unavailableReason } from '../modules/oprpg-system-fixes/scripts/argon-hud/execute.js';
import { weaponSetsForActor, setWeaponSlot, selectWeaponSet } from '../modules/oprpg-system-fixes/scripts/argon-hud/weapon-sets.js';
import { isFavoriteEntry, toggleFavoriteEntry } from '../modules/oprpg-system-fixes/scripts/argon-hud/favorites.js';
import { activityDetails } from '../modules/oprpg-system-fixes/scripts/argon-hud/activity-details.js';
import { convertLength, movementInfo } from '../modules/oprpg-system-fixes/scripts/argon-hud/movement.js';
import { registerArgon } from '../modules/oprpg-system-fixes/scripts/argon-hud/argon.js';
import { installEmbeddedArgonHUD, argonHUDStatus, installArgonModuleCheckCompatibility } from '../modules/oprpg-system-fixes/scripts/argon-hud/integration.js';
import { executePrepared, installBasicActionAutomation, isDodging, useBasicAction, dashMovementInfo, basicEffectActive, applyDodgeToAttack } from '../modules/oprpg-system-fixes/scripts/argon-hud/basic-actions.js';
import { actorAbilities, relatedSkills, rollBonusLabel } from '../modules/oprpg-system-fixes/scripts/argon-hud/actor-tests.js';
import { panelPlacement } from '../modules/oprpg-system-fixes/scripts/argon-hud/panel-layout.js';
import { registerArgonHUDSettings } from '../modules/oprpg-system-fixes/scripts/argon-hud/integration.js';
import { argonIconPath, argonIconMarkup } from '../modules/oprpg-system-fixes/scripts/argon-hud/icons.js';

test('roll hints use prepared totals and explicitly label a base modifier without evaluating formulas', () => {
  const actor={system:{abilities:{dex:{mod:3,check:{value:5},save:{value:7}},str:{mod:-1},con:{mod:0,save:{value:'@prof'}}},skills:{ste:{total:8},ath:{total:'1d4+3'}}}};
  assert.equal(rollBonusLabel(actor,'check','dex'),'+5');
  assert.equal(rollBonusLabel(actor,'save','dex'),'+7');
  assert.equal(rollBonusLabel(actor,'skill','ste'),'+8');
  assert.equal(rollBonusLabel(actor,'check','str'),'Mod. -1');
  assert.equal(rollBonusLabel(actor,'check','con'),'Mod. +0');
  for(const [kind,key] of [['save','con'],['save','str'],['skill','ath'],['check','missing']]) assert.equal(rollBonusLabel(actor,kind,key),'');
});

test('panel geometry respects the portrait, visible sidebar and hotbar without moving native UI', () => {
  const base={anchor:{left:300,top:700},portrait:{left:16,right:296,top:550},viewport:{width:1000,height:800}};
  assert.deepEqual(panelPlacement(base),{left:300,width:380,bottom:108,maxHeight:380,narrow:false});
  const sidebar={left:600,right:1000,width:400,height:800};
  const blocked=panelPlacement({...base,sidebar,hotbar:{left:250,right:600,top:480,bottom:540,width:350,height:60}});
  assert.equal(blocked.left,212);assert.equal(blocked.bottom,328);assert.equal(blocked.maxHeight,380);
  assert.ok(blocked.left+blocked.width<=sidebar.left-8);
  const narrow=panelPlacement({...base,viewport:{width:320,height:360},anchor:{left:168,top:200},portrait:{left:16,right:160,top:120}});
  assert.equal(narrow.width,280);assert.equal(narrow.left,32);assert.equal(narrow.bottom,248);assert.equal(narrow.maxHeight,104);assert.equal(narrow.narrow,true);
  const low=panelPlacement({...base,anchor:{left:300,top:5}});assert.equal(low.maxHeight,0);
});

test('text preference is client-only, compact by default and refreshes without requiring a reload', () => {
  const previous=globalThis.game,settings=new Map();
  globalThis.game={settings:{register:(_id,key,value)=>settings.set(key,value)}};
  try {registerArgonHUDSettings();const text=settings.get('argonTextSize');assert.equal(text.scope,'client');assert.equal(text.default,'normal');assert.equal(text.type,String);assert.equal(text.choices.large,'Texto ampliado');assert.equal(typeof text.onChange,'function');assert.ok(!text.requiresReload);}
  finally {globalThis.game=previous;}
});

function fixture(use = async () => ({})) {
  const first = {id:'a',name:'Ataque',type:'attack',activation:{type:'action'},use};
  const second = {id:'b',name:'Área',type:'save',activation:{type:'powerful'},use};
  const item = {id:'i',name:'Técnica',type:'spell',system:{activities:new Map([['a',first],['b',second]])}};
  const actor = {id:'actor',uuid:'Actor.actor',isOwner:true,items:new Map([['i',item]])};
  item.parent = actor; first.item = second.item = item;
  return {actor,item,first,second};
}

test('original HUD icons have local paths, accessible markup and a closed fallback', () => {
  for(const key of ['sword','bolt','clock','shield','other','star','info','close','haki']) {
    assert.equal(argonIconPath(key),`modules/oprpg-system-fixes/assets/argon/icons/${key}.svg`);
    assert.match(argonIconMarkup(key),/aria-hidden="true"/);
    assert.ok(!argonIconMarkup(key).includes('style="color:'));
  }
  assert.equal(argonIconMarkup('__proto__'),argonIconMarkup('other'));
  assert.equal(argonIconPath('../bad'),'modules/oprpg-system-fixes/assets/argon/icons/other.svg');
});

test('multiple activities retain exact identity, economy and stable labels', () => {
  const {actor} = fixture();
  const entries = entriesForActor(actor);
  assert.deepEqual(entries.map(e => [e.activityId,e.economy]), [['a','action'],['b','powerful']]);
  assert.match(entries[1].label,/Área/);
  assert.equal(economyOf({activation:{type:'reaction'}}),'reaction');
  assert.equal(groupOf({type:'spell',flags:{'oprpg-system':{akumaTec:{grau:1}}}}),'akuma');
});

test('only selected native activity executes; no guessed fallback after deletion', async () => {
  let count = 0;
  const {actor,item,second} = fixture();
  second.use = async () => {count++; return {};};
  const entry = entriesForActor(actor)[1];
  assert.equal((await executeEntry(actor,entry)).ok,true);
  assert.equal(count,1);
  item.system.activities.delete('b');
  assert.equal((await executeEntry(actor,entry)).reason,'unavailable');
  assert.equal(count,1);
});

test('ownership, native restrictions, cancellation, exceptions and concurrent clicks', async () => {
  const {actor,first} = fixture();
  const entry = entriesForActor(actor)[0];
  actor.isOwner = false; assert.equal(isAvailable(actor,entry),false); actor.isOwner = true;
  first.canUse = false; assert.equal(isAvailable(actor,entry),false); first.canUse = true;
  first.use = async () => undefined;
  assert.equal((await executeEntry(actor,entry)).reason,'cancelled');
  let finish;
  first.use = () => new Promise(resolve => {finish=resolve;});
  const pending = executeEntry(actor,entry);
  assert.equal((await executeEntry(actor,entry)).reason,'pending');
  finish({}); await pending;
  first.use = async () => {throw new Error('expected test error');};
  const old = console.error; console.error = () => {};
  try {assert.equal((await executeEntry(actor,entry)).reason,'exception');} finally {console.error=old;}
  first.use = async () => ({});
  assert.equal((await executeEntry(actor,entry)).ok,true);
});

test('missing stats do not become zero; PP formulas remain variable', () => {
  for (const value of [null,undefined,'',NaN]) assert.equal(finiteValue(value),null);
  assert.equal(finiteValue(0),0);
  assert.equal(resourceLabel({consumption:{targets:[{type:'attribute',target:'energy.total',value:'3'}]}}),'3 PP');
  assert.equal(resourceLabel({consumption:{targets:[{type:'attribute',target:'energy.total',value:'@prof'}]}}),'PP variável');
  assert.equal(resourceLabel({uses:{max:4,spent:1}}),'3/4 usos');
  assert.equal(escapeHTML('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
  assert.equal(diagnostics({fixes:{version:'1.27.14'}}).adapter,'integrado-1.27.14');
});

test('movement respects units, mode, absent conversion and zero speed', () => {
  const units = {m:{conversion:1},ft:{conversion:.3048}};
  assert.equal(convertLength(10,'ft','m',units),3.048);
  assert.equal(convertLength(10,'unknown','m',units),null);
  assert.equal(convertLength(10,undefined,undefined,units),null);
  globalThis.CONFIG = {DND5E:{movementUnits:units}};
  globalThis.canvas = {scene:{grid:{units:'m',distance:1.5}},tokens:{placeables:[]}};
  const actor = {system:{attributes:{movement:{walk:9,fly:0,units:'m'}}}};
  assert.equal(movementInfo(actor,{document:{movementHistory:[{cost:3}]}},'walk').remaining,6);
  assert.equal(movementInfo(actor,null,'fly').maxSpaces,0);
});

test('Argon classes use CORE templates and native PP; register all supported panels', async () => {
  class Base {get classes(){return [];} get actor(){return globalThis.ui.ARGON._actor;} }
  const registered = {};
  const core = {ARGON:{MAIN:{BUTTONS:{ActionButton:Base,ButtonPanelButton:Base},ActionPanel:Base,BUTTON_PANELS:{ButtonPanel:Base}},
    PORTRAIT:{PortraitPanel:Base},DRAWER:{DrawerPanel:Base,DrawerButton:Base},WeaponSets:Base,MovementHud:Base}};
  for (const key of ['SupportedActorTypes','PortraitPanel','DrawerPanel','WeaponSets','MovementHud','MainPanels']) core['define'+key]=value=>registered[key]=value;
  globalThis.game = {i18n:{localize:key=>key},settings:{get:()=>true},user:{hotbar:{}},macros:new Map()};
  const {actor} = fixture(); actor.system = {energy:{total:7,max:12},attributes:{hp:{value:4,max:10,temp:2},ac:{value:13}}};
  globalThis.ui = {ARGON:{_actor:actor}};
  registerArgon(core);
  assert.equal(registered.MainPanels.length,5);
  assert.deepEqual(registered.SupportedActorTypes,['character','npc','vehicle']);
  const stats = await new registered.PortraitPanel().getStatBlocks();
  assert.ok(stats.flat().some(stat=>stat.text==='PP: 7/12'));
  assert.ok(stats.flat().some(stat=>stat.text==='PV: 4/10 (+2)'));
  actor.type='character'; actor.system.attributes.hp.value=0; actor.system.attributes.death={success:3,failure:0};
  assert.equal(new registered.PortraitPanel().isDying,false);
  actor.system.attributes.death={success:0,failure:3};
  assert.equal(new registered.PortraitPanel().isDead,true);
  const powerful = new registered.MainPanels[1]();
  const buttons = await powerful._getButtons();
  assert.equal(buttons.length,1);
  assert.equal(buttons[0].label,'Poderosa');
  assert.equal(buttons[0].entries[0].activityId,'b');
});

test('search ignores accents without losing category filters', () => {
  const entry={label:'Técnica — Área de alcance',group:'techniques'};
  assert.equal(matchesEntry(entry,'  tecnica '),true);
  assert.equal(matchesEntry(entry,'area','techniques'),true);
  assert.equal(matchesEntry(entry,'area','weapons'),false);
  assert.equal(matchesEntry(entry,'x'),false);
});

test('activity artwork prefers explicit activity images over item photos, and item photos over prepared defaults', () => {
  const item={img:'worlds/campaign/weapon.webp'};
  assert.equal(activityImage({_source:{img:''},img:'icons/svg/sword.svg'},item),item.img);
  assert.equal(activityImage({_source:{img:'worlds/campaign/technique.webp'},img:'icons/svg/sword.svg'},item),'worlds/campaign/technique.webp');
  assert.equal(activityImage({img:'activity.webp'},item),'activity.webp');
  assert.equal(activityImage({_source:{img:''},img:'icons/svg/sword.svg'},{}),'icons/svg/sword.svg');
  assert.equal(activityImage(null,{}),'icons/svg/dice-target.svg');
});

test('activity details preserve prepared labels, weapon overrides and damage arrays', () => {
  let uses=0;
  const activity={type:'attack',use:()=>uses++,labels:{activation:'1 ação',range:'3 m',duration:'1 minuto',concentrationDuration:'Concentração, 1 minuto',damages:[{formula:'2d6',label:'2d6 cortante'},{formula:'@mod',label:'@mod fogo'}]},
    activationLabels:{activation:'1 ação',range:'12 m'},target:{affects:{labels:{sheet:'2 criaturas'}},template:{labels:{description:'Cone de 6 m'}}}};
  const rows=activityDetails(activity,{});
  assert.deepEqual(rows.find(row=>row.label==='Alcance'),{label:'Alcance',value:'12 m'});
  assert.equal(rows.find(row=>row.label==='Dano').value,'2d6 cortante; @mod fogo');
  assert.equal(rows.find(row=>row.label==='Duração').value,'Concentração, 1 minuto');
  assert.equal(rows.find(row=>row.label==='Alvos').value,'2 criaturas');
  assert.equal(rows.find(row=>row.label==='Área').value,'Cone de 6 m');
  assert.equal(uses,0);
});

test('missing activity metadata is not inferred from a different activity or item', () => {
  const {item,first,second}=fixture();
  first.labels={range:'18 m',damage:'4d6 fogo'};
  second.labels={}; item.labels={range:'999 m'};
  assert.deepEqual(activityDetails(second,item),[]);
  assert.deepEqual(activityDetails(null,item),[]);
  assert.equal(activityDetails(first,item).find(row=>row.label==='Dano').value,'4d6 fogo');
});

test('healing details remain unevaluated and native localization is respected', () => {
  const rows=activityDetails({type:'heal',labels:{range:'DND5E.DistTouch',damage:[{label:'1d8 + @mod pontos de vida'}]}},null,value=>value==='DND5E.DistTouch'?'Toque':value);
  assert.equal(rows.find(row=>row.label==='Alcance').value,'Toque');
  assert.equal(rows.find(row=>row.label==='Cura').value,'1d8 + @mod pontos de vida');
  assert.ok(!rows.some(row=>row.value.includes('[object Object]')));
});

test('activity details respect unidentified items and native sheet visibility', () => {
  const item={system:{identified:false}};
  const activity={labels:{range:'18 m',damage:[{label:'segredo'}]}};
  assert.deepEqual(activityDetails(activity,item),[]);
  assert.equal(activityDetails(activity,item,value=>value,{isGM:true}).find(row=>row.label==='Dano').value,'segredo');
  assert.deepEqual(activityDetails({...activity,canConfigure:false},{system:{}}),[]);
});

test('activities sharing one item cannot open concurrent native usage dialogs', async () => {
  let finish;
  const {actor,first}=fixture();
  const [a,b]=entriesForActor(actor);
  first.use=()=>new Promise(resolve=>{finish=resolve;});
  const usage=executeEntry(actor,a);
  assert.equal((await executeEntry(actor,b)).reason,'pending');
  finish({}); await usage;
  assert.equal((await executeEntry(actor,b)).ok,true);
});

test('availability explains native failures and survives throwing system getters', () => {
  const {actor,first}=fixture(); const entry=entriesForActor(actor)[0];
  actor.isOwner=false; assert.match(unavailableReason(actor,entry),/permissão/); actor.isOwner=true;
  Object.defineProperty(first,'canUse',{get(){throw new Error('unprepared');}});
  assert.equal(isAvailable(actor,entry),false);
  assert.match(unavailableReason(actor,entry),/consultar/);
});

test('weapon sets only write CORE slot flags for owned weapons, never equipment', async () => {
  const actor={isOwner:true,items:new Map(),getFlag:(_,key)=>key==='weaponSets'?{'2':{primary:'Actor.other.Item.other'}}:'2'};
  const weapon={id:'w',uuid:'Actor.a.Item.w',parent:actor,type:'weapon',system:{equipped:true}};
  actor.items.set('w',weapon);
  const updates=[]; actor.update=async update=>updates.push(update); actor.setFlag=async(...args)=>updates.push(args);
  assert.equal(weaponSetsForActor(actor).sets[0].primary,weapon);
  assert.equal(weaponSetsForActor(actor).sets[1].primary,null);
  assert.equal(await setWeaponSlot(actor,'2','primary','w'),true);
  assert.deepEqual(updates[0],{'flags.enhancedcombathud.weaponSets.2.primary':weapon.uuid});
  assert.equal(await setWeaponSlot(actor,'4','primary','w'),false);
  assert.equal(await setWeaponSlot(actor,'2','secondary','other'),false);
  assert.equal(await selectWeaponSet(actor,'3'),true);
  assert.equal(weapon.system.equipped,true);
  actor.isOwner=false; assert.equal(await setWeaponSlot(actor,'2','primary','w'),false);
});

test('favorites use exact native relative activity IDs and preserve unrelated favorites', async () => {
  const {actor,item}=fixture(); const [entry]=entriesForActor(actor);
  item.getRelativeUUID=()=>`Item.${item.id}`;
  actor.system={favorites:[{type:'skill',id:'ste'}]};
  actor.system.addFavorite=async favorite=>actor.system.favorites.push(favorite);
  actor.system.removeFavorite=async id=>{actor.system.favorites=actor.system.favorites.filter(f=>f.id!==id);};
  assert.equal(await toggleFavoriteEntry(actor,entry),true);
  assert.deepEqual(actor.system.favorites[1],{type:'activity',id:'Item.i.Activity.a'});
  assert.equal(isFavoriteEntry(actor,entry),true);
  assert.equal(await toggleFavoriteEntry(actor,entry),true);
  assert.deepEqual(actor.system.favorites,[{type:'skill',id:'ste'}]);
  actor.isOwner=false; assert.equal(await toggleFavoriteEntry(actor,entry),false);
});

test('dash ignores disabled effects and other movement modes', () => {
  globalThis.game.time = {worldTime:10};
  const effect={disabled:false,duration:{startTime:10,seconds:6},getFlag:()=>({key:'dash',movementMode:'walk',movementBonus:9})};
  const actor={effects:[effect],system:{attributes:{movement:{walk:9,fly:6,units:'m'}}}};
  assert.equal(dashMovementInfo(actor,null,'walk').max,18);
  assert.equal(dashMovementInfo(actor,null,'fly').max,6);
  effect.disabled=true;
  assert.equal(dashMovementInfo(actor,null,'walk').max,9);
});

test('prepared action survives native cancellation and executes once', async () => {
  globalThis.foundry = {applications:{api:{DialogV2:{confirm:async()=>true}}}};
  const {actor,first} = fixture(async()=>undefined);
  let deleted = 0;
  const effect = {uuid:'Effect.e',parent:actor,getFlag:()=>({key:'ready',activityUuid:'Activity.a'}),delete:async()=>deleted++};
  globalThis.fromUuid = async uuid=>uuid==='Effect.e'?effect:first;
  globalThis.game.user = {isGM:false};
  globalThis.ui.notifications = {warn:()=>{},error:()=>{}};
  await executePrepared(effect);
  assert.equal(deleted,0);
  first.use = async()=>({});
  await executePrepared(effect);
  assert.equal(deleted,1);
});

test('basic actions are idempotent and time expiry only touches their own effects', async () => {
  const hooks = new Map();
  globalThis.Hooks = {on:(name,fn)=>hooks.set(name,fn)};
  globalThis.game.users = [{id:'gm',active:true,isGM:true}];
  globalThis.game.user = {id:'gm',isGM:true};
  globalThis.game.time = {worldTime:20};
  globalThis.game.combat = null;
  const state = {key:'dodge',activated:null};
  const effect = {id:'e',disabled:false,duration:{startTime:10,seconds:6},getFlag:(id)=>id==='oprpg-system-fixes'?state:null};
  const actor = {id:'actor',isOwner:true,effects:[effect],statuses:new Set(),system:{attributes:{movement:{walk:9}}}};
  assert.equal(isDodging(actor),false);
  let removed;
  actor.deleteEmbeddedDocuments=async(type,ids)=>{removed=ids;};
  globalThis.game.actors = [actor];
  installBasicActionAutomation();
  await hooks.get('updateWorldTime')(20);
  assert.deepEqual(removed,['e']);
  let created = 0, release;
  actor.effects = [];
  actor.createEmbeddedDocuments=async()=>{created++; await new Promise(resolve=>{release=resolve;}); return [{}];};
  globalThis.ChatMessage={create:async()=>{},getSpeaker:()=>({})};
  const a = useBasicAction(actor,'dodge','icon');
  await useBasicAction(actor,'dodge','icon');
  release(); await a;
  assert.equal(created,1);
  actor.effects=[effect,{id:'foreign',getFlag:()=>null}];actor.statuses.add('incapacitated');
  await hooks.get('createActiveEffect')({parent:actor});assert.deepEqual(removed,['e']);
  actor.statuses.clear();actor.system.attributes.movement.walk=0;
  await hooks.get('updateActor')(actor);assert.deepEqual(removed,['e']);
});

test('attribute indicators keep prepared values and skill associations respect actor overrides', () => {
  assert.deepEqual(actorAbilities({}),[]);
  const config={abilities:{dex:{label:'Destreza',abbreviation:'DES'}},skills:{ste:{ability:'dex'},ath:{ability:'str'},custom:{ability:'dex'}}};
  const actor={system:{abilities:{dex:{value:0,mod:0},str:{mod:-2},missing:null,wis:{mod:'@formula'}},skills:{ste:{},ath:{ability:'dex'},custom:{ability:'wis'},unrelated:{}}}};
  assert.deepEqual(actorAbilities(actor,config)[0],{key:'dex',label:'Destreza',short:'DES',value:0,mod:0});
  assert.equal(actorAbilities(actor,config).find(a=>a.key==='wis').mod,null);
  assert.deepEqual(relatedSkills(actor,'dex',config),['ste','ath']);
  assert.deepEqual(relatedSkills(actor,'wis',config),['custom']);
  assert.deepEqual(relatedSkills(actor,'con',config),[]);
});

test('Dodge uses defender sight, honors explicit targets and never penalizes a mixed attack', () => {
  game.combat=null; game.time={worldTime:0};
  const actor={effects:[{getFlag:()=>({key:'dodge'})}],statuses:new Set(),system:{attributes:{movement:{walk:9}}}};
  const attacker={center:{x:100,y:100},document:{level:'level',parent:{levels:new Map([['level',{id:'level'}]])},getVisibilityTestPoints:()=>[{x:100,y:100,elevation:3}]}};
  const defender={actor,vision:{id:'defender'},document:{detectionModes:[{id:'sight',enabled:true},{id:'hearing',enabled:true}]}};
  let visible=true, tests=0;
  globalThis.foundry={canvas:{perception:{DetectionMode:{DETECTION_TYPES:{SIGHT:1}}}}};
  globalThis.CONFIG={Canvas:{detectionModes:{sight:{type:1,testVisibility(source,mode,config){tests++;assert.equal(source,defender.vision);assert.equal(config.object,attacker);assert.equal(config.level.id,'level');assert.deepEqual(config.tests[0].point,{x:100,y:100,elevation:3});return visible;}},hearing:{type:2,testVisibility(){throw new Error('hearing is not sight');}}}}};
  const config=()=>({subject:{actor:{getActiveTokens:()=>[attacker]}},targets:new Set([defender]),rolls:[{}]});
  let roll=config(); applyDodgeToAttack(roll); assert.equal(roll.rolls[0].options.disadvantage,true);
  visible=false; roll=config(); applyDodgeToAttack(roll); assert.equal(roll.disadvantage,undefined);
  visible=true; roll=config(); roll.targets.add({actor:{effects:[]}}); applyDodgeToAttack(roll); assert.equal(roll.disadvantage,undefined);
  roll=config(); roll.targets=new Set(); applyDodgeToAttack(roll); assert.equal(roll.disadvantage,undefined);
  attacker.document.hidden=true; roll=config(); applyDodgeToAttack(roll); assert.equal(roll.disadvantage,undefined);
  assert.ok(tests>=2);
});

test('turn state expires even before deletion, including actions prepared off turn', () => {
  const actor={},other={};
  const effect={parent:actor,getFlag:()=>({key:'ready',activated:{combatId:'c',round:1,turn:0,combatantId:'other'}})};
  game.combat={id:'c',started:true,round:1,turn:0,combatant:{id:'other',actor:other},turns:[{actor:other},{actor}]};
  assert.equal(basicEffectActive(effect),true);
  game.combat.turn=1; game.combat.combatant={id:'owner',actor};
  assert.equal(basicEffectActive(effect),false);
  game.combat.round=2; game.combat.turn=0;game.combat.combatant={id:'other',actor:other};
  assert.equal(basicEffectActive(effect),false);
  game.combat=null; assert.equal(basicEffectActive(effect),false);
});

test('Ready cancellation, suppression and concentration transfer never spend or duplicate a use', async () => {
  game.combat=null;game.time={worldTime:0};
  const {actor,first}=fixture(); let uses=0,updates=[];
  let confirm=false;
  globalThis.foundry={applications:{api:{DialogV2:{confirm:async()=>confirm}}}};
  const state={key:'ready',activityUuid:'Activity.a',nativeConcentration:true};
  const effect={uuid:'Effect.ready',parent:actor,getFlag:()=>state,update:async data=>updates.push(data)};
  first.duration={getEffectData:()=>({seconds:60})};
  first.use=async config=>{uses++;assert.deepEqual(config,{concentration:{begin:false,end:null}});return {};};
  globalThis.fromUuid=async()=>first;
  assert.equal((await executePrepared(effect)).ok,false);assert.equal(uses,0);
  confirm=true; effect.isSuppressed=true; await executePrepared(effect);assert.equal(uses,0);
  effect.isSuppressed=false; await executePrepared(effect);assert.equal(uses,1);
  assert.deepEqual(updates,[{'flags.oprpg-system-fixes.-=basicAction':null,duration:{seconds:60}}]);
  actor.statuses=new Set(['incapacitated']);await executePrepared(effect);assert.equal(uses,1);
});

test('preparing a technique creates native concentration status without using it or ending unrelated concentration', async () => {
  const {actor,first}=fixture();first.uuid='Activity.a';let uses=0,created=[];
  first.use=async()=>{uses++;};actor.statuses=new Set();actor.effects=[];
  actor.system={attributes:{concentration:{limit:1}}};actor.concentration={effects:new Set()};
  actor.createEmbeddedDocuments=async(type,data)=>{created.push(...data);return [{uuid:'Effect.ready'}];};
  game.combat=null;game.settings={get:()=>false};game.user={id:'gm',isGM:true};
  globalThis.CONFIG={specialStatusEffects:{CONCENTRATING:'concentrating'}};
  globalThis.foundry={utils:{escapeHTML:String},applications:{api:{DialogV2:{wait:async config=>config.buttons[0].callback(null,null,{element:{querySelector:selector=>({value:selector.includes('trigger')?'Ao abrir a porta':'Activity.a'})}})}}}};
  await useBasicAction(actor,'ready','icon');
  assert.equal(uses,0);assert.equal(created.length,1);assert.deepEqual(created[0].statuses,['concentrating']);
  assert.equal(created[0].flags['oprpg-system-fixes'].basicAction.activityUuid,'Activity.a');
  actor.concentration.effects.add({id:'unrelated'});
  await useBasicAction(actor,'ready','icon');assert.equal(created.length,1);
});

test('integration is optional, idempotent and refuses the legacy adapter or unsupported CORE', () => {
  game.settings={get:()=>true};
  const hooks = new Map();
  globalThis.Hooks = {on:(name,fn)=>hooks.set(name,fn)};
  const legacy = {active:true};
  const core = {active:true,version:'5.0.2'};
  globalThis.game.system = {id:'oprpg-system',version:'1.0.22'};
  globalThis.game.modules = new Map([['enhancedcombathud',core],['enhancedcombathud-oprpg-system',legacy]]);
  installEmbeddedArgonHUD();
  const handler = hooks.get('argonInit');
  installEmbeddedArgonHUD(); assert.equal(hooks.get('argonInit'),handler);
  const old = console.warn; console.warn=()=>{};
  try {
    handler({}); assert.equal(argonHUDStatus().registered,false);
    legacy.active=false; core.version='6.0.0'; handler({});
    assert.match(argonHUDStatus().lastError,/6.0.0/);
  } finally {console.warn=old;}
});

test('CORE package check waits for successful embedded registration and keeps legitimate warnings', async () => {
  const integration=await import('../modules/oprpg-system-fixes/scripts/argon-hud/integration.js?module-check');
  const hooks=new Map();globalThis.Hooks={on:(name,fn)=>hooks.set(name,fn)};
  let checks=0,enabled=true;
  class Base {get classes(){return [];} }
  class Core {
    constructor(){this.performModuleCheck();hooks.get('argonInit')(Core);}
    performModuleCheck(){checks++;}
  }
  Core.ARGON={CORE:{CoreHud:Core},MAIN:{BUTTONS:{ActionButton:Base,ButtonPanelButton:Base},ActionPanel:Base,BUTTON_PANELS:{ButtonPanel:Base}},PORTRAIT:{PortraitPanel:Base},DRAWER:{DrawerPanel:Base,DrawerButton:Base},WeaponSets:Base,MovementHud:Base};
  for(const key of ['SupportedActorTypes','PortraitPanel','DrawerPanel','WeaponSets','MovementHud','MainPanels'])Core['define'+key]=()=>{};
  globalThis.CONFIG={ARGON:Core.ARGON};game.settings={get:()=>enabled};game.system={id:'oprpg-system'};
  game.modules=new Map([['enhancedcombathud',{active:true,version:'5.0.2'}]]);
  const previousInfo=console.info,previousWarn=console.warn;console.info=()=>{};console.warn=()=>{};
  try {
    integration.installEmbeddedArgonHUD();
    const wrapped=Core.prototype.performModuleCheck;
    hooks.get('setup')();assert.equal(Core.prototype.performModuleCheck,wrapped);
    game.modules.get('enhancedcombathud').version='6.0.0';
    new Core();await Promise.resolve();assert.equal(checks,1);assert.equal(integration.argonHUDStatus().registered,false);
    game.modules.get('enhancedcombathud').version='5.0.2';checks=0;
    const core=new Core();await Promise.resolve();assert.equal(checks,0);assert.equal(integration.argonHUDStatus().registered,true);
    enabled=false;core.performModuleCheck();await Promise.resolve();assert.equal(checks,1);
    enabled=true;game.system.id='other';core.performModuleCheck();assert.equal(checks,2);
  } finally {console.info=previousInfo;console.warn=previousWarn;}
});
