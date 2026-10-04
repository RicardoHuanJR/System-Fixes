// Curated character rules. No NPC aspects or editable formula presets.
export const CHARACTER_RULES = [
  {id:'robusto',name:'Robusto',aliases:['Robusto'],source:'Livro do Jogador 2.1, p. 40',passive:true,summary:'Mais 3 PV máximos por nível de personagem, sem curar PV atuais.'},
  {id:'ingenuidade-anormal',name:'Ingenuidade Anormal',aliases:['Ingenuidade Anormal'],source:'Livro do Jogador 2.1, p. 16',passive:true,summary:'Penalidade de 10 em Intuição; não altera o atributo inteiro.'},
  {id:'corpo-leve',name:'Corpo Leve',aliases:['Corpo Leve'],source:'Livro do Jogador 2.1, p. 28',passive:true,summary:'Deslocamento de 12 metros e escalada de 9 metros; prevalece o maior.'},
  {id:'estamina-animal',name:'Estamina Animal',aliases:['Estamina Animal'],source:'Livro do Jogador 2.1, p. 28',passive:true,summary:'Deslocamento de 18 metros; prevalece o maior.'},
  {id:'pisada-firme',name:'Pisada Firme',aliases:['Pisada Firme'],source:'Livro do Jogador 2.1, p. 28',passive:true,summary:'Deslocamento de 12 metros; prevalece o maior.',manual:'A imunidade ao terreno difícil continua sob controle da mesa.'},
  {id:'resiliencia-humana',name:'Resiliência',aliases:['Resiliência'],source:'Livro do Jogador 2.1, p. 188',passive:true,abilityChoice:true,summary:'Proficiência na salvaguarda escolhida, sem duplicar uma proficiência já existente.'},
  {id:'overclock',name:'Overclock',aliases:['Overclock'],source:'Livro do Jogador 2.1, p. 69',style:'Ciborgue',level:11,seconds:300,uses:true,weaponSelect:true,summary:'Deslocamento de 15 metros e mais 1d6 elétrico nos ataques comuns selecionados.',manual:'A penalidade dos inimigos atingidos contra outros atacantes continua sob confirmação.'},
  {id:'controle-corporal',name:'Controle Corporal',aliases:['Controle Corporal'],source:'Livro do Jogador 2.1, p. 179',seconds:60,uses:true,select:true,formChoice:true,summary:'Forma híbrida: Largo adiciona um dado nas técnicas; Grande concede 20 PV temporários.',manual:'Confirme a forma híbrida Zoan. Corpo Magro está pendente da integração do bônus de acerto.'},
  {id:'musculo-aco',name:'Músculo de Aço',aliases:['Músculo de Aço','Posições de Luta'],source:'Livro do Jogador 2.1, p. 86',style:'Lutador',level:3,summary:'Resistência a dano contundente, cortante e perfurante.',manual:'Escolha a posição no início do turno. As demais posições ainda são resolvidas pela mesa.'}
];

export function lengthInUnits(metres,units){
  if(units==='m'||units==='meter'||units==='meters')return metres;
  if(units==='ft')return metres/0.3;
  throw Error('Configure o deslocamento da ficha em metros ou pés antes de ativar esta regra.');
}

export function characterRuleChanges(id,actor,config,modes){
  const add=(key,value)=>({key,mode:modes.ADD,value:String(value)});
  const upgrade=(key,value)=>({key,mode:modes.UPGRADE,value:String(value)});
  const movement=(kind,m)=>upgrade('system.attributes.movement.'+kind,lengthInUnits(m,actor.system.attributes.movement.units));
  switch(id){
    case 'robusto':{
      const level=Number(actor.system.details.level);
      if(!Number.isInteger(level)||level<1)throw Error('A ficha precisa ter um nível de personagem válido.');
      const manual=actor._source?.system?.attributes?.hp?.max;
      return [add(Number.isFinite(manual)?'system.attributes.hp.max':'system.attributes.hp.bonuses.overall',3*level)];
    }
    case 'ingenuidade-anormal':return [add('system.skills.ins.bonuses.check','-10')];
    case 'corpo-leve':return [movement('walk',12),movement('climb',9)];
    case 'estamina-animal':return [movement('walk',18)];
    case 'pisada-firme':return [movement('walk',12)];
    case 'overclock':return [{...movement('walk',15),mode:modes.OVERRIDE}];
    case 'resiliencia-humana':{
      if(!Object.hasOwn(actor.system.abilities??{},config.ability))throw Error('Escolha a salvaguarda nas opções.');
      return [upgrade(`system.abilities.${config.ability}.proficient`,1)];
    }
    case 'musculo-aco':return ['bludgeoning','slashing','piercing'].map(t=>add('system.traits.dr.value',t));
    default:return [];
  }
}

export function ruleDamage(id,item,activity,config,faces){
  if(id==='overclock'&&item.type==='weapon'&&activity.type==='attack'&&config.weaponIds?.includes(item.id))return {formula:'1d6',type:'lightning'};
  if(id==='controle-corporal'&&config.form==='wide'&&item.type==='spell'&&config.techniqueIds?.includes(item.id)&&Number.isInteger(Number(item.system.level))&&Number(item.system.level)>0&&Number.isInteger(faces)&&faces>=2)return {formula:`1d${faces}`};
  return null;
}
