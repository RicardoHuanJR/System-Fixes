import { finiteValue } from "./model.js";

/** Read-only indicators. Omit missing fields; never evaluate or spend resources. */
export function resourceIndicators(actor, akumaStatus) {
  const rows = [];
  const sys = actor?.system ?? {};
  const generated = finiteValue(sys.energy?.generated);
  if (generated !== null) rows.push({label:"PP gerado", short:"PPg", value:String(generated)});
  const shield = finiteValue(sys.shieldPoints?.value);
  const max = finiteValue(sys.shieldPoints?.max);
  if (shield !== null && (shield > 0 || max > 0)) rows.push({label:"Escudo", short:"Esc", value:`${shield}${max !== null ? `/${max}` : ""}`});
  const flag = (scope,key) => actor?.getFlag?.(scope,key);
  if (flag("oprpg-system","antevisaoModo") === "padrao") rows.push({label:"Antevisão",short:"Antevisão",value:"ativa"});
  const presence = flag("oprpg-system-fixes","presenceActive") ?? actor?.flags?.["oprpg-haki-automations"]?.presenceActive;
  if (presence === true) rows.push({label:"Perceber Presença",short:"Presença",value:"ativa"});
  if (flag("oprpg-system","corpoArmaduradoAtivo") === true) rows.push({label:"Corpo Armadurado",short:"Corpo",value:"ativo"});
  if (flag("oprpg-system","enduDefensivoAtivo") === true) rows.push({label:"Endurecimento Defensivo",short:"Endurecimento",value:"ativo"});
  const akuma = flag("oprpg-system","akuma") ?? sys.akuma;
  if (akuma?.powerUp?.active === true) rows.push({label:"Akuma — Power Up",short:"Power Up",value:"ativo"});
  if (akumaStatus?.intangibility?.active === true) rows.push({label:"Intangibilidade",short:"Intangível",value:"ativa"});
  return rows;
}
