/*
 * OPRPG Detector de Rolagens Suspeitas  v1.3.1
 * v1.3.1: exibe o ID da mensagem no alerta (clique para copiar).
 */
const MOD = "oprpg-detector-fraude";

Hooks.once("init", () => {
  game.settings.register(MOD, "sensibilidade", {
    name: "Sensibilidade",
    hint: "Estrita tambem sinaliza rolagens sem as flags do sistema.",
    scope: "world", config: true, type: String, default: "normal",
    choices: { normal: "Normal (recomendado)", estrita: "Estrita" }
  });
  game.settings.register(MOD, "ignorarGM", {
    name: "Ignorar rolagens do GM", scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "debug", {
    name: "Modo depuracao (log de toda rolagem no console)",
    scope: "world", config: true, type: Boolean, default: false
  });
});

function ehTermoDado(t) {
  if (!t) return false;
  if (typeof t.class === "string" && /die|dice/i.test(t.class)) return true;
  return Array.isArray(t.results) && (t.faces !== undefined || t.denomination !== undefined);
}
function facesDe(t) {
  if (Number.isFinite(t.faces)) return t.faces;
  const n = parseInt(String(t.denomination ?? "").replace(/^d/i, ""), 10);
  return Number.isFinite(n) ? n : null;
}
function somaDoTermo(t) {
  return (t.results ?? []).filter(r => r.active !== false).reduce((a, r) => a + (r.result ?? 0), 0);
}
function recalcular(rollJSON) {
  let expr = "";
  for (const t of rollJSON.terms ?? []) {
    if (ehTermoDado(t)) expr += somaDoTermo(t);
    else if (t.operator !== undefined) expr += t.operator;
    else if (t.number !== undefined) expr += t.number;
    else return null;
  }
  try { const v = Function(`"use strict"; return (${expr});`)(); return Number.isFinite(v) ? v : null; }
  catch { return null; }
}

function analisar(msg, roll) {
  const motivos = [];
  const j = roll.toJSON?.() ?? {};
  const cls = j.class ?? roll.constructor?.name;
  const termos = j.terms ?? [];
  const estrita = game.settings.get(MOD, "sensibilidade") === "estrita";

  const dados = termos.filter(ehTermoDado);
  if (!dados.some(t => facesDe(t) === 20)) return motivos;

  // Com o Anti-Fraude no nivel de DiceTerm, um /roll manual legitimo
  // tambem produz classe generica (Roll/BasicDie) mesmo com o dado
  // real vindo do GM. Por isso essa checagem virou sinal fraco demais
  // pra disparar sozinha no modo normal - so conta no modo estrito.
  if (estrita && cls !== "D20Roll") motivos.push(`Classe do roll e "${cls}" - a ficha sempre produz D20Roll`);

  const real = recalcular(j);
  if (real !== null && real !== roll.total)
    motivos.push(`Total declarado (${roll.total}) nao confere com a soma dos termos (${real})`);

  for (const t of dados) {
    const f = facesDe(t);
    if (!f) continue;
    for (const r of t.results ?? []) {
      if (r.result < 1 || r.result > f) motivos.push(`Resultado ${r.result} impossivel em d${f}`);
    }
  }

  if (estrita && !msg.flags?.dnd5e) motivos.push("Mensagem sem flags do sistema (modo estrito)");
  if (estrita && cls === "D20Roll" && roll.options?.rollType === undefined)
    motivos.push("D20Roll sem options.rollType (modo estrito)");

  return motivos;
}

Hooks.on("createChatMessage", async (msg) => {
  if (!game.user.isGM) return;
  const autor = msg.author ?? msg.user;
  const roll = msg.rolls?.[0];
  if (!roll) return;

  if (game.settings.get(MOD, "debug")) {
    const j = roll.toJSON?.() ?? {};
    console.log(`${MOD} | debug`, { id: msg.id, autor: autor?.name, classe: j.class,
      termos: (j.terms ?? []).map(t => t.class), total: roll.total, recalc: recalcular(j),
      autoritativa: roll.options?.oprpgAutoritativa === true });
  }

  if (game.settings.get(MOD, "ignorarGM") && autor?.isGM) return;

  const motivos = analisar(msg, roll);
  if (!motivos.length) return;

  const autoritativa = roll.options?.oprpgAutoritativa === true;
  const conteudo = `
    <div class="oprpg-alerta">
      <p><strong>&#9888; Rolagem suspeita detectada</strong></p>
      <p><b>Personagem:</b> ${msg.speaker?.alias ?? "-"}<br>
         <b>Rolagem:</b> ${msg.flavor ?? "-"}<br>
         <b>Formula:</b> ${roll.formula} = ${roll.total}<br>
         <b>Autor real:</b> ${autor?.name ?? "?"} (nao-GM)<br>
         <b>Classe:</b> ${roll.toJSON?.()?.class ?? "?"}<br>
         <b>Dados sorteados no GM:</b> ${autoritativa ? "sim" : "nao"}<br>
         <b>ID da mensagem:</b> <code class="oprpg-id" title="Clique para copiar">${msg.id}</code></p>
      <p><b>Motivos:</b></p>
      <ul>${motivos.map(m => `<li>${m}</li>`).join("")}</ul>
      <button type="button" class="oprpg-ir-msg" data-msg-id="${msg.id}">
        <i class="fas fa-search"></i> Ver mensagem original no chat
      </button>
    </div>`;

  await ChatMessage.create({
    content: conteudo,
    whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
    speaker: { alias: "Detector de Fraude" }
  });
  console.warn(`${MOD} | suspeita em ${msg.id}:`, motivos);
});

function ligarBotao(html) {
  const el = html instanceof HTMLElement ? html : html?.[0];
  el?.querySelector(".oprpg-ir-msg")?.addEventListener("click", ev => {
    const id = ev.currentTarget.dataset.msgId;
    const alvo = document.querySelector(`.chat-message[data-message-id="${id}"]`);
    if (!alvo) return ui.notifications.warn("Mensagem nao esta mais no chat visivel.");
    alvo.scrollIntoView({ behavior: "smooth", block: "center" });
    alvo.classList.add("oprpg-destaque");
    setTimeout(() => alvo.classList.remove("oprpg-destaque"), 3000);
  });
  el?.querySelector(".oprpg-id")?.addEventListener("click", ev => {
    const id = ev.currentTarget.textContent.trim();
    game.clipboard.copyPlainText(id);
    ui.notifications.info(`ID copiado: ${id}`);
  });
}
Hooks.on("renderChatMessageHTML", (app, html) => ligarBotao(html));
Hooks.on("renderChatMessage", (app, html) => ligarBotao(html));
