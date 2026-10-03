import { MODULE_ID, STATE } from "./shared.js";
import { currentRollMode } from "./roll-privacy.js";
import { HAKI_SCOPE as ID, SYSTEM, RESOURCES, MAJESTY, level, resourceState, remainingUpdate,
  damageDie, resetUpdates, readHakiFlag, migrateHakiFlags } from "./haki-unified-rules.js";
import { applyContentFix } from "./haki-content-fix.js";
import { installStagePresentation } from "./haki-stages-fix.js";
import { installCharacterModel, installSheetCorpo, toggleCorpo, installCorpoDuration } from "./haki-mechanics-fix.js";
import { installCardDamageRefresh } from "./haki-card-damage-fix.js";
import { queueActor } from './automation-runtime.js';

const concentrationSnapshots=new WeakMap();
const boundRoots = new WeakSet();
const boundChat = new WeakSet();
let concentrationInstalled=false;
const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const pathValue = (object, path) => object?.[path] ?? foundry.utils.getProperty(object, path);
const session = actor => readHakiFlag(actor, "anteSession") ?? "legacy";
const concentrationKind = actor => actor.getFlag(SYSTEM, "antevisaoModo") === "padrao" ? "antevisao"
  : readHakiFlag(actor, "presenceActive") === true ? "presenca" : null;
const concentrating = actor => !!concentrationKind(actor);
const concentrationName = kind => kind === "presenca" ? "Perceber Presença" : "Antevisão";
export function concentrationDamage(before, changes) {
  const previous = before?.attributes?.hp ?? before?.hp ?? {};
  const current = pathValue(changes, "system.attributes.hp") ?? {};
  const oldHP = Number(previous.value), oldTemp = Number(previous.temp ?? 0);
  const newHP = Number(pathValue(changes, "system.attributes.hp.value") ?? current.value ?? oldHP);
  const newTemp = Number(pathValue(changes, "system.attributes.hp.temp") ?? current.temp ?? oldTemp);
  if(!Number.isFinite(oldHP)||!Number.isFinite(oldTemp)||!Number.isFinite(newHP)||!Number.isFinite(newTemp))return 0;
  return Math.max(0,oldHP-newHP)+Math.max(0,oldTemp-newTemp);
}
export const concentrationDC = damage => Math.max(10,Math.floor(Math.max(0,Number(damage)||0)/2));
function captureConcentration(actor){
  if(!actor?.system?.attributes?.hp)return;
  const hp=actor.system.attributes.hp;
  concentrationSnapshots.set(actor,{hp:Number(hp.value),temp:Number(hp.temp??0),kind:concentrationKind(actor),session:session(actor)});
}

// One online client is responsible for automatic prompts and clean-up.
function authority(actor) {
  const players = game.users.filter(u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
  const user = players.sort((a, b) => a.id.localeCompare(b.id))[0] ?? game.users.activeGM;
  return user?.id === game.user.id && actor.isOwner;
}

function enqueue(actor, task) {
  return queueActor(actor,task,'haki');
}
export function registerConcentrationSettings(){
  game.settings.register(MODULE_ID,'concentrationPromptMode',{name:'Testes de concentração',hint:'Pendentes: mantém os testes no chat e no Painel Fixes sem abrir várias janelas. Automático: abre a rolagem a cada dano.',scope:'client',config:true,type:String,choices:{pending:'Pendentes no painel',automatic:'Abrir automaticamente'},default:'pending'});
}
export function pendingConcentration(actor){
  return Array.from(game.messages??[]).filter(m=>{const c=readHakiFlag(m, 'check');return c?.actor===actor?.uuid&&c.state==='pending'&&c.session===session(actor)&&(!c.kind||c.kind===concentrationKind(actor));});
}
export async function resolvePendingConcentration(actor,message){
  if(!actor||!authority(actor))throw Error('O teste deve ser feito pelo jogador responsável ou pelo mestre quando ele estiver offline.');
  if(readHakiFlag(message,'check')?.actor!==actor.uuid)throw Error('Selecione um teste pendente desta ficha.');
  return enqueue(actor,()=>resolveConcentration(actor,message));
}
function report(error) {
  console.error(`${ID} |`, error);
  ui.notifications.error(`Haki Unificado: ${error.message ?? error}`);
}
async function chat(actor, text) {
  const data = {speaker: ChatMessage.getSpeaker({actor}),
    content: `<div class="haki-auto-chat">${text}</div>`};
  ChatMessage.applyRollMode(data, currentRollMode());
  return ChatMessage.create(data);
}

let installed = false;
let talents;
const patchedHud = new WeakSet();
const patchedSheet = new WeakSet();

function installDamageHud(Sheet) {
  const proto = Sheet?.prototype;
  if (!proto || patchedSheet.has(proto)) return true;
  patchedSheet.add(proto);
  const prepareSidebar = proto._prepareSidebarContext;
  if (typeof prepareSidebar === "function") {
    proto._prepareSidebarContext = async function (context, ...args) {
      const result = await prepareSidebar.call(this, context, ...args);
      const die = damageDie(this.actor);
      if (context?.hakiArma && die) context.hakiArma.ofensivoBonus = die;
      return result;
    };
  }

  const toggle = proto._onToggleHakiArma;
  if (typeof toggle === "function") {
    proto._onToggleHakiArma = async function (type, ...args) {
      const actor = this.actor;
      if (type !== "ofensivo" || !level(actor, "endurecimento-ofensivo")
        || actor.getFlag(SYSTEM, "enduOfensivoAtivo")
        || !actor.getFlag(SYSTEM, "corpoArmaduradoAtivo") || level(actor, "corpo-armadurado") < 3) {
        return toggle.call(this, type, ...args);
      }
      await actor.setFlag(SYSTEM, "enduOfensivoAtivo", true);
      STATE.hakiUnifiedLast = { actor: actor.name, action: "endurecimento-ofensivo-boosted", die: damageDie(actor), at: Date.now() };
      return ChatMessage.create({speaker: ChatMessage.getSpeaker({actor}),
        content: `<strong>${foundry.utils.escapeHTML(actor.name)}</strong> ativou o <strong>Endurecimento Ofensivo</strong> (+${damageDie(actor)} de dano em ataques com arma, com Corpo Armadurado Avançado).`});
    };
  }
  STATE.hakiDamageHudPatch = true;
  return true;
}

export async function installUnifiedHakiFixes() {
  if (installed) return true;
  if (game.system.id !== SYSTEM) return false;

  const external = game.modules?.get("oprpg-haki-automations");
  if (external?.active) {
    STATE.hakiUnifiedDeferredExternal = true;
    STATE.warnings.push("OPRPG — Haki Unificado externo está ativo. A integração interna do System Fixes foi adiada para evitar dois patches sobre o mesmo HUD; desative o módulo externo e recarregue.");
    if (game.user?.isGM) ui.notifications.warn("OPRPG System Fixes: desative o módulo separado ‘OPRPG — Haki Unificado’. As correções dele já estão integradas e duas cópias não devem ficar ativas.");
    return false;
  }

  try {
    const actors=new Map();
    for(const a of game.actors ?? [])actors.set(a.uuid,a);
    for(const scene of game.scenes ?? [])for(const token of scene.tokens ?? [])if(token.actor)actors.set(token.actor.uuid,token.actor);
    if(game.user.isGM)for(const a of actors.values())await migrateHakiFlags(a);
    const root = new URL(`../../../systems/${SYSTEM}/module/`, import.meta.url);
    const [data, {default: Hud}, {default: Sheet}, {default: Screen}, {default: CharacterData}] = await Promise.all([
      import(new URL("systems/haki-talentos.mjs", root).href),
      import(new URL("applications/actor/haki-hud.mjs", root).href),
      import(new URL("applications/actor/character-sheet.mjs", root).href),
      import(new URL("applications/actor/haki-screen.mjs", root).href),
      import(new URL("data/actor/character.mjs", root).href)
    ]);
    talents = data;
    if (!talents.HAKI_TALENTOS_BY_ID || !Hud.prototype._prepareContext) throw new Error("Esta versão do sistema não expõe o HUD de Haki esperado.");
    if (game.user?.isGM && game.modules?.get("oprpg-haki-content-fix")?.active) {
      ui.notifications.warn("OPRPG System Fixes: desative o módulo antigo ‘OPRPG — Correção de Haki’; as descrições corrigidas já estão integradas.");
    }
    applyContentFix(talents);
    STATE.hakiContentPatch = true;
    installHud(Hud);
    installDamageHud(Sheet);
    installCardDamageRefresh();
    installStagePresentation(Sheet, Screen);
    installCharacterModel(CharacterData);
    installCorpoDuration();
    installSheetCorpo(Sheet, chat, actor => ensureUse(actor,
      RESOURCES.find(r => r.id === "corpo-armadurado")));
    installConcentration();
    installRecovery();
    for (const app of foundry.applications.instances.values()) if (app instanceof Hud) app.render();
    installed = true;
    STATE.hakiUnifiedPatch = true;
    STATE.hakiHudPatch = true;
    STATE.hakiAntevisaoPatch = true;
    STATE.hakiRecoveryPatch = true;
    console.info(`${MODULE_ID} | Haki Unificado integrado: conteúdo, HUD e automações carregados.`);
    return true;
  } catch (error) {
    report(error);
    return false;
  }
}


function counterItem(actor, item, spec) {
  const state = resourceState(actor, spec);
  if (!state) return item;
  return {...item, id: spec.button ?? spec.id, nome: spec.name, counter: true,
    toggle: false, info: false, pp: null, perTurn: false, max: state.max, rem: state.rem,
    esgotado: state.rem === 0,
    pips: Array.from({length: state.max}, (_, i) => ({filled: i < state.rem}))};
}

function installHud(Hud) {
  const proto = Hud?.prototype;
  if (!proto || patchedHud.has(proto)) return true;
  const prepare = proto._prepareContext;
  const render = proto._onRender;
  const useNative = Hud.DEFAULT_OPTIONS?.actions?.["hud-use"];
  if (typeof prepare !== "function" || typeof render !== "function" || typeof useNative !== "function") {
    throw new Error("HUD de Haki não expõe _prepareContext/_onRender/hud-use compatíveis.");
  }
  patchedHud.add(proto);

  proto._prepareContext = async function (...args) {
    const context = await prepare.apply(this, args);
    for (const section of context.sections ?? []) {
      section.items = section.items.flatMap(item => {
        if (item.id === "antevisao") {
          const rank = level(this.actor, "antevisao");
          const mode = this.actor.getFlag(SYSTEM, "antevisaoModo");
          return [
            {...item, nome: `Antevisão · Concentração (+${rank} CR)`, on: mode === "padrao"},
            {...item, id: "antevisao-reacao", nome: `Antevisão · Reação (+${rank + 1} CR)`, on: mode === "alternativa"}
          ];
        }
        if(item.id === "perceber-presenca")return [{...item,info:false,toggle:true,nome:`Perceber Presença · ${readHakiFlag(this.actor, "presenceActive")?"Concentrando":"Ativar"}`,on:readHakiFlag(this.actor, "presenceActive")===true}];
        if (item.id === "vidente") {
          const stored = readHakiFlag(this.actor, "videnteResults") ?? [];
          return [counterItem(this.actor, item, RESOURCES.find(r => r.id === "vidente")),
            ...stored.map((value, index) => ({...item, id: `vidente-usar-${index}`,
              nome: `Vidente · usar ${value}`, toggle: false, info: false, pp: null,
              perTurn: false, counter: false,
              desc: "Consome o d20 guardado para substituir manualmente um teste antes de saber se houve sucesso."}))];
        }
        if (item.id === MAJESTY.id) return [counterItem(this.actor, item, MAJESTY)];
        const spec = RESOURCES.find(r => r.id === item.id);
        if (!spec || !resourceState(this.actor, spec)) return [item];
        if (spec.id === "corpo-armadurado") {
          const state = resourceState(this.actor, spec);
          return [{...item, nome: `${spec.name} (${state.rem}/${state.max})`}];
        }
        const row = counterItem(this.actor, item, spec);
        if (spec.button) return [item, {...row, reference: null,
          desc: "Controla o uso limitado desta forma. Aplique o efeito à Técnica correspondente."}];
        return [row];
      });
    }
    return context;
  };

  proto._onRender = function (...args) {
    render.apply(this, args);
    const root = this.element;
    if (!root) return;
    root.querySelectorAll("[data-action='hud-use']").forEach(button => {
      if (!managed(button.dataset.id)) return;
      button.dataset.hakiManaged = "true";
      button.disabled = false;
      button.removeAttribute("aria-disabled");
    });
    root.querySelector(".haki-auto-summary")?.remove();
    const die = damageDie(this.actor);
    if (die) {
      const summary = document.createElement("div");
      summary.className = "haki-auto-summary";
      summary.textContent = `Endurecimento Ofensivo: +${die} de dano${
        this.actor.getFlag(SYSTEM, "corpoArmaduradoAtivo") && level(this.actor, "corpo-armadurado") >= 3
          ? " · Corpo Armadurado Avançado" : ""}`;
      root.querySelector(".oprpg-hud-body")?.append(summary);
    }
    if (boundRoots.has(root)) return;
    boundRoots.add(root);
    root.addEventListener("click", event => {
      const target = event.target.closest?.("[data-action='hud-use']");
      if (!target || !root.contains(target) || !managed(target.dataset.id)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!this.actor.isOwner) return;
      enqueue(this.actor, () => useHud(this, target.dataset.id, event, target, useNative)).catch(report);
    }, true);
  };
}

function managed(id) {
  return ["antevisao", "antevisao-reacao", "perceber-presenca", MAJESTY.id].includes(id)
    || /^vidente-usar-\d+$/.test(id ?? "")
    || RESOURCES.some(r => (r.button ?? r.id) === id);
}

async function useHud(app, id, event, target, useNative) {
  const actor = app.actor;
  if (id === "antevisao" || id === "antevisao-reacao") {
    await setAntevisao(actor, id === "antevisao" ? "padrao" : "alternativa");
  } else if(id === "perceber-presenca") {
    await togglePresence(actor);
  } else if (/^vidente-usar-\d+$/.test(id)) {
    await useVidenteResult(actor, Number(id.slice("vidente-usar-".length)));
  } else if (id === MAJESTY.id) {
    await chooseRecovery(actor);
  } else {
    const spec = RESOURCES.find(r => (r.button ?? r.id) === id);
    if (!spec || !level(actor, spec.id)) return;
    // Unlimited/initial forms retain their native informational action.
    if (!resourceState(actor, spec)) return useNative.call(app, event, target);
    if (id === "corpo-armadurado" && actor.getFlag(SYSTEM, "corpoArmaduradoAtivo")) {
      await toggleCorpo(actor, chat);
    } else {
      if (!await ensureUse(actor, spec)) return;
      if (id === "corpo-armadurado") {
        await toggleCorpo(actor, chat);
        const die = damageDie(actor);
        if (die && level(actor, id) >= 3) {
          await chat(actor, `<strong>Corpo Armadurado Avançado</strong>: o bônus de Endurecimento Ofensivo agora é <strong>+${esc(die)}</strong>.`);
        }
      } else {
        const state = resourceState(actor, spec);
        await actor.update(remainingUpdate(spec, state.rem - 1));
        if (id === "vidente") {
          const roll = await new Roll("1d20").evaluate();
          const stored = readHakiFlag(actor, "videnteResults") ?? [];
          await actor.setFlag(ID, "videnteResults", [...stored, roll.total]);
          await roll.toMessage({speaker: ChatMessage.getSpeaker({actor}),
            flavor: `Vidente — resultado guardado: ${roll.total}. Para consumi-lo, use o botão correspondente no HUD antes de saber o sucesso do teste.`},
          {rollMode: currentRollMode()});
        } else {
          const t = talents.HAKI_TALENTOS_BY_ID[spec.id];
          const text = spec.min === 3 ? t?.avancada : spec.min === 2 ? t?.dominada : t?.base;
          await chat(actor, `<strong>${esc(spec.name)}</strong> — ${esc(actor.name)}<p>${text ?? ""}</p>Restam ${state.rem - 1}/${state.max} usos.`);
        }
      }
    }
  }
  STATE.hakiUnifiedUses = Number(STATE.hakiUnifiedUses ?? 0) + 1;
  STATE.hakiUnifiedLast = { actor: actor.name ?? actor.id, action: id, at: Date.now() };
  app.render();
}

async function useVidenteResult(actor, index) {
  const stored = readHakiFlag(actor, "videnteResults") ?? [];
  const value = stored[index];
  if (!Number.isFinite(Number(value))) return;
  const confirmed = await foundry.applications.api.DialogV2.confirm({classes:['oprpg-fixes-dialog'],
    window: {title: "Vidente — consumir resultado"},
    content: `<p>Substituir o resultado de um Teste de Atributo ou Salvaguarda já rolado por <strong>${esc(value)}</strong>?</p><p>Decida antes de saber se o teste foi bem-sucedido. A substituição no teste é manual.</p>`,
    yes: {label: "Consumir resultado"}, no: {label: "Cancelar"}, rejectClose: false
  });
  if (!confirmed) return;
  const current = readHakiFlag(actor, "videnteResults") ?? [];
  if (current[index] !== value) return ui.notifications.warn("O resultado de Vidente mudou. Abra o HUD novamente.");
  await actor.setFlag(ID, "videnteResults", current.filter((_, i) => i !== index));
  await chat(actor, `<strong>${esc(actor.name)}</strong> consumiu <strong>Vidente</strong> para substituir manualmente o resultado de um Teste de Atributo ou Salvaguarda por <strong>${esc(value)}</strong>.`);
}

async function ensureUse(actor, spec) {
  const state = resourceState(actor, spec);
  if (!state) return false;
  if (state.rem > 0) return true;
  const recovery = resourceState(actor, MAJESTY);
  if (!recovery?.rem) {
    ui.notifications.warn(`${spec.name}: usos esgotados${recovery ? "; Superação Majestosa também está esgotada" : ""}.`);
    return false;
  }
  const yes = await foundry.applications.api.DialogV2.confirm({classes:['oprpg-fixes-dialog'],
    window: {title: "Superação Majestosa"},
    content: `<p><strong>${esc(spec.name)}</strong> está sem usos.</p><p>Gastar 1 uso de <strong>Superação Majestosa</strong> para recuperar 1 uso e utilizar esta característica agora?</p><p>Disponíveis: ${recovery.rem}/${recovery.max}. Superação usa uma ação bônus.</p>`,
    yes: {label: "Recuperar e usar"}, no: {label: "Cancelar"}, rejectClose: false
  });
  if (!yes) return false;
  // A rest or another HUD may have changed the actor while the dialog was open.
  if ((resourceState(actor, spec)?.rem ?? 0) > 0) return true;
  return recoverOne(actor, spec);
}

async function recoverOne(actor, spec) {
  if (spec.id === MAJESTY.id) return false;
  const source = resourceState(actor, MAJESTY), target = resourceState(actor, spec);
  if (!source?.rem || !target || target.rem >= target.max) return false;
  await actor.update({...remainingUpdate(MAJESTY, source.rem - 1),
    ...remainingUpdate(spec, target.rem + 1)});
  await chat(actor, `<strong>${esc(actor.name)}</strong> usou <strong>Superação Majestosa</strong> em <strong>${esc(spec.name)}</strong>, recuperando <strong>1 uso</strong>. Restam ${source.rem - 1}/${source.max} usos de Superação Majestosa.`);
  return true;
}

async function chooseRecovery(actor) {
  const source = resourceState(actor, MAJESTY);
  if (!source?.rem) return ui.notifications.warn("Superação Majestosa sem usos disponíveis.");
  const eligible = RESOURCES.filter(spec => {
    const state = resourceState(actor, spec);
    return state && state.rem < state.max;
  });
  if (!eligible.length) return ui.notifications.info("Nenhuma característica de Haki precisa recuperar usos.");
  const id = await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],
    window: {title: "Superação Majestosa — recuperar 1 uso"},
    content: `<p>Gasta uma ação bônus e 1 uso de Superação Majestosa (${source.rem}/${source.max}).</p>
      <label>Característica <select name="haki-recovery">${eligible.map(spec =>
        `<option value="${spec.id}">${esc(spec.name)}</option>`).join("")}</select></label>`,
    buttons: [{action: "recover", label: "Recuperar", default: true,
      callback: (_event, _button, dialog) => dialog.element.querySelector("[name='haki-recovery']").value},
    {action: "cancel", label: "Cancelar", callback: () => null}], rejectClose: false, close: () => null
  });
  const spec = eligible.find(r => r.id === id);
  if (spec) await recoverOne(actor, spec);
}

async function clearAntevisao(actor) {
  const ids = actor.effects.filter(e => e.getFlag(SYSTEM, "antevisaoEffect")).map(e => e.id);
  // Clear the mode first; effect deletion hooks must not mistake a mode switch for a new activation.
  await actor.update({[`flags.${SYSTEM}.antevisaoModo`]: "", [`flags.${ID}.anteSession`]: ""});
  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
}
async function clearPresence(actor) {
  const ids=actor.effects.filter(e=>readHakiFlag(e, "presenceEffect")).map(e=>e.id);
  await actor.update({[`flags.${ID}.presenceActive`]:false,[`flags.${ID}.anteSession`]:foundry.utils.randomID()});
  if(ids.length)await actor.deleteEmbeddedDocuments("ActiveEffect",ids);
}
async function togglePresence(actor) {
  const active=readHakiFlag(actor, "presenceActive")===true;
  if(active){await clearPresence(actor);await chat(actor,`<strong>${esc(actor.name)}</strong> encerrou Perceber Presença.`);return;}
  if(!level(actor,"perceber-presenca"))return;
  if(actor.concentration?.effects?.size)await actor.endConcentration();
  await clearAntevisao(actor);
  await actor.createEmbeddedDocuments("ActiveEffect",[{name:"Perceber Presença (Concentração)",img:"icons/svg/eye.svg",flags:{[ID]:{presenceEffect:true}}}]);
  await actor.update({[`flags.${ID}.presenceActive`]:true,[`flags.${ID}.anteSession`]:foundry.utils.randomID()});
  const reach=level(actor,"perceber-presenca")>=2?12:6;
  await chat(actor,`<strong>${esc(actor.name)}</strong> ativou Perceber Presença: criaturas vivas a até ${reach} m, enquanto mantiver Concentração. A forma avançada também permite perceber o estado físico descrito no talento.`);
}
async function setAntevisao(actor, mode) {
  const rank = level(actor, "antevisao");
  if (!rank) return;
  const previous = actor.getFlag(SYSTEM, "antevisaoModo");
  if(mode==="padrao"&&actor.concentration?.effects?.size)await actor.endConcentration();
  if(mode==="padrao"&&readHakiFlag(actor, "presenceActive"))await clearPresence(actor);
  await clearAntevisao(actor);
  if (previous === mode) {
    await chat(actor, `<strong>${esc(actor.name)}</strong> encerrou a <strong>Antevisão</strong>.`);
    return;
  }
  const bonus = rank + (mode === "alternativa" ? 1 : 0);
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: `Antevisão (${mode === "padrao" ? "Concentração" : "Reação"})`, img: "icons/svg/eye.svg",
    changes: [{key: "system.attributes.ac.bonus", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(bonus)}],
    flags: {[SYSTEM]: {antevisaoEffect: true}, [ID]: {mode}}
  }]);
  await actor.update({[`flags.${SYSTEM}.antevisaoModo`]: mode,
    [`flags.${ID}.anteSession`]: foundry.utils.randomID()});
  await chat(actor, `<strong>${esc(actor.name)}</strong> ativou <strong>Antevisão (${mode === "padrao" ? "Concentração" : "Reação"})</strong>: +${bonus} CR${mode === "alternativa" ? " até o início do próximo turno" : "; ação bônus, mantendo Concentração"}.`);
}

function installConcentration() {
  if(concentrationInstalled)return;
  concentrationInstalled=true;
  for(const actor of game.actors??[])captureConcentration(actor);
  for(const token of canvas?.tokens?.placeables??[])captureConcentration(token.actor);
  for(const combat of game.combats??[])for(const entry of combat.combatants??[])captureConcentration(entry.actor);
  Hooks.on("createActor",captureConcentration);
  Hooks.on("createToken",token=>captureConcentration(token.actor));
  Hooks.on("preUpdateActor", (actor, changes, options={}) => {
    const nextMode = pathValue(changes, `flags.${SYSTEM}.antevisaoModo`);
    const nextPresence=pathValue(changes,`flags.${ID}.presenceActive`);
    if (((nextMode !== undefined && nextMode !== actor.getFlag(SYSTEM, "antevisaoModo"))
      ||(nextPresence!==undefined&&nextPresence!==readHakiFlag(actor, "presenceActive")))
      && pathValue(changes, `flags.${ID}.anteSession`) === undefined) {
      changes[`flags.${ID}.anteSession`] = foundry.utils.randomID();
    }
    if (options.oprpgFixesResourceUndo||!concentrating(actor)||game.settings.get(SYSTEM,"disableConcentration")) return;
    const loss = concentrationDamage(actor.system,changes);
    if (!loss) return;
    options[ID] = {loss, session: session(actor), kind:concentrationKind(actor)};
  });
  Hooks.on("updateActor", (actor, _changes, options={}) => {
    const old=concentrationSnapshots.get(actor);
    const current=actor.system.attributes?.hp;
    const observed=old&&current?Math.max(0,old.hp-Number(current.value))+
      Math.max(0,old.temp-Number(current.temp??0)):0;
    const request=options[ID]??(observed>0&&old.kind&&old.session===session(actor)
      ?{loss:observed,session:old.session,kind:old.kind}:null);
    captureConcentration(actor);
    if(options.oprpgFixesResourceUndo)return;
    if(game.settings.get(SYSTEM,"disableConcentration"))return;
    if (!request?.loss || !authority(actor)) return;
    enqueue(actor, () => requestConcentration(actor, request)).catch(report);
  });
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    const button = root?.querySelector("[data-haki-concentration]");
    if (!button || boundChat.has(button)) return;
    boundChat.add(button);
    button.addEventListener("click", async event => {
      event.preventDefault(); event.stopPropagation();
      try {
        const info = readHakiFlag(message, "check");
        const actor = info && await fromUuid(info.actor);
        if (!actor || !authority(actor)) return ui.notifications.warn("O teste deve ser feito pelo jogador responsável pelo personagem ou pelo mestre quando ele estiver offline.");
        await enqueue(actor, () => resolveConcentration(actor, message));
      } catch (error) { report(error); }
    });
  });
  // Also clear the mode when the named effect is removed by the user.
  Hooks.on("deleteActiveEffect", effect => {
    const actor = effect.parent;
    if(!actor||!authority(actor))return;
    if(readHakiFlag(effect, "presenceEffect")&&readHakiFlag(actor, "presenceActive")
      &&!actor.effects.some(e=>readHakiFlag(e, "presenceEffect"))){
      enqueue(actor,async()=>{if(!actor.effects.some(e=>readHakiFlag(e, "presenceEffect")))await clearPresence(actor)}).catch(report);
    }
    if (!effect.getFlag(SYSTEM, "antevisaoEffect")) return;
    if (!actor.effects.some(e => e.getFlag(SYSTEM, "antevisaoEffect")) && actor.getFlag(SYSTEM, "antevisaoModo")) {
      enqueue(actor, async () => {
        if (!actor.effects.some(e => e.getFlag(SYSTEM, "antevisaoEffect"))) await clearAntevisao(actor);
      }).catch(report);
    }
  });
  Hooks.on("dnd5e.beginConcentrating",(actor)=>{
    if(!actor||!authority(actor)||!concentrating(actor))return;
    enqueue(actor,async()=>{if(readHakiFlag(actor, "presenceActive"))await clearPresence(actor);else if(actor.getFlag(SYSTEM,"antevisaoModo")==="padrao")await clearAntevisao(actor)}).catch(report);
  });
  // Native system handles characters; this also covers NPC HUDs.
  Hooks.on("combatTurnChange", (combat, _prior, current) => {
    const actor = combat?.combatants?.get(current?.combatantId)?.actor;
    if (!actor || actor.type === "character" || !authority(actor)) return;
    enqueue(actor, async () => {
      if (actor.getFlag(SYSTEM, "antevisaoModo") === "alternativa") {
        await clearAntevisao(actor);
        await chat(actor, `<strong>Antevisão (Reação)</strong> de ${esc(actor.name)} terminou no início do turno.`);
      }
    }).catch(report);
  });
}

async function requestConcentration(actor, request) {
  if (!concentrating(actor) || session(actor) !== request.session || concentrationKind(actor)!==request.kind) return;
  if ((actor.system.attributes.hp.value ?? 0) <= 0) {
    if(request.kind==="presenca")await clearPresence(actor);else await clearAntevisao(actor);
    await chat(actor, `<strong>${esc(actor.name)}</strong> chegou a 0 PV e encerrou a concentração de ${concentrationName(request.kind)}.`);
    return;
  }
  const dc = concentrationDC(request.loss);
  const name=concentrationName(request.kind);
  const data = {speaker: ChatMessage.getSpeaker({actor}),
    content: `<div class="haki-auto-chat"><strong>${name} — Concentração</strong><p>${esc(actor.name)} sofreu ${request.loss} de dano. CD ${dc}.</p><button type="button" data-haki-concentration>Rolar concentração pendente</button></div>`,
    whisper: game.users.filter(u => u.isGM || actor.testUserPermission(u, "OWNER")).map(u => u.id),
    flags: {[ID]: {check: {actor: actor.uuid, dc, session: request.session, kind:request.kind, state: "pending"}}}};
  const message = await ChatMessage.create(data);
  if(game.settings.get(MODULE_ID,'concentrationPromptMode')!=='pending')await resolveConcentration(actor, message);
}

async function resolveConcentration(actor, message) {
  const info = readHakiFlag(message, "check");
  if (!info || info.state !== "pending") return;
  if (!concentrating(actor) || session(actor) !== info.session || (info.kind&&concentrationKind(actor)!==info.kind)) {
    await message.update({[`flags.${ID}.check.state`]: "obsolete", content: "Teste de concentração encerrado: aquela característica já terminou."});
    return;
  }
  const name=concentrationName(info.kind);
  // Native method preserves bonuses, advantage, ability, proficiency and roll mode.
  const rolls = await actor.rollConcentration({target: info.dc},
    {options: {window: {title: `${name} — Concentração (CD ${info.dc})`}}},
    {rollMode:actor.type==="npc"?"gmroll":currentRollMode()});
  const roll = Array.isArray(rolls) ? rolls[0] : rolls;
  if (!roll || !Number.isFinite(roll.total)) return; // Cancellation leaves the pending chat button.
  const success = roll.isSuccess ?? roll.total >= info.dc;
  if (!success && concentrating(actor) && session(actor) === info.session){if(info.kind==="presenca")await clearPresence(actor);else await clearAntevisao(actor)}
  await message.update({[`flags.${ID}.check.state`]: "resolved",
    content: `<div class="haki-auto-chat"><strong>${name} — ${success ? "Concentração mantida" : "Concentração perdida"}</strong><p>${esc(actor.name)}: ${roll.total} contra CD ${info.dc}.</p></div>`});
}

function installRecovery() {
  Hooks.on("dnd5e.restCompleted", (actor, result, config={}) => {
    if (!authority(actor)) return;
    const long = result?.longRest === true || config?.longRest === true || [result?.type, result?.restType, config?.type, config?.restType].some(t => String(t ?? "").toLowerCase().includes("long"));
    enqueue(actor, async () => {
      const updates = resetUpdates(actor, !long);
      if (Object.keys(updates).length) await actor.update(updates);
    }).catch(report);
  });
}


export function unifiedHakiStatus(actor=null) {
  const current = actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game?.user?.character ?? null;
  return {
    installed: !!STATE.hakiUnifiedPatch,
    deferredBecauseExternalModuleActive: !!STATE.hakiUnifiedDeferredExternal,
    content: !!STATE.hakiContentPatch,
    hud: !!STATE.hakiHudPatch,
    antevisao: !!STATE.hakiAntevisaoPatch,
    recovery: !!STATE.hakiRecoveryPatch,
    damageHud: !!STATE.hakiDamageHudPatch,
    uses: Number(STATE.hakiUnifiedUses ?? 0),
    last: STATE.hakiUnifiedLast ?? null,
    actor: current ? { name: current.name, antevisaoMode: current.getFlag?.(SYSTEM, "antevisaoModo") ?? null, superacao: resourceState(current, MAJESTY) } : null
  };
}
