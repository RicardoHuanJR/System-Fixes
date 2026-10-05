import { MODULE_ID } from "./settings.js";

const PRESETS = {
  compact: { width: 126, height: 146, title: 11, gap: 6 },
  normal:  { width: 150, height: 172, title: 12, gap: 8 },
  large:   { width: 176, height: 202, title: 13, gap: 10 }
};

const observed = new Set();
let layoutPending=false;
let resizeObserver = null;

function setting(key, fallback) {
  try { return game.settings.get(MODULE_ID, key); }
  catch (_) { return fallback; }
}

export function applyLayout(root = document.querySelector(".extended-combat-hud")) {
  if (!root) return false;
  const preset = PRESETS[setting("layoutPreset", "normal")] ?? PRESETS.normal;
  root.style.setProperty("--oprpg-tech-width", `${preset.width}px`);
  root.style.setProperty("--oprpg-tech-height", `${preset.height}px`);
  root.style.setProperty("--oprpg-tech-title-size", `${preset.title}px`);
  root.style.setProperty("--oprpg-tech-gap", `${preset.gap}px`);
  root.style.setProperty("--oprpg-utility-gap", `${Number(setting("utilityGap", 14)) || 14}px`);
  root.style.setProperty("--oprpg-technique-offset-x", `${Number(setting("techniqueOffsetX", 0)) || 0}px`);

  alignUtilityControls(root);
  watch(root);
  return true;
}

export function alignUtilityControls(root = document.querySelector(".extended-combat-hud")) {
  if (!root) return false;
  const portrait = root.querySelector(".portrait-hud");
  const controls = portrait?.querySelector(".player-buttons");
  const weaponSets = root.querySelector(".weapon-sets");
  if (!portrait || !controls || !weaponSets) return false;

  // Utility icons always sit after the complete visible Weapon Sets strip.
  // Anchoring after the active set caused the icons to jump into the middle
  // of the set row whenever the active set changed.
  const portraitRect = portrait.getBoundingClientRect();
  const setsRect = weaponSets.getBoundingClientRect();
  if (!portraitRect.width || !setsRect.width) return false;

  // getBoundingClientRect() includes Argon Core's HUD transform scale, while CSS left
  // is expressed in the portrait's unscaled local coordinate system. Convert the
  // measured viewport distance back to local CSS pixels before applying the offset.
  const renderedWidth = Number(portraitRect.width) || 0;
  const localWidth = Number(portrait.offsetWidth) || renderedWidth || 1;
  const scaleX = renderedWidth > 0 && localWidth > 0 ? renderedWidth / localWidth : 1;
  const safeScaleX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
  const offset = Number(setting("utilityOffset", 12)) || 0;
  const localAnchorRight = (setsRect.right - portraitRect.left) / safeScaleX;
  const left = Math.max(0, Math.round(localAnchorRight + offset));
  controls.style.setProperty("left", `${left}px`, "important");
  controls.dataset.oprpgHudScaleX = String(safeScaleX);
  controls.style.setProperty("right", "auto", "important");
  controls.dataset.oprpgAutoAligned = "true";
  return true;
}

export function scheduleLayout() {
  if(layoutPending)return;layoutPending=true;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    layoutPending=false;
    for(const node of observed)if(!node.isConnected){resizeObserver?.unobserve(node);observed.delete(node);}
    applyLayout();
  }));
}

function watch(root) {
  if (observed.has(root) || typeof ResizeObserver !== "function") return;
  observed.add(root);
  resizeObserver ??= new ResizeObserver(() => scheduleLayout());
  resizeObserver.observe(root);
  const portrait = root.querySelector(".portrait-hud");
  const sets = root.querySelector(".weapon-sets");
  if (portrait) {observed.add(portrait);resizeObserver.observe(portrait);}
  if (sets) {observed.add(sets);resizeObserver.observe(sets);}
}

export function installLayoutManager() {
  globalThis.OPRPG_ARGON_LAYOUT_REFRESH = scheduleLayout;
  for (const hook of [
    "renderOPRPGPortraitPanelArgonComponent",
    "renderOPRPGWeaponSetsArgonComponent",
    "renderPortraitPanelArgonComponent",
    "renderWeaponSetsArgonComponent"
  ]) Hooks.on(hook, scheduleLayout);
  window.addEventListener("resize", scheduleLayout, { passive: true });
  Hooks.on("canvasReady", scheduleLayout);
  Hooks.on("argon-onSetChangeComplete", scheduleLayout);
  Hooks.once("ready", scheduleLayout);
}
