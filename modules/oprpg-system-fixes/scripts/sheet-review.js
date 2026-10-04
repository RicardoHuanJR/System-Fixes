import { MODULE_ID, activitiesOf } from './shared.js';

const escape=value=>foundry.utils.escapeHTML(String(value??''));
// Review only: a missing book value must never be guessed from PP or item name.
export function inspectSheet(actor){
  const issues=[];
  const add=(item,code,detail)=>issues.push({itemId:item?.id??null,name:item?.name??actor.name,code,detail});
  for(const item of actor.items??[]){
    const activities=activitiesOf(item),system=item.system??{};
    if(item.type==='weapon'&&!activities.some(a=>a.type==='attack'))add(item,'weapon-attack','Se este item representa um ataque comum, configure uma atividade de ataque na arma.');
    if(item.type!=='feat'&&activities.some(a=>a.activation?.type==='legendary'))add(item,'legendary-category','A ação lendária deve ficar em uma característica, na seção de ações lendárias da ficha.');
    if(item.type==='spell'){
      const grade=system.level;
      if(grade===null||grade===undefined||grade===''||!Number.isInteger(Number(grade))||Number(grade)<0||Number(grade)>7)add(item,'grade','Confira o grau no livro. Grau 0 é uma técnica auxiliar; o custo em PP não define o grau.');
      if(!activities.length)add(item,'activities','A técnica não tem atividades. Configure sua execução, custo, alcance e alvos no item.');
      for(const activity of activities){
        const ability=activity.ability??system.ability;
        if(['attack','save'].includes(activity.type)&&!ability&&!activity.attack?.ability&&!activity.save?.dc?.calculation)add(item,'ability','Confira o atributo de ataque ou da CD desta atividade. Não foi encontrado atributo nem cálculo de CD.');
        const template=activity.target?.template;
        if(template?.type&&!(Number(template.size)>0))add(item,'area','Uma área está definida, mas seu tamanho está vazio ou inválido.');
      }
    }
    const uses=system.uses;
    if(uses&&Number.isFinite(Number(uses.max))&&Number(uses.max)>0&&(!Number.isFinite(Number(uses.spent))||Number(uses.spent)<0||Number(uses.spent)>Number(uses.max)))add(item,'uses','Os usos gastos estão fora do limite da característica. Confira os usos e a recuperação.');
  }
  for(const [rule,config]of Object.entries(actor.flags?.[MODULE_ID]?.catalogue??{})){
    if(!config.enabled)continue;
    const item=actor.items.get(config.sourceItemId);
    if(!item){add(null,'automation-source','Uma automação habilitada está sem sua característica original. Confira as Opções na aba Automações.');continue;}
    if(config.activityId&&!activitiesOf(item).some(a=>a.id===config.activityId))add(item,'automation-activity','A atividade escolhida para ativar esta automação foi removida. Selecione outra nas Opções.');
    if(['diable-jambe','overclock','controle-corporal'].includes(rule)&&!(Number(item.system?.uses?.max)>0))add(item,'automation-uses','Esta automação exige usos na característica original. Configure o limite e a recuperação no item.');
  }
  const seen=new Set();
  for(const effect of actor.effects??[]){
    const rule=effect.flags?.[MODULE_ID]?.catalogue;
    if(!rule||effect.disabled)continue;
    const key=rule+':'+effect.origin;
    if(seen.has(key))issues.push({itemId:null,name:effect.name,code:'duplicate-managed-effect',detail:'Há mais de um efeito ativo desta automação com a mesma origem. Revise os efeitos antes de excluir um deles.'});
    seen.add(key);
  }
  return issues;
}
export async function openSheetReview(actor){
  if(!actor?.isOwner)throw Error('Você precisa controlar esta ficha.');
  const issues=inspectSheet(actor);
  const choice=await foundry.applications.api.DialogV2.wait({classes:['oprpg-fixes-dialog'],window:{title:'Revisar ficha — '+actor.name},content:`<p>Esta verificação não altera sua ficha. Confira cada indicação com o livro; valores ausentes não serão deduzidos.</p>${issues.length?`<label>Indicação<select name="issue">${issues.map((i,n)=>`<option value="${n}">${escape(i.name)}: ${escape(i.detail)}</option>`).join('')}</select></label><ul>${issues.map(i=>`<li><strong>${escape(i.name)}</strong>: ${escape(i.detail)}</li>`).join('')}</ul>`:'<p>Nenhuma inconsistência encontrada nestas verificações. Isso não substitui a conferência das regras do livro.</p>'}`,buttons:[...(issues.length?[{action:'open',label:'Abrir item para revisar',callback:(_e,_b,d)=>Number(d.element.querySelector('[name=issue]').value)}]:[]),{action:'close',label:'Fechar',callback:()=>null}],rejectClose:false});
  if(choice===null||choice===undefined)return issues;
  const issue=issues[choice];
  if(issue?.itemId)await actor.items.get(issue.itemId)?.sheet?.render(true);
  else if(issue)await actor.sheet?.render(true,{tab:'effects'});
  return issues;
}
