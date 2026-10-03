export const MODULE_ID = "enhancedcombathud-oprpg-system";
export const SYSTEM_ID = "oprpg-system";
export const TESTED_ARGON_VERSION = "5.0.1";
export const MIN_SYSTEM_VERSION = "1.0.20";

export function t(key) { return game.i18n.localize(`${MODULE_ID}.${key}`); }

function refresh() { ui.ARGON?.refresh?.(); setTimeout(() => globalThis.OPRPG_ARGON_LAYOUT_REFRESH?.(), 0); }
function relayout() { setTimeout(() => globalThis.OPRPG_ARGON_LAYOUT_REFRESH?.(), 0); }

export function registerSettings() {
  game.settings.register(MODULE_ID, "showBasicActions", {
    name: `${MODULE_ID}.settings.showBasicActions.name`, hint: `${MODULE_ID}.settings.showBasicActions.hint`,
    scope: "world", config: true, type: Boolean, default: true, onChange: refresh
  });

  // Legacy compatibility. Hidden in 6.1; weaponSetMode is the user-facing replacement.
  game.settings.register(MODULE_ID, "switchEquip", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, "weaponSetMode", {
    name: `${MODULE_ID}.settings.weaponSetMode.name`, hint: `${MODULE_ID}.settings.weaponSetMode.hint`,
    scope: "world", config: true, type: String, default: "visual",
    choices: { visual: `${MODULE_ID}.settings.weaponSetMode.visual`, equipment: `${MODULE_ID}.settings.weaponSetMode.equipment` }
  });

  for (const key of ["showFavorites", "showHaki", "showAkuma"]) {
    game.settings.register(MODULE_ID, key, {
      name: `${MODULE_ID}.settings.${key}.name`, hint: `${MODULE_ID}.settings.${key}.hint`,
      scope: "world", config: true, type: Boolean, default: true, onChange: refresh
    });
  }


  game.settings.register(MODULE_ID, "favoritesPlacement", {
    name: `${MODULE_ID}.settings.favoritesPlacement.name`, hint: `${MODULE_ID}.settings.favoritesPlacement.hint`,
    scope: "client", config: true, type: String, default: "special",
    choices: {
      special: `${MODULE_ID}.settings.favoritesPlacement.special`,
      main: `${MODULE_ID}.settings.favoritesPlacement.main`,
      hidden: `${MODULE_ID}.settings.favoritesPlacement.hidden`
    },
    onChange: refresh
  });
  game.settings.register(MODULE_ID, "favoritesMax", {
    name: `${MODULE_ID}.settings.favoritesMax.name`, hint: `${MODULE_ID}.settings.favoritesMax.hint`,
    scope: "client", config: true, type: Number, default: 8,
    range: { min: 1, max: 20, step: 1 }, onChange: refresh
  });

  game.settings.register(MODULE_ID, "diagnosticMode", {
    name: `${MODULE_ID}.settings.diagnosticMode.name`, hint: `${MODULE_ID}.settings.diagnosticMode.hint`,
    scope: "client", config: true, type: Boolean, default: false, onChange: refresh
  });

  game.settings.register(MODULE_ID, "movementMode", {
    name: `${MODULE_ID}.settings.movementMode.name`, hint: `${MODULE_ID}.settings.movementMode.hint`,
    scope: "client", config: true, type: String, default: "hidden",
    choices: { simple: `${MODULE_ID}.settings.movementMode.simple`, argon: `${MODULE_ID}.settings.movementMode.argon`, hidden: `${MODULE_ID}.settings.movementMode.hidden` },
    onChange: refresh
  });

  game.settings.register(MODULE_ID, "layoutPreset", {
    name: `${MODULE_ID}.settings.layoutPreset.name`, hint: `${MODULE_ID}.settings.layoutPreset.hint`,
    scope: "client", config: true, type: String, default: "normal",
    choices: { compact: `${MODULE_ID}.settings.layoutPreset.compact`, normal: `${MODULE_ID}.settings.layoutPreset.normal`, large: `${MODULE_ID}.settings.layoutPreset.large` },
    onChange: relayout
  });
  // Retained as a hidden legacy setting so existing worlds do not complain
  // about an unknown key. Since 6.3.0 utility controls always anchor after
  // the full Weapon Sets strip.
  game.settings.register(MODULE_ID, "utilityAnchor", {
    name: `${MODULE_ID}.settings.utilityAnchor.name`, hint: `${MODULE_ID}.settings.utilityAnchor.hint`,
    scope: "client", config: false, type: String, default: "all",
    choices: { active: `${MODULE_ID}.settings.utilityAnchor.active`, all: `${MODULE_ID}.settings.utilityAnchor.all` }, onChange: relayout
  });
  game.settings.register(MODULE_ID, "utilityGap", {
    name: `${MODULE_ID}.settings.utilityGap.name`, hint: `${MODULE_ID}.settings.utilityGap.hint`,
    scope: "client", config: true, type: Number, default: 14, range: { min: 4, max: 36, step: 1 }, onChange: relayout
  });
  game.settings.register(MODULE_ID, "utilityOffset", {
    name: `${MODULE_ID}.settings.utilityOffset.name`, hint: `${MODULE_ID}.settings.utilityOffset.hint`,
    scope: "client", config: true, type: Number, default: 12, range: { min: 0, max: 80, step: 1 }, onChange: relayout
  });
  game.settings.register(MODULE_ID, "techniqueOffsetX", {
    name: `${MODULE_ID}.settings.techniqueOffsetX.name`, hint: `${MODULE_ID}.settings.techniqueOffsetX.hint`,
    scope: "client", config: true, type: Number, default: 0, range: { min: -80, max: 80, step: 1 }, onChange: relayout
  });
}

export function checkRuntimeCompatibility() {
  const argon = game.modules.get("enhancedcombathud");
  if (!argon?.active) return;
  if (argon.version !== TESTED_ARGON_VERSION) console.warn(`Argon OPRPG | Argon ${argon.version} detectado; versão testada: ${TESTED_ARGON_VERSION}.`);
  if (game.system.id === SYSTEM_ID && foundry.utils.isNewerVersion(MIN_SYSTEM_VERSION, game.system.version)) {
    ui.notifications.warn(game.i18n.format(`${MODULE_ID}.warnings.oldSystem`, { current: game.system.version, minimum: MIN_SYSTEM_VERSION }));
  }
}
