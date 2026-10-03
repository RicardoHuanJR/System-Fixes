import { MODULE_ID, VERIFIED_SYSTEM, STATE, healMode } from "./shared.js";
import { shieldPointsStatus, damageTypePipelineStatus } from "./shield-points-fix.js";
import { multiActivityAttackStatus } from "./multi-activity-attack-fix.js";
import { akumaFixStatus } from "./akuma-fix.js";
import { akumaCombatStatus } from "./akuma-combat-fix.js";
import { hakiAwakeningStatus } from "./haki-awakening-fix.js";
import { unifiedHakiStatus } from "./haki-unified-fix.js";
import { npcSheetRepairStatus } from "./npc-sheet-fix.js";
import { logNativeMechanicsAudit, nativeMechanicsAudit } from "./native-audit.js";

export function selfTest({ log=true, deep=true }={}) {
  const tests = [];
  const add = (name, pass, detail="") => tests.push({ teste: name, ok: !!pass, detalhe: detail });
  add("Sistema OPRPG ativo", game.system.id === "oprpg-system", game.system.id);
  add("Regras do Livro 2.1", STATE.bookRulesPatch, "Descanso, lendárias e registro de PV negativos; verifique a opção do módulo se desativado.");
  add("Foundry v14", String(game.version ?? "").startsWith("14."), game.version);
  add("Patch de Item/fórmulas", STATE.itemPatch, "_initializeSource/createActivity/update");
  add("Patch HealActivity", STATE.healClassPatch, "rollDamage/getHealLimit por contexto");
  add("Bypass preUse prioritário", STATE.preUseBypass, "temp/mixed não bloqueia por limite");
  add("Patch de cards de Cura", STATE.chatPatch, "renderChatMessageHTML + observador temporário apenas no card de cura");
  add("Cura automática substituída", STATE.autoHealPatch, STATE.autoHealPatch ? "handler legado reconhecido" : "verifique a versão do sistema");
  add("Duração sustentada e ordem da cura", STATE.sustainedDurationPatch, "permanentes preservados; prazo e manutenção verificados antes da cura por turno");
  add("Escolha de pagamento do treino", STATE.freeTrainingPatch, "gastar PT ou recebido gratuitamente do mestre/característica");
  add("Aba Fruta", STATE.fruitSheetPatch, "criação de técnicas, Manifestações, Power Up e efeitos fixos Zoan");
  add("Dano multi-Activity", STATE.multiActivityDamagePatch, "jj-damage respeita data-activity-id em Técnicas com 2+ Activities");
  add("Acerto multi-Activity", STATE.multiActivityAttackPatch, "jj-attack preserva o handler nativo e mantém a Activity selecionada após o rerender do ACERTO");
  add("Labels de dano por Activity", STATE.multiActivityDamageLabelsPatch, "Activity.getDamageConfig é a fonte prioritária; o cache item.labels é apenas ponte temporária no handler nativo");
  add("Dano sem Acerto prévio", STATE.multiActivityDamageIndependent, "DANO pode ser rolado e exibido diretamente sem ACERTO quando a Activity selecionada possui dano válido");
  add("Pontos de Escudo no card", STATE.shieldPointsPatch, "camadas do card reparadas: Armadura → Escudo → PV temporário → PV");
  add("Endurecimento: resistência física", STATE.shieldPhysicalResistancePatch, "Contundente/Cortante/Perfurante recebem resistência enquanto os Pontos de Escudo estão ativos");
  add("Tipos de dano no card", STATE.damageTypePipelinePatch, "Actor.calculateDamage resolve resistência/imunidade/vulnerabilidade antes das camadas customizadas quando o tipo é inequívoco");
  add("Uso Alternativo da Akuma", STATE.akumaAlternativePatch, "Activity.use nativo preservado com consumo de energy temporariamente zerado; fallback curto para caminhos legados");
  add("Power Up: ciclo de vida", STATE.powerUpLifecyclePatch, "efeito nativo rastreado e powerUp.active sincronizado ao expirar/remover");
  add("Power Up: SAV", STATE.powerUpSavPatch, "Salvaguardas de alvos da Técnica recebem desvantagem enquanto a opção SAV estiver ativa");
  add("Power Up: DMG", STATE.powerUpDamagePatch, "Técnicas instantâneas da Akuma recebem dados extras limitados pelo grau");
  add("Power Up: RED", STATE.powerUpReductionPatch, "PV protegido até o limiar de 10 × nível e transformação encerrada ao romper");
  add("Intangibilidade Logia", STATE.intangibilityPatch, "bloqueio no pipeline do card com bypass por Haki/Kairoseki e bypass manual para inimigo natural");
  add("Predador Zoan", STATE.predatorPatch, "recuperação usa dano realmente causado e limites acumulados");
  add("Escudo: recarga de 10 minutos", STATE.shieldRechargePatch, "usa tempo do mundo, pausa em combate e reinicia ao detectar uso do Haki do Armamento");
  add("Ataque Infuso: seleção de forma", STATE.hakiInfusionPatch, "bypass da Intangibilidade só quando a forma escolhida/explicitamente imbuída puder ser identificada");
  add("Haki Unificado integrado", STATE.hakiUnifiedPatch || STATE.hakiUnifiedDeferredExternal, STATE.hakiUnifiedPatch ? "HUD, Antevisão, Superação Majestosa, contadores e descrições integrados" : "módulo Haki externo ativo; integração interna adiada para evitar duplicação");
  add("Estágio Desperto: Liberação Cansativa", STATE.awakeningDrainPatch, "consome 1 PP no fim do turno e encerra o estágio ao chegar a 0 PP");
  add("Estágio Desperto: ciclo de vida", STATE.awakeningLifecyclePatch, "estado é reavaliado por campo nativo/Active Effect sem observer global");
  add("NPC Sheet: SVG/contexto", STATE.npcSheetPatch, "sanitiza SVG inválido em Manipulation/Trainings sem alterar npc-sheet.mjs");
  add("Hidratação leve do card", true, "renderChatMessageHTML; sem MutationObserver global");
  add("API game.oprpg", !!game.oprpg?.getPP && !!game.oprpg?.applyTempHP, "API sem alterar o sistema");
  add("Versão oficialmente validada", game.system.version === VERIFIED_SYSTEM, game.system.version);

  if (deep) {
    const modes = {};
    let scanned = 0;
    for (const actor of game.actors ?? []) {
      for (const item of actor.items ?? []) {
        let activities = [];
        try { activities = Array.from(item.system?.activities?.values?.() ?? []); } catch (_) { activities = []; }
        for (const activity of activities) {
          if (activity.type !== "heal") continue;
          scanned++;
          const mode = healMode(activity);
          modes[mode] = (modes[mode] ?? 0) + 1;
        }
      }
    }
    add("Activities heal legíveis", true, `${scanned} Activities; ${JSON.stringify(modes)}`);
  } else {
    add("Activities heal legíveis", true, "varredura profunda adiada até OPRPG_FIXES_SELF_TEST({deep:true})");
  }

  const result = { kind: "installation-diagnostics", functionalValidation: false, module: game.modules.get(MODULE_ID)?.version, system: game.system.version, foundry: game.version, passed: tests.filter(t => t.ok).length, total: tests.length, tests, warnings: [...STATE.warnings] };
  if (log) {
    console.group("OPRPG System Fixes | Self Test");
    console.table(tests);
    if (STATE.warnings.length) console.warn("Avisos:", STATE.warnings);
    console.log(result);
    console.groupEnd();
  }
  return result;
}



export function compatibilityReport() {
  const mod = game.modules.get(MODULE_ID);
  const tests = selfTest({log:false, deep:false});
  const systemVersion = game.system?.version ?? "—";
  return {
    foundry: game.version,
    system: {id: game.system?.id, version: systemVersion, verified: systemVersion === VERIFIED_SYSTEM},
    module: {version: mod?.version ?? "—", active: !!mod?.active},
    capabilities: {
      formulaRepair: STATE.itemPatch,
      healActivity: STATE.healClassPatch,
      healLimitBypass: STATE.preUseBypass,
      chatCards: STATE.chatPatch,
      autoHeal: STATE.autoHealPatch,
      sustainedDuration: STATE.sustainedDurationPatch,
      multiActivityDamage: STATE.multiActivityDamagePatch,
      multiActivityAttack: STATE.multiActivityAttackPatch,
      multiActivityDamageLabels: STATE.multiActivityDamageLabelsPatch,
      damageWithoutAttack: STATE.multiActivityDamageIndependent,
      shieldPoints: STATE.shieldPointsPatch,
      shieldPhysicalResistance: STATE.shieldPhysicalResistancePatch,
      damageTypePipeline: STATE.damageTypePipelinePatch,
      akumaAlternative: STATE.akumaAlternativePatch,
      powerUpLifecycle: STATE.powerUpLifecyclePatch,
      powerUpSav: STATE.powerUpSavPatch,
      powerUpDamage: STATE.powerUpDamagePatch,
      powerUpReduction: STATE.powerUpReductionPatch,
      intangibility: STATE.intangibilityPatch,
      predator: STATE.predatorPatch,
      shieldRecharge: STATE.shieldRechargePatch,
      hakiInfusion: STATE.hakiInfusionPatch,
      hakiUnified: STATE.hakiUnifiedPatch || STATE.hakiUnifiedDeferredExternal,
      awakeningDrain: STATE.awakeningDrainPatch,
      awakeningLifecycle: STATE.awakeningLifecyclePatch,
      npcSheetRepair: STATE.npcSheetPatch,
      publicApi: !!game.oprpg?.getPP && !!game.oprpg?.applyTempHP
    },
    tests,
    warnings: [...STATE.warnings]
  };
}

export async function openCompatibilityPanel() {
  const report = compatibilityReport();
  const cap = report.capabilities;
  const row = (label, value, ok=true) => `<tr><th>${label}</th><td class="oprpg-fixes-status-${ok?'ok':'warning'}">${value}</td></tr>`;
  const rows = [
    row("Foundry", report.foundry, String(report.foundry).startsWith("14.")),
    row("OPRPG System", report.system.version, report.system.id === "oprpg-system"),
    row("Versão validada", report.system.verified ? "sim" : `não (validada: ${VERIFIED_SYSTEM})`, report.system.verified),
    row("Patch de fórmulas", cap.formulaRepair ? "ativo" : "inativo", cap.formulaRepair),
    row("HealActivity", cap.healActivity ? "ativo" : "inativo", cap.healActivity),
    row("Limite de cura", cap.healLimitBypass ? "ativo" : "inativo", cap.healLimitBypass),
    row("Cards de Cura", cap.chatCards ? "ativo" : "inativo", cap.chatCards),
    row("Cura automática", cap.autoHeal ? "ativo" : "não reconhecida", cap.autoHeal),
    row("Dano multi-Activity", cap.multiActivityDamage ? "ativo" : "inativo", cap.multiActivityDamage),
    row("Acerto multi-Activity", cap.multiActivityAttack ? "ativo" : "inativo", cap.multiActivityAttack),
    row("Labels por Activity", cap.multiActivityDamageLabels ? "ativo" : "inativo", cap.multiActivityDamageLabels),
    row("Dano sem Acerto prévio", cap.damageWithoutAttack ? "ativo" : "inativo", cap.damageWithoutAttack),
    row("Pontos de Escudo no card", cap.shieldPoints ? "ativo" : "inativo", cap.shieldPoints),
    row("Resistência do Endurecimento", cap.shieldPhysicalResistance ? "ativa" : "inativa", cap.shieldPhysicalResistance),
    row("Tipos de dano no card", cap.damageTypePipeline ? "ativo" : "inativo", cap.damageTypePipeline),
    row("Uso Alternativo", cap.akumaAlternative ? "ativo" : "inativo", cap.akumaAlternative),
    row("Power Up — ciclo de vida", cap.powerUpLifecycle ? "ativo" : "inativo", cap.powerUpLifecycle),
    row("Power Up — SAV", cap.powerUpSav ? "ativo" : "inativo", cap.powerUpSav),
    row("Power Up — DMG", cap.powerUpDamage ? "ativo" : "inativo", cap.powerUpDamage),
    row("Power Up — RED", cap.powerUpReduction ? "ativo" : "inativo", cap.powerUpReduction),
    row("Intangibilidade", cap.intangibility ? "ativa" : "inativa", cap.intangibility),
    row("Predador", cap.predator ? "ativo" : "inativo", cap.predator),
    row("Escudo — recarga 10 min", cap.shieldRecharge ? "ativa" : "inativa", cap.shieldRecharge),
    row("Ataque Infuso", cap.hakiInfusion ? "ativo" : "inativo", cap.hakiInfusion),
    row("Haki Unificado", cap.hakiUnified ? (STATE.hakiUnifiedPatch ? "integrado" : "externo ativo") : "inativo", cap.hakiUnified),
    row("Despertar — Liberação Cansativa", cap.awakeningDrain ? "ativa" : "inativa", cap.awakeningDrain),
    row("Despertar — ciclo de vida", cap.awakeningLifecycle ? "ativo" : "inativo", cap.awakeningLifecycle),
    row("NPC Sheet — SVG/contexto", cap.npcSheetRepair ? "ativo" : "inativo", cap.npcSheetRepair),
    row("API game.oprpg", cap.publicApi ? "ativa" : "inativa", cap.publicApi),
    row("Verificações de instalação", `${report.tests.passed}/${report.tests.total}`, report.tests.passed === report.tests.total)
  ].join("");
  const warnings = report.warnings.length ? `<h3>Avisos</h3><ul>${report.warnings.map(w=>`<li>${foundry.utils.escapeHTML(String(w))}</li>`).join("")}</ul>` : `<p>Nenhum aviso registrado.</p>`;
  return foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],
    window:{title:"OPRPG System Fixes — Compatibilidade"},
    content:`<div><table style="width:100%;border-collapse:collapse">${rows}</table>${warnings}<p class="hint">Depois de qualquer atualização oficial do OPRPG, abra este painel e confirme que os patches continuam reconhecidos.</p></div>`,
    buttons:[{label:"Fechar",action:"close",default:true,callback:()=>null}],rejectClose:false,close:()=>null
  });
}

export function installDiagnostics() {
  globalThis.OPRPG_FIXES_SELF_TEST = selfTest;
  globalThis.OPRPG_FIXES_COMPATIBILITY = openCompatibilityPanel;
  globalThis.OPRPG_FIXES_COMPATIBILITY_REPORT = compatibilityReport;
  globalThis.OPRPG_FIXES_NATIVE_AUDIT = logNativeMechanicsAudit;
  globalThis.OPRPG_FIXES_NATIVE_AUDIT_REPORT = nativeMechanicsAudit;
  globalThis.OPRPG_FIXES_SHIELD_STATUS = shieldPointsStatus;
  globalThis.OPRPG_FIXES_DAMAGE_TYPES_STATUS = damageTypePipelineStatus;
  globalThis.OPRPG_FIXES_ATTACK_STATUS = multiActivityAttackStatus;
  globalThis.OPRPG_FIXES_AKUMA_STATUS = akumaFixStatus;
  globalThis.OPRPG_FIXES_AKUMA_COMBAT_STATUS = akumaCombatStatus;
  globalThis.OPRPG_FIXES_HAKI_AWAKENING_STATUS = hakiAwakeningStatus;
  globalThis.OPRPG_FIXES_HAKI_STATUS = unifiedHakiStatus;
  globalThis.OPRPG_FIXES_NPC_SHEET_STATUS = npcSheetRepairStatus;
  globalThis.OPRPG_FIXES_STATUS = () => ({
    loaded: true,
    ...STATE,
    system: globalThis.game?.system?.version ?? null,
    systemId: globalThis.game?.system?.id ?? null,
    module: globalThis.game?.modules?.get?.(MODULE_ID)?.version ?? "1.9.0",
    active: globalThis.game?.modules?.get?.(MODULE_ID)?.active ?? null
  });
}
