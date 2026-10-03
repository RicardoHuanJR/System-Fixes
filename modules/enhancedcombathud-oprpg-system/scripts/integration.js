import { MODULE_ID, SYSTEM_ID, t } from "./settings.js";
import {
  activitiesOf, activityCanUse, activityType, convertLengthSafe, featureItems, getItem, getLabel,
  isActivity, isExcludedSystemSpell, itemMatchesActivation, matchingActivities, ppCostInfo, resolveIcon, techniqueGrade, techniqueItems, techniqueLabel,
  usableItems
} from "./utils.js";
import { OPRPG } from "./oprpg-api.js";

import { chooseActivity, tooltipFor, tooltipForActivities } from "./activity-ui.js";
import { basicActionEffect, dashMovementInfo, useBasicAction } from "./basic-actions.js";


const registeredCoreHuds = new WeakSet();

export function registerArgonIntegration(CoreHud) {
  if (game.system.id !== SYSTEM_ID) return false;
  if (!CoreHud || typeof CoreHud.definePortraitPanel !== "function") {
    console.error("Argon OPRPG | CoreHud inválido ou API do Argon indisponível.", CoreHud);
    return false;
  }
  if (registeredCoreHuds.has(CoreHud)) return true;
  const A = CoreHud.ARGON;
  const {ItemButton, ActionButton, ButtonPanelButton} = A.MAIN.BUTTONS;
  const {ButtonPanel} = A.MAIN.BUTTON_PANELS;
  const {AccordionPanel, AccordionPanelCategory} = A.MAIN.BUTTON_PANELS.ACCORDION;

  class OPRPGItemButton extends ItemButton {
    constructor({ item, isWeaponSet = false, isPrimary = false, inActionPanel = undefined, activationFilter = null } = {}) {
      super({ item, isWeaponSet, isPrimary, inActionPanel });
      this._activationFilter = activationFilter;
    }
    get source() { return this._item; }
    get item() { return getItem(this._item); }
    get candidateActivities() {
      if (isActivity(this._item)) return activityCanUse(this._item) ? [this._item] : [];
      return matchingActivities(this.item, this._activationFilter);
    }
    get activity() { return this.candidateActivities[0] ?? (isActivity(this._item) ? this._item : activitiesOf(this.item)[0]); }
    get label() {
      if (isActivity(this._item)) return this.item?.name === this._item.name ? this._item.name : `${this._item.name} (${this.item?.name ?? ""})`;
      return this.item?.name ?? "";
    }
    get icon() { return resolveIcon(this._item); }
    get hasTooltip() { return true; }
    get ranges() {
      if (this.candidateActivities.length > 1) return { normal: null, long: null };
      const a = this.activity;
      if (!a) return { normal: null, long: null };
      const sceneUnits = canvas?.scene?.grid?.units;
      const rangeUnits = a?.range?.units;
      const touch = rangeUnits === "touch" ? canvas?.scene?.grid?.distance : null;
      const convert = value => {
        if (!Number.isFinite(Number(value))) return null;
        return convertLengthSafe(Number(value), rangeUnits, sceneUnits) ?? Number(value);
      };
      return { normal: touch ?? convert(a?.range?.value), long: convert(a?.range?.long) };
    }
    get targets() {
      if (this.candidateActivities.length > 1) return 0;
      const a = this.activity;
      const affects = a?.target?.affects;
      if (!affects) return 0;
      if (["creature", "ally", "enemy"].includes(affects.type)) return Number(affects.count || 1);
      return 0;
    }
    get quantity() {
      if (this.candidateActivities.length > 1) return null;
      const a = this.activity;
      if (a?.uses?.max && Number.isNumeric(a?.uses?.value)) return a.uses.value;
      if (["consumable", "loot"].includes(this.item?.type) && Number.isNumeric(this.item?.system?.quantity)) return this.item.system.quantity;
      return null;
    }
    get displayPPCost() {
      const activities = this.candidateActivities;
      if (!activities.length) return ppCostInfo(this.activity);
      const costs = activities.map(ppCostInfo);
      const labels = [...new Set(costs.map(cost => cost.label ?? ""))];
      if (labels.length === 1) return costs[0];
      return { value: null, label: t("hud.variablePP"), dynamic: true, raw: costs.flatMap(cost => cost.raw ?? []) };
    }
    async getTooltipData() { return this.candidateActivities.length > 1 ? tooltipForActivities(this.item, this.candidateActivities) : tooltipFor(this._item, this.activity); }
    async _onLeftClick(event) {
      if (isActivity(this._item)) return this._item.use({event, legacy: false}, {event});
      if (!this.item) return;
      const activities = this.candidateActivities;
      if (!activities.length) return this.item.use?.({event, legacy: false}, {event});
      const activity = await chooseActivity(this.item, activities);
      if (!activity) return;
      return activity.use({event, legacy: false}, {event});
    }
    async _onRightClick(event) {
      event.preventDefault();
      event.stopPropagation();
      return this.item?.sheet?.render?.(true);
    }
    async _renderInner() {
      await super._renderInner();
      if (!this.item) return;
      if (this.item.type === "spell") this.element.classList.add("oprpg-technique-button");
      const cost = this.displayPPCost;
      if (cost.label) {
        let badge = this.element.querySelector(".oprpg-pp-badge");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "oprpg-pp-badge";
          this.element.appendChild(badge);
        }
        badge.classList.toggle("oprpg-pp-badge-dynamic", cost.dynamic);
        const pp = OPRPG.getPP(this.actor);
        const insufficient = !cost.dynamic && Number.isFinite(cost.value) && cost.value > pp.current;
        badge.classList.toggle("oprpg-pp-badge-insufficient", insufficient);
        this.element.classList.toggle("oprpg-pp-insufficient", insufficient);
        if (insufficient) badge.title = game.i18n.format(`${MODULE_ID}.hud.insufficientPP`, {current: pp.current, required: cost.value});
        else badge.removeAttribute("title");
        badge.textContent = cost.label;
      }
    }
  }

  class OPRPGBasicActionButton extends ActionButton {
    constructor(key, icon) { super(); this.key = key; this._icon = icon; }
    get label() { return t(`basic.${this.key}.name`); }
    get icon() { return this._icon; }
    get hasTooltip() { return true; }
    async getTooltipData() {
      return {title: this.label, description: t(`basic.${this.key}.desc`), subtitle: t("hud.action"), details: [], properties: []};
    }
    async _onLeftClick(event) { return useBasicAction(this.actor, this.key, this.icon, event); }
    async _renderInner() {
      await super._renderInner();
      const active = !!basicActionEffect(this.actor, this.key);
      this.element.classList.toggle("oprpg-basic-action-active", active);
      if (active) this.element.title = `${this.label} — ${t("basic.active")}`;
    }
  }

  class OPRPGHakiButton extends ActionButton {
    get label() { return t("hud.haki"); }
    get icon() { return "systems/oprpg-system/assets/haki/haki-wallpaper.webp"; }
    get colorScheme() { return 2; }
    get visible() {
      if (!game.settings.get(MODULE_ID, "showHaki")) return false;
      return OPRPG.hasHaki(this.actor);
    }
    async _onLeftClick() {
      try {
        return await OPRPG.openHaki(this.actor);
      } catch (err) {
        console.error("Argon OPRPG | Falha ao abrir HUD de Haki", err);
        ui.notifications.error("Não foi possível abrir o HUD de Haki.");
      }
    }
  }

  class OPRPGFavoriteSkillButton extends ActionButton {
    constructor(favorite) { super(); this.favorite = favorite; }
    get label() { return CONFIG.DND5E.skills?.[this.favorite.id]?.label ?? this.favorite.id; }
    get icon() { return "icons/svg/d20-grey.svg"; }
    async _onLeftClick(event) { return this.actor.rollSkill({skill: this.favorite.id, event}); }
  }

  class OPRPGFavoriteToolButton extends ActionButton {
    constructor(favorite) { super(); this.favorite = favorite; }
    get label() { return getLabel(CONFIG.DND5E.tools?.[this.favorite.id] ?? this.favorite.id); }
    get icon() { return "modules/enhancedcombathud/icons/backpack.webp"; }
    get hasTooltip() { return false; }
    async _onLeftClick(event) { return this.actor.rollToolCheck?.({ tool: this.favorite.id, event }); }
  }


  class OPRPGFavoriteEffectButton extends ActionButton {
    constructor(effect) { super(); this.effect = effect; }
    get label() { return this.effect?.name ?? t("hud.effect"); }
    get icon() { return this.effect?.img || "icons/svg/aura.svg"; }
    get hasTooltip() { return true; }
    async getTooltipData() {
      const disabled = !!this.effect?.disabled;
      const suppressed = !!(this.effect?.isSuppressed ?? this.effect?.suppressed);
      return {
        title: this.label,
        description: this.effect?.description ?? "",
        subtitle: suppressed ? t("hud.effectSuppressed") : (disabled ? t("hud.effectDisabled") : t("hud.effectEnabled")),
        details: [], properties: []
      };
    }
    async _onLeftClick() {
      const effect = this.effect;
      if (!effect) return;
      if (effect?.isSuppressed ?? effect?.suppressed) return ui.notifications.warn(t("hud.effectSuppressed"));
      if (!effect.isOwner && !this.actor?.isOwner) return ui.notifications.warn(t("hud.noEffectPermission"));
      await effect.update({disabled: !effect.disabled});
      ui.ARGON?.refresh?.();
    }
    async _onRightClick(event) {
      event?.preventDefault?.(); event?.stopPropagation?.();
      return this.effect?.sheet?.render?.(true);
    }
    async _renderInner() {
      await super._renderInner();
      this.element.classList.add("oprpg-favorite-effect");
      this.element.classList.toggle("oprpg-effect-disabled", !!this.effect?.disabled);
      this.element.classList.toggle("oprpg-effect-suppressed", !!(this.effect?.isSuppressed ?? this.effect?.suppressed));
    }
  }

  function sourceButtons(sources, inActionPanel = false, activationFilter = null) {
    return sources.filter(Boolean).map(source => new OPRPGItemButton({ item: source, inActionPanel, activationFilter }));
  }

  function itemsForActivation(items, activation = null) {
    return items.filter(item => itemMatchesActivation(item, activation));
  }


  class OPRPGTechniquePanelButton extends ButtonPanelButton {
    // Pin the Core partial explicitly because this class is also subclassed by
    // OPRPGAkumaPanelButton. Argon otherwise derives the partial name from the
    // immediate parent class and would request OPRPGTechniquePanelButton.hbs.
    get template() { return "modules/enhancedcombathud/templates/partials/ButtonPanelButton.hbs"; }
    constructor({activation = null, label = null, akuma = null, color = 0} = {}) {
      super(); this.activation = activation; this._label = label; this.akuma = akuma; this._color = color;
    }
    get label() { return this._label ?? t("hud.technique"); }
    get icon() { return "modules/enhancedcombathud/icons/bolt-spell-cast.webp"; }
    get colorScheme() { return this._color; }
    get sources() {
      const items = techniqueItems(this.actor, {akuma: this.akuma});
      return itemsForActivation(items, this.activation);
    }
    get hasContents() { return this.sources.length > 0; }
    async _getPanel() {
      const byGrade = new Map();
      for (const source of this.sources) {
        const grade = techniqueGrade(getItem(source));
        if (!byGrade.has(grade)) byGrade.set(grade, []);
        byGrade.get(grade).push(source);
      }
      const categories = [...byGrade.entries()].sort((a,b) => a[0]-b[0]).map(([grade, sources]) =>
        new AccordionPanelCategory({label: techniqueLabel(grade), buttons: sourceButtons(sources, false, this.activation), uses: {}})
      );
      return new AccordionPanel({id: `oprpg-technique-${this.activation ?? "all"}-${this.akuma ?? "any"}`, accordionPanelCategories: categories});
    }
    async _renderInner() {
      await super._renderInner();
      this.element.classList.add("oprpg-technique-panel-button");
      if (this.activation === "powerful") this.element.classList.add("oprpg-powerful-button");
    }
  }

  class OPRPGFeaturePanelButton extends ButtonPanelButton {
    constructor({activation = null, color = 0} = {}) { super(); this.activation = activation; this._color = color; }
    get label() { return t("hud.feature"); }
    get icon() { return "modules/enhancedcombathud/icons/mighty-force.webp"; }
    get colorScheme() { return this._color; }
    get sources() { return itemsForActivation(featureItems(this.actor), this.activation); }
    get hasContents() { return this.sources.length > 0; }
    async _getPanel() { return new ButtonPanel({id: `oprpg-features-${this.activation ?? "all"}`, buttons: sourceButtons(this.sources, false, this.activation)}); }
    async _renderInner() {
      await super._renderInner();
      if (this.activation === "powerful") this.element.classList.add("oprpg-powerful-button");
    }
  }

  class OPRPGItemPanelButton extends ButtonPanelButton {
    get label() { return t("hud.item"); }
    get icon() { return "modules/enhancedcombathud/icons/backpack.webp"; }
    get colorScheme() { return 2; }
    get sources() { return usableItems(this.actor); }
    get hasContents() { return this.sources.length > 0; }
    async _getPanel() { return new ButtonPanel({id: "oprpg-items", buttons: sourceButtons(this.sources)}); }
  }

  class OPRPGFavoritesPanelButton extends ButtonPanelButton {
    get label() { return t("hud.favorites"); }
    get icon() { return "modules/enhancedcombathud-oprpg-system/icons/favorites-star.svg"; }
    get colorScheme() { return 2; }
    get entries() {
      if (!game.settings.get(MODULE_ID, "showFavorites")) return [];
      if (game.settings.get(MODULE_ID, "favoritesPlacement") === "hidden") return [];
      const result = [];
      for (const fav of this.actor.system?.favorites ?? []) {
        if (fav.type === "skill") { result.push(new OPRPGFavoriteSkillButton(fav)); continue; }
        if (fav.type === "tool") { result.push(new OPRPGFavoriteToolButton(fav)); continue; }
        if (!["activity", "item", "effect"].includes(fav.type)) continue;
        let doc = null;
        try { doc = fromUuidSync(fav.id, { relative: this.actor, strict: false }); } catch (_) {}
        if (!doc) continue;
        if (fav.type === "effect") { result.push(new OPRPGFavoriteEffectButton(doc)); continue; }
        const favoriteItem = getItem(doc);
        if (favoriteItem?.type === "spell" && isExcludedSystemSpell(favoriteItem)) continue;
        if (fav.type === "activity") {
          if (activityCanUse(doc)) result.push(new OPRPGItemButton({ item: doc }));
          continue;
        }
        result.push(new OPRPGItemButton({ item: doc }));
      }
      const max = Math.max(1, Number(game.settings.get(MODULE_ID, "favoritesMax") ?? 8));
      return result.slice(0, max);
    }
    get hasContents() { return this.entries.length > 0; }
    async _getPanel() { return new ButtonPanel({id: "oprpg-favorites", buttons: this.entries}); }
  }

  class OPRPGAkumaPanelButton extends OPRPGTechniquePanelButton {
    constructor() { super({akuma: true, label: t("hud.akuma"), color: 2}); }
    get icon() { return "systems/oprpg-system/assets/akuma/Akuma-Color.webp"; }
    get sources() {
      if (!game.settings.get(MODULE_ID, "showAkuma")) return [];
      return itemsForActivation(techniqueItems(this.actor, {akuma: true}), null);
    }
    async _getPanel() {
      const manifests = [];
      const grouped = new Map();
      for (const source of this.sources) {
        const item = getItem(source);
        if (item?.getFlag?.(SYSTEM_ID, "akumaManif")) { manifests.push(source); continue; }
        const grade = techniqueGrade(item);
        if (!grouped.has(grade)) grouped.set(grade, []);
        grouped.get(grade).push(source);
      }
      const categories = [];
      if (manifests.length) categories.push(new AccordionPanelCategory({label: t("hud.manifestations"), buttons: sourceButtons(manifests), uses: {}}));
      for (const [grade, sources] of [...grouped.entries()].sort((a,b)=>a[0]-b[0])) {
        categories.push(new AccordionPanelCategory({label: techniqueLabel(grade), buttons: sourceButtons(sources), uses: {}}));
      }
      return new AccordionPanel({id: "oprpg-akuma", accordionPanelCategories: categories});
    }
  }

  class OPRPGPortraitPanel extends A.PORTRAIT.PortraitPanel {
    get description() {
      if (this.actor.type === "npc") return this.actor.system?.details?.type?.value ?? "NPC";
      const classes = Object.values(this.actor.classes ?? {}).map(c => `${c.name} ${c.system?.levels ?? ""}`.trim()).join(" / ");
      const race = this.actor.system?.details?.race || this.actor.system?.details?.species || "";
      return [classes, race ? `(${race})` : ""].filter(Boolean).join(" ");
    }
    get isDying() { return (this.actor.system?.attributes?.hp?.value ?? 1) <= 0; }
    get isDead() { return this.isDying && this.actor.type !== "character"; }
    get successes() { return this.actor.system?.attributes?.death?.success ?? 0; }
    get failures() { return this.actor.system?.attributes?.death?.failure ?? 0; }
    async _onDeathSave() { return this.actor.rollDeathSave?.({}); }
    async getStatBlocks() {
      const hp = this.actor.system?.attributes?.hp ?? {};
      const ac = this.actor.system?.attributes?.ac?.value ?? "—";
      const energy = OPRPG.getPP(this.actor);
      const temp = Number(hp.temp ?? 0);
      const hpText = temp > 0 ? `${hp.value}/${hp.max} (+${temp})` : `${hp.value}/${hp.max}`;
      return [
        [{text: hpText}, {text: t("hud.hp")}],
        [{text: t("hud.ac")}, {text: String(ac), color: "var(--ech-movement-baseMovement-background)"}],
        [{text: t("hud.pp")}, {text: `${energy.current ?? 0}/${energy.max ?? 0}`, color: "#d9b5ff"}]
      ];
    }
    async _getButtons() {
      const buttons = await super._getButtons();
      if (game.settings.get(MODULE_ID, "showHaki") && OPRPG.hasHaki(this.actor)) {
        buttons.splice(1, 0, {
          id: "oprpg-haki",
          icon: "fas fa-hand-fist",
          label: t("hud.haki"),
          onClick: async () => {
            try { await OPRPG.openHaki(this.actor); }
            catch (err) { console.error("Argon OPRPG | Falha ao abrir HUD de Haki", err); }
          }
        });
      }
      if (game.settings.get(MODULE_ID, "diagnosticMode")) {
        buttons.splice(1, 0, {
          id: "oprpg-diagnostic",
          icon: "fas fa-bug",
          label: "Diagnóstico OPRPG",
          onClick: (event) => event?.altKey ? globalThis.OPRPG_ARGON_COMPATIBILITY?.(this.actor) : (event?.shiftKey ? globalThis.OPRPG_ARGON_EXPORT_DIAGNOSTIC(this.actor) : (event?.ctrlKey ? globalThis.OPRPG_ARGON_SELF_TEST(this.actor) : globalThis.OPRPG_ARGON_DIAGNOSTIC(this.actor)))
        });
      }
      return buttons;
    }
  }

  class OPRPGDrawerButton extends A.DRAWER.DrawerButton {
    constructor(buttons, source, type) { super(buttons); this.source = source; this.type = type; }
    get hasTooltip() { return !!this.source; }
    async getTooltipData() {
      if (!this.source) return null;
      if (this.type === "skill") {
        const skill = CONFIG.DND5E.skills?.[this.source];
        return {title: getLabel(skill), description: "", subtitle: t("hud.special"), details: [], properties: []};
      }
      return null;
    }
  }

  class OPRPGDrawerPanel extends A.DRAWER.DrawerPanel {
    get title() { return "Resistências / Perícias / Ferramentas"; }
    get categories() {
      const actor = this.actor;
      const sign = n => `${Number(n) >= 0 ? "+" : ""}${Number(n) || 0}`;
      const abilities = Object.entries(actor.system?.abilities ?? {}).map(([key, data]) => new OPRPGDrawerButton([
        {label: getLabel(CONFIG.DND5E.abilities?.[key] ?? key), onClick: e => actor.rollAbilityCheck({ability:key,event:e})},
        {label: sign((data.mod ?? 0) + (data.checkBonus ?? 0)), onClick: e => actor.rollAbilityCheck({ability:key,event:e})},
        {label: sign(data.save?.value ?? data.save ?? 0), onClick: e => actor.rollSavingThrow({ability:key,event:e})}
      ], key, "ability"));
      const skills = Object.entries(actor.system?.skills ?? {}).map(([key, data]) => new OPRPGDrawerButton([
        {label: getLabel(CONFIG.DND5E.skills?.[key] ?? key), onClick: e => actor.rollSkill({skill:key,event:e})},
        {label: `${sign(data.total)} (${data.passive ?? "—"})`}
      ], key, "skill"));
      const tools = Object.entries(actor.system?.tools ?? {}).map(([key, data]) => new OPRPGDrawerButton([
        {label: getLabel(CONFIG.DND5E.tools?.[key] ?? key), onClick: e => actor.rollToolCheck?.({tool:key,event:e})},
        {label: sign(data.total ?? data.mod ?? 0)}
      ], key, "tool"));
      return [
        {gridCols:"5fr 2fr 2fr", captions:[{label:"Atributo",align:"left"},{label:"Teste",align:"center"},{label:"Salv.",align:"center"}], buttons:abilities},
        {gridCols:"7fr 2fr", captions:[{label:"Perícias"},{label:"Total (Passivo)"}], buttons:skills},
        {gridCols:"7fr 2fr", captions:[{label:"Ferramentas"},{label:"Total"}], buttons:tools}
      ];
    }
  }

  class OPRPGMovementHud extends A.MovementHud {
    get visible() {
      return game.settings.get(MODULE_ID, "movementMode") !== "hidden" && !!this.actor && !!this.token;
    }

    get movementMax() {
      const info = dashMovementInfo(this.actor, this.token, this.movementMode);
      return Math.max(Math.round(Number(info.maxSpaces) || 0), 1);
    }

    updateMovement() {
      const mode = game.settings.get(MODULE_ID, "movementMode");
      if (mode === "hidden") {
        this.element.classList.add("hidden");
        return;
      }
      this.element.classList.remove("hidden");
      this.element.classList.toggle("oprpg-simple-movement", mode === "simple");
      if (mode === "argon") return super.updateMovement();

      const info = dashMovementInfo(this.actor, this.token, this.movementMode);
      const fmt = value => Number.isInteger(value) ? String(value) : Number(value).toFixed(1).replace(/\.0$/, "");
      const suffix = info.abbreviation ? ` ${info.abbreviation}` : "";
      const spaces = this.element.querySelector(".movement-spaces");
      if (spaces) spaces.innerHTML = "";
      const current = this.element.querySelector(".movement-current");
      const maxEl = this.element.querySelector(".movement-max");
      if (current) current.textContent = `${fmt(info.remaining)}${suffix}`;
      if (maxEl) maxEl.textContent = `${fmt(info.max)}${suffix}`;
      if (!info.conversionKnown && info.sceneUnits !== info.actorUnits) {
        this.element.title = game.i18n.format(`${MODULE_ID}.warnings.unknownMovementConversion`, {
          scene: info.sceneUnits ?? "—", actor: info.actorUnits ?? "—"
        });
      } else this.element.removeAttribute("title");
    }
  }

  class OPRPGWeaponSets extends A.WeaponSets {
    async getDefaultSets() {
      const weapons = this.actor.items.filter(i => i.type === "weapon");
      const action = weapons.filter(i => activitiesOf(i).some(a => activityCanUse(a) && activityType(a) === "action"));
      const bonus = weapons.filter(i => activitiesOf(i).some(a => activityCanUse(a) && activityType(a) === "bonus"));
      return {
        1:{primary:action[0]?.uuid ?? null, secondary:bonus[0]?.uuid ?? null},
        2:{primary:action[1]?.uuid ?? null, secondary:bonus[1]?.uuid ?? null},
        3:{primary:action[2]?.uuid ?? null, secondary:bonus[2]?.uuid ?? null}
      };
    }
    async _onSetChange({sets, active}) {
      if (game.settings.get(MODULE_ID, "weaponSetMode") !== "equipment") return;
      const selected = Object.values(sets[active] ?? {}).filter(Boolean);
      const other = Object.entries(sets).filter(([k]) => k !== active).flatMap(([,v]) => Object.values(v)).filter(Boolean);
      const updates = [];
      for (const item of selected) if (item?.system && !item.system.equipped) updates.push({_id:item.id,"system.equipped":true});
      for (const item of other) if (item?.system?.equipped && !selected.includes(item)) updates.push({_id:item.id,"system.equipped":false});
      if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
    }
  }

  class BaseOPRPGActionPanel extends A.MAIN.ActionPanel {
    // ArgonComponent derives a template name from the immediate parent class.
    // Our concrete panels inherit from this intermediate class, so without this
    // override Argon tries to load BaseOPRPGActionPanel.hbs, which does not exist.
    // Keep the Core untouched and explicitly reuse its canonical ActionPanel partial.
    get template() { return "modules/enhancedcombathud/templates/partials/ActionPanel.hbs"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    _onNewRound() {}
  }


  class ActionPanel extends BaseOPRPGActionPanel {
    get label() { return t("hud.action"); }
    async _getButtons() {
      const buttons = [new OPRPGItemButton({item:null,isWeaponSet:true,isPrimary:true})];
      if (game.settings.get(MODULE_ID, "showBasicActions")) {
        buttons.push(
          new OPRPGBasicActionButton("dodge", "modules/enhancedcombathud/icons/dodging.webp"),
          new OPRPGBasicActionButton("ready", "modules/enhancedcombathud/icons/clockwork.webp"),
          new OPRPGBasicActionButton("dash", "modules/enhancedcombathud/icons/run.webp"),
          new OPRPGBasicActionButton("hide", "modules/enhancedcombathud/icons/cloak-dagger.webp")
        );
      }
      const techniques = new OPRPGTechniquePanelButton({activation:"action", label:t("hud.technique"), color:0});
      const features = new OPRPGFeaturePanelButton({activation:"action", color:0});
      if (techniques.hasContents) buttons.push(techniques);
      if (features.hasContents) buttons.push(features);
      return buttons;
    }
  }

  class PowerfulPanel extends BaseOPRPGActionPanel {
    get label() { return t("hud.powerful"); }
    async _getButtons() {
      const buttons = [];
      const techniques = new OPRPGTechniquePanelButton({activation:"powerful", label:t("hud.combatTechnique"), color:0});
      const features = new OPRPGFeaturePanelButton({activation:"powerful", color:0});
      if (techniques.hasContents) buttons.push(techniques);
      if (features.hasContents) buttons.push(features);
      return buttons;
    }
  }

  class BonusPanel extends BaseOPRPGActionPanel {
    get label() { return t("hud.bonus"); }
    async _getButtons() {
      const buttons = [new OPRPGItemButton({item:null,isWeaponSet:true,isPrimary:false})];
      const techniques = new OPRPGTechniquePanelButton({activation:"bonus", label:t("hud.auxTechnique"), color:1});
      const features = new OPRPGFeaturePanelButton({activation:"bonus", color:1});
      if (techniques.hasContents) buttons.push(techniques);
      if (features.hasContents) buttons.push(features);
      return buttons;
    }
  }

  class ReactionPanel extends BaseOPRPGActionPanel {
    get label() { return t("hud.reaction"); }
    async _getButtons() {
      const buttons = [];
      const techniques = new OPRPGTechniquePanelButton({activation:"reaction", label:t("hud.auxTechnique"), color:3});
      const features = new OPRPGFeaturePanelButton({activation:"reaction", color:3});
      if (techniques.hasContents) buttons.push(techniques);
      if (features.hasContents) buttons.push(features);
      return buttons;
    }
  }

  class FavoritesPanel extends BaseOPRPGActionPanel {
    get label() { return t("hud.favorites"); }
    get visible() {
      return game.settings.get(MODULE_ID, "showFavorites")
        && game.settings.get(MODULE_ID, "favoritesPlacement") === "main"
        && new OPRPGFavoritesPanelButton().hasContents;
    }
    async _getButtons() {
      if (game.settings.get(MODULE_ID, "favoritesPlacement") !== "main") return [];
      return new OPRPGFavoritesPanelButton().entries;
    }
  }

  class SpecialPanel extends BaseOPRPGActionPanel {
    get label() { return t("hud.special"); }
    async _getButtons() {
      const buttons = [];
      const allTechniques = new OPRPGTechniquePanelButton({activation:null,label:t("hud.technique"),akuma:false,color:2});
      if (allTechniques.hasContents) buttons.push(allTechniques);
      if (game.settings.get(MODULE_ID, "favoritesPlacement") === "special") {
        const favorites = new OPRPGFavoritesPanelButton();
        if (favorites.hasContents) buttons.push(favorites);
      }
      const akuma = new OPRPGAkumaPanelButton();
      if (akuma.hasContents) buttons.push(akuma);
      const haki = new OPRPGHakiButton();
      if (haki.visible) buttons.push(haki);
      const features = new OPRPGFeaturePanelButton({activation:null,color:2});
      if (features.hasContents) buttons.push(features);
      const items = new OPRPGItemPanelButton();
      if (items.hasContents) buttons.push(items);
      return buttons;
    }
  }

  class OPRPGTooltip extends A.CORE.Tooltip {
    get classes() { return [...super.classes, "dnd5e2", "oprpg-tooltip"]; }
  }

  const components = {
    portrait: OPRPGPortraitPanel,
    drawer: OPRPGDrawerPanel,
    panels: [ActionPanel, PowerfulPanel, BonusPanel, ReactionPanel, FavoritesPanel, SpecialPanel, A.PREFAB.PassTurnPanel],
    weaponSets: OPRPGWeaponSets,
    movement: OPRPGMovementHud,
    tooltip: OPRPGTooltip
  };

  const invalid = [
    ["PortraitPanel", components.portrait],
    ["DrawerPanel", components.drawer],
    ["WeaponSets", components.weaponSets],
    ["MovementHud", components.movement],
    ["Tooltip", components.tooltip],
    ...components.panels.map((panel, index) => [`MainPanel[${index}]`, panel])
  ].filter(([, value]) => typeof value !== "function");

  if (invalid.length) {
    console.error("Argon OPRPG | Um ou mais componentes não são construtores válidos.", invalid);
    return false;
  }

  CoreHud.definePortraitPanel(components.portrait);
  CoreHud.defineDrawerPanel(components.drawer);
  CoreHud.defineMainPanels(components.panels);
  CoreHud.defineWeaponSets(components.weaponSets);
  CoreHud.defineMovementHud(components.movement);
  CoreHud.defineTooltip(components.tooltip);
  CoreHud.defineSupportedActorTypes(["character","npc"]);

  registeredCoreHuds.add(CoreHud);
  globalThis.OPRPG_ARGON_REGISTERED = true;
  console.info("Argon OPRPG | Integração nativa v6.4.0 registrada no Argon Core.");
  return true;
}

// Primary path: the Core explicitly announces its registration window.
Hooks.on("argonInit", registerArgonIntegration);

// Safety path: protects against module/load-order races. The Argon Core keeps its
// component registry on the CoreHud class, so registration is still valid after
// ui.ARGON has been constructed, as long as it happens before/then refreshes render.
function lateRegisterArgonIntegration() {
  const CoreHud = ui.ARGON?.constructor;
  if (!CoreHud?.definePortraitPanel) return false;
  const registered = registerArgonIntegration(CoreHud);
  if (registered && ui.ARGON?._target) ui.ARGON.refresh?.();
  return registered;
}

Hooks.once("ready", () => {
  if (lateRegisterArgonIntegration()) return;
  // Some package load orders can leave the Core ready callback after this module.
  // Retry on the next event loop without polling continuously.
  setTimeout(lateRegisterArgonIntegration, 0);
});
Hooks.once("canvasReady", lateRegisterArgonIntegration);
