import { registerArgon } from "./argon.js";
import { diagnostics } from "./execute.js";
import { installBasicActionAutomation } from "./basic-actions.js";

const MODULE_ID = "oprpg-system-fixes";
const CORE_ID = "enhancedcombathud";
const OLD_ADAPTER_ID = "enhancedcombathud-oprpg-system";
const SYSTEM_ID = "oprpg-system";
let registered = false;
let hookInstalled = false;
let lastError = null;

function setting(key, fallback = true) {
  try { return game.settings.get(MODULE_ID, key); }
  catch (_) { return fallback; }
}

/** Optional integration: System Fixes keeps functioning if Argon CORE is absent. */
export function argonHUDStatus() {
  const oldAdapter = game.modules?.get(OLD_ADAPTER_ID);
  const core = game.modules?.get(CORE_ID);
  return {
    ...diagnostics({system:game.system, core, fixes:game.modules?.get(MODULE_ID), hud:globalThis.ui?.ARGON}),
    embedded: true, enabled: setting("argonHudEnabled"),
    oldAdapterActive: !!oldAdapter?.active, registered,
    lastError: lastError ? String(lastError?.message ?? lastError) : null
  };
}

export function registerArgonHUDSettings() {
  const options = [
    ["argonHudEnabled", "Argon: integrar HUD de combate", "Habilita os painéis OPRPG no Argon CORE 5.x, se estiver instalado. Desative antes de usar outro adaptador para OP RPG.", "world", true],
    ["argonShowMacros", "Argon: mostrar macros", "Mostra as macros da barra de atalhos no painel lateral.", "client", true],
    ["argonShowMovement", "Argon: mostrar deslocamento", "Mostra o deslocamento durante combate no HUD.", "client", true]
  ];
  for (const [key,name,hint,scope,value] of options) {
    game.settings.register(MODULE_ID, key, {name,hint,scope,config:true,type:Boolean,default:value,requiresReload:true});
  }
}

/** Install the hook at ES-module evaluation, before Argon constructs its HUD. */
export function installEmbeddedArgonHUD() {
  if (hookInstalled) return;
  hookInstalled = true;
  Hooks.on("argonInit", CoreHUD => {
    if (game.system?.id !== SYSTEM_ID || !setting("argonHudEnabled")) return;
    // Do not register two sets of action panels when the old standalone plugin is still enabled.
    if (game.modules?.get(OLD_ADAPTER_ID)?.active) {
      console.warn(`[${MODULE_ID}] Adaptador Argon separado ativo. Integração interna ignorada para evitar duplicação.`);
      return;
    }
    if (registered) return;
    // This adapter follows the Foundry V14 Argon CORE 5.x component API.
    const coreVersion = String(game.modules?.get(CORE_ID)?.version ?? "");
    const coreMajor = Number(coreVersion.split(".")[0]);
    if (coreVersion && coreMajor !== 5) {
      lastError = new Error(`Argon CORE ${coreVersion} não é a linha 5.x compatível com este adaptador.`);
      console.warn(`[${MODULE_ID}] ${lastError.message}`);
      return;
    }
    try {
      registerArgon(CoreHUD);
      installBasicActionAutomation();
      registered = true;
      lastError = null;
      // CORE tracks ItemButton subclasses; our activity buttons also need structural refreshes.
      for (const hook of ["updateItem", "createItem", "deleteItem", "updateActiveEffect", "createActiveEffect", "deleteActiveEffect"]) {
        Hooks.on(hook, document => {
          const actor = globalThis.ui?.ARGON?._actor;
          if (actor && (document.parent === actor || document.parent?.parent === actor)) refreshEmbeddedArgonHUD();
        });
      }
      Hooks.on("updateActor", actor => {
        if (actor === globalThis.ui?.ARGON?._actor) refreshEmbeddedArgonHUD();
      });
      console.info(`[${MODULE_ID}] Argon OPRPG integrado: painéis registrados no CORE.`);
    } catch (error) {
      lastError = error;
      console.error(`[${MODULE_ID}] Falha ao registrar HUD no Argon CORE`, error);
    }
  });
}

export function refreshEmbeddedArgonHUD() {
  return globalThis.ui?.ARGON?.refresh?.();
}
