import { MODULE_ID, SYSTEM_ID, TESTED_ARGON_VERSION, MIN_SYSTEM_VERSION, t } from "./settings.js";
import {
  activitiesOf, activityCanUse, activityType, movementInfo, ppCostInfo, resolveIcon
} from "./utils.js";
import { OPRPG } from "./oprpg-api.js";

export function buildDiagnostic(actor = ui.ARGON?._actor) {
  if (!actor) return { error: "Nenhum ator está vinculado ao Argon." };
  const rows = [];
  for (const item of actor.items) {
    const acts = activitiesOf(item);
    if (!acts.length) {
      rows.push({
        item: item.name, type: item.type, activity: "—", canUse: "—", activation: "—",
        itemImg: item.img, explicitActivityImg: "—", computedActivityImg: "—", resolvedImg: item.img,
        pp: "—", akumaTechnique: item.getFlag?.(SYSTEM_ID, "akumaTec") ?? "",
        akumaManifest: !!item.getFlag?.(SYSTEM_ID, "akumaManif")
      });
      continue;
    }
    for (const activity of acts) {
      const pp = ppCostInfo(activity);
      rows.push({
        item: item.name,
        type: item.type,
        activity: activity.name,
        uuid: activity.uuid,
        canUse: activityCanUse(activity),
        activation: activityType(activity) ?? "—",
        itemImg: item.img,
        explicitActivityImg: activity?._source?.img ?? "",
        computedActivityImg: activity?.img ?? "",
        resolvedImg: resolveIcon(activity),
        pp: pp.label ?? "—",
        ppDynamic: pp.dynamic,
        akumaTechnique: item.getFlag?.(SYSTEM_ID, "akumaTec") ?? "",
        akumaManifest: !!item.getFlag?.(SYSTEM_ID, "akumaManif")
      });
    }
  }

  const movement = ui.ARGON?._token
    ? movementInfo(actor, ui.ARGON._token, ui.ARGON._token.document?.movementAction || "walk")
    : null;
  const settingKeys = [
    "showBasicActions", "weaponSetMode", "showFavorites", "showHaki", "showAkuma",
    "movementMode", "layoutPreset", "utilityAnchor", "utilityGap", "utilityOffset", "techniqueOffsetX", "diagnosticMode",
    "favoritesPlacement", "favoritesMax"
  ];
  const settings = Object.fromEntries(settingKeys.map(key => {
    try { return [key, game.settings.get(MODULE_ID, key)]; }
    catch (_) { return [key, null]; }
  }));

  return {
    generatedAt: new Date().toISOString(),
    versions: {
      foundry: game.version,
      system: game.system.version,
      argon: game.modules.get("enhancedcombathud")?.version,
      adapter: game.modules.get(MODULE_ID)?.version
    },
    actor: {
      name: actor.name, id: actor.id, uuid: actor.uuid, type: actor.type,
      pp: OPRPG.getPP(actor),
      ac: actor.system?.attributes?.ac?.value,
      hp: actor.system?.attributes?.hp,
      movement
    },
    layout: {
      root: !!document.querySelector(".extended-combat-hud"),
      utilityAutoAligned: document.querySelector(".portrait-hud .player-buttons")?.dataset?.oprpgAutoAligned === "true",
      hudScaleX: Number(document.querySelector(".portrait-hud .player-buttons")?.dataset?.oprpgHudScaleX ?? 1),
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio }
    },
    settings,
    rows
  };
}

function downloadJSON(data, name) {
  const content = JSON.stringify(data, null, 2);
  if (typeof saveDataToFile === "function") return saveDataToFile(content, "application/json", name);
  const blob = new Blob([content], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportDiagnostic(actor = ui.ARGON?._actor) {
  const data = buildDiagnostic(actor);
  const safe = String(actor?.name ?? "sem-ator").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
  downloadJSON(data, `oprpg-argon-diagnostic-${safe || "actor"}.json`);
  return data;
}

async function checkTemplate(path) {
  try { const response = await fetch(path, { cache: "no-store" }); return response.ok; }
  catch (_) { return false; }
}

export async function selfTest(actor = ui.ARGON?._actor, {notify=true}={}) {
  const results = [];
  const add = (test, ok, detail="") => results.push({ test, ok: !!ok, detail });
  const argon = game.modules.get("enhancedcombathud");
  const adapter = game.modules.get(MODULE_ID);

  add("Foundry v14", String(game.version).startsWith("14."), game.version);
  add("OPRPG System ativo", game.system.id === SYSTEM_ID, `${game.system.id} ${game.system.version}`);
  add("OPRPG >= mínimo", !foundry.utils.isNewerVersion(MIN_SYSTEM_VERSION, game.system.version), game.system.version);
  add("Argon Core ativo", !!argon?.active, argon?.version ?? "não encontrado");
  add("Argon Core testado", argon?.version === TESTED_ARGON_VERSION, argon?.version ?? "—");
  add("Adaptador ativo", !!adapter?.active, adapter?.version ?? "—");
  add("Integração registrada", globalThis.OPRPG_ARGON_REGISTERED === true);
  add("Ações básicas automatizadas", globalThis.OPRPG_ARGON_BASIC_ACTIONS_INSTALLED === true);
  add("Portrait construído", !!ui.ARGON?.components?.portrait);
  add("Painéis principais", (ui.ARGON?.components?.main?.length ?? 0) >= 5, String(ui.ARGON?.components?.main?.length ?? 0));
  add("Ação Poderosa registrada", !!CONFIG.DND5E?.activityActivationTypes?.powerful);
  add("Template ActionPanel", await checkTemplate("modules/enhancedcombathud/templates/partials/ActionPanel.hbs"));
  add("Template ButtonPanelButton", await checkTemplate("modules/enhancedcombathud/templates/partials/ButtonPanelButton.hbs"));
  add("Ícone Favoritos", await checkTemplate("modules/enhancedcombathud-oprpg-system/icons/favorites-star.svg"));
  const controls = document.querySelector(".portrait-hud .player-buttons");
  const sets = document.querySelector(".weapon-sets");
  add("Layout automático", controls?.dataset?.oprpgAutoAligned === "true");
  if (controls && sets) {
    const cr = controls.getBoundingClientRect();
    const sr = sets.getBoundingClientRect();
    const gap = cr.left - sr.right;
    add("Controles após Weapon Sets", gap >= -2, `sets.right=${Math.round(sr.right)}, controls.left=${Math.round(cr.left)}, gap=${Math.round(gap)}px, scale=${controls.dataset.oprpgHudScaleX ?? "1"}`);
  }
  const duplicateIds = actor ? Array.from(actor.items ?? []).flatMap(activitiesOf).map(a => a.uuid).filter((v,i,a)=>v && a.indexOf(v)!==i) : [];
  add("UUIDs de Activities sem duplicação", duplicateIds.length === 0, duplicateIds.length ? duplicateIds.join(", ") : "OK");

  if (actor) {
    const activities = Array.from(actor.items ?? []).flatMap(activitiesOf);
    add("Actor vinculado", true, `${actor.name} (${actor.type})`);
    add("API de Activity", !activities.length || activities.some(a => typeof a.use === "function"), `${activities.length} activities`);
    const pp = OPRPG.getPP(actor);
    add("Pontos de Poder legíveis", Number.isFinite(pp.current) && Number.isFinite(pp.max), `${pp.current}/${pp.max}`);
    const effectFavs = Array.from(actor.system?.favorites ?? []).filter(f => f.type === "effect");
    const unresolved = effectFavs.filter(f => { try { return !fromUuidSync(f.id, {relative:actor, strict:false}); } catch (_) { return true; } });
    add("Favoritos de Active Effect", unresolved.length === 0, effectFavs.length ? `${effectFavs.length-unresolved.length}/${effectFavs.length} resolvidos` : "não aplicável");
  } else add("Actor vinculado", false, "Selecione um token para testes dependentes do ator.");

  if (actor && OPRPG.hasHaki(actor)) {
    try {
      const mod = await import("/systems/oprpg-system/module/applications/actor/haki-hud.mjs");
      add("HUD de Haki", typeof (mod.default ?? mod.OprpgHakiHud)?.openFor === "function");
    } catch (err) { add("HUD de Haki", false, err.message); }
  } else add("HUD de Haki", true, "não aplicável ao ator atual");

  const passed = results.filter(r => r.ok).length;
  const report = { passed, failed: results.length - passed, total: results.length, results };
  console.table(results.map(r => ({ teste: r.test, resultado: r.ok ? "OK" : "FALHA", detalhe: r.detail })));
  console.info("Argon OPRPG | Self Test", report);
  if (notify) {
    if (report.failed) ui.notifications.warn(`Argon OPRPG: ${report.failed}/${report.total} autotestes falharam. Veja o Console.`);
    else ui.notifications.info(`Argon OPRPG: ${report.total} autotestes aprovados.`);
  }
  return report;
}



export async function openCompatibilityPanel(actor = ui.ARGON?._actor) {
  const argonReport = await selfTest(actor, {notify:false});
  let fixesReport = null;
  try { fixesReport = globalThis.OPRPG_FIXES_SELF_TEST?.({log:false}) ?? null; } catch (error) { fixesReport = {error:error.message}; }
  const mod = game.modules.get(MODULE_ID);
  const fixes = game.modules.get("oprpg-system-fixes");
  const row = (label, value, ok=true) => `<tr><th>${label}</th><td class="${ok ? "ok" : "bad"}">${value}</td></tr>`;
  const html = `<div class="oprpg-compatibility-panel">
    <table><tbody>
      ${row("Foundry", game.version, String(game.version).startsWith("14."))}
      ${row("OPRPG System", game.system.version, game.system.id === SYSTEM_ID)}
      ${row("Argon Core", game.modules.get("enhancedcombathud")?.version ?? "—", game.modules.get("enhancedcombathud")?.active)}
      ${row("Argon OPRPG", mod?.version ?? "—", mod?.active)}
      ${row("System Fixes", fixes?.active ? fixes.version : "inativo", !fixes || fixes.active)}
      ${row("Autoteste HUD", `${argonReport.passed}/${argonReport.total}`, argonReport.failed === 0)}
      ${row("Autoteste Fixes", fixesReport?.total ? `${fixesReport.passed}/${fixesReport.total}` : (fixes?.active ? "indisponível" : "não instalado"), !fixes?.active || fixesReport?.passed === fixesReport?.total)}
    </tbody></table>
    <p class="hint">${t("hud.compatibilityHint")}</p>
  </div>`;
  return foundry.applications.api.DialogV2.wait({
    window:{title:t("hud.compatibility")}, content:html,
    buttons:[
      {label:t("hud.exportDiagnostic"), action:"export", callback:()=>{exportDiagnostic(actor);return "export";}},
      {label:t("hud.close"), action:"close", default:true, callback:()=>null}
    ], rejectClose:false, close:()=>null
  });
}

export function installDiagnosticGlobal() {
  globalThis.OPRPG_ARGON_DIAGNOSTIC = function(actor = ui.ARGON?._actor) {
    const data = buildDiagnostic(actor);
    console.info("Argon OPRPG | Diagnóstico", data);
    if (data.rows) console.table(data.rows);
    return data;
  };
  globalThis.OPRPG_ARGON_EXPORT_DIAGNOSTIC = exportDiagnostic;
  globalThis.OPRPG_ARGON_SELF_TEST = selfTest;
  globalThis.OPRPG_ARGON_COMPATIBILITY = openCompatibilityPanel;
  globalThis.OPRPG_ARGON_RESET_LAYOUT = async function() {
    const defaults = { layoutPreset: "normal", utilityAnchor: "all", utilityGap: 14, utilityOffset: 12, techniqueOffsetX: 0 };
    for (const [key, value] of Object.entries(defaults)) await game.settings.set(MODULE_ID, key, value);
    globalThis.OPRPG_ARGON_LAYOUT_REFRESH?.();
    ui.notifications.info("Argon OPRPG: layout restaurado para o padrão.");
    return defaults;
  };
}
