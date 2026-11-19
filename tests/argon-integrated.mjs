import test from 'node:test';
import assert from 'node:assert/strict';
import { entriesForActor, economyOf, groupOf, finiteValue, resourceLabel, escapeHTML, matchesEntry } from '../modules/oprpg-system-fixes/scripts/argon-hud/model.js';
import { executeEntry, isAvailable, diagnostics, unavailableReason } from '../modules/oprpg-system-fixes/scripts/argon-hud/execute.js';
import { weaponSetsForActor, setWeaponSlot, selectWeaponSet } from '../modules/oprpg-system-fixes/scripts/argon-hud/weapon-sets.js';
import { isFavoriteEntry, toggleFavoriteEntry } from '../modules/oprpg-system-fixes/scripts/argon-hud/favorites.js';
import { activityDetails } from '../modules/oprpg-system-fixes/scripts/argon-hud/activity-details.js';
import { convertLength, movementInfo } from '../modules/oprpg-system-fixes/scripts/argon-hud/movement.js';
import { registerArgon } from '../modules/oprpg-system-fixes/scripts/argon-hud/argon.js';
import { installEmbeddedArgonHUD, argonHUDStatus } from '../modules/oprpg-system-fixes/scripts/argon-hud/integration.js';
import { executePrepared, installBasicActionAutomation, isDodging, useBasicAction, dashMovementInfo } from '../modules/oprpg-system-fixes/scripts/argon-hud/basic-actions.js';

function fixture(use = async () => ({})) {
  const first = {id:'a',name:'Ataque',type:'attack',activation:{type:'action'},use};
  const second = {id:'b',name:'Área',type:'save',activation:{type:'powerful'},use};
  const item = {id:'i',name:'Técnica',type:'spell',system:{activities:new Map([['a',first],['b',second]])}};
  const actor = {id:'actor',uuid:'Actor.actor',isOwner:true,items:new Map([['i',item]])};
  item.parent = actor; first.item = second.item = item;
  return {actor,item,first,second};
}

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
});

test('integration is optional, idempotent and refuses the legacy adapter or unsupported CORE', () => {
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
