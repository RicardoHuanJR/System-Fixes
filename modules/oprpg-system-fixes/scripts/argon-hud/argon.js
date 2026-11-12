import { GROUPS, ECONOMY, entriesForActor, escapeHTML, activityById, asArray, finiteValue, resourceLabel } from "./model.js";
import { executeEntry, getItem, isAvailable } from "./execute.js";
import { useBasicAction, dashMovementInfo } from "./basic-actions.js";

const ID = "oprpg-system-fixes";
const warn = msg => ui.notifications?.warn?.(`Argon OPRPG: ${msg}`);

function iconFor(group) { return GROUPS.find(g => g.key === group)?.icon ?? "icons/svg/dice-target.svg"; }
function groupLabel(group) { return GROUPS.find(g => g.key === group)?.label ?? "Outras ações"; }
function usableMacro(macro) { return !!macro && macro.canExecute !== false && typeof macro.execute === "function"; }

/** Register all classes during Argon's argonInit, when CoreHUD.ARGON exists. */
export function registerArgon(CoreHUD) {
  const api = CoreHUD?.ARGON;
  if (!api?.MAIN?.BUTTONS?.ActionButton || !api?.MAIN?.BUTTONS?.ButtonPanelButton ||
      !api?.MAIN?.ActionPanel || !api?.MAIN?.BUTTON_PANELS?.ButtonPanel ||
      !api?.PORTRAIT?.PortraitPanel || !api?.DRAWER?.DrawerPanel || !api?.DRAWER?.DrawerButton) {
    throw new Error("Argon CORE incompatível: classes de painel/botão necessárias não encontradas.");
  }
  const {ActionButton, ButtonPanelButton} = api.MAIN.BUTTONS;
  const {ActionPanel} = api.MAIN;
  const {ButtonPanel} = api.MAIN.BUTTON_PANELS;
  const {PortraitPanel} = api.PORTRAIT;
  const {DrawerPanel, DrawerButton} = api.DRAWER;
  if (!api.WeaponSets || !api.MovementHud) throw new Error("Argon CORE: componentes de movimento/armas ausentes.");
  const partial = name => `modules/enhancedcombathud/templates/partials/${name}.hbs`;

  function keyboard(element, click, {expanded = false} = {}) {
    element.setAttribute("role", "button");
    element.tabIndex = 0;
    element.onkeydown = event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void click(event); }
      if (event.key === "Escape") { ui.ARGON.collapseAllPanels(); element.blur(); }
    };
    if (expanded) element.setAttribute("aria-haspopup", "true");
  }

  class OPRPGList extends ButtonPanel {
    get template() { return partial("ButtonPanel"); }
    get classes() { return [...super.classes, "argon-oprpg-list"]; }
    async _renderInner() {
      await super._renderInner();
      const search = document.createElement("input");
      search.type = "search"; search.placeholder = "Buscar atividade…";
      search.setAttribute("aria-label", "Buscar atividade neste painel");
      search.oninput = () => {
        const query = search.value.toLocaleLowerCase();
        let count = 0;
        for (const button of this._buttons) {
          const match = button.label.toLocaleLowerCase().includes(query);
          button.element.hidden = !match;
          if (match) count++;
        }
        status.textContent = count ? "" : "Nenhuma atividade encontrada.";
      };
      search.onkeydown = event => {
        if (event.key === "Escape") { event.stopPropagation(); this.toggle(false); this.parent.element.focus(); }
      };
      const status = document.createElement("p"); status.setAttribute("role", "status");
      status.className = "argon-oprpg-empty";
      this.element.prepend(search); this.element.append(status);
    }
    toggle(value, noTransition) {
      super.toggle(value, noTransition);
      this.parent?.element.setAttribute("aria-expanded", String(this.visible));
      this.parent?.element.setAttribute("aria-controls", this.id);
      this.element.id = this.id;
    }
  }

  class OPRPGActivityButton extends ActionButton {
    constructor(entry, actor) { super(); this.entry = entry; this.ownerActor = actor; }
    get item() { return getItem(this.ownerActor, this.entry.itemId); }
    get label() { return this.entry.label; }
    get icon() { return this.item?.img && !this.entry.activityId
      ? this.item.img : (this.entry.activityId ? activityById(this.item, this.entry.activityId)?.img : null)
        || this.item?.img || this.entry.icon || iconFor(this.entry.group); }
    get colorScheme() { return ({bonus:1,free:2,reaction:3})[this.entry.economy] ?? 0; }
    get disabled() { return !isAvailable(this.ownerActor, this.entry) || ui.ARGON?._actor !== this.ownerActor; }
    get visible() { return !!this.item; }
    async getData() { const data = await super.getData(); return {...data, label: escapeHTML(data.label)}; }
    async _renderInner() {
      await super._renderInner();
      this.element.classList.add("argon-oprpg-activity");
      this.element.classList.toggle("argon-oprpg-disabled", this.disabled);
      this.element.title = `${this.entry.label} (${this.entry.economy}) — clique para usar; botão direito: ficha`;
      this.element.setAttribute("aria-label", this.entry.label);
      this.element.setAttribute("aria-disabled", String(this.disabled));
      const details = resourceLabel(activityById(this.item, this.entry.activityId), this.item);
      if (details) {
        const line = document.createElement("small"); line.textContent = details;
        line.className = "argon-oprpg-resources"; this.element.append(line);
        this.element.title += ` · ${details}`;
      }
      this.element.tabIndex = 0;
    }
    async _onLeftClick(event) {
      event?.preventDefault?.(); event?.stopPropagation?.();
      if (this.disabled) return warn("Você não pode usar esta atividade.");
      const result = await executeEntry(this.ownerActor, this.entry, {notify: warn});
      if (result.reason === "no-native-use") this.item?.sheet?.render?.(true);
      if (result.reason === "pending") warn("Esta atividade já está em execução.");
    }
    async _onRightClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); this.item?.sheet?.render?.(true); }
    async activateListeners(element) {
      await super.activateListeners(element);
      keyboard(element, event => this._onLeftClick(event));
      element.onkeydown = event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void this._onLeftClick(event); }
        if (event.key === "F2") { event.preventDefault(); void this._onRightClick(event); }
        if (event.key === "Escape") { this.parent.toggle(false); this.parent.parent.element.focus(); }
      };
    }
  }

  class OPRPGCategoryButton extends ButtonPanelButton {
    constructor(group, economy, entries, actor) {
      super(); this.group = group; this.economy = economy; this.entries = entries; this.ownerActor = actor;
    }
    get label() { return `${groupLabel(this.group)} (${this.entries.length})`; }
    get icon() { return iconFor(this.group); }
    get colorScheme() { return ({bonus:1,free:2,reaction:3})[this.economy.key] ?? 0; }
    async activateListeners(element) {
      await super.activateListeners(element);
      keyboard(element, event => this._onClick(event), {expanded: true});
      element.setAttribute("aria-label", `${this.economy.label}: ${this.label}`);
      element.title = `${this.economy.label}: ${this.label}`;
      element.setAttribute("aria-expanded", String(this.panel?.visible ?? false));
    }
    async getData() { const data = await super.getData(); return {...data, label: escapeHTML(data.label)}; }
    async _getPanel() {
      const buttons = this.entries.map(entry => new OPRPGActivityButton(entry, this.ownerActor));
      return new OPRPGList({id:`argon-oprpg-${this.group}-${this.economy.key}`, buttons});
    }
  }

  class OPRPGBasicButton extends ActionButton {
    constructor(key, label, icon) { super(); this.key = key; this.name = label; this.image = icon; }
    get label() { return this.name; }
    get icon() { return this.image; }
    async _onLeftClick(event) {
      try { return await useBasicAction(this.actor, this.key, this.icon, event); }
      catch (error) { console.error("[System Fixes/Argon] Ação básica", error); warn("Não foi possível executar a ação básica. Consulte F12."); }
    }
    async activateListeners(element) { await super.activateListeners(element); keyboard(element, event => this._onLeftClick(event)); element.setAttribute("aria-label",this.label); }
  }
  class OPRPGBasics extends ButtonPanelButton {
    get label() { return "Básicas"; }
    get icon() { return "icons/svg/dice-target.svg"; }
    async activateListeners(element) { await super.activateListeners(element); keyboard(element, event => this._onClick(event), {expanded:true}); element.setAttribute("aria-label","Ações básicas"); }
    async _getPanel() {
      const buttons = [["dodge","Esquivar","shield"],["ready","Preparar","clockwork"],["dash","Disparada","wingfoot"],["hide","Esconder","cloak"]]
        .map(([key,label,icon]) => new OPRPGBasicButton(key,label,`icons/svg/${icon}.svg`));
      return new OPRPGList({id:"argon-oprpg-basics",buttons});
    }
  }

  function makePanel(economy) {
    // Extends CORE ActionPanel directly, so CORE uses its standard template.
    return class OPRPGGroupPanel extends ActionPanel {
      get label() { return economy.label; }
      get maxActions() { return null; }
      get currentActions() { return null; }
      async _getButtons() {
        const actor = this.actor;
        if (!actor) return [];
        const entries = entriesForActor(actor).filter(entry => entry.economy === economy.key);
        const buttons = [];
        if (economy.key === "action") buttons.push(new OPRPGBasics());
        for (const group of GROUPS) {
          const subset = entries.filter(entry => entry.group === group.key);
          if (subset.length) buttons.push(new OPRPGCategoryButton(group.key, economy, subset, actor));
        }
        return buttons;
      }
    };
  }

  class OPRPGPortrait extends PortraitPanel {
    get isDead() { return this.actor.statuses?.has("dead") || (finiteValue(this.actor.system?.attributes?.hp?.value) === 0 && (this.actor.type === "npc" || this.failures >= 3)); }
    get isDying() { return !this.isDead && this.actor.type === "character" && finiteValue(this.actor.system?.attributes?.hp?.value) === 0 && this.successes < 3; }
    get successes() { return this.actor.system?.attributes?.death?.success ?? 0; }
    get failures() { return this.actor.system?.attributes?.death?.failure ?? 0; }
    async _onDeathSave(event) { return this.actor.rollDeathSave?.({event}); }
    async _renderInner(data) {
      ui.ARGON.element.classList.add("argon-oprpg");
      await super._renderInner(data);
      for (const button of this._buttons) {
        keyboard(button.element, button.onClick);
        button.element.setAttribute("aria-label", button.label);
      }
    }
    async _getButtons() {
      const buttons = await super._getButtons();
      if (asArray(this.actor.getFlag?.("oprpg-system", "haki")?.talentos).length && typeof game.oprpg?.openHakiHud === "function") {
        buttons.push({id:"haki", icon:"fas fa-hand-fist", label:"Abrir Haki", onClick:() => game.oprpg.openHakiHud(this.actor)});
      }
      return buttons;
    }
    get description() {
      const level = this.actor?.system?.details?.level;
      return Number.isFinite(Number(level)) && level !== "" && level != null ? `Nível ${level}` : "";
    }
    async getStatBlocks() {
      const sys = this.actor?.system ?? {};
      const hp = sys.attributes?.hp;
      const pp = sys.energy ? {value:sys.energy.total, max:sys.energy.max} : sys.attributes?.pp ?? sys.resources?.pp;
      const ac = sys.attributes?.ac?.value ?? sys.attributes?.ac;
      const blocks = [];
      if (hp && finiteValue(hp.value) !== null) {
        blocks.push([{text:`PV: ${hp.value}${finiteValue(hp.max) !== null ? `/${hp.max}` : ""}${finiteValue(hp.temp) > 0 ? ` (+${hp.temp})` : ""}`}]);
      }
      if (pp && finiteValue(pp.value) !== null) {
        blocks.push([{text:`PP: ${pp.value}${finiteValue(pp.max) !== null ? `/${pp.max}` : ""}`}]);
      }
      if (finiteValue(ac) !== null) blocks.push([{text:`Defesa: ${ac}`}]);
      return blocks;
    }
  }

  // Keep weapon sets hidden until their native item selection is integrated.
  class OPRPGWeaponSets extends api.WeaponSets {
    get visible() { return false; }
  }

  class OPRPGMovement extends api.MovementHud {
    get visible() {
      return (game.settings?.get?.(ID, "argonShowMovement") ?? true) && !!this.token && !!game.combat?.started && this.movementMax > 0;
    }
    get movementMax() {
      const info = dashMovementInfo(this.actor, this.token, this.movementMode);
      return info.conversionKnown && info.maxSpaces > 0 ? Math.max(1, Math.round(info.maxSpaces)) : 0;
    }
    updateMovement() {
      if (!this.movementMax) return;
      super.updateMovement();
    }
  }

  class OPRPGAccessibleRow extends DrawerButton {
    get template() { return partial("DrawerButton"); }
    async activateListeners(element) {
      await super.activateListeners(element);
      for (const span of element.querySelectorAll("span[data-index]")) {
        const button = this._buttons[Number(span.dataset.index)];
        if (!button?.onClick) continue;
        keyboard(span, event => span.onclick?.(event));
        const onKey = span.onkeydown;
        span.onkeydown = event => {
          if (event.key === "Escape") {
            event.preventDefault();
            this.parent._expandPanel(ui.ARGON._lastExpandedDrawer);
            this.parent.element.querySelector(".ability-toggle .ability-title")?.focus();
          } else onKey(event);
        };
        span.setAttribute("aria-label", span.textContent);
      }
    }
  }
  function drawerRow(label, callback) {
    const actor = ui.ARGON._actor;
    return new OPRPGAccessibleRow([{label:escapeHTML(label), onClick:async event => {
      if (ui.ARGON._actor !== actor || !actor?.isOwner) return warn("Sem permissão para esta ficha.");
      try { await callback(event); } catch (error) { console.error("[System Fixes/Argon]", error); warn("Não foi possível executar. Abra a ficha."); }
    }}]);
  }
  function category(label, buttons) {
    return {gridCols:"1fr", captions:[{label, align:"start"}], buttons};
  }
  class OPRPGDrawer extends DrawerPanel {
    get title() { return "Ficha e atalhos"; }
    async activateListeners(element) {
      await super.activateListeners(element);
      for (const toggle of element.querySelectorAll(".ability-toggle .ability-title")) {
        keyboard(toggle, () => this._expandPanel(toggle.dataset.index));
        toggle.setAttribute("aria-label", this.title);
        toggle.setAttribute("aria-expanded", String(toggle.classList.contains("active")));
      }
    }
    _expandPanel(index) {
      const toggles = [...this.element.querySelectorAll(".ability-toggle .ability-title")];
      const target = toggles.find(toggle => toggle.dataset.index === String(index));
      const open = !!target && !target.classList.contains("active");
      for (const panel of this.element.querySelectorAll(".collapsible-panel")) {
        panel.style.maxHeight = open && panel.dataset.index === String(index) ? `${Math.max(80, window.innerHeight - 180)}px` : "0px";
      }
      for (const toggle of toggles) {
        const active = open && toggle === target;
        toggle.classList.toggle("active", active);
        toggle.setAttribute("aria-expanded", String(active));
      }
      ui.ARGON._lastExpandedDrawer = open ? index : null;
      document.body.classList.toggle("ech-show-ability-menu", open);
    }
    get categories() {
      const actor = this.actor;
      const result = [];
      const favorites = asArray(actor.system?.favorites).slice().sort((a,b) => (a.sort ?? 0) - (b.sort ?? 0));
      if (favorites.length) result.push(category("Favoritos", favorites.map(favorite => {
        let name = favorite.id;
        try { name = globalThis.fromUuidSync?.(favorite.id, {relative:actor,strict:false})?.name ??
          game.i18n.localize(CONFIG.DND5E?.skills?.[favorite.id]?.label ?? CONFIG.DND5E?.toolTypes?.[favorite.id] ?? favorite.id); } catch (_) { /* stale favorite stays inspectable */ }
        return drawerRow(name, async event => {
        if (favorite.type === "skill") return actor.rollSkill({skill:favorite.id, event});
        if (favorite.type === "tool") return actor.rollToolCheck({tool:favorite.id, event});
        const doc = await fromUuid(favorite.id, {relative:actor});
        const item = doc?.item ?? (doc?.documentName === "Item" ? doc : null);
        if (item?.parent !== actor && doc?.parent !== actor && doc?.parent?.parent !== actor) return warn("Favorito não pertence a esta ficha.");
        if (favorite.type === "activity" && item) return executeEntry(actor, {itemId:item.id, activityId:doc.id, label:doc.name}, {notify:warn});
        if (favorite.type === "item" && item) {
          const entries = entriesForActor(actor).filter(entry => entry.itemId === item.id);
          if (entries.length === 1) return executeEntry(actor, entries[0], {notify:warn});
          return item.sheet?.render(true);
        }
        if (favorite.type === "effect" && doc && !doc.isSuppressed && doc.isOwner) return doc.update({disabled:!doc.disabled});
        return doc?.sheet?.render(true);
      }); })));
      if (typeof actor.rollAbilityCheck === "function") result.push(category("Atributos", Object.keys(actor.system?.abilities ?? {}).map(key =>
        drawerRow(game.i18n.localize(CONFIG.DND5E?.abilities?.[key]?.label ?? key), event => actor.rollAbilityCheck({ability:key,event})))));
      if (typeof actor.rollSavingThrow === "function") result.push(category("Salvaguardas", Object.keys(actor.system?.abilities ?? {}).map(key =>
        drawerRow(game.i18n.localize(CONFIG.DND5E?.abilities?.[key]?.label ?? key), event => actor.rollSavingThrow({ability:key,event})))));
      if (typeof actor.rollSkill === "function") result.push(category("Perícias", Object.keys(actor.system?.skills ?? {}).map(key =>
        drawerRow(game.i18n.localize(CONFIG.DND5E?.skills?.[key]?.label ?? key), event => actor.rollSkill({skill:key,event})))));
      if (typeof actor.rollToolCheck === "function") result.push(category("Ferramentas", Object.keys(actor.system?.tools ?? {}).map(key =>
        drawerRow(game.i18n.localize(CONFIG.DND5E?.toolTypes?.[key] ?? key), event => actor.rollToolCheck({tool:key,event})))));
      const effects = asArray(actor.effects);
      if (effects.length) result.push(category("Efeitos — ativar/desativar", effects.map(effect => drawerRow(`${effect.disabled ? "Inativo" : "Ativo"}: ${effect.name}`, () => {
        if (effect.isSuppressed || !effect.isOwner) return warn("Efeito suprimido ou sem permissão; abra a ficha.");
        return effect.update({disabled:!effect.disabled});
      }))));
      const passive = asArray(actor.items).filter(item => !entriesForActor({items:[item]}).length);
      if (passive.length) result.push(category("Itens e habilidades — ficha", passive.map(item => drawerRow(item.name, () => item.sheet?.render(true)))));
      const enabled = game.settings?.get?.(ID, "argonShowMacros") ?? true;
      const macros = enabled ? [...new Set(Object.entries(game.user?.hotbar ?? {}).sort(([a],[b]) => Number(a)-Number(b)).map(([,id]) => id))]
        .map(id => game.macros?.get?.(id)).filter(usableMacro) : [];
      if (macros.length) result.push(category("Macros", macros.map(m => drawerRow(m.name, () => {
        if (usableMacro(m)) return m.execute();
        warn("Macro indisponível ou sem permissão.");
      }))));
      return result.length ? result : [category("Ficha", [drawerRow("Abrir ficha", () => actor.sheet.render(true))])];
    }
  }

  CoreHUD.defineSupportedActorTypes(["character", "npc", "vehicle"]);
  CoreHUD.definePortraitPanel(OPRPGPortrait);
  CoreHUD.defineDrawerPanel(OPRPGDrawer);
  CoreHUD.defineWeaponSets(OPRPGWeaponSets);
  CoreHUD.defineMovementHud(OPRPGMovement);
  CoreHUD.defineMainPanels(ECONOMY.map(makePanel));
}
