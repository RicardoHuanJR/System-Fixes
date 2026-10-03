import { MODULE_ID, STATE } from "./shared.js";

const NATIVE_NPC_SHEET_PATH = "/systems/oprpg-system/module/applications/actor/npc-sheet.mjs";
const TARGET_METHODS = ["_prepareManipulationContext", "_prepareTrainingsContext"];
const PATCH_MARK = Symbol.for("oprpg-system-fixes.npcSheetSvgPatch");
const TEXT_PATCH_MARK = Symbol.for("oprpg-system-fixes.npcSheetTextEditorPatch");

let activePrepDepth = 0;
let sourceAudit = null;

function isPromiseLike(value) {
  return !!value && typeof value.then === "function";
}

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function repairRawSvg(markup) {
  if (typeof markup !== "string" || !/<svg\b/i.test(markup)) return markup;
  let out = markup;

  // The OPRPG NPC sheet can build icon SVGs before a dimension is available,
  // producing width="", height="" and viewBox="0 0 ". Chromium reports all
  // three as SVG parse errors. Use CSS-friendly dimensions and a conservative
  // FontAwesome-style fallback viewBox only for actually malformed attributes.
  out = out.replace(/\bwidth\s*=\s*(["'])\s*\1/gi, 'width="1em"');
  out = out.replace(/\bheight\s*=\s*(["'])\s*\1/gi, 'height="1em"');
  out = out.replace(/\bviewBox\s*=\s*(["'])\s*0(?:\s+|,)0(?:\s+|,)*\1/gi, 'viewBox="0 0 512 512"');
  out = out.replace(/\bviewBox\s*=\s*(["'])\s*\1/gi, 'viewBox="0 0 512 512"');

  return out;
}

function repairSvgDataUri(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!/^data:image\/svg\+xml/i.test(trimmed)) return value;

  const comma = value.indexOf(",");
  if (comma < 0) return value;
  const head = value.slice(0, comma + 1);
  const body = value.slice(comma + 1);

  try {
    if (/;base64,/i.test(head)) {
      const decoded = decodeURIComponent(escape(atob(body)));
      const repaired = repairRawSvg(decoded);
      if (repaired === decoded) return value;
      return head + btoa(unescape(encodeURIComponent(repaired)));
    }

    const decoded = decodeURIComponent(body);
    const repaired = repairRawSvg(decoded);
    if (repaired === decoded) return value;
    return head + encodeURIComponent(repaired);
  } catch (_) {
    // Some SVG data URIs are deliberately only partially escaped. The raw
    // replacement below is safe and still catches the empty-attribute case.
    return repairRawSvg(value);
  }
}

export function repairMalformedNpcSvg(value) {
  if (typeof value !== "string") return value;
  let repaired = repairSvgDataUri(value);
  repaired = repairRawSvg(repaired);
  if (repaired !== value) STATE.npcSheetSvgStringsRepaired++;
  return repaired;
}

function sanitizeContext(value, seen = new WeakMap(), depth = 0) {
  if (typeof value === "string") return repairMalformedNpcSvg(value);
  if (!value || typeof value !== "object" || depth > 10) return value;
  if (seen.has(value)) return seen.get(value);
  seen.set(value, value);

  // IMPORTANT: never enumerate by reading value[key] and never Object.assign
  // context objects. Foundry/DnD5e exposes compatibility getters on some
  // objects (for example CONFIG.DND5E.spellcastingTypes). Merely reading such
  // an accessor emits a deprecation warning. Inspect property descriptors and
  // recurse only through own DATA properties, so getters/setters are preserved
  // without ever being evaluated.
  if (Array.isArray(value)) {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    let changed = false;
    const outputDescriptors = {};

    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key === "length") continue;
      if (!("value" in descriptor)) {
        STATE.npcSheetAccessorsSkipped++;
        outputDescriptors[key] = descriptor;
        continue;
      }
      const repaired = sanitizeContext(descriptor.value, seen, depth + 1);
      if (repaired !== descriptor.value) changed = true;
      outputDescriptors[key] = { ...descriptor, value: repaired };
    }

    if (!changed) return value;
    const draft = [];
    // Numeric descriptors establish the correct array length automatically.
    Object.defineProperties(draft, outputDescriptors);
    const lengthDescriptor = descriptors.length;
    if (lengthDescriptor && lengthDescriptor.writable === false) {
      Object.defineProperty(draft, "length", {
        value: value.length,
        writable: false,
        enumerable: false,
        configurable: false
      });
    } else {
      draft.length = value.length;
    }
    seen.set(value, draft);
    return draft;
  }

  if (value instanceof Map) {
    // Map iteration does not invoke arbitrary property getters on the Map
    // object. Values are sanitized copy-on-write; keys are preserved.
    let draft = null;
    for (const [key, entry] of value.entries()) {
      const repaired = sanitizeContext(entry, seen, depth + 1);
      if (repaired !== entry) {
        draft ??= new Map(value);
        draft.set(key, repaired);
      }
    }
    seen.set(value, draft ?? value);
    return draft ?? value;
  }

  // Never walk Foundry Documents/Application instances, CONFIG branches,
  // class instances, etc. NPC preparation payloads that need repair are plain
  // objects/arrays; anything else is intentionally left untouched.
  if (!isPlainObject(value)) return value;

  const descriptors = Object.getOwnPropertyDescriptors(value);
  let changed = false;
  const outputDescriptors = {};

  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!("value" in descriptor)) {
      STATE.npcSheetAccessorsSkipped++;
      outputDescriptors[key] = descriptor;
      continue;
    }

    const repaired = sanitizeContext(descriptor.value, seen, depth + 1);
    if (repaired !== descriptor.value) changed = true;
    outputDescriptors[key] = { ...descriptor, value: repaired };
  }

  if (!changed) return value;
  const draft = Object.create(Object.getPrototypeOf(value));
  Object.defineProperties(draft, outputDescriptors);
  seen.set(value, draft);
  return draft;
}

function patchTextEditorHolder(holder, key = "enrichHTML") {
  if (!holder || typeof holder[key] !== "function") return false;
  const original = holder[key];
  if (original[TEXT_PATCH_MARK]) return true;

  function wrapped(...args) {
    if (activePrepDepth > 0 && typeof args[0] === "string") {
      args[0] = repairMalformedNpcSvg(args[0]);
    }
    return original.apply(this, args);
  }
  Object.defineProperty(wrapped, TEXT_PATCH_MARK, { value: true });
  Object.defineProperty(wrapped, "__oprpgOriginal", { value: original });
  holder[key] = wrapped;
  STATE.npcSheetTextEditorGuard = true;
  return true;
}

function installScopedTextEditorGuard() {
  let installed = false;
  try { installed = patchTextEditorHolder(globalThis.TextEditor) || installed; } catch (_) {}
  try { installed = patchTextEditorHolder(foundry?.applications?.ux?.TextEditor?.implementation) || installed; } catch (_) {}
  return installed;
}

function wrapPrepareMethod(proto, name) {
  const original = proto?.[name];
  if (typeof original !== "function") return false;
  if (original[PATCH_MARK]) return true;

  function wrapped(...args) {
    // Sanitize any context object passed into the method before native code can
    // enrich/parse it, then sanitize the returned context as a second barrier.
    // copy-on-write is required because ApplicationV2 may freeze its context.
    args = args.map(arg => sanitizeContext(arg));
    activePrepDepth++;
    STATE.npcSheetPrepareCalls++;

    let result;
    try {
      result = original.apply(this, args);
    } catch (error) {
      activePrepDepth = Math.max(0, activePrepDepth - 1);
      throw error;
    }

    if (isPromiseLike(result)) {
      return Promise.resolve(result).then(value => sanitizeContext(value)).finally(() => {
        activePrepDepth = Math.max(0, activePrepDepth - 1);
      });
    }

    const sanitized = sanitizeContext(result);
    activePrepDepth = Math.max(0, activePrepDepth - 1);
    return sanitized;
  }

  Object.defineProperty(wrapped, PATCH_MARK, { value: true });
  Object.defineProperty(wrapped, "__oprpgOriginal", { value: original });
  proto[name] = wrapped;
  STATE.npcSheetMethodsPatched++;
  return true;
}

function collectCandidateClasses(moduleExports) {
  const classes = new Set();
  const add = value => {
    if (typeof value !== "function" || !value.prototype) return;
    if (TARGET_METHODS.some(name => typeof value.prototype[name] === "function")) classes.add(value);
  };

  if (moduleExports && typeof moduleExports === "object") {
    for (const value of Object.values(moduleExports)) add(value);
  }

  // Fallback for a future system version that moves/renames the source module
  // while still registering the same NPC sheet class with Foundry.
  const seen = new WeakSet();
  const scan = (value, depth = 0) => {
    if (!value || depth > 6) return;
    if (typeof value === "function") { add(value); return; }
    if (typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    for (const entry of Object.values(value)) {
      if (entry?.cls) add(entry.cls);
      if (depth < 6 && entry && typeof entry === "object") scan(entry, depth + 1);
    }
  };
  try { scan(CONFIG?.Actor?.sheetClasses); } catch (_) {}

  return classes;
}

async function auditNativeSource() {
  try {
    const response = await fetch(NATIVE_NPC_SHEET_PATH, { cache: "no-store" });
    if (!response.ok) return { available: false, status: response.status };
    const text = await response.text();
    const badWidth = /width\s*=\s*["'`]\s*["'`]/i.test(text);
    const badHeight = /height\s*=\s*["'`]\s*["'`]/i.test(text);
    const hasTargets = TARGET_METHODS.filter(name => text.includes(name));
    return {
      available: true,
      bytes: text.length,
      targetMethods: hasTargets,
      staticEmptyWidth: badWidth,
      staticEmptyHeight: badHeight,
      path: NATIVE_NPC_SHEET_PATH
    };
  } catch (error) {
    return { available: false, error: error?.message ?? String(error), path: NATIVE_NPC_SHEET_PATH };
  }
}

export async function installNpcSheetRepair() {
  if (STATE.npcSheetPatch) return true;
  if (game.system?.id !== "oprpg-system") return false;

  installScopedTextEditorGuard();

  let moduleExports = null;
  try {
    moduleExports = await import(NATIVE_NPC_SHEET_PATH);
  } catch (error) {
    STATE.warnings.push(`NPC Sheet: import nativo falhou (${error?.message ?? error}); tentando classes registradas.`);
  }

  const classes = collectCandidateClasses(moduleExports);
  for (const cls of classes) {
    for (const name of TARGET_METHODS) wrapPrepareMethod(cls.prototype, name);
  }

  sourceAudit = await auditNativeSource();
  STATE.npcSheetSourceAudit = sourceAudit;
  STATE.npcSheetPatch = STATE.npcSheetMethodsPatched > 0;

  if (!STATE.npcSheetPatch) {
    STATE.warnings.push("NPC Sheet: _prepareManipulationContext/_prepareTrainingsContext não foram localizados; reparo SVG ficou apenas em diagnóstico.");
    return false;
  }

  console.info(`${MODULE_ID} | NPC Sheet Repair instalado (${STATE.npcSheetMethodsPatched} métodos nativos envolvidos).`);
  return true;
}

export function npcSheetRepairStatus() {
  return {
    installed: !!STATE.npcSheetPatch,
    mode: "native-context-svg-sanitizer",
    nativeMethodsPatched: Number(STATE.npcSheetMethodsPatched || 0),
    prepareCalls: Number(STATE.npcSheetPrepareCalls || 0),
    svgStringsRepaired: Number(STATE.npcSheetSvgStringsRepaired || 0),
    textEditorGuard: !!STATE.npcSheetTextEditorGuard,
    accessorSafeTraversal: true,
    accessorsSkipped: Number(STATE.npcSheetAccessorsSkipped || 0),
    sourceAudit: sourceAudit ?? STATE.npcSheetSourceAudit ?? null,
    targetMethods: [...TARGET_METHODS]
  };
}
