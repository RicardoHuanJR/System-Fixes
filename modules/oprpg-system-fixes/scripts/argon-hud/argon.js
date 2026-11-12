import { GROUPS, ECONOMY, entriesForActor, escapeHTML, activityById } from "./model.js";
import { executeEntry, getItem, isAvailable } from "./execute.js";

const ID = "oprpg-system-fixes";
const t = key => game.i18n?.localize?.(`ARGON-OPRPG.${key}`) ?? key;
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
      element.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void this._onLeftClick(event); }
      });
    }
  }

  class OPRPGCategoryButton extends ButtonPanelButton {
    constructor(group, economy, entries, actor) {
      super(); this.group = group; this.economy = economy; this.entries = entries; this.ownerActor = actor;
    }
    get label() { return `${this.economy.label} (${this.entries.length})`; }
    get icon() { return this.economy.icon || iconFor(this.group); }
    async getData() { const data = await super.getData(); return {...data, label: escapeHTML(data.label)}; }
    async _getPanel() {
      const buttons = this.entries.map(entry => new OPRPGActivityButton(entry, this.ownerActor));
      return new ButtonPanel({id:`argon-oprpg-${this.group}-${this.economy.key}`, buttons});
    }
  }

  function makePanel(group) {
    // Extends CORE ActionPanel directly, so CORE uses its standard template.
    return class OPRPGGroupPanel extends ActionPanel {
      get label() { return groupLabel(group); }
      get maxActions() { return null; }
      get currentActions() { return null; }
      async _getButtons() {
        const actor = ui.ARGON?._actor;
        if (!actor) return [];
        const entries = entriesForActor(actor).filter(entry => entry.group === group);
        const buttons = [];
        for (const economy of ECONOMY) {
          const subset = entries.filter(entry => entry.economy === economy.key);
          if (subset.length) buttons.push(new OPRPGCategoryButton(group, economy, subset, actor));
        }
        return buttons;
      }
    };
  }

  class OPRPGPortrait extends PortraitPanel {
    get description() {
      const level = this.actor?.system?.details?.level;
      return Number.isFinite(Number(level)) && level !== "" && level != null ? `Nível ${level}` : "";
    }
    async getStatBlocks() {
      const sys = this.actor?.system ?? {};
      const hp = sys.attributes?.hp;
      const pp = sys.attributes?.pp ?? sys.resources?.pp;
      const ac = sys.attributes?.ac?.value ?? sys.attributes?.ac;
      const blocks = [];
      if (hp && Number.isFinite(Number(hp.value))) {
        blocks.push([{text:`${t("HP")}: ${hp.value}${Number.isFinite(Number(hp.max)) ? `/${hp.max}` : ""}`}]);
      }
      if (pp && Number.isFinite(Number(pp.value))) {
        blocks.push([{text:`${t("PP")}: ${pp.value}${Number.isFinite(Number(pp.max)) ? `/${pp.max}` : ""}`}]);
      }
      if (Number.isFinite(Number(ac))) blocks.push([{text:`${t("AC")}: ${ac}`}]);
      return blocks;
    }
  }

  // Keep weapon sets hidden until their native item selection is integrated.
  class OPRPGWeaponSets extends api.WeaponSets {
    get visible() { return false; }
  }

  class OPRPGMovement extends api.MovementHud {
    get visible() {
      return (game.settings?.get?.(ID, "argonShowMovement") ?? true) && !!this.token && !!game.combat?.started;
    }
    get movementMax() {
      const walk = Number(this.actor?.system?.attributes?.movement?.walk ?? 0);
      const distance = Number(canvas?.scene?.dimensions?.distance ?? 5);
      return Number.isFinite(walk) && walk > 0 && Number.isFinite(distance) && distance > 0
        ? Math.max(1, Math.round(walk / distance)) : 1;
    }
  }

  class OPRPGMacroDrawerButton extends DrawerButton {
    constructor(macro) { super([{label:escapeHTML(macro.name), onClick: async () => {
      if (!usableMacro(macro)) return warn("Macro indisponível ou sem permissão.");
      try { await macro.execute(); } catch (error) { console.error("[System Fixes/Argon] Macro",error); warn("Erro ao executar macro. Verifique F12."); }
    }}]); }
  }
  class OPRPGDrawer extends DrawerPanel {
    get title() { return t("Macros"); }
    get categories() {
      const enabled = game.settings?.get?.(ID, "argonShowMacros") ?? true;
      const macros = enabled ? Object.values(game.user?.hotbar ?? {})
        .map(id => game.macros?.get?.(id)).filter(Boolean) : [];
      return [{gridCols:"1fr", captions:[{label:t("Macros"), align:"start"}],
        buttons:macros.length ? macros.map(m => new OPRPGMacroDrawerButton(m))
          : [new DrawerButton([{label:escapeHTML(t("Empty"))}])]}];
    }
  }

  CoreHUD.defineSupportedActorTypes(["character", "npc", "vehicle"]);
  CoreHUD.definePortraitPanel(OPRPGPortrait);
  CoreHUD.defineDrawerPanel(OPRPGDrawer);
  CoreHUD.defineWeaponSets(OPRPGWeaponSets);
  CoreHUD.defineMovementHud(OPRPGMovement);
  CoreHUD.defineMainPanels(GROUPS.map(g => makePanel(g.key)));
}
