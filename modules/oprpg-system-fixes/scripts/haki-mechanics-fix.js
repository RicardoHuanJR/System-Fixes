import {SYSTEM, level, damageDie} from "./haki-unified-rules.js";
import { MODULE_ID, canAct } from './shared.js';
import { registerActorTimer, queueActor } from './automation-runtime.js';

let durationInstalled=false;
export function installCorpoDuration() {
  if(durationInstalled)return;durationInstalled=true;
  registerActorTimer('corpo-armadurado',a=>!!a.getFlag(SYSTEM,'corpoArmaduradoAtivo'),a=>{
    if(!canAct(a))return;
    return queueActor(a,async()=>{
      if(!a.getFlag(SYSTEM,'corpoArmaduradoAtivo'))return;
      const started=a.getFlag(MODULE_ID,'corpoStarted');
      if(started==null){await a.setFlag(MODULE_ID,'corpoStarted',Number(game.time.worldTime));return;}
      if(Number(game.time.worldTime)-Number(started)>=60)await a.update({[`flags.${SYSTEM}.corpoArmaduradoAtivo`]:false});
    });
  });
  Hooks.on('preUpdateActor',(actor,changes)=>{
    const active=changes[`flags.${SYSTEM}.corpoArmaduradoAtivo`] ?? foundry.utils.getProperty(changes,`flags.${SYSTEM}.corpoArmaduradoAtivo`);
    if(active===true&&!actor.getFlag(SYSTEM,'corpoArmaduradoAtivo'))changes[`flags.${MODULE_ID}.corpoStarted`]=Number(game.time.worldTime);
  });
}

const patchedModels = new WeakSet();
const patchedSheets = new WeakSet();

// The July system model still adds 20 Shield Points to Corpo Armadurado.
// Haki 2.1 replaces that benefit with resistance on Shield Points, and changes
// Armadura Suprema Avançada to 80 Shield Points plus 40 maximum HP.
export function installCharacterModel(CharacterData) {
  const original = CharacterData?.prototype?.prepareDerivedData;
  if (typeof original !== "function" || patchedModels.has(CharacterData.prototype)) return false;
  // A later system release may implement 2.1 itself. Do not stack bonuses.
  if (!original.toString().includes("shieldMax += 20")) return false;
  patchedModels.add(CharacterData.prototype);
  CharacterData.prototype.prepareDerivedData = function (...args) {
    const result = original.apply(this, args);
    const actor = this.parent;
    const def = level(actor, "endurecimento-defensivo");
    const body = level(actor, "corpo-armadurado");
    const supreme = level(actor, "armadura-suprema");
    const defensiveActive = !!actor.getFlag(SYSTEM, "enduDefensivoAtivo");
    const bodyActive = !!actor.getFlag(SYSTEM, "corpoArmaduradoAtivo");
    if (this.shieldPoints) {
      let max = Number(this.shieldPoints.max) || 0;
      if (defensiveActive && def && bodyActive && body >= 2) max = Math.max(0, max - 20);
      if (defensiveActive && def >= 3 && supreme >= 3) max = Math.max(max, 80);
      this.shieldPoints.max = max;
      this.shieldPoints.value = Math.min(Number(this.shieldPoints.value) || 0, max);
    }
    if (supreme >= 3 && Number.isFinite(this.attributes?.hp?.max)) this.attributes.hp.max += 40;
    return result;
  };
  return true;
}

export async function toggleCorpo(actor, announce) {
  if (!level(actor, "corpo-armadurado")) return false;
  if (actor.getFlag(SYSTEM, "corpoArmaduradoAtivo")) {
    await actor.setFlag(SYSTEM, "corpoArmaduradoAtivo", false);
    await announce(actor, `<strong>Corpo Armadurado</strong> de ${foundry.utils.escapeHTML(actor.name)} foi encerrado.`);
    return true;
  }
  if (actor.getFlag(SYSTEM, "corpoArmaduradoUsado")) {
    ui.notifications.warn("Corpo Armadurado sem usos disponíveis.");
    return false;
  }
  await actor.update({[`flags.${SYSTEM}.corpoArmaduradoAtivo`]: true,
    [`flags.${MODULE_ID}.corpoStarted`]: Number(game.time.worldTime),
    [`flags.${SYSTEM}.corpoArmaduradoUsado`]: true});
  const body = level(actor, "corpo-armadurado");
  let details = "+2 em Salvaguardas por 1 minuto";
  if (body >= 2) details += "; os Pontos de Escudo resistem a todos os demais tipos, exceto Verdadeiro";
  const die = damageDie(actor);
  if (body >= 3 && die) details += `; Endurecimento Ofensivo concede +${die} de dano`;
  await announce(actor, `<strong>${foundry.utils.escapeHTML(actor.name)}</strong> ativou <strong>Corpo Armadurado</strong>: ${details}.`);
  return true;
}

export function installSheetCorpo(Sheet, announce, ensureUse) {
  if (!Sheet?.prototype?._onCorpoArmadurado || patchedSheets.has(Sheet.prototype)) return;
  patchedSheets.add(Sheet.prototype);
  Sheet.prototype._onCorpoArmadurado = async function () {
    const actor = this.actor;
    if (!actor.getFlag(SYSTEM, "corpoArmaduradoAtivo") && actor.getFlag(SYSTEM, "corpoArmaduradoUsado")) {
      if (!await ensureUse(actor)) return;
    }
    return toggleCorpo(actor, announce);
  };
}
