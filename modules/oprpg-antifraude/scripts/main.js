/*
 * OPRPG Anti-Fraude de Rolagens  v1.4.0
 *
 * MUDANCA DE ESTRATEGIA
 * As versoes anteriores dependiam dos hooks dnd5e.preRoll / postRollV2, que o
 * oprpg-system 1.0.20 NAO dispara. Esta versao ignora hooks e substitui o
 * metodo de avaliacao dos termos de dado: quando um jogador rola qualquer
 * dado, os numeros sao sorteados no cliente do GM e devolvidos via socketlib.
 * Cobre ficha, macro e console, porque todos passam pelo mesmo ponto.
 */
const MOD = "oprpg-antifraude";
let socket = null;
let patchAplicado = false;

Hooks.once("init", () => {
  game.settings.register(MOD, "ativo", {
    name: "Ativar sorteio no cliente do GM",
    hint: "Os dados dos jogadores passam a ser sorteados na maquina do GM.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "modoEstrito", {
    name: "Modo Estrito",
    hint: "Sem socketlib ou sem GM conectado, BLOQUEIA a rolagem em vez de sortear localmente.",
    scope: "world", config: true, type: Boolean, default: false
  });
  game.settings.register(MOD, "somenteD20", {
    name: "Aplicar somente a d20",
    hint: "Se desligado, todos os dados (dano incluso) passam pelo GM.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "log", {
    name: "Registrar no console", scope: "world", config: true, type: Boolean, default: true
  });
});

/* ---------- lado do GM: sorteia de verdade ---------- */
async function sortearNoGM({ quantidade, faces, userId }) {
  const res = [];
  for (let i = 0; i < quantidade; i++) {
    res.push(Math.ceil(CONFIG.Dice.randomUniform() * faces));
  }
  if (game.settings.get(MOD, "log"))
    console.log(`${MOD} | ${quantidade}d${faces} para ${game.users.get(userId)?.name}: [${res.join(", ")}]`);
  return { resultados: res, gmUserId: game.user.id };
}

/* ---------- socketlib ---------- */
function registrarSocket() {
  if (socket || typeof socketlib === "undefined") return;
  try {
    socket = socketlib.registerModule(MOD);
    socket.register("sortearNoGM", sortearNoGM);
    const m = game.modules.get(MOD);
    m.api = { socket, sortearNoGM, get patchAplicado() { return patchAplicado; } };
    console.log(`${MOD} | socketlib registrado`);
  } catch (e) {
    console.error(`${MOD} | falha ao registrar socketlib:`, e);
  }
}
Hooks.once("socketlib.ready", registrarSocket);
Hooks.once("setup", registrarSocket);

/* ---------- descobre as classes de termo de dado em uso ---------- */
function classesDeDado() {
  const encontradas = new Set();
  const base = foundry?.dice?.terms?.DiceTerm ?? globalThis.DiceTerm;
  const candidatos = [
    foundry?.dice?.terms?.Die, globalThis.Die,
    foundry?.dice?.terms?.BasicDie, globalThis.BasicDie,
    ...Object.values(CONFIG?.Dice?.termTypes ?? {}),
    ...(CONFIG?.Dice?.terms ? Object.values(CONFIG.Dice.terms) : [])
  ];
  for (const c of candidatos) {
    if (typeof c !== "function") continue;
    if (!c.prototype) continue;
    const ehDado = base ? (c.prototype instanceof base || c === base) : /die/i.test(c.name);
    if (ehDado && typeof c.prototype._evaluate === "function") encontradas.add(c);
  }
  return [...encontradas];
}

function gmDisponivel() { return game.users.some(u => u.isGM && u.active); }

/* ---------- o patch ---------- */
function aplicarPatch() {
  if (patchAplicado) return;
  const classes = classesDeDado();
  if (!classes.length) {
    console.error(`${MOD} | nenhuma classe de dado encontrada - patch nao aplicado.`);
    return;
  }

  for (const C of classes) {
    const original = C.prototype._evaluate;

    C.prototype._evaluate = async function (options = {}) {
      const podeInterceptar =
        !game.user.isGM &&
        game.settings.get(MOD, "ativo") &&
        socket && gmDisponivel() &&
        (!game.settings.get(MOD, "somenteD20") || this.faces === 20);

      if (!podeInterceptar) {
        if (!game.user.isGM && game.settings.get(MOD, "ativo") &&
            game.settings.get(MOD, "modoEstrito") && (!socket || !gmDisponivel())) {
          ui.notifications.error("Anti-Fraude: sem GM conectado ou socketlib indisponivel. Rolagem bloqueada.");
          throw new Error(`${MOD}: rolagem bloqueada pelo Modo Estrito.`);
        }
        return original.call(this, options);
      }

      try {
        const { resultados, gmUserId } = await socket.executeAsGM("sortearNoGM", {
          quantidade: this.number, faces: this.faces, userId: game.user.id
        });
        // Ainda NÃO congela aqui — _evaluateModifiers() precisa poder
        // marcar dados como descartados (vantagem/desvantagem, kh/kl,
        // exploding dice, etc.), e isso falharia num objeto congelado.
        this.results = resultados.map(r => ({ result: r, active: true }));
        if (typeof this._evaluateModifiers === "function") await this._evaluateModifiers();

        // Trava só as chaves "result" e "active" de cada resultado já
        // processado (não pode mais ser reescrito), mas deixa o objeto
        // extensível — módulos como o Dice So Nice precisam poder
        // adicionar propriedades próprias (ex: "indexThrow") depois,
        // e Object.freeze() bloquearia isso e quebraria a animação.
        this.results.forEach((r, i) => {
          for (const chave of ["result", "active"]) {
            if (chave in r) {
              Object.defineProperty(r, chave, {
                value: r[chave], writable: false, configurable: false, enumerable: true
              });
            }
          }
          Object.defineProperty(this.results, i, {
            value: r, writable: false, configurable: false, enumerable: true
          });
        });

        this.options = foundry.utils.mergeObject(this.options ?? {}, {
          oprpgAutoritativa: true, oprpgGM: gmUserId
        });
        this._evaluated = true;
        return this;
      } catch (e) {
        console.error(`${MOD} | falha ao sortear no GM:`, e);
        if (game.settings.get(MOD, "modoEstrito")) {
          ui.notifications.error("Anti-Fraude: falha na validacao pelo GM. Rolagem bloqueada.");
          throw e;
        }
        ui.notifications.warn("Anti-Fraude: dado sorteado localmente (sem validacao do GM).");
        return original.call(this, options);
      }
    };

    console.log(`${MOD} | patch aplicado em ${C.name}`);
  }
  patchAplicado = true;
}

/* Marca a rolagem inteira quando os dados vieram do GM. */
Hooks.on("preCreateChatMessage", (msg) => {
  if (game.user.isGM) return;
  for (const r of msg.rolls ?? []) {
    if ((r.terms ?? []).some(t => t.options?.oprpgAutoritativa))
      r.options = foundry.utils.mergeObject(r.options ?? {}, { oprpgAutoritativa: true });
  }
});

Hooks.once("ready", () => {
  registrarSocket();
  if (!socket) {
    console.error(`${MOD} | socketlib NAO registrado. Verifique o modulo socketlib e "socket": true no module.json.`);
    return;
  }
  aplicarPatch();
  console.log(`${MOD} | pronto | patch: ${patchAplicado} | estrito: ${game.settings.get(MOD, "modoEstrito")}`);
});
