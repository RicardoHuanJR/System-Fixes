// Guide 2.0 pp.45-46: virtual encounter XP is not a reward or a creature resource.
const LIMITS = [[25,50,75,100],[50,100,150,200],[75,150,225,400],[125,250,375,500],[250,500,750,1100],[300,600,900,1400],[350,750,1100,1700],[450,900,1400,2100],[550,1100,1600,2400],[600,1200,1900,2800],[800,1500,2400,3600],[1000,2000,3000,4500],[1100,2200,3400,5100],[1250,2500,3800,5700],[1400,2800,4300,6500],[1600,3200,4800,7200],[2000,3900,5900,8800],[2100,4200,6300,9500],[2400,4900,7300,10900],[2800,5700,8500,12700]];
export function encounterEstimate(levels,xp,count) {
  if(!Array.isArray(levels)||!levels.length||!levels.every(n=>Number.isInteger(n)&&n>=1&&n<=20))throw Error('Informe níveis de 1 a 20.');
  if(!Number.isFinite(xp)||xp<0||!Number.isInteger(count)||count<1)throw Error('Informe XP não negativo e quantidade de criaturas positiva.');
  const thresholds=levels.reduce((sum,level)=>sum.map((n,i)=>n+LIMITS[level-1][i]),[0,0,0,0]);
  const steps=[0.5,1,1.5,2,2.5,3,4,5];
  let index=count===1?1:count===2?2:count<=6?3:count<=10?4:count<=14?5:6;
  if(levels.length<3)index++;else if(levels.length>=5)index--;
  const multiplier=steps[index],adjustedXP=xp*multiplier;
  const categories=['Abaixo de fácil','Fácil','Média','Difícil','Mortal'];
  const rank=thresholds.reduce((n,limit,i)=>adjustedXP>=limit?i+1:n,0);
  return {thresholds,multiplier,adjustedXP,rewardXP:xp,category:categories[rank]};
}
export async function openNarratorTools() {
  if(!game.user.isGM)throw Error('Ferramenta exclusiva do mestre.');
  const data=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:'Mestre — avaliar encontro'},content:'<p>Guia do Narrador 2.0, páginas 45–46. Estimativa; ações lendárias, controle e terreno exigem julgamento.</p><label>Níveis dos jogadores (separados por vírgula)<input name="levels" value="6,6,6,6,6,6"></label><label>XP real total das criaturas<input name="xp" type="number" min="0" value="0"></label><label>Criaturas relevantes para o multiplicador<input name="count" type="number" min="1" value="1"></label><p>Não conte criaturas muito fracas que não contribuam ao desafio. Avalie ondas separadamente.</p>',buttons:[{action:'calculate',label:'Calcular',callback:(_e,_b,d)=>{const q=n=>d.element.querySelector(`[name="${n}"]`).value;return encounterEstimate(q('levels').split(/[,;\s]+/).filter(Boolean).map(Number),Number(q('xp')),Number(q('count')));}},{action:'cancel',label:'Cancelar',callback:()=>null}],rejectClose:false});
  if(!data||typeof data!=='object')return null;
  await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:'Mestre — resultado do encontro'},content:`<p>Dificuldade estimada: <strong>${data.category}</strong></p><p>XP ajustado: ${data.adjustedXP} (×${data.multiplier}). XP real para recompensa: ${data.rewardXP}.</p><p>Limites do grupo — Fácil: ${data.thresholds[0]}; Média: ${data.thresholds[1]}; Difícil: ${data.thresholds[2]}; Mortal: ${data.thresholds[3]}.</p><p>O XP ajustado só mede dificuldade. Nada foi aplicado às fichas ou ao combate.</p>`,buttons:[{action:'close',label:'Fechar',callback:()=>null}],rejectClose:false});
  return data;
}
export function installNarratorTools() {
  Hooks.on('renderSettings',(_app,html)=>{
    if(!game.user.isGM)return;
    const root=html?.[0]??html;if(!root?.querySelector||root.querySelector('[data-oprpg-narrator]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.oprpgNarrator='1';button.textContent='Mestre: avaliar encontro';button.onclick=()=>openNarratorTools().catch(e=>ui.notifications.warn(e.message));root.append(button);
  });
}
