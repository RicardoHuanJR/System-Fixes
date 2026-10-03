import { registerFeatureSettings, featureEnabled } from './scripts/feature-settings.js';
import { registerBookSettings, installBookRules } from './scripts/book-rules.js';
import { installRollPrivacy } from './scripts/roll-privacy.js';
import { installWorkspace } from './scripts/workspace.js';
import { installPresentation } from './scripts/presentation.js';
import { installTargetDamage } from './scripts/target-damage.js';
import { installTechniqueTargets } from './scripts/technique-targets.js';
import { installNativeTargets } from './scripts/native-targets.js';
import { MODULE_ID, SYSTEM_ID, VERIFIED_SYSTEM, STATE } from "./scripts/shared.js";
import { installFormulaPatches, persistWorldFormulaRepairs } from "./scripts/formula-fix.js";
import { installHealingPatches } from "./scripts/healing-fix.js";
import { installSustainedDurationFix } from "./scripts/sustained-duration-fix.js";
import { installFreeTrainingFix } from "./scripts/free-training-fix.js";
import { installFruitSheetFix } from "./scripts/fruit-sheet-fix.js";
import { installMultiActivityDamagePatch } from "./scripts/multi-activity-damage-fix.js";
import { installMultiActivityAttackPatch } from "./scripts/multi-activity-attack-fix.js";
import { installMultiActivityLabelPatch } from "./scripts/multi-activity-label-fix.js";
import { installShieldPointsPatch } from "./scripts/shield-points-fix.js";
import { installAkumaNativeFixes } from "./scripts/akuma-fix.js";
import { installAkumaCombatFixes } from "./scripts/akuma-combat-fix.js";
import { installHakiAwakeningFixes } from "./scripts/haki-awakening-fix.js";
import { installUnifiedHakiFixes, registerConcentrationSettings } from "./scripts/haki-unified-fix.js";
import { installResourceHistory } from './scripts/operation-history.js';
import { installActivityGuide } from './scripts/activity-guide.js';
import { installSaveWorkflow } from './scripts/save-workflow.js';
import { installCardSync } from './scripts/card-sync.js';
import { installNpcSheetRepair } from "./scripts/npc-sheet-fix.js";
import { installPublicAPI } from "./scripts/api.js";
import { installDiagnostics, selfTest } from "./scripts/diagnostic.js";
import { installExternalCompatibility } from './scripts/external-compatibility.js';
import { installAreaWorkflow } from './scripts/area-workflow.js';

// Register diagnostics as soon as the ES module is evaluated. This intentionally
// happens before Foundry's init hook so an unrelated patch failure cannot hide
// OPRPG_FIXES_STATUS / OPRPG_FIXES_SELF_TEST from the console.
installDiagnostics();
globalThis.OPRPG_FIXES_LOADED = true;

function safeInstall(label, installer) {
  try {
    const result = installer();
    if (result === false) STATE.warnings.push(`${label}: não pôde ser instalado nesta inicialização.`);
    return result;
  } catch (error) {
    const message = `${label}: ${error?.message ?? error}`;
    STATE.warnings.push(message);
    console.error(`${MODULE_ID} | ${label} falhou`, error);
    return false;
  }
}

Hooks.once("init", () => {
  if (game.system.id !== SYSTEM_ID) {
    STATE.warnings.push(`Sistema ativo é ${game.system.id}; esperado ${SYSTEM_ID}.`);
    return;
  }

  registerFeatureSettings();
  // game.system is available at init; DAE builds specs during document
  // preparation after init. Never access the system at module evaluation time.
  if(featureEnabled('externalCompatibility'))safeInstall('Compatibilidade DAE/Midi',installExternalCompatibility);
  game.settings.register(MODULE_ID,'compatibilityMacros',{
    name:'Compatibilidade: executar macros de itens',
    hint:'Executa Macros do mundo referidas no campo On Use do Midi após etapas nativas suportadas. ItemMacro e etapas anteriores à rolagem ainda não são adaptadas.',
    scope:'world',config:true,type:Boolean,default:false
  });
  safeInstall('Apresentação nativa',installPresentation);
  registerBookSettings();
  registerConcentrationSettings();
  if(featureEnabled("privacy"))safeInstall("Sigilo de dados",installRollPrivacy);
  try {
    game.settings.register(MODULE_ID, "lastWarnedSystemVersion", {
      name: "Última versão OPRPG avisada",
      scope: "client",
      config: false,
      type: String,
      default: ""
    });
  } catch (error) {
    STATE.warnings.push(`Registro de setting falhou: ${error?.message ?? error}`);
    console.error(`${MODULE_ID} | Falha ao registrar setting`, error);
  }

  if(featureEnabled("formulas"))safeInstall("Patch de fórmulas", installFormulaPatches);
  if(featureEnabled("multiActivity"))safeInstall("Dano de Técnicas com múltiplas Activities", installMultiActivityDamagePatch);
  if(featureEnabled("multiActivity"))safeInstall("Acerto de Técnicas com múltiplas Activities", installMultiActivityAttackPatch);
  if(featureEnabled("multiActivity"))safeInstall("Labels de dano por Activity", installMultiActivityLabelPatch);
  if(featureEnabled('multiActivity'))safeInstall('Etapas das atividades',installActivityGuide);

  // The old local fork already contains healing fixes; avoid double-patching it.
  if (featureEnabled("healing") && !String(game.system.version ?? "").includes("-local.")) {
    safeInstall("Patches de Cura/PV Temporários", installHealingPatches);
  } else if(String(game.system.version ?? "").includes("-local.")) {
    STATE.warnings.push("Fork local detectado: patches de cura do módulo foram desativados para evitar duplicação. Use o OPRPG oficial com este módulo.");
  }

  STATE.initialized = true;
  console.info(`${MODULE_ID} | init concluído; arquivos do sistema permanecem inalterados.`);
});

Hooks.once("ready", async () => {
  if (game.system.id !== SYSTEM_ID) return;
  if(featureEnabled('bookRules'))try{await installBookRules()}catch(error){STATE.warnings.push(`Regras do livro: ${error.message}`);console.error(error)}
  if(featureEnabled("targets")) {
    safeInstall('Salvaguardas de todos os alvos',installSaveWorkflow);
    safeInstall("Dano nos alvos",installTargetDamage);
    try { await installNativeTargets(); } catch(error) { STATE.warnings.push(`Dano nativo nos alvos: ${error.message}`); }
    try { await installTechniqueTargets(); } catch(error) { STATE.warnings.push(`Alvos e áreas: ${error.message}`); }
    try { await installAreaWorkflow(); } catch(error) { STATE.warnings.push(`Execuções de área: ${error.message}`); }
  }
  if(featureEnabled('multiActivity'))safeInstall('Compartilhamento do dano',installCardSync);
  if(featureEnabled("sustained"))safeInstall("Duração de técnicas sustentadas e cura por turno", installSustainedDurationFix);

  // The native custom chat card bypasses Actor.applyDamage. Install a narrow
  // compatibility layer that diverts its HP/TempHP update through the already
  // existing Shield Points pool, leaving official system files untouched.
  try { if(featureEnabled("shield"))await installShieldPointsPatch(); }
  catch (error) {
    STATE.warnings.push(`Pontos de Escudo: ${error?.message ?? error}`);
    console.error(`${MODULE_ID} | Falha ao instalar camada de Pontos de Escudo`, error);
  }

  try { if(featureEnabled("fruit"))installAkumaNativeFixes(); }
  catch (error) {
    STATE.warnings.push(`Akuma no Mi: ${error?.message ?? error}`);
    console.error(`${MODULE_ID} | Falha ao instalar reparos nativos de Akuma no Mi`, error);
  }

  try { if(featureEnabled("fruit"))await installAkumaCombatFixes(); }
  catch (error) {
    STATE.warnings.push(`Akuma no Mi/combate: ${error?.message ?? error}`);
    console.error(`${MODULE_ID} | Falha ao instalar reparos de combate da Akuma no Mi`, error);
  }

  try { if(featureEnabled("haki"))await installHakiAwakeningFixes(); }
  catch (error) {
    STATE.warnings.push(`Haki/Estágio Desperto: ${error?.message ?? error}`);
    console.error(`${MODULE_ID} | Falha ao instalar reparos de Haki/Estágio Desperto`, error);
  }

  try { if(featureEnabled("haki"))await installUnifiedHakiFixes(); }
  catch (error) {
    STATE.warnings.push(`Haki Unificado: ${error?.message ?? error}`);
    console.error(`${MODULE_ID} | Falha ao instalar Haki Unificado integrado`, error);
  }

  try { if(featureEnabled("npc"))await installNpcSheetRepair(); }
  catch (error) {
    STATE.warnings.push(`NPC Sheet: ${error?.message ?? error}`);
    console.error(`${MODULE_ID} | Falha ao instalar reparo da ficha de NPC`, error);
  }

  try { installPublicAPI(); }
  catch (error) {
    STATE.warnings.push(`API pública: ${error?.message ?? error}`);
    console.error(`${MODULE_ID} | Falha ao instalar API pública`, error);
  }
  for(const [label,install] of [["Treinos grátis",installFreeTrainingFix],["Aba Fruta",installFruitSheetFix]]) {
    try { if(!featureEnabled(install===installFreeTrainingFix?"training":"fruit"))continue; if(await install()===false)STATE.warnings.push(`${label}: integração indisponível.`); }
    catch(error){STATE.warnings.push(`${label}: ${error.message}`);console.error(error)}
  }

  try { if(featureEnabled("formulas"))await persistWorldFormulaRepairs(); }
  catch (error) {
    STATE.warnings.push(`Persistência de fórmulas: ${error?.message ?? error}`);
    console.error(`${MODULE_ID} | Falha ao persistir fórmulas reparadas`, error);
  }

  if (game.system.version !== VERIFIED_SYSTEM) {
    try {
      const warned = game.settings.get(MODULE_ID, "lastWarnedSystemVersion");
      if (warned !== game.system.version) {
        ui.notifications.warn(game.i18n.format("OPRPGFIXES.SystemUnverified", { version: game.system.version }), { permanent: false });
        await game.settings.set(MODULE_ID, "lastWarnedSystemVersion", game.system.version);
      }
    } catch (error) {
      STATE.warnings.push(`Aviso de versão: ${error?.message ?? error}`);
    }
  }

  if(featureEnabled("workspace"))safeInstall("Painel Fixes",installWorkspace);
  installResourceHistory();
  try { selfTest({ log: false, deep: false }); }
  catch (error) { console.error(`${MODULE_ID} | Self test automático falhou`, error); }
});
