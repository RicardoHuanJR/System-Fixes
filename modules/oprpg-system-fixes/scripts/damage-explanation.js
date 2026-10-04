import { rewriteNativeDamageMessage } from './shield-points-fix.js';

export function damageExplanation(actor,meta,factor,adjustment){
  const name=foundry.utils.escapeHTML(String(actor.name??'')),amount=Math.floor(meta.amount*factor);
  const scale=factor===0?'Salvaguarda: dano evitado':factor===0.5?'Salvaguarda: metade do dano':factor===0.25?'Um quarto do dano':factor===1?'Sem redução adicional':`Multiplicador: ${factor}`;
  const details=factor===0?'A salvaguarda evitou todo o dano. Nenhum PV foi perdido.':rewriteNativeDamageMessage(`🛡️ <strong>${name}</strong> (${amount} de dano):`,adjustment);
  return `<section class="oprpg-damage-explanation"><strong>${name}</strong><p>Dano do cartão: ${meta.amount} · ${scale} → ${amount}</p><details><summary>Como o dano foi aplicado</summary><p>${details}</p></details></section>`;
}
