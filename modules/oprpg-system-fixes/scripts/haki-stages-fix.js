import {CORRECTED_TALENT_IDS} from "./haki-content-fix.js";

const patched = new WeakSet();

const STAGE_DESCRIPTIONS = {
  inexperiente: "Dá acesso aos talentos do Estágio Inexperiente. O Estágio do usuário é definido pela soma de todos os PA distribuídos nos três tipos de Haki.",
  treinado: "Dá acesso aos talentos do Estágio Treinado. Você se torna proficiente na perícia Haki.",
  perito: "Dá acesso aos talentos do Estágio Perito. Uma vez por dia, ao falhar em um Teste da perícia Haki, você pode rolar novamente e deve usar o segundo resultado. Você também pode ensinar os conceitos básicos de Haki."
};

export function updateStageContext(haki) {
  if (!haki) return;
  for (const stage of haki.stages ?? []) {
    if (STAGE_DESCRIPTIONS[stage.id]) stage.desc = STAGE_DESCRIPTIONS[stage.id];
    if (stage.current) haki.stageDesc = stage.desc;
  }
  // A versão 2.1 atualiza essas descrições. O compêndio de uma instalação
  // anterior pode continuar exibindo o texto 2.0 no tooltip do journal.
  for (const node of haki.nodes ?? []) {
    if (CORRECTED_TALENT_IDS.has(node.id)) node.reference = null;
  }
}

export function installStagePresentation(Sheet, Screen) {
  if (Sheet?.prototype?._prepareHakiContext && !patched.has(Sheet.prototype)) {
    patched.add(Sheet.prototype);
    const original = Sheet.prototype._prepareHakiContext;
    Sheet.prototype._prepareHakiContext = async function (...args) {
      const result = await original.apply(this, args);
      updateStageContext(args[0]?.haki ?? result?.haki);
      return result;
    };
  }
  if (Screen?.prototype?._prepareContext && !patched.has(Screen.prototype)) {
    patched.add(Screen.prototype);
    const original = Screen.prototype._prepareContext;
    Screen.prototype._prepareContext = async function (...args) {
      const result = await original.apply(this, args);
      updateStageContext(result.haki);
      return result;
    };
  }
}
