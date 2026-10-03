export const ID = 'oprpg-diable-jambe';
const MARK = 'diableJambe';

export function activeEffect(actor, now) {
  return Array.from(actor?.appliedEffects ?? actor?.effects ?? []).find(e => {
    const identified = e.flags?.[ID]?.enabled || e.name?.trim().toLowerCase() === 'diable jambe';
    if (e.disabled || e.isSuppressed || !identified) return false;
    const start = e.duration?.startTime;
    const seconds = e.duration?.seconds;
    return !(Number.isFinite(start) && Number.isFinite(seconds) && now >= start + seconds);
  });
}

export function bonusSpec(activity, now) {
  const item = activity?.item;
  if (item?.type !== 'spell' || !['attack', 'save', 'damage'].includes(activity.type)
      || !activeEffect(activity.actor ?? item.actor, now)) return null;
  const degree = Number(item.system?.level);
  if (!Number.isInteger(degree) || degree < 1 || degree > 7) return null;
  // Use the first original damage part; never copy an added bonus or a second part.
  const part = Array.from(activity.damage?.parts ?? [])[0];
  if (!part) return null;
  let faces;
  if (part.custom?.enabled) {
    const match = String(part.custom.formula ?? '').match(/\b\d*d(\d+)\b/i);
    if (!match) return null;
    faces = Number(match[1]);
  } else {
    if (!(Number(part.number) > 0)) return null;
    faces = Number(part.denomination);
  }
  if (!Number.isInteger(faces) || faces < 2) return null;
  return {formula: `${Math.max(1, Math.floor(degree / 2))}d${faces}`, degree, faces};
}

export function augmentDamage(activity, config, now) {
  if (!config?.rolls?.length || config.rolls.some(r => r.options?.[MARK])) return config;
  const spec = bonusSpec(activity, now);
  if (!spec) return config;
  config.rolls.push({
    parts: [spec.formula], data: activity.getRollData?.() ?? {},
    options: {type: 'fire', types: ['fire'], properties: [], [MARK]: true,
      flavor: 'Diable Jambe — Fogo'}
  });
  return config;
}

export async function toggle(actor) {
  if (!actor?.isOwner) return ui.notifications.warn('Selecione um token que você pode controlar.');
  const effects = Array.from(actor.effects ?? []).filter(e => e.flags?.[ID]?.enabled);
  if (activeEffect(actor, game.time.worldTime)) {
    await actor.deleteEmbeddedDocuments('ActiveEffect', effects.map(e => e.id));
    return ui.notifications.info('Diable Jambe desativado.');
  }
  if (effects.length) await actor.deleteEmbeddedDocuments('ActiveEffect', effects.map(e => e.id));
  await actor.createEmbeddedDocuments('ActiveEffect', [{
    name: 'Diable Jambe', img: 'icons/magic/fire/flame-burning-fist-strike.webp',
    disabled: false, transfer: false, changes: [],
    duration: {seconds: 60, startTime: game.time.worldTime},
    flags: {[ID]: {enabled: true}}
  }]);
  ui.notifications.info('Diable Jambe ativo por 1 minuto.');
}

export function install(types) {
  const seen = new Set();
  for (const entry of Object.values(types ?? {})) {
    const proto = entry.documentClass?.prototype;
    if (!proto || seen.has(proto) || typeof proto.getDamageConfig !== 'function') continue;
    seen.add(proto);
    const original = proto.getDamageConfig;
    Object.defineProperty(proto, 'getDamageConfig', {
      configurable: true, writable: true,
      value: function(...args) {
        return augmentDamage(this, original.apply(this, args), game.time.worldTime);
      }
    });
  }
  return seen.size;
}

if (typeof Hooks !== 'undefined') Hooks.once('ready', () => {
  if (game.system.id !== 'oprpg-system') return;
  const count = install(CONFIG.DND5E.activityTypes);
  game.modules.get(ID).api = {toggle, bonusSpec};
  if (!count) ui.notifications.error('Diable Jambe: configuração de atividades não encontrada.');
});
