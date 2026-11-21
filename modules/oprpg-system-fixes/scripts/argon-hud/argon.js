import { GROUPS, ECONOMY, entriesForActor, escapeHTML, activityById, asArray, finiteValue, resourceLabel, matchesEntry } from "./model.js";
import { executeEntry, getItem, isAvailable, unavailableReason, isEntryPending } from "./execute.js";
import { useBasicAction, dashMovementInfo } from "./basic-actions.js";
import { weaponSetsForActor, weaponsForActor, setWeaponSlot, selectWeaponSet } from "./weapon-sets.js";
import { isFavoriteEntry, toggleFavoriteEntry } from "./favorites.js";
import { activityDetails } from "./activity-details.js";
import { actorAbilities, relatedSkills, rollBonusLabel } from "./actor-tests.js";
import { activityImage } from "./model.js";
import { argonIconPath, argonIconMarkup } from "./icons.js";
import { panelPlacement } from "./panel-layout.js";

const ID = "oprpg-system-fixes";
const warn = msg => ui.notifications?.warn?.(`Argon OPRPG: ${msg}`);
const panelStates = new WeakMap();
const listComponents = new WeakMap();
const drawerStates = new WeakMap();

function rowImage(element, source, fallback) {
  const image = document.createElement("img");
  image.className = "argon-oprpg-thumbnail"; image.alt = "";
  image.width = image.height = 32; image.draggable = false; image.decoding = "async";
  image.setAttribute("aria-hidden","true");
  const sources = [...new Set([source,fallback,"icons/svg/dice-target.svg"].filter(Boolean))];
  let index = 0;
  image.onerror = () => {if (++index < sources.length) image.src = sources[index]; else image.onerror = null;};
  image.src = sources[0];
  element.prepend(image);
}

export function rememberArgonFocus(hud = globalThis.ui?.ARGON) {
  const active = globalThis.document?.activeElement;
  if (active?.closest?.(".argon-oprpg-drawer")) {
    const state = drawerStates.get(hud?._actor);
    if (state) state.focus = active.dataset.drawerKey;
  }
  const panel = active?.closest?.(".argon-oprpg-list");
  const state = panelStates.get(hud?._actor)?.get(panel?.id);
  if (!state) return;
  if (active.matches("input[type=search]")) state.focus = {search:true, start:active.selectionStart, end:active.selectionEnd};
  else if (active.dataset.entrySheet) state.focus = {sheet:active.dataset.entrySheet};
  else if (active.dataset.entryKey) state.focus = {key:active.dataset.entryKey};
  else if (active.classList.contains("argon-oprpg-favorite")) state.focus = {favorite:active.closest(".argon-oprpg-entry")?.querySelector("[data-entry-key]")?.dataset.entryKey};
  else if (active.classList.contains("argon-oprpg-info")) state.focus = {info:active.closest(".argon-oprpg-entry")?.querySelector("[data-entry-key]")?.dataset.entryKey};
  else if (active.matches("select")) state.focus = {control:active.getAttribute("aria-label")};
  else if (active.dataset.group) state.focus = {group:active.dataset.group};
  else if (active.matches("summary")) state.focus = {summary:true};
}

function focusInPanel(control,panel) {
  if (!control) return;
  control.focus({preventScroll:true});
  for (const box of [...new Set([control.closest(".argon-oprpg-rows"),panel].filter(Boolean))]) {
    const row=control.getBoundingClientRect(), bounds=box.getBoundingClientRect();
    if (row.top<bounds.top+4) box.scrollTop-=bounds.top+4-row.top;
    else if (row.bottom>bounds.bottom-4) box.scrollTop+=row.bottom-bounds.bottom+4;
  }
}

function iconFor(group) { return argonIconPath(({akuma:"effects",weapons:"sword",techniques:"flame",features:"haki",items:"potion"})[group] ?? "other"); }
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

  let layoutObserver, observedElements=[];
  function chromeRect(id) {
    const element=document.getElementById(id);
    if (!element || element.classList.contains("ech-hidden") || element.hidden) return null;
    const style=getComputedStyle(element), rect=element.getBoundingClientRect();
    return style.display!=="none" && style.visibility!=="hidden" && Number(style.opacity)!==0 && rect.width>0 && rect.height>0 && rect.right>0 && rect.left<innerWidth && rect.bottom>0 && rect.top<innerHeight ? rect : null;
  }
  function placement(anchor,width) {
    return panelPlacement({anchor,width,portrait:ui.ARGON.element.querySelector(".portrait-hud")?.getBoundingClientRect(),viewport:{width:innerWidth,height:innerHeight},sidebar:chromeRect("sidebar"),hotbar:chromeRect("hotbar")});
  }
  function applyPlacement(element,position) {
    element.style.left=position.left+"px";element.style.width=position.width+"px";
    element.style.bottom=position.bottom+"px";element.style.maxHeight=position.maxHeight+"px";
    element.classList.toggle("argon-oprpg-narrow",position.narrow);
  }
  function watchLayout() {
    if (!globalThis.ResizeObserver) return;
    const hud=globalThis.ui?.ARGON?.element;
    if (!hud) return;
    const elements=[hud,hud.querySelector(".action-hud"),document.getElementById("sidebar"),document.getElementById("hotbar")].filter(Boolean);
    if (elements.length===observedElements.length && elements.every((el,i)=>el===observedElements[i])) return;
    layoutObserver ??= new ResizeObserver(placeLists); layoutObserver.disconnect();
    for (const element of elements) layoutObserver.observe(element);
    observedElements=elements;
  }
  function placeLists() {
    watchLayout();
    for (const element of ui.ARGON?.element?.querySelectorAll(".argon-oprpg-list.show") ?? []) listComponents.get(element)?.place();
    ui.ARGON?.components?.drawer?.place?.();
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
      const header = document.createElement("div"); header.className = "argon-oprpg-list-header argon-oprpg-list-tools";
      const title = document.createElement("strong"); title.textContent = this.title;
      const close = document.createElement("button"); close.type = "button";
      close.innerHTML = argonIconMarkup("close"); close.setAttribute("aria-label","Fechar"); close.title = "Fechar";
      close.onclick = () => this.close();
      const search = document.createElement("input");
      search.type = "search"; search.placeholder = "Buscar atividade…"; search.value = this.state.query;
      search.setAttribute("aria-label", "Buscar atividade neste painel");
      header.append(title,search,close);
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
      const reset = document.createElement("button"); reset.type="button";reset.className="argon-oprpg-reset";reset.textContent="Limpar busca e filtros";
      reset.onclick=()=>{search.value="";this.state.group="all";this.state.useSet=false;useSet.checked=false;this.state.scroll=0;rows.scrollTop=0;applyFilters();search.focus();};
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
        if (!count && (this.state.query || this.state.group!=="all" || this.state.useSet)) status.append(reset);
      };
      for (const group of groups) {
        const filter = document.createElement("button"); filter.type = "button"; filter.textContent = group.label;
        filter.dataset.group = group.key;
        filter.onclick = () => {this.state.group = group.key; this.state.scroll = 0; rows.scrollTop = 0; applyFilters();};
        filters.append(filter);
      }
      search.oninput = () => {this.state.scroll = 0; rows.scrollTop = 0; applyFilters();};
      rows.onscroll = () => {this.state.scroll = rows.scrollTop;};
      this.element.prepend(header, filters, loadoutSection); this.element.append(rows, status);
      applyFilters(); rows.scrollTop = this.state.scroll;
      if (this.visible && this.state.focus) {
        const focus = this.state.focus; delete this.state.focus;
        if (focus.search) {search.focus({preventScroll:true}); search.setSelectionRange(focus.start,focus.end);}
        else if (focus.sheet) this._buttons.find(button=>button.element.dataset.entryKey===focus.sheet)?.sheetElement?.focus({preventScroll:true});
        else if (focus.favorite) this._buttons.find(button => button.element.dataset.entryKey === focus.favorite)?.favoriteElement?.focus({preventScroll:true});
        else if (focus.info) this._buttons.find(button => button.element.dataset.entryKey === focus.info)?.infoElement?.focus({preventScroll:true});
        else if (focus.control) [...loadout.querySelectorAll("select")].find(control => control.getAttribute("aria-label") === focus.control)?.focus({preventScroll:true});
        else if (focus.group) [...filters.children].find(filter => filter.dataset.group === focus.group)?.focus({preventScroll:true});
        else if (focus.summary) summary.focus({preventScroll:true});
        else this._buttons.find(button => button.element.dataset.entryKey === focus.key && !button.element.hidden)?.element.focus({preventScroll:true});
      }
      if (this.visible && this.element.contains(document.activeElement)) focusInPanel(document.activeElement,this.element);
      this.element.onkeydown = event => {
        if (event.key === "Escape") {
          event.preventDefault();event.stopPropagation();
          if (event.target.closest(".argon-oprpg-activity-details")) {
            const info=event.target.closest(".argon-oprpg-entry")?.querySelector(".argon-oprpg-info");info?.click();focusInPanel(info,this.element);
          } else this.close();
        }
        if (["Home","End"].includes(event.key) && event.target.matches(".argon-oprpg-activity,.argon-oprpg-basic")) {
          const buttons=this._buttons.filter(button=>!button.element.hidden);event.preventDefault();focusInPanel((event.key==="Home"?buttons[0]:buttons.at(-1))?.element,this.element);
        }
        if (["ArrowDown","ArrowUp"].includes(event.key) && event.target.matches("input[type=search],.argon-oprpg-activity,.argon-oprpg-basic")) {
          const buttons = this._buttons.filter(button => !button.element.hidden);
          if (!buttons.length) return;
          const current = buttons.findIndex(button => button.element === event.target);
          const next = current < 0 ? 0 : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
          event.preventDefault(); focusInPanel(buttons[next].element,this.element);
        }
      };
    }
    close() { this.toggle(false); this.parent?.element.focus(); }
    place() {
      if (!this.visible) return;
      if (this.ownerActor !== ui.ARGON._actor || !this.element.isConnected || !this.parent?.element?.isConnected) return;
      watchLayout();
      applyPlacement(this.element,placement(this.parent.element.getBoundingClientRect(),380));
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
    get icon() { return activityImage(activityById(this.item,this.entry.activityId),this.item,iconFor(this.entry.group)); }
    get colorScheme() { return ({bonus:1,free:2,reaction:3})[this.entry.economy] ?? 0; }
    get busy() { return this._busy || isEntryPending(this.ownerActor,this.entry); }
    set busy(value) { this._busy = value; }
    get disabled() { return this.busy || !isAvailable(this.ownerActor, this.entry) || ui.ARGON?._actor !== this.ownerActor; }
    get visible() { return !!this.item; }
    async getData() { const data = await super.getData(); return {...data, label: escapeHTML(data.label)}; }
    async _renderInner() {
      await super._renderInner();
      this.element.classList.add("argon-oprpg-activity");
      this.element.style.backgroundImage = "none";
      rowImage(this.element,this.icon,this.item?.img !== this.icon ? this.item?.img : iconFor(this.entry.group));
      this.element.dataset.entryKey = `${this.entry.itemId}:${this.entry.activityId ?? "item"}`;
      this.baseTitle = this.entry.label + " — " + (ECONOMY.find(e => e.key === this.entry.economy)?.label ?? "") + ". F2 ou botão direito: ficha";
      this.element.setAttribute("aria-label", this.entry.label);
      const title = this.element.querySelector(".action-element-title");
      const itemName = String(this.item?.name ?? ""), prefix = itemName + " — ";
      if (title && itemName && this.entry.label.startsWith(prefix)) {
        const item = document.createElement("span"), activity = document.createElement("span");
        item.className = "argon-oprpg-item-name"; item.textContent = itemName;
        activity.className = "argon-oprpg-activity-name"; activity.textContent = "— " + this.entry.label.slice(prefix.length);
        title.classList.add("argon-oprpg-identity"); title.replaceChildren(item,activity);
        title.title = this.entry.label;
      }
      const economy = this.parent.showEconomy ? ECONOMY.find(e => e.key === this.entry.economy)?.label : "";
      const activity = activityById(this.item,this.entry.activityId);
      let range;
      try { range = activityDetails(activity,this.item,value=>game.i18n.localize(value),{isGM:game.user.isGM}).find(row=>row.label === "Alcance")?.value; }
      catch (_) { /* Unprepared metadata remains available through the item sheet. */ }
      const canInspect = this.ownerActor.isOwner || game.user.isGM || this.ownerActor.testUserPermission?.(game.user,"OBSERVER") === true;
      const details = canInspect ? [economy,resourceLabel(activity, this.item),range].filter(Boolean).join(" · ") : "";
      const descriptionIds = [];
      const id = this.parent.id + "-" + this.entry.itemId + "-" + (this.entry.activityId ?? "item");
      if (details) {
        const line = document.createElement("small"); line.textContent = details;
        line.className = "argon-oprpg-activity-meta"; line.title = details; line.id = id + "-meta";
        this.element.append(line); descriptionIds.push(line.id); this.baseTitle += " · " + details;
      }
      const state = document.createElement("small"); state.className = "argon-oprpg-activity-state";
      state.id = id + "-state"; this.statusElement = state; this.element.append(state); descriptionIds.push(state.id);
      this.element.setAttribute("aria-describedby",descriptionIds.join(" "));
      this.updateUsageState();
      this.element.tabIndex = 0;
      if (this.ownerActor.isOwner && typeof this.ownerActor.system?.addFavorite === "function") {
        this.favoriteElement?.remove();
        const favorite = document.createElement("button"); favorite.type = "button";
        favorite.className = "argon-oprpg-favorite";
        const starred = isFavoriteEntry(this.ownerActor, this.entry);
        favorite.innerHTML = argonIconMarkup("star");
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
      info.innerHTML = argonIconMarkup("info");
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
          if (typeof this.item?.sheet?.render === "function") {
            const footer=document.createElement("dd"), sheet=document.createElement("button");footer.className="argon-oprpg-detail-actions";
            sheet.type="button";sheet.textContent="Abrir ficha do item";sheet.dataset.entrySheet=this.element.dataset.entryKey;
            sheet.onclick=event=>{event.stopPropagation();void this._onRightClick(event);};
            sheet.onmousedown=sheet.onmouseup=event=>event.stopPropagation();
            this.sheetElement=sheet;footer.append(sheet);body.append(footer);
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
    updateUsageState() {
      const busy = !!this.busy;
      const reason = this.ownerActor === globalThis.ui?.ARGON?._actor ? unavailableReason(this.ownerActor,this.entry) : "A ficha selecionada foi trocada.";
      const text = busy ? "Em execução…" : reason ?? "";
      this.element.dataset.usageState = busy ? "pending" : reason ? "unavailable" : "ready";
      this.element.setAttribute("aria-disabled",String(busy || !!reason));
      if (busy) this.element.setAttribute("aria-busy","true"); else this.element.removeAttribute("aria-busy");
      this.element.classList.toggle("argon-oprpg-disabled",!!reason);
      this.element.classList.toggle("argon-oprpg-pending",busy);
      this.element.title = [this.baseTitle,text].filter(Boolean).join(" · ");
      if (this.statusElement) {this.statusElement.textContent = text; this.statusElement.title = text; this.statusElement.hidden = !text;}
    }
    refreshItemStates() {
      this.updateUsageState();
      for (const element of globalThis.ui?.ARGON?.element?.querySelectorAll(".argon-oprpg-list") ?? []) {
        const panel = listComponents.get(element);
        if (panel?.ownerActor !== this.ownerActor) continue;
        for (const button of panel._buttons) if (button !== this && button.entry?.itemId === this.entry.itemId) button.updateUsageState?.();
      }
    }
    async _onLeftClick(event) {
      event?.preventDefault?.(); event?.stopPropagation?.();
      if (this.disabled) return warn(unavailableReason(this.ownerActor, this.entry) ?? "Esta atividade já está em execução ou a ficha foi trocada.");
      this.busy = true;
      try {
        const usage = executeEntry(this.ownerActor, this.entry, {notify: warn});
        this.refreshItemStates();
        const result = await usage;
        if (result.reason === "no-native-use") this.item?.sheet?.render?.(true);
        if (result.reason === "pending") warn("Este item já está em execução.");
      } finally {
        this.busy = false; this.refreshItemStates();
        if (ui.ARGON._actor === this.ownerActor) {rememberArgonFocus(); ui.ARGON.refresh?.();}
      }
    }
    async _onRightClick(event) {
      event?.preventDefault?.();event?.stopPropagation?.();
      if (ui.ARGON?._actor!==this.ownerActor) return;
      if (!game.user.isGM && !this.ownerActor.isOwner && this.ownerActor.testUserPermission?.(game.user,"OBSERVER")!==true) return warn("Sem permissão para consultar esta ficha.");
      try {await this.item?.sheet?.render?.(true);} catch (error) {console.error("[System Fixes/Argon] Ficha",error);warn("Não foi possível abrir a ficha do item.");}
    }
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
    async _renderInner() {
      await super._renderInner();
      this.element.classList.add("argon-oprpg-launcher");
      this.element.style.backgroundImage = "none";
      const key = ({action:"sword",powerful:"bolt",bonus:"clock",reaction:"shield",free:"other"})[this.economy.key];
      this.element.insertAdjacentHTML("afterbegin",argonIconMarkup(key));
    }
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
      this.element.classList.add("argon-oprpg-basic");
      this.element.style.backgroundImage = "none";
      rowImage(this.element,this.icon,"icons/svg/dice-target.svg");
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
      .map(([key,label]) => new OPRPGBasicButton(key,label,argonIconPath(key)));
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
      ui.ARGON.element.classList.toggle("argon-oprpg-large-text",game.settings.get(ID,"argonTextSize")==="large");
      await super._renderInner(data);
      if (this.actor !== actor || !this.element.isConnected || container !== ui.ARGON.buttonPanelContainer) return;
      // Keep the real portrait separate from every label and resource overlay.
      this.element.querySelector(".portrait-hud-image")?.remove();
      const photo = document.createElement("button"); photo.type = "button";
      photo.className = "argon-oprpg-portrait-photo";
      photo.setAttribute("aria-label", `Abrir ficha de ${actor.name}`); photo.title = `Abrir ficha de ${actor.name}`;
      const image = document.createElement("img");
      image.alt = `Retrato de ${actor.name}`; image.draggable = false;
      image.onerror = () => {image.onerror = null; image.src = argonIconPath("hide");};
      image.src = this.image || argonIconPath("hide"); photo.append(image);
      photo.onclick = () => {if (ui.ARGON._actor === actor) actor.sheet?.render(true);};
      this.element.prepend(photo);
      const name = this.element.querySelector(".player-name");
      if (name) {name.title = actor.name; name.setAttribute("aria-label",actor.name);}
      const effects = this.element.querySelector(".effects-container");
      if (effects) {
        this.element.append(effects);effects.setAttribute("role","group");effects.setAttribute("aria-label","Efeitos do personagem");
        for (const icon of effects.querySelectorAll(".effect-icon")) {
          const label=icon.querySelector("img")?.alt || "Efeito";
          const open=()=>{if (ui.ARGON._actor===actor) void ui.ARGON.components?.drawer?.openFor(null,icon,"effects");};
          keyboard(icon,open,{expanded:true});icon.title=label+" — consultar efeitos";icon.setAttribute("aria-label","Consultar efeito: "+label);
          icon.dataset.drawerSection="effects";icon.setAttribute("aria-controls","argon-oprpg-drawer");
          const nativeMouseUp=icon.onmouseup;
          icon.onmouseup=event=>{
            if(event.button!==0) return nativeMouseUp?.call(icon,event);
            event.preventDefault();event.stopPropagation();open();
          };
          icon.onfocus=()=>{if(icon.offsetTop<effects.scrollTop)effects.scrollTop=icon.offsetTop;else if(icon.offsetTop+icon.offsetHeight>effects.scrollTop+effects.clientHeight)effects.scrollTop=icon.offsetTop+icon.offsetHeight-effects.clientHeight;};
        }
      }
      const stats = document.createElement("div"); stats.className = "argon-oprpg-portrait-stats";
      for (const block of this.element.querySelectorAll(":scope > .portrait-stat-block:not(.player-details)")) {
        block.title = block.textContent; stats.append(block);
      }
      if (stats.children.length) this.element.append(stats);
      const abilities = actorAbilities(actor, CONFIG.DND5E, value => game.i18n.localize(value));
      if (abilities.length) {
        const strip = document.createElement("div"); strip.className = "argon-oprpg-attributes";
        strip.setAttribute("role","group"); strip.setAttribute("aria-label","Atributos — testes e perícias");
        for (const ability of abilities) {
          const button = document.createElement("button"); button.type = "button"; button.dataset.ability = ability.key;
          const mod = ability.mod === null ? "" : (ability.mod >= 0 ? "+" : "") + ability.mod;
          const caption = document.createElement("span"), modifier = document.createElement("strong");
          caption.textContent = ability.short; modifier.textContent = mod; button.append(caption,modifier);
          button.title = ability.label + (ability.value === null ? "" : ": " + ability.value) + (mod ? " (" + mod + ")" : "");
          button.setAttribute("aria-label", "Testes de " + ability.label);
          button.setAttribute("aria-haspopup","true"); button.setAttribute("aria-controls","argon-oprpg-drawer");
          button.setAttribute("aria-expanded",String(!!drawerStates.get(actor)?.open && drawerStates.get(actor).ability === ability.key));
          button.onclick = () => {if (ui.ARGON._actor === actor) void ui.ARGON.components?.drawer?.openFor(ability.key,button);};
          strip.append(button);
        }
        this.element.append(strip);
      }
      for (const button of this._buttons) {
        keyboard(button.element, button.onClick);
        button.element.setAttribute("aria-label", button.label);
        button.element.dataset.shortcut = button.id;
        const glyph = ({"roll-initiative":"ready","open-sheet":"sheet","toggle-minimize":"minus","oprpg-favorites":"star","oprpg-weapons":"sword",haki:"haki"})[button.id];
        if (glyph) button.element.innerHTML = argonIconMarkup(glyph);
        if (button.id === "open-sheet") {
          button.element.dataset.drawerShortcuts = "true";
          button.element.setAttribute("aria-controls","argon-oprpg-drawer");
          button.element.setAttribute("aria-expanded",String(!!drawerStates.get(actor)?.open && drawerStates.get(actor).ability === null && !drawerStates.get(actor).section));
        }
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
      const actor = this.actor;
      for (const button of buttons) {
        if (button.id === "roll-initiative") button.label = "Rolar iniciativa";
        if (button.id === "toggle-minimize") button.label = "Recolher ou expandir HUD";
      }
      const sheetButton = buttons.find(button => button.id === "open-sheet");
      if (sheetButton) {
        sheetButton.label = "Atalhos da ficha";
        sheetButton.onClick = event => {if (ui.ARGON._actor === actor) void ui.ARGON.components?.drawer?.openFor(null,event?.currentTarget);};
      }
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
        if (!drawer.state.open || drawer.state.ability !== null || drawer.state.section) void drawer.openFor(null);
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
        if (button.image) rowImage(span,button.image,"icons/svg/dice-target.svg");
        keyboard(span, event => span.onclick?.(event));
        const onKey = span.onkeydown;
        span.onkeydown = event => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation(); this.parent.close(true);
          } else onKey(event);
        };
        span.setAttribute("aria-label", span.textContent);
        if (button.bonus && (game.user.isGM || this.actor?.isOwner || this.actor?.testUserPermission?.(game.user,"OBSERVER") === true)) {
          const bonus=document.createElement("strong");bonus.className="argon-oprpg-roll-bonus";bonus.textContent=button.bonus;span.append(bonus);
        }
        span.setAttribute("aria-disabled",String(!this.actor?.isOwner));
      }
    }
  }
  function drawerRow(label, callback, image, bonus) {
    const actor = ui.ARGON._actor;
    return new OPRPGAccessibleRow([{label:escapeHTML(label), image, bonus, onClick:async event => {
      if (ui.ARGON._actor !== actor || !actor?.isOwner) return warn("Sem permissão para esta ficha.");
      try { await callback(event); } catch (error) { console.error("[System Fixes/Argon]", error); warn("Não foi possível executar. Abra a ficha."); }
    }}]);
  }
  function category(label, buttons) {
    return {gridCols:"1fr", captions:[{label, align:"start"}], buttons};
  }
  class OPRPGDrawer extends DrawerPanel {
    constructor() {
      super(); this.ownerActor = this.actor;
      if (!drawerStates.has(this.ownerActor)) drawerStates.set(this.ownerActor,{ability:null,open:false});
      this.state = drawerStates.get(this.ownerActor);
    }
    get classes() { return [...super.classes,"argon-oprpg-drawer"]; }
    get title() {
      if (this.state.section==="effects") return "Efeitos";
      return this.state.ability === null ? "Atalhos da ficha" : actorAbilities(this.ownerActor,CONFIG.DND5E,value=>game.i18n.localize(value)).find(a=>a.key===this.state.ability)?.label ?? "Testes";
    }
    syncTriggers() {
      for (const button of ui.ARGON.element.querySelectorAll("[data-ability], [data-drawer-shortcuts], [data-drawer-section]")) {
        const selected = button.dataset.drawerSection ? button.dataset.drawerSection===this.state.section : button.hasAttribute("data-ability") ? button.dataset.ability===this.state.ability : this.state.ability===null && !this.state.section;
        button.setAttribute("aria-expanded",String(this.state.open && selected));
      }
    }
    async openFor(ability, trigger, section=null) {
      if (this.ownerActor !== ui.ARGON._actor || !this.element.isConnected) return;
      if (ability !== null && !actorAbilities(this.ownerActor).some(a=>a.key===ability)) return;
      if (this.state.open && this.state.ability === ability && (this.state.section ?? null)===section) return this.close(true);
      closeLists(); this.state.ability = ability; this.state.section=section; this.state.open = true; delete this.state.focus;
      this.element.hidden = true; this.trigger = trigger; this.syncTriggers();
      try { await this.render(); }
      catch (error) {console.error("[System Fixes/Argon] Testes e atalhos",error); this.close(true); warn("Não foi possível abrir os testes. Abra a ficha pelo retrato."); return;}
      if (this.ownerActor === ui.ARGON._actor && this.state.open && this.element.isConnected) this.focusControl(this.element.querySelector("[data-drawer-key]:not([data-drawer-key=close])"));
    }
    focusControl(control) {focusInPanel(control,this.element); }
    close(restoreFocus = false) {
      this.state.open = false; delete this.state.focus; this.element.hidden = true;
      ui.ARGON._lastExpandedDrawer = null; document.body.classList.remove("ech-show-ability-menu"); this.syncTriggers();
      if (restoreFocus) {
        const trigger = this.trigger?.isConnected ? this.trigger : [...ui.ARGON.element.querySelectorAll("[data-ability], [data-drawer-shortcuts], [data-drawer-section]")].find(b=>this.state.section ? b.dataset.drawerSection===this.state.section : this.state.ability===null ? b.hasAttribute("data-drawer-shortcuts") : b.dataset.ability===this.state.ability);
        (trigger ?? ui.ARGON.element.querySelector("[data-drawer-shortcuts], .argon-oprpg-portrait-photo"))?.focus({preventScroll:true});
      }
    }
    _expandPanel(index) { if (index == null) this.close(); }
    place() {
      if (!this.state.open) return;
      watchLayout();
      const portrait=ui.ARGON.element.querySelector(".portrait-hud").getBoundingClientRect();
      applyPlacement(this.element,placement({left:portrait.left,top:portrait.top},320));
    }
    async _renderInner() {
      const sequence = this.sequence = (this.sequence ?? 0) + 1;
      if (this.ownerActor !== ui.ARGON._actor || !this.element.isConnected) return;
      if (this.state.ability !== null && !actorAbilities(this.ownerActor).some(a=>a.key===this.state.ability)) this.state.open = false;
      const heading = document.createElement("div"); heading.className = "argon-oprpg-list-header";
      const title = document.createElement("strong"); title.textContent = this.title;
      const close = document.createElement("button"); close.type = "button"; close.innerHTML = argonIconMarkup("close");
      close.setAttribute("aria-label","Fechar testes e atalhos"); close.dataset.drawerKey = "close";
      close.onclick = () => this.close(true); heading.append(title,close);
      const list = document.createElement("ul"); list.className = "argon-oprpg-test-rows";
      for (const group of this.categories) {
        if (!group.buttons.length) continue;
        const caption = document.createElement("li"); caption.className = "ability ability-title"; caption.textContent = group.captions[0].label; list.append(caption);
        for (const button of group.buttons) {
          button._parent = this; button.setGrid(group.gridCols); button.setAlign(group.captions.map(c=>c.align));
          await button.render(); list.append(button.element);
          const control = button.element.querySelector("[role=button]"); if (control) {control.dataset.drawerKey=String(list.children.length);const bonus=control.querySelector(".argon-oprpg-roll-bonus");if(bonus){bonus.id="argon-oprpg-drawer-bonus-"+list.children.length;control.setAttribute("aria-describedby",bonus.id);}}
        }
      }
      if (!list.children.length) {const empty = document.createElement("li"); empty.textContent = this.state.section==="effects"?"Nenhum efeito nesta ficha.":"Nenhum teste disponível na ficha."; list.append(empty);}
      if (sequence !== this.sequence || this.ownerActor !== ui.ARGON._actor || !this.element.isConnected) return;
      this.element.id = "argon-oprpg-drawer"; this.element.setAttribute("role","region"); this.element.setAttribute("aria-label",this.title);
      this.element.replaceChildren(heading,list); this.element.hidden = !this.state.open; this.syncTriggers(); this.place();
      if (this.state.open && this.state.focus) {
        const control = [...this.element.querySelectorAll("[data-drawer-key]")].find(b=>b.dataset.drawerKey===this.state.focus); delete this.state.focus; this.focusControl(control);
      }
    }
    async activateListeners(element) {
      element.onkeydown = event => {
        if (event.key === "Escape") {event.preventDefault(); event.stopPropagation(); this.close(true);}
        if (["ArrowUp","ArrowDown"].includes(event.key)) {
          const controls = [...element.querySelectorAll("[data-drawer-key]")];
          const current = controls.indexOf(document.activeElement), step = event.key === "ArrowDown" ? 1 : -1;
          event.preventDefault(); this.focusControl(controls[(current + step + controls.length) % controls.length]);
        }
      };
    }
    get categories() {
      const actor = this.actor;
      const result = [];
      const ability = this.state.ability;
      if (ability !== null) {
        const label = game.i18n.localize(CONFIG.DND5E?.abilities?.[ability]?.label ?? ability);
        if (typeof actor.rollAbilityCheck === "function") result.push(category("Teste de atributo",[drawerRow("Teste de " + label,event=>actor.rollAbilityCheck({ability,event}),null,rollBonusLabel(actor,"check",ability))]));
        if (typeof actor.rollSavingThrow === "function") result.push(category("Salvaguarda",[drawerRow("Salvaguarda de " + label,event=>actor.rollSavingThrow({ability,event}),null,rollBonusLabel(actor,"save",ability))]));
        if (typeof actor.rollSkill === "function") result.push(category("Perícias relacionadas",relatedSkills(actor,ability,CONFIG.DND5E).map(key=>drawerRow(game.i18n.localize(CONFIG.DND5E?.skills?.[key]?.label ?? key),event=>actor.rollSkill({skill:key,event}),null,rollBonusLabel(actor,"skill",key)))));
        return result;
      }

      const favorites = asArray(actor.system?.favorites).slice().sort((a,b) => (a.sort ?? 0) - (b.sort ?? 0));
      if (favorites.length) result.push(category("Favoritos", favorites.map(favorite => {
        let name = favorite.id, image;
        try { const doc = globalThis.fromUuidSync?.(favorite.id, {relative:actor,strict:false});
          image = doc?.item ? activityImage(doc,doc.item) : doc?.img;
          name = doc?.name ??
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
      },image); })));
      if (typeof actor.rollToolCheck === "function") result.push(category("Ferramentas", Object.keys(actor.system?.tools ?? {}).map(key =>
        drawerRow(game.i18n.localize(CONFIG.DND5E?.toolTypes?.[key] ?? key), event => actor.rollToolCheck({tool:key,event})))));
      const effects = asArray(actor.effects);
      if (effects.length) result.push(category("Efeitos — ativar/desativar", effects.map(effect => drawerRow(`${effect.disabled ? "Inativo" : "Ativo"}: ${effect.name}`, () => {
        if (effect.isSuppressed || !effect.isOwner) return warn("Efeito suprimido ou sem permissão; abra a ficha.");
        return effect.update({disabled:!effect.disabled});
      },effect.img))));
      const passive = asArray(actor.items).filter(item => !entriesForActor({items:[item]}).length);
      if (passive.length) result.push(category("Itens e habilidades — ficha", passive.map(item => drawerRow(item.name, () => item.sheet?.render(true),item.img))));
      const enabled = game.settings?.get?.(ID, "argonShowMacros") ?? true;
      const macros = enabled ? [...new Set(Object.entries(game.user?.hotbar ?? {}).sort(([a],[b]) => Number(a)-Number(b)).map(([,id]) => id))]
        .map(id => game.macros?.get?.(id)).filter(usableMacro) : [];
      if (macros.length) result.push(category("Macros", macros.map(m => drawerRow(m.name, () => {
        if (usableMacro(m)) return m.execute();
        warn("Macro indisponível ou sem permissão.");
      },m.img))));
      if (this.state.section==="effects") return result.filter(group=>group.captions[0].label==="Efeitos — ativar/desativar");
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
    placeLists();
  });
}
