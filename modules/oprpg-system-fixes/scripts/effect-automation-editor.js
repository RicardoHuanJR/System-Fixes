import {ID, cleanConfig, paMaxBonus, applicableEffects, isActive, bulkAmount, formulaResult} from "./effect-automation-rules.js";
function field(parent, text, name, type, value, options = {}) {
  const label = document.createElement("label");
  label.textContent = text;
  const input = document.createElement(type === "select" ? "select" : "input");
  input.dataset.autoField = name;
  if (type !== "select") input.type = type;
  if (type === "checkbox") input.checked = !!value;
  else input.value = value;
  if (type === "number") { input.min = options.min ?? "0"; input.max = options.max ?? "100"; input.step = "1"; }
  if (type === "select") for (const [key, title] of options.choices ?? []) {
    const option = document.createElement("option"); option.value = key; option.textContent = title;
    input.append(option);
  }
  if (type === "select") input.value = value;
  label.append(input);
  parent.append(label);
  return input;
}

const AUTOMATIONS = [
  {key: "hitTechniqueMelee", group: "Acerto — técnicas", label: "Técnica corpo a corpo", help: "Soma o valor ao acerto de técnicas de ataque corpo a corpo."},
  {key: "hitTechniqueRanged", group: "Acerto — técnicas", label: "Técnica à distância", help: "Soma o valor ao acerto de técnicas de ataque à distância."},
  {key: "hitCommonMelee", group: "Acerto — ataques comuns", label: "Ataque comum corpo a corpo", help: "Soma o valor ao acerto de armas ou ataques comuns corpo a corpo."},
  {key: "hitCommonRanged", group: "Acerto — ataques comuns", label: "Ataque comum à distância", help: "Soma o valor ao acerto de armas ou ataques comuns à distância."},
  {key: "comboDiceAttack", group: "Dano — técnica com ataque", label: "Dados extras · ataque", help: "Adiciona dados ao dano de técnicas com rolagem de ataque, usando o primeiro dado da técnica."},
  {key: "techniqueDiceAttack", group: "Dano — técnica com ataque", label: "Dados pela graduação · ataque", help: "Adiciona dados fixos, iguais ao grau ou à metade do grau em técnicas com rolagem de ataque."},
  {key: "flatDamageAttack", group: "Dano — técnica com ataque", label: "Dano fixo · ataque", help: "Soma o valor ao dano de técnicas com rolagem de ataque."},
  {key: "comboDiceSave", group: "Dano — técnica com salvaguarda", label: "Dados extras · salvaguarda", help: "Adiciona dados ao dano de técnicas com salvaguarda, usando o primeiro dado da técnica."},
  {key: "techniqueDiceSave", group: "Dano — técnica com salvaguarda", label: "Dados pela graduação · salvaguarda", help: "Adiciona dados fixos, iguais ao grau ou à metade do grau em técnicas com salvaguarda."},
  {key: "flatDamageSave", group: "Dano — técnica com salvaguarda", label: "Dano fixo · salvaguarda", help: "Soma o valor ao dano de técnicas com salvaguarda."},
  {key: "commonDiceMelee", group: "Dano — ataques comuns", label: "Dados extras · corpo a corpo", help: "Adiciona dados ao dano de ataques comuns corpo a corpo, usando o primeiro dado do ataque."},
  {key: "commonDiceRanged", group: "Dano — ataques comuns", label: "Dados extras · à distância", help: "Adiciona dados ao dano de ataques comuns à distância, usando o primeiro dado do ataque."},
  {key: "commonFlatMelee", group: "Dano — ataques comuns", label: "Dano fixo · corpo a corpo", help: "Soma o valor desta linha ao dano de ataques comuns corpo a corpo."},
  {key: "commonFlatRanged", group: "Dano — ataques comuns", label: "Dano fixo · à distância", help: "Soma o valor desta linha ao dano de ataques comuns à distância."},
  {key: "maxPa", group: "Recursos", label: "PP máximo", help: "Acrescenta o valor desta linha × multiplicador ao PP máximo da ficha."}
];
const DEGREE_AUTOMATIONS = new Set(["techniqueDiceAttack", "techniqueDiceSave"]);

function limitedItems(actor) {
  return Array.from(actor?.items?.contents ?? actor?.items ?? []).filter(item =>
    item.hasLimitedUses || Number(item.system?.uses?.max) > 0);
}

function makeBulkControls(parent, config, actor, effect) {
  const settings = document.createElement("div"); settings.className = "auto-bulk-settings";
  const stacking = field(settings, "Somar com bônus de outros efeitos", "stackable", "checkbox", config.stackable);
  const stackHelp = document.createElement("p"); stackHelp.className = "auto-bulk-help";
  stackHelp.textContent = "Desmarcado: prevalece o maior bônus de cada tipo entre os efeitos ativos (acerto, dados, dano e PP).";
  settings.append(stackHelp);
  const enabled = field(settings, "Adicionar o mesmo bônus a todas as automações deste efeito", "bulkEnabled", "checkbox", config.bulkEnabled);
  const box = document.createElement("div"); box.className = "auto-bulk-fields";
  const mode = field(box, "Origem do bônus conjunto", "bulkMode", "select", config.bulkMode, {choices: [
    ["fixed", "Valor definido aqui"], ["uses", "Usos restantes de uma característica"]
  ]});
  const fixedWrap = document.createElement("div"); fixedWrap.className = "auto-bulk-source";
  const fixed = field(fixedWrap, "Valor extra para cada automação", "bulkValue", "number", config.bulkValue);
  box.append(fixedWrap);
  const usesWrap = document.createElement("div"); usesWrap.className = "auto-bulk-source";
  const choices = [];
  const own = effect?.parent?.documentName === "Item" ? effect.parent : null;
  if (own && (own.hasLimitedUses || Number(own.system?.uses?.max) > 0)) {
    choices.push(["", `Própria característica: ${own.name}`]);
  } else {
    choices.push(["", "Escolha uma característica…"]);
  }
  for (const item of limitedItems(actor)) {
    if (item.id !== own?.id) choices.push([item.id, item.name]);
  }
  if (config.bulkItemId && !choices.some(([id]) => id === config.bulkItemId)) {
    choices.push([config.bulkItemId, "Característica vinculada não encontrada"]);
  }
  if (choices.length === 1 && choices[0][1] === "Escolha uma característica…") {
    choices[0][1] = "Nenhuma característica com usos limitados";
  }
  const source = field(usesWrap, "Usar os usos restantes de", "bulkItemId", "select",
    config.bulkItemId, {choices});
  box.append(usesWrap);
  const formula = field(box, "Somar fórmula da ficha a cada automação (opcional)",
    "bulkFormula", "text", config.bulkFormula);
  formula.placeholder = "floor(@prof/2)";
  formula.maxLength = 120;
  formula.autocomplete = "off";
  const usage = document.createElement("p"); usage.className = "auto-bulk-help"; box.append(usage);
  const refresh = () => {
    box.hidden = !enabled.checked;
    fixedWrap.hidden = mode.value !== "fixed";
    usesWrap.hidden = mode.value !== "uses";
    if (mode.value !== "uses") {
      usage.textContent = "O valor extra se soma a cada automação selecionada, sem alterar seus valores originais.";
    } else {
      const amount = bulkAmount(actor, effect, cleanConfig({bulkEnabled: true,
        bulkMode: "uses", bulkItemId: source.value})) + formulaResult(actor, formula.value).value;
      usage.textContent = choices.length === 1 && choices[0][1].startsWith("Nenhuma")
        ? "Esta ficha não tem característica com usos limitados. Configure uma antes de ativar este vínculo."
        : !source.value && !own?.hasLimitedUses && !(Number(own?.system?.uses?.max) > 0)
          ? "Escolha qual característica fornece os usos restantes para este bônus."
        : source.selectedOptions?.[0]?.textContent === "Característica vinculada não encontrada"
          ? "A característica vinculada não está mais nesta ficha. Escolha outra antes de salvar."
        : `Bônus atual: ${amount >= 0 ? "+" : ""}${amount} por automação. O módulo apenas lê os usos restantes; não gasta usos.`;
    }
  };
  mode.addEventListener("change", refresh);
  source.addEventListener("change", refresh);
  formula.addEventListener("input", refresh);
  enabled.addEventListener("change", refresh);
  refresh();
  settings.append(box);
  parent.append(settings);
  return {box, read: () => ({bulkEnabled: enabled.checked, bulkMode: mode.value,
    bulkValue: fixed.value, bulkItemId: source.value, bulkFormula: formula.value,
    stackable: stacking.checked})};
}

export function renderEffectEditor(app, element) {
  const effect = app.document;
  if(!effect?.parent?.isOwner)return;
  if (effect?.documentName !== "ActiveEffect" || element.querySelector(".oprpg-auto-effects")) return;
  const host = app.form ?? element.querySelector("form") ?? element;
  const config = cleanConfig(effect.flags?.[ID]?.automationConfig ?? effect.flags?.["oprpg-automacoes-efeitos"]?.config ?? {});
  const panel = document.createElement("fieldset");
  panel.className = "oprpg-auto-effects";
  const legend = document.createElement("legend"); legend.textContent = "Automações cadastradas — OP-RPG"; panel.append(legend);
  const intro = document.createElement("p");
  intro.textContent = "Escolha uma regra por vez. Você pode combinar várias no mesmo efeito.";
  panel.append(intro);
  const chosen = new Set(AUTOMATIONS.filter(option => config[option.key]).map(option => option.key));
  const picker = document.createElement("label"); picker.className = "auto-picker";
  picker.textContent = "Adicionar automação";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Escolha uma automação para adicionar");
  const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Escolha uma opção…";
  select.append(placeholder);
  for (const groupName of [...new Set(AUTOMATIONS.map(option => option.group))]) {
    const group = document.createElement("optgroup"); group.label = groupName;
    for (const option of AUTOMATIONS.filter(entry => entry.group === groupName)) {
      const choice = document.createElement("option"); choice.value = option.key; choice.textContent = option.label;
      group.append(choice);
    }
    select.append(group);
  }
  picker.append(select); panel.append(picker);
  const help = document.createElement("p"); help.className = "auto-help";
  help.textContent = "Cada automação pode somar um valor fixo e uma fórmula da ficha. Escolha outras opções para combiná-las.";
  panel.append(help);
  const selectedList = document.createElement("ul"); selectedList.className = "auto-selected"; panel.append(selectedList);
  const values = {...config.values};
  const formulas = {...config.formulas};
  const diceModes = {...config.diceModes};
  let multiplier = config.maxPaMultiplier;
  const renderChoices = () => {
    selectedList.replaceChildren();
    if (!chosen.size) {
      const empty = document.createElement("li"); empty.className = "auto-empty";
      empty.textContent = "Nenhuma automação adicionada."; selectedList.append(empty);
    }
    for (const option of AUTOMATIONS.filter(entry => chosen.has(entry.key))) {
      const row = document.createElement("li");
      const main = document.createElement("div"); main.className = "auto-choice-main";
      const label = document.createElement("span"); label.className = "auto-choice-label"; label.textContent = option.label;
      main.append(label);
      if (!DEGREE_AUTOMATIONS.has(option.key) || diceModes[option.key] === "fixed") {
        const valueLabel = document.createElement("label"); valueLabel.className = "auto-choice-value";
        valueLabel.textContent = "Fixo";
        const valueInput = document.createElement("input"); valueInput.type = "number";
        valueInput.min = "0"; valueInput.max = "100"; valueInput.step = "1";
        valueInput.value = values[option.key];
        valueInput.setAttribute("aria-label", `Valor de ${option.label}`);
        valueInput.addEventListener("input", () => { values[option.key] = valueInput.value; });
        valueLabel.append(valueInput); main.append(valueLabel);
      } else {
        const rule = document.createElement("span"); rule.className = "auto-choice-rule";
        rule.textContent = diceModes[option.key] === "degree" ? "= grau" : "= ½ grau";
        main.append(rule);
      }
      const remove = document.createElement("button"); remove.type = "button";
      remove.textContent = "Remover"; remove.setAttribute("aria-label", `Remover ${option.label}`);
      remove.addEventListener("click", () => { chosen.delete(option.key); renderChoices(); });
      main.append(remove); row.append(main);
      if (DEGREE_AUTOMATIONS.has(option.key)) {
        const detail = document.createElement("div"); detail.className = "auto-choice-detail";
        const mode = field(detail, "Quantidade de dados", `diceMode-${option.key}`, "select", diceModes[option.key], {choices: [
          ["fixed", "Quantidade fixa"], ["degree", "Igual ao grau"], ["half", "Metade do grau (para baixo)"]
        ]});
        mode.addEventListener("change", () => { diceModes[option.key] = mode.value; renderChoices(); });
        row.append(detail);
      }
      if (option.key === "maxPa") {
        const detail = document.createElement("div"); detail.className = "auto-choice-detail";
        const mult = field(detail, "Multiplicador", "maxPaMultiplier", "number", multiplier);
        mult.addEventListener("input", () => { multiplier = mult.value; });
        row.append(detail);
      }
      const formulaLabel = document.createElement("label"); formulaLabel.className = "auto-choice-formula";
      formulaLabel.textContent = "Somar da ficha (opcional)";
      const formulaInput = document.createElement("input"); formulaInput.type = "text";
      formulaInput.value = formulas[option.key];
      formulaInput.placeholder = "floor(@prof/2)";
      formulaInput.maxLength = 120;
      formulaInput.autocomplete = "off";
      formulaInput.setAttribute("aria-label", `Fórmula para ${option.label}`);
      formulaInput.addEventListener("input", () => { formulas[option.key] = formulaInput.value; });
      formulaLabel.append(formulaInput); row.append(formulaLabel);
      selectedList.append(row);
    }
  };
  select.addEventListener("change", () => {
    const option = AUTOMATIONS.find(entry => entry.key === select.value);
    if (!option) return;
    if (!chosen.has(option.key) && Number(values[option.key]) === 0) values[option.key] = 1;
    chosen.add(option.key);
    help.textContent = option.help;
    select.value = "";
    renderChoices();
  });
  renderChoices();
  const actor = effect.actor ?? (effect.parent?.documentName === "Actor" ? effect.parent : effect.parent?.actor);
  const bulk = makeBulkControls(panel, config, actor, effect);
  const formulaHelp = document.createElement("p"); formulaHelp.className = "auto-help";
  formulaHelp.textContent = "Exemplos: floor(@prof/2) ou @abilities.dex.mod. O resultado é inteiro e acompanha a ficha; dados aleatórios e código não são aceitos.";
  panel.append(formulaHelp);
  const note = document.createElement("p");
  const refreshStatus = () => {
    if (!actor) {
      note.textContent = "Este item não está dentro da ficha de um personagem. Configure a cópia do item na ficha; alterações no item original não mudam cópias já existentes.";
      return false;
    }
    if (effect.parent?.documentName === "Item" && !effect.transfer) {
      note.textContent = "O efeito está no item, mas 'Apply Effect to Actor' está desligado. Ative essa opção em Detalhes para aplicar os bônus ao personagem.";
      return false;
    }
    const found = applicableEffects(actor).some(e => (e.uuid && e.uuid === effect.uuid) || e === effect);
    if (!found) {
      note.textContent = `O efeito não foi encontrado entre os efeitos da ficha de ${actor.name}. Confira se o item pertence a essa ficha.`;
      return false;
    }
    if (effect.disabled) {
      note.textContent = `O efeito está desativado em ${actor.name}. Ative-o para usar as automações.`;
      return false;
    }
    if (effect.isSuppressed) {
      const item = effect.item ?? (effect.parent?.documentName === "Item" ? effect.parent : null);
      if (item?.system?.equipped === false && item.areEffectsSuppressed) {
        note.textContent = `O item ${item.name} não está equipado. O sistema desativa seus efeitos nessa condição; equipe o item para usar estes bônus.`;
      } else if (item?.system?.attunement === "required" && !item.system.attuned) {
        note.textContent = `${item.name} exige sintonia. Faça a sintonia para ativar estes bônus.`;
      } else {
        note.textContent = `O sistema está suprimindo este efeito em ${actor.name}. Verifique as condições do item.`;
      }
      return false;
    }
    if (!isActive(effect)) {
      note.textContent = `O efeito não está ativo em ${actor.name}; verifique a duração.`;
      return false;
    }
    note.textContent = `Efeito detectado em ${actor.name}. Bônus de PP máximo ativo nesta ficha: +${paMaxBonus(actor)}.`;
    return true;
  };
  refreshStatus();
  panel.append(note);
  const actions = document.createElement("div"); actions.className = "auto-actions"; panel.append(actions);
  const save = document.createElement("button"); save.type = "button"; save.textContent = "Salvar automações";
  save.disabled = !app.isEditable || !effect.id; actions.append(save);
  if (!effect.id) note.textContent = "Salve o efeito primeiro e reabra esta janela para configurar as automações.";
  save.addEventListener("click", async () => {
    if (!app.isEditable || !effect.id) return;
    const bulkChoice = bulk.read();
    for (const option of AUTOMATIONS.filter(entry => chosen.has(entry.key))) {
      const result = formulaResult(actor, formulas[option.key]);
      if (result.error) {
        ui.notifications.warn(`Fórmula de ${option.label}: ${result.error}`);
        return;
      }
    }
    if (bulkChoice.bulkEnabled) {
      const result = formulaResult(actor, bulkChoice.bulkFormula);
      if (result.error) {
        ui.notifications.warn(`Fórmula do bônus conjunto: ${result.error}`);
        return;
      }
    }
    if (bulkChoice.bulkEnabled && bulkChoice.bulkMode === "uses") {
      const ownUses = effect.parent?.documentName === "Item"
        && (effect.parent.hasLimitedUses || Number(effect.parent.system?.uses?.max) > 0);
      const linked = bulkChoice.bulkItemId && limitedItems(actor).some(item => item.id === bulkChoice.bulkItemId);
      if (!linked && !(!bulkChoice.bulkItemId && ownUses)) {
        ui.notifications.warn("Escolha uma característica com usos limitados antes de salvar o bônus conjunto.");
        return;
      }
    }
    const data = cleanConfig({value: 0, hit: false, values, formulas,
      diceMode: diceModes.techniqueDiceAttack, diceModes,
      fixedDice: values.techniqueDiceAttack,
      maxPaMultiplier: multiplier,
      ...bulkChoice,
      ...Object.fromEntries(AUTOMATIONS.map(option => [option.key, chosen.has(option.key)]))});
    save.disabled = true;
    try {
      await effect.setFlag(ID, "automationConfig", data);
      try { actor?.prepareData?.(); }
      catch (error) { console.warn(`${ID} | Não foi possível atualizar ${actor?.name} imediatamente`, error); }
      if (refreshStatus()) ui.notifications.info(`Automações salvas e efeito detectado em ${actor.name}.`);
      else ui.notifications.warn(note.textContent);
    } catch (error) {
      console.error(`${ID} | Falha ao salvar`, error);
      ui.notifications.error(`Automações: ${error.message ?? error}`);
    } finally { save.disabled = false; }
  });
  const details = element.querySelector('[data-application-part="details"]')
    ?? element.querySelector('[data-tab="details"]') ?? host;
  details.append(panel);
}

