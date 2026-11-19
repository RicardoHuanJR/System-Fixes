import { GROUPS, ECONOMY, entriesForActor, escapeHTML, activityById, asArray, finiteValue, resourceLabel, matchesEntry } from "./model.js";
import { executeEntry, getItem, isAvailable, unavailableReason, isEntryPending } from "./execute.js";
import { useBasicAction, dashMovementInfo } from "./basic-actions.js";
import { weaponSetsForActor, weaponsForActor, setWeaponSlot, selectWeaponSet } from "./weapon-sets.js";
import { isFavoriteEntry, toggleFavoriteEntry } from "./favorites.js";
import { activityDetails } from "./activity-details.js";

const ID = "oprpg-system-fixes";
const warn = msg => ui.notifications?.warn?.(`Argon OPRPG: ${msg}`);
const panelStates = new WeakMap();
const listComponents = new WeakMap();

export function rememberArgonFocus(hud = globalThis.ui?.ARGON) {
  const active = globalThis.document?.activeElement;
  const panel = active?.closest?.(".argon-oprpg-list");
  const state = panelStates.get(hud?._actor)?.get(panel?.id);
  if (!state) return;
  if (active.matches("input[type=search]")) state.focus = {search:true, start:active.selectionStart, end:active.selectionEnd};
  else if (active.dataset.entryKey) state.focus = {key:active.dataset.entryKey};
  else if (active.classList.contains("argon-oprpg-favorite")) state.focus = {favorite:active.closest(".argon-oprpg-entry")?.querySelector("[data-entry-key]")?.dataset.entryKey};
  else if (active.classList.contains("argon-oprpg-info")) state.focus = {info:active.closest(".argon-oprpg-entry")?.querySelector("[data-entry-key]")?.dataset.entryKey};
  else if (active.matches("select")) state.focus = {control:active.getAttribute("aria-label")};
  else if (active.dataset.group) state.focus = {group:active.dataset.group};
  else if (active.matches("summary")) state.focus = {summary:true};
}

function iconFor(group) { return GROUPS.find(g => g.key === group)?.icon ?? "icons/svg/dice-target.svg"; }
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
      if (event.key === "Escape") { closeLists(); ui.ARGON.components?.drawer?._expandPanel(null); }
    };
    if (expanded) element.setAttribute("aria-haspopup", "true");
  }

  function closeLists(except) {
    for (const element of ui.ARGON.element.querySelectorAll(".argon-oprpg-list.show")) {
      const list = listComponents.get(element);
      if (list && list !== except) list.toggle(false);
    }
  }

  class OPRPGList extends ButtonPanel {
    constructor(options) {
      super(options);
      this.ownerActor = options.actor ?? this.actor;
      this.title = options.title ?? "Atividades";
      this.filters = options.filters ?? false;
      this.weaponSetOnly = options.weaponSetOnly ?? false;
      this.showEconomy = options.showEconomy ?? false;
      if (!panelStates.has(this.ownerActor)) panelStates.set(this.ownerActor, new Map());
      const states = panelStates.get(this.ownerActor);
      const sets = weaponSetsForActor(this.ownerActor);
      const selected = sets.sets.find(set => set.id === sets.active);
      if (!states.has(this.id)) states.set(this.id, {query:"", group:"all", scroll:0, useSet:this.weaponSetOnly && !!(selected.primary || selected.secondary)});
      this.state = states.get(this.id);
      listComponents.set(this.element, this);
    }
    get template() { return partial("ButtonPanel"); }
    get classes() { return [...super.classes, "argon-oprpg-list"]; }
    saveState() {
      if (this.ownerActor === ui.ARGON._actor && this.element.isConnected) super.saveState();
    }
    restoreState() {
      if (this.ownerActor === ui.ARGON._actor && this.element.isConnected) super.restoreState();
    }
    async _renderInner() {
      await super._renderInner();
      if (this.ownerActor !== ui.ARGON._actor || !this.element.isConnected) return;
      this.element.id = this.id;
      this.element.setAttribute("role", "region");
      this.element.setAttribute("aria-label", this.title);
      const header = document.createElement("div"); header.className = "argon-oprpg-list-header";
      const title = document.createElement("strong"); title.textContent = this.title;
      const close = document.createElement("button"); close.type = "button"; close.textContent = "Fechar";
      close.onclick = () => this.close(); header.append(title, close);
      const search = document.createElement("input");
      search.type = "search"; search.placeholder = "Buscar por nome ou atividade…"; search.value = this.state.query;
      search.setAttribute("aria-label", "Buscar atividade neste painel");
      const filters = document.createElement("div"); filters.className = "argon-oprpg-filters";
      filters.setAttribute("role", "group"); filters.setAttribute("aria-label", "Filtrar atividades");
      const groups = this.filters ? [{key:"all",label:"Todas"}, ...[{key:"basic",label:"Básicas"}, ...GROUPS].filter(group => this._buttons.some(button => button.entry?.group === group.key))] : [];
      if (this.filters && this._buttons.some(button => isFavoriteEntry(this.ownerActor, button.entry))) groups.splice(1,0,{key:"favorites",label:"Favoritos"});
      if (!groups.some(group => group.key === this.state.group)) this.state.group = "all";
      const rows = document.createElement("div"); rows.className = "argon-oprpg-rows";
      for (const button of this._buttons) {
        const container = document.createElement("div"); container.className = "argon-oprpg-entry";
        button.entryContainer = container;
        container.append(button.element);
        const favorite = button.element.querySelector(".argon-oprpg-favorite");
        if (favorite) container.append(favorite);
        if (button.infoElement) container.append(button.infoElement);
        if (button.detailsElement) container.append(button.detailsElement);
        rows.append(container);
      }
      const status = document.createElement("p"); status.setAttribute("role", "status");
      status.className = "argon-oprpg-empty";
      const weapons = weaponsForActor(this.ownerActor);
      const loadout = document.createElement("fieldset"); loadout.className = "argon-oprpg-loadout";
      const legend = document.createElement("legend"); legend.textContent = "Armas do conjunto"; loadout.append(legend);
      const loadoutSection = document.createElement("details"); loadoutSection.className = "argon-oprpg-loadout-section";
      const summary = document.createElement("summary"); summary.textContent = "Conjuntos de armas";
      loadoutSection.open = this.state.loadoutOpen ?? false;
      loadoutSection.ontoggle = () => {this.state.loadoutOpen = loadoutSection.open;};
      loadoutSection.append(summary, loadout);
      const setChoice = document.createElement("select"); setChoice.setAttribute("aria-label", "Conjunto de armas");
      for (const id of ["1","2","3"]) setChoice.add(new Option(`Conjunto ${id}`,id));
      setChoice.value = weaponSetsForActor(this.ownerActor).active;
      const slotControls = [];
      for (const [slot, label] of [["primary","Principal"],["secondary","Secundária"]]) {
        const field = document.createElement("label"); field.textContent = label;
        const select = document.createElement("select"); select.setAttribute("aria-label", `Arma ${label.toLocaleLowerCase()}`);
        select.add(new Option("Nenhuma", ""));
        for (const item of weapons) select.add(new Option(item.name, item.id));
        const slots = weaponSetsForActor(this.ownerActor).sets.find(set => set.id === setChoice.value);
        select.value = slots?.[slot]?.id ?? "";
        select.onchange = () => changeLoadout(() => setWeaponSlot(this.ownerActor, setChoice.value, slot, select.value));
        field.append(select); slotControls.push({slot, select}); loadout.append(field);
      }
      const useSetLabel = document.createElement("label");
      const useSet = document.createElement("input"); useSet.type = "checkbox"; useSet.checked = this.state.useSet ?? false;
      useSet.onchange = () => {this.state.useSet = useSet.checked; applyFilters();};
      useSetLabel.append(useSet, document.createTextNode("Só armas deste conjunto"));
      const note = document.createElement("small"); note.textContent = "Não altera equipamento nem consome ações.";
      loadout.insertBefore(setChoice,legend.nextSibling); loadout.append(useSetLabel, note);
      const changeLoadout = async callback => {
        if (ui.ARGON._actor !== this.ownerActor) return;
        loadout.disabled = true;
        try {
          if (!await callback()) return warn("Não foi possível alterar este conjunto de armas.");
          const current = weaponSetsForActor(this.ownerActor);
          const set = current.sets.find(set => set.id === current.active);
          for (const {slot, select} of slotControls) select.value = set?.[slot]?.id ?? "";
          applyFilters();
        } catch (error) { console.error("[System Fixes/Argon] Conjuntos",error); warn("Não foi possível salvar o conjunto. Tente novamente."); }
        finally {loadout.disabled = !this.ownerActor.isOwner;}
      };
      setChoice.onchange = () => changeLoadout(() => selectWeaponSet(this.ownerActor, setChoice.value));
      loadout.disabled = !this.ownerActor.isOwner;
      const applyFilters = () => {
        this.state.query = search.value;
        loadoutSection.hidden = !weapons.length || !(this.weaponSetOnly || this.state.group === "weapons");
        const sets = weaponSetsForActor(this.ownerActor);
        const selected = sets.sets.find(set => set.id === sets.active);
        const itemIds = new Set([selected?.primary?.id, selected?.secondary?.id]);
        let count = 0;
        for (const button of this._buttons) {
          const group = this.state.group === "favorites" ? "all" : this.state.group;
          const match = matchesEntry({label:button.label,group:button.entry?.group}, this.state.query, group) &&
            (this.state.group !== "favorites" || isFavoriteEntry(this.ownerActor, button.entry)) &&
            !(this.state.useSet && (this.weaponSetOnly || this.state.group === "weapons") && !itemIds.has(button.entry?.itemId));
          button.element.hidden = !match;
          button.entryContainer.hidden = !match;
          if (match) count++;
        }
        for (const filter of filters.children) filter.setAttribute("aria-pressed", String(filter.dataset.group === this.state.group));
        status.textContent = count ? `${count} ${count === 1 ? "atividade" : "atividades"}` :
          this.weaponSetOnly && this.state.useSet ? "Conjunto sem atividades. Abra Conjuntos de armas para selecionar outras armas ou desmarcar o filtro." : "Nenhuma atividade encontrada.";
      };
      for (const group of groups) {
        const filter = document.createElement("button"); filter.type = "button"; filter.textContent = group.label;
        filter.dataset.group = group.key;
        filter.onclick = () => {this.state.group = group.key; this.state.scroll = 0; rows.scrollTop = 0; applyFilters();};
        filters.append(filter);
      }
      search.oninput = () => {this.state.scroll = 0; rows.scrollTop = 0; applyFilters();};
      rows.onscroll = () => {this.state.scroll = rows.scrollTop;};
      this.element.prepend(header, search, filters, loadoutSection); this.element.append(rows, status);
      applyFilters(); rows.scrollTop = this.state.scroll;
      if (this.visible && this.state.focus) {
        const focus = this.state.focus; delete this.state.focus;
        if (focus.search) {search.focus({preventScroll:true}); search.setSelectionRange(focus.start,focus.end);}
        else if (focus.favorite) this._buttons.find(button => button.element.dataset.entryKey === focus.favorite)?.favoriteElement?.focus({preventScroll:true});
        else if (focus.info) this._buttons.find(button => button.element.dataset.entryKey === focus.info)?.infoElement?.focus({preventScroll:true});
        else if (focus.control) [...loadout.querySelectorAll("select")].find(control => control.getAttribute("aria-label") === focus.control)?.focus({preventScroll:true});
        else if (focus.group) [...filters.children].find(filter => filter.dataset.group === focus.group)?.focus({preventScroll:true});
        else if (focus.summary) summary.focus({preventScroll:true});
        else this._buttons.find(button => button.element.dataset.entryKey === focus.key && !button.element.hidden)?.element.focus({preventScroll:true});
      }
      this.element.onkeydown = event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); this.close(); }
        if (["ArrowDown","ArrowUp"].includes(event.key) && !event.target.matches("select")) {
          const buttons = this._buttons.filter(button => !button.element.hidden);
          if (!buttons.length) return;
          const current = buttons.findIndex(button => button.element === event.target);
          const next = current < 0 ? 0 : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
          event.preventDefault(); buttons[next].element.focus();
        }
      };
    }
    close() { this.toggle(false); this.parent?.element.focus(); }
    place() {
      if (!this.visible) return;
      const hudLeft = ui.ARGON.element.getBoundingClientRect().left;
      const width = this.element.getBoundingClientRect().width;
      const left = Math.max(8, Math.min(hudLeft, window.innerWidth - width - 8));
      this.element.style.left = `${getComputedStyle(this.element).position === "fixed" ? left : left - hudLeft}px`;
    }
    toggle(value, noTransition) {
      if (this.ownerActor !== ui.ARGON._actor) return;
      const open = value ?? !this.visible;
      if (!open) delete this.state.focus;
      if (open) {
        closeLists(this);
        ui.ARGON.components?.drawer?._expandPanel(null);
      }
      super.toggle(value, noTransition);
      this.place();
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
    get busy() { return this._busy || isEntryPending(this.ownerActor,this.entry); }
    set busy(value) { this._busy = value; }
    get disabled() { return this.busy || !isAvailable(this.ownerActor, this.entry) || ui.ARGON?._actor !== this.ownerActor; }
    get visible() { return !!this.item; }
    async getData() { const data = await super.getData(); return {...data, label: escapeHTML(data.label)}; }
    async _renderInner() {
      await super._renderInner();
      this.element.classList.add("argon-oprpg-activity");
      this.element.dataset.entryKey = `${this.entry.itemId}:${this.entry.activityId ?? "item"}`;
      this.element.classList.toggle("argon-oprpg-disabled", this.disabled);
      this.element.title = `${this.entry.label} — ${ECONOMY.find(e => e.key === this.entry.economy)?.label ?? ""}. F2 ou botão direito: ficha`;
      this.element.setAttribute("aria-label", this.entry.label);
      this.element.setAttribute("aria-disabled", String(this.disabled));
      this.element.toggleAttribute("aria-busy", !!this.busy);
      if (this.busy) this.element.setAttribute("aria-busy", "true");
      this.element.classList.toggle("argon-oprpg-pending", !!this.busy);
      const economy = this.parent.showEconomy ? ECONOMY.find(e => e.key === this.entry.economy)?.label : "";
      const details = [economy,resourceLabel(activityById(this.item, this.entry.activityId), this.item)].filter(Boolean).join(" · ");
      const reason = unavailableReason(this.ownerActor, this.entry);
      if (details || reason || this.busy) {
        const line = document.createElement("small"); line.textContent = details;
        if (reason) line.textContent = reason;
        if (this.busy) line.textContent = "Em execução…";
        line.className = "argon-oprpg-resources"; this.element.append(line);
        this.element.title += ` · ${details}`;
      }
      this.element.tabIndex = 0;
      if (this.ownerActor.isOwner && typeof this.ownerActor.system?.addFavorite === "function") {
        this.favoriteElement?.remove();
        const favorite = document.createElement("button"); favorite.type = "button";
        favorite.className = "argon-oprpg-favorite";
        const starred = isFavoriteEntry(this.ownerActor, this.entry);
        favorite.innerHTML = `<i class="${starred ? "fas" : "far"} fa-star" aria-hidden="true"></i>`;
        favorite.setAttribute("aria-label", starred ? "Remover dos favoritos" : "Adicionar aos favoritos");
        favorite.setAttribute("aria-pressed", String(starred));
        favorite.onmousedown = favorite.onmouseup = event => event.stopPropagation();
        favorite.onclick = async event => {
          event.stopPropagation();
          if (ui.ARGON._actor !== this.ownerActor) return;
          favorite.disabled = true;
          try {
            if (!await toggleFavoriteEntry(this.ownerActor, this.entry)) warn("Edite os favoritos pela ficha.");
            else {rememberArgonFocus(); ui.ARGON.refresh();}
          } catch (error) { console.error("[System Fixes/Argon] Favoritos",error); warn("Não foi possível salvar o favorito."); }
          finally {favorite.disabled = false;}
        };
        this.favoriteElement = favorite;
        (this.entryContainer ?? this.element).append(favorite);
      }
      this.infoElement?.remove(); this.detailsElement?.remove();
      const info = document.createElement("button"); info.type = "button";
      info.className = "argon-oprpg-info";
      info.innerHTML = '<i class="fas fa-circle-info" aria-hidden="true"></i>';
      info.title = "Detalhes da atividade (I)";
      info.setAttribute("aria-label", `Detalhes de ${this.entry.label}`);
      const body = document.createElement("dl"); body.className = "argon-oprpg-activity-details"; body.hidden = true;
      body.id = `${this.parent.id}-details-${this.entry.itemId}-${this.entry.activityId ?? "item"}`;
      info.setAttribute("aria-controls",body.id); info.setAttribute("aria-expanded","false");
      info.onmousedown = info.onmouseup = event => event.stopPropagation();
      const drawDetails = () => {
        body.replaceChildren();
        try {
          if (!game.user.isGM && !this.ownerActor.isOwner && this.ownerActor.testUserPermission?.(game.user,"OBSERVER") !== true) {
            const message = document.createElement("dd"); message.textContent = "Sem permissão para consultar os detalhes desta ficha."; body.append(message); return;
          }
          const rows = activityDetails(activityById(this.item,this.entry.activityId),this.item,value=>game.i18n.localize(value),{isGM:game.user.isGM});
          if (!rows.length) {
            const message = document.createElement("dd"); message.textContent = this.item?.system?.identified === false && !game.user.isGM
              ? "Item não identificado. Abra a ficha para consultar as informações disponíveis."
              : "O sistema não forneceu detalhes visíveis preparados. Abra a ficha do item para consultar."; body.append(message);
          }
          for (const row of rows) {
            const label = document.createElement("dt"); label.textContent = row.label;
            const value = document.createElement("dd"); value.textContent = row.value;
            body.append(label,value);
          }
        } catch (error) {
          console.error("[System Fixes/Argon] Detalhes",error);
          const message = document.createElement("dd"); message.textContent = "Não foi possível consultar os detalhes. Abra a ficha do item."; body.append(message);
        }
      };
      const expanded = this.parent.state.detailsKey === this.element.dataset.entryKey;
      if (expanded) {drawDetails(); body.hidden = false;}
      info.setAttribute("aria-expanded",String(expanded));
      info.onclick = event => {
        event.stopPropagation();
        if (ui.ARGON._actor !== this.ownerActor) return;
        const open = body.hidden;
        for (const button of this.parent._buttons) {
          if (button.detailsElement) button.detailsElement.hidden = true;
          button.infoElement?.setAttribute("aria-expanded","false");
        }
        if (open) drawDetails();
        body.hidden = !open; info.setAttribute("aria-expanded",String(open));
        this.parent.state.detailsKey = open ? this.element.dataset.entryKey : null;
      };
      this.infoElement = info; this.detailsElement = body;
      (this.entryContainer ?? this.element).append(info,body);
    }
    async _onLeftClick(event) {
      event?.preventDefault?.(); event?.stopPropagation?.();
      if (this.disabled) return warn(unavailableReason(this.ownerActor, this.entry) ?? "Esta atividade já está em execução ou a ficha foi trocada.");
      this.busy = true;
      this.element.setAttribute("aria-busy", "true"); this.element.setAttribute("aria-disabled", "true");
      this.element.classList.add("argon-oprpg-pending");
      try {
        const result = await executeEntry(this.ownerActor, this.entry, {notify: warn});
        if (result.reason === "no-native-use") this.item?.sheet?.render?.(true);
        if (result.reason === "pending") warn("Este item já está em execução.");
      } finally {
        this.busy = false; this.element.removeAttribute("aria-busy"); this.element.classList.remove("argon-oprpg-pending");
        this.element.setAttribute("aria-disabled", String(this.disabled));
        if (ui.ARGON._actor === this.ownerActor) {rememberArgonFocus(); ui.ARGON.refresh?.();}
      }
    }
    async _onRightClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); this.item?.sheet?.render?.(true); }
    async activateListeners(element) {
      await super.activateListeners(element);
      keyboard(element, event => this._onLeftClick(event));
      element.onkeydown = event => {
        if (event.target !== element) return;
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void this._onLeftClick(event); }
        if (event.key === "F2") { event.preventDefault(); void this._onRightClick(event); }
        if (event.key.toLocaleLowerCase() === "i" && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); this.infoElement?.click(); }
      };
    }
  }

  class OPRPGCategoryButton extends ButtonPanelButton {
    constructor(group, economy, entries, actor) {
      super(); this.group = group; this.economy = economy; this.entries = entries; this.ownerActor = actor;
      this.hudContainer = ui.ARGON.buttonPanelContainer;
    }
    get buttonPanelContainer() { return this.hudContainer ?? super.buttonPanelContainer; }
    get label() { return this.economy.label; }
    get icon() { return this.economy.icon; }
    get colorScheme() { return ({bonus:1,free:2,reaction:3})[this.economy.key] ?? 0; }
    async activateListeners(element) {
      await super.activateListeners(element);
      keyboard(element, event => this._onClick(event), {expanded: true});
      const count = this.entries.length + (this.economy.key === "action" ? 4 : 0);
      element.setAttribute("aria-label", `${this.economy.label}: ${count} atividades`);
      element.title = `${this.economy.label}: ${count} atividades`;
      element.setAttribute("aria-expanded", String(this.panel?.visible ?? false));
    }
    async getData() { const data = await super.getData(); return {...data, label: escapeHTML(data.label)}; }
    async _getPanel() {
      const buttons = this.entries.map(entry => new OPRPGActivityButton(entry, this.ownerActor));
      if (this.economy.key === "action") buttons.unshift(...basicButtons());
      return new OPRPGList({id:`argon-oprpg-${this.economy.key}`, title:this.economy.label, actor:this.ownerActor, filters:true, buttons});
    }
    async _onClick(event) {
      await super._onClick(event);
      if (this.panel.visible) this.panel.element.querySelector("input[type=search]")?.focus();
    }
  }

  class OPRPGBasicButton extends ActionButton {
    constructor(key, label, icon) { super(); this.key = key; this.name = label; this.image = icon; this.entry = {group:"basic"}; this.ownerActor = this.actor; }
    get label() { return this.name; }
    get icon() { return this.image; }
    async _renderInner() {
      await super._renderInner();
      this.element.setAttribute("aria-disabled", String(!this.ownerActor?.isOwner));
      this.element.classList.toggle("argon-oprpg-disabled", !this.ownerActor?.isOwner);
    }
    async _onLeftClick(event) {
      if (ui.ARGON._actor !== this.ownerActor || !this.ownerActor?.isOwner) return warn("Sem permissão para usar esta ficha.");
      try { return await useBasicAction(this.ownerActor, this.key, this.icon, event); }
      catch (error) { console.error("[System Fixes/Argon] Ação básica", error); warn("Não foi possível executar a ação básica. Consulte F12."); }
    }
    async activateListeners(element) { await super.activateListeners(element); keyboard(element, event => this._onLeftClick(event)); element.setAttribute("aria-label",this.label); }
  }
  function basicButtons() {
    return [["dodge","Esquivar","shield"],["ready","Preparar","clockwork"],["dash","Disparada","wingfoot"],["hide","Esconder","cloak"]]
      .map(([key,label,icon]) => new OPRPGBasicButton(key,label,`icons/svg/${icon}.svg`));
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
        return entries.length || economy.key === "action" ? [new OPRPGCategoryButton("all", economy, entries, actor)] : [];
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
      const actor = this.actor;
      const container = ui.ARGON.buttonPanelContainer;
      const previous = new Map((this.quickPanels ?? []).map(panel=>[panel.id,panel]));
      this.quickPanels = [];
      ui.ARGON.element.classList.add("argon-oprpg");
      await super._renderInner(data);
      if (this.actor !== actor || !this.element.isConnected || container !== ui.ARGON.buttonPanelContainer) return;
      for (const button of this._buttons) {
        keyboard(button.element, button.onClick);
        button.element.setAttribute("aria-label", button.label);
        if (button.quick) {
          const entries = entriesForActor(actor).filter(entry => button.quick === "favorites" ? isFavoriteEntry(actor,entry) : entry.item.type === "weapon");
          const id = `argon-oprpg-quick-${button.quick}`;
          let panel = previous.get(id);
          const reusable = panel?.ownerActor === actor && panel.element.parentElement === container;
          if (!reusable) panel = new OPRPGList({id, title:button.label, actor, buttons:entries.map(entry=>new OPRPGActivityButton(entry,actor)), weaponSetOnly:button.quick === "weapons", showEconomy:true});
          panel._parent = button;
          this.quickPanels.push(panel); previous.delete(id);
          if (!reusable) {container.append(panel.element); await panel.render();}
          button.panel = panel;
          button.element.setAttribute("aria-haspopup","true");
          button.element.setAttribute("aria-controls",panel.id);
          button.element.setAttribute("aria-expanded",String(panel.visible));
        }
      }
      for (const panel of previous.values()) {
        if (panel.ownerActor === actor && panel.element.isConnected) ui.ARGON.setPanelState({visible:false},panel);
        panel.element.remove();
      }
    }
    async _getButtons() {
      const buttons = await super._getButtons();
      const entries = entriesForActor(this.actor);
      const quick = (kind,label,icon) => ({id:`oprpg-${kind}`,quick:kind,label,icon,onClick:() => {
        const button = this._buttons.find(button=>button.quick === kind);
        if (!button?.panel || button.panel.ownerActor !== ui.ARGON._actor) return;
        button.panel.toggle();
        if (button.panel.visible) button.panel.element.querySelector("input[type=search]")?.focus();
      }});
      if (entries.some(entry=>isFavoriteEntry(this.actor,entry))) buttons.push(quick("favorites","Favoritos — atividades","fas fa-star"));
      else if (asArray(this.actor.system?.favorites).length) buttons.push({id:"oprpg-favorites",label:"Favoritos da ficha",icon:"fas fa-star",onClick:()=>{
        const drawer = ui.ARGON.components?.drawer;
        if (!drawer) return;
        if (String(ui.ARGON._lastExpandedDrawer) !== "0") drawer._expandPanel("0");
        drawer.element.querySelector(".collapsible-panel")?.scrollTo(0,0);
      }});
      if (entries.some(entry=>entry.item.type === "weapon")) buttons.push(quick("weapons","Armas — conjunto ativo","fas fa-crosshairs"));
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
      return info.conversionKnown && info.maxSpaces > 0 ? info.maxSpaces : 0;
    }
    updateMovement() {
      const info = dashMovementInfo(this.actor, this.token, this.movementMode);
      if (!info.conversionKnown || !(info.max > 0)) { this.setVisibility(); return; }
      const remaining = Math.max(0, info.max - info.used);
      const text = this.element.querySelector(".movement-text");
      if (text) text.textContent = `Movimento: ${Number(remaining.toFixed(2))}/${Number(info.max.toFixed(2))} ${info.actorUnits ?? ""}`;
      this.element.setAttribute("aria-label", text?.textContent ?? "Movimento");
      this.element.title = `${this.movementMode}: ${Number(info.used.toFixed(2))} ${info.actorUnits ?? ""} percorridos`;
      this.element.querySelector(".movement-spaces")?.replaceChildren();
      this.setVisibility();
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
      if (open) closeLists();
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
  globalThis.document?.addEventListener("pointerdown", event => {
    const hud = ui.ARGON?.element;
    if (hud?.classList.contains("argon-oprpg") && !hud.contains(event.target)) {
      closeLists(); ui.ARGON.components?.drawer?._expandPanel(null);
    }
  });
  globalThis.window?.addEventListener("resize", () => {
    for (const element of ui.ARGON?.element?.querySelectorAll(".argon-oprpg-list.show") ?? []) listComponents.get(element)?.place();
  });
}
