import { SYSTEM_ID } from "./settings.js";

/** Small compatibility layer between the HUD and OPRPG internals. */
export const OPRPG = {
  getPP(actor) {
    const publicGet = game.oprpg?.getPP;
    if (typeof publicGet === "function") return publicGet(actor);
    const energy = actor?.system?.energy ?? {};
    return {
      current: Number(energy.total ?? 0),
      max: Number(energy.max ?? 0),
      generated: Number(energy.generated ?? 0)
    };
  },

  getActivities(item) {
    const publicGet = game.oprpg?.getActivities;
    if (typeof publicGet === "function") return publicGet(item);
    const activities = item?.system?.activities;
    return Array.from(activities?.values?.() ?? activities ?? []);
  },

  getMovement(actor) {
    const publicGet = game.oprpg?.getMovement;
    if (typeof publicGet === "function") return publicGet(actor);
    return actor?.system?.attributes?.movement ?? {};
  },

  hasHaki(actor) {
    const haki = actor?.getFlag?.(SYSTEM_ID, "haki");
    return !!haki && Object.keys(haki?.talentos ?? {}).length > 0;
  },

  async openHaki(actor) {
    // Prefer a future public API if OPRPG exposes one.
    const publicOpen = game.oprpg?.openHakiHud ?? game.oprpg?.applications?.openHakiHud;
    if (typeof publicOpen === "function") return publicOpen(actor);

    // OPRPG 1.0.20 / 1.0.21-local fallback.
    const mod = await import("/systems/oprpg-system/module/applications/actor/haki-hud.mjs");
    const HakiHud = mod.default ?? mod.OprpgHakiHud;
    if (typeof HakiHud?.openFor !== "function") throw new Error("API do HUD de Haki não encontrada.");
    return HakiHud.openFor(actor);
  }
};
