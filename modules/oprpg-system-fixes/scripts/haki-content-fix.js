/** Correções de conteúdo do Haki para OPRPG. Não altera arquivos do sistema. */

import { MODULE_ID as ID } from "./shared.js";

// Descrições do Armamento que mudaram no capítulo 7, versão 2.1.
const ARMAMENTO = {
  "ataque-infuso": {
    base: "Suas jogadas de ataque de Técnicas e os danos Contundente, Cortante ou Perfurante de Técnicas afetam usuários de Akuma no Mi, ignorando Intangibilidade, resistências e invulnerabilidades sobrenaturais, com as exceções descritas na regra. Para ataques comuns, escolha uma forma: desarmados, corpo a corpo com arma ou à distância.",
    dominada: "Escolha uma segunda forma de ataque comum.",
    avancada: "Escolha uma terceira forma de ataque comum."
  },
  "endurecimento-defensivo": {
    base: "Cria 20 Pontos de Escudo, que coexistem com PV temporários, são consumidos antes deles e se renovam após 10 minutos fora de combate. Os Pontos de Escudo têm resistência a dano Contundente, Cortante e Perfurante.",
    dominada: "Muda para 40 Pontos de Escudo.",
    avancada: "Muda para 60 Pontos de Escudo."
  },
  "chama-do-armamento": {
    base: "Ao usar Endurecimento Ofensivo, você pode converter qualquer quantidade do dano adicional desse talento para Fogo.",
    dominada: "Suas Técnicas não podem causar menos da metade do dano máximo possível, antes de reduções. Até metade do dano total da Técnica pode ter o tipo convertido para Fogo."
  },
  "corpo-armadurado": {
    base: "Com uma ação bônus, fortaleça o corpo por 1 minuto. Suas Salvaguardas recebem +2. Recupera o uso no descanso longo.",
    dominada: "Enquanto ativo, os Pontos de Escudo de Endurecimento Defensivo ganham resistência a todos os outros tipos de dano, exceto dano Verdadeiro. O máximo de Pontos de Escudo não aumenta.",
    avancada: "Enquanto ativo, o dado de Endurecimento Ofensivo sobe um passo: 1 → 1d4 → 1d6 → 1d8."
  },
  "armadura-suprema": {
    avancada: "Os Pontos de Escudo de Endurecimento Defensivo aumentam para 80, caso ele esteja na Forma Avançada. Seus Pontos de Vida máximos aumentam permanentemente em 40."
  },
  "escudo-de-vontade": {
    avancada: "Ao usar esse talento como reação ao sofrer dano de uma Técnica de Akuma no Mi, você também reduz pela metade o dano sofrido."
  }
};

const OBSERVACAO = {
  "perceber-emocoes": {
    base: "Você percebe sem teste se a postura de uma criatura que possa ver a até 6 metros é hostil, neutra ou amigável em relação a você.",
    dominada: "Você recebe vantagem em Testes de Atributo de Presença ao interagir com criaturas amigáveis.",
    avancada: "Você recebe vantagem em Testes de Atributo de Presença ao interagir com criaturas neutras."
  },
  "perceber-presenca": {
    base: "Com uma ação e mantendo Concentração, sinta criaturas vivas em 6 metros. Você recebe percepção às cegas nessa área e percebe como auras até criaturas invisíveis ou ocultas.",
    dominada: "O alcance aumenta para 12 m.",
    avancada: "Você percebe o estado físico de qualquer criatura conhecida dentro da ilha: vivo, morto, ferido ou saudável; fora de uma ilha, o Narrador define a área."
  },
  "perceber-desafio": {
    base: "Uma vez por encontro, use uma ação para focar uma criatura a até 6 m. O Narrador revela um valor aproximado do Nível de Desafio ou dos Pontos de Vida dela.",
    dominada: "Você percebe criaturas poderosas, com ND acima do seu nível ou assim definidas pelo Narrador, dentro da ilha ou que nela entrem; fora de uma ilha, o Narrador define a área."
  },
  "perceber-o-futuro": {
    base: "Fora de combate, você pode pedir ao Narrador uma visão dos próximos 30 segundos. As visões podem ser incompletas, enganosas ou se desviar conforme as ações e dados.",
    dominada: "Você passa a enxergar até 2 minutos no futuro.",
    avancada: "Você passa a enxergar até 10 minutos no futuro."
  },
  "antecipacao": {
    base: "Ao usar uma característica ligada ao acerto de ataque comum ou de Técnica, ao ser alvo de um desses ataques ou ao realizar Salvaguarda, você pode decidir ativá-la após saber se o ataque ou efeito teve sucesso, evitando gastar recursos em vão.",
    dominada: "Ao sofrer dano, você pode perguntar ao Narrador o valor exato antes de decidir usar suas características.",
    avancada: "Se sua reação não causar nem reduzir dano e não produzir outro efeito ou impacto, você recupera o uso da reação ao fim do turno em que ela foi utilizada."
  },
  "clarividencia": {
    base: "Quando uma Técnica que exija uma jogada de ataque não afetar criatura, ambiente, estrutura ou objeto, você gasta metade do custo em PP, arredondada para cima.",
    dominada: "Você pode escolher não gastar PP quando a Técnica não afetar criatura, ambiente, estrutura ou objeto. Pode usar esta forma até 3 vezes por descanso longo.",
    avancada: "A Forma Dominada também se aplica a Técnicas que imponham Salvaguardas e não afetem criatura, ambiente, estrutura ou objeto."
  },
  "vidente": {
    base: "Após um descanso longo, role 1d20 e guarde o resultado. Você pode substituí-lo por um Teste de Atributo ou Salvaguarda seu ou de criatura que possa ver, após o d20 ser rolado e antes de saber se houve sucesso. O valor guardado é consumido nessa substituição.",
    dominada: "Você passa a rolar e guardar 2 dados por descanso longo."
  },
  "premonicao": { base: "Você não pode ser surpreendido, não rola iniciativa e sempre age primeiro. Se múltiplas criaturas tiverem esta característica, o Narrador decide a ordem entre elas." },
  "ver-o-futuro": { base: "Ao falhar em uma Salvaguarda ou ataque comum, você pode tratá-lo como sucesso. Pode usar 3 vezes por descanso longo." },
  "antevisao": {
    base: "Ação bônus e Concentração: sua CR aumenta em +1 enquanto mantiver a Concentração. Alternativamente, se não estiver concentrando nessa habilidade, ao ser alvo de um ataque comum você pode usar sua reação para receber +2 CR até o início do próximo turno.",
    dominada: "Os bônus passam a +2 CR na forma padrão e +3 CR na forma alternativa.",
    avancada: "Os bônus passam a +3 CR na forma padrão e +4 CR na forma alternativa."
  },
  "passo-antecipado": { base: "Uma vez por rodada, você ignora um ataque comum provocado por seu deslocamento, mesmo que ele ignore características como Ataque de Oportunidade Superior." },
  "antevisao-sobrenatural": { base: "Quando um efeito permitir uma Salvaguarda de Destreza para sofrer metade do dano, você não sofre dano se passar e sofre somente metade se falhar." },
  "antecipar-movimentos": { base: "Gaste 2 PP para impedir uma criatura a até 1,5 m de se levantar, escalar, saltar ou usar reação. Uma vez por rodada por criatura; o deslocamento dela fica 0 até o início do próximo turno." },
  "antevisao-especial": {
    base: "Ataques comuns contra você, feitos por criaturas sem Haki da Observação, têm desvantagem.",
    dominada: "Você realiza Salvaguardas de Destreza com vantagem contra essas mesmas criaturas."
  },
  "antevisao-profetica": {
    base: "Uma vez por rodada, ao usar Técnica ou característica de reação, você pode executar outra de reação como parte da mesma reação. Não pode repetir a anterior nem causar dano. Uso: 1 vez por descanso longo.",
    dominada: "Pode usar até 3 vezes por descanso longo.",
    avancada: "Pode usar até 5 vezes por descanso curto ou longo."
  },
  "previsao": {
    base: "Sempre que fizer uma jogada de ataque, comum ou de Técnica, recebe +1 para acertar.",
    dominada: "O bônus passa a +2.",
    avancada: "O bônus passa a +3."
  },
  "previsao-sobrenatural": {
    base: "Quando errar uma jogada de ataque de Técnica ou ela não afetar criatura ou ambiente, acumula 1 dado extraordinário de dano/cura para Técnica posterior, até 5 dados e até o fim do encontro. Eles só ajudam a alcançar o máximo, nunca ultrapassá-lo.",
    dominada: "Você pode consumir cada dado para recuperar 1 PP.",
    avancada: "Você pode consumir cada dado para recuperar 2 PP."
  },
  "impeto-antecipado": {
    base: "Ao usar Técnica de Combate que cause dano direto e exija Ação Poderosa, faça um ataque comum adicional contra o alvo como parte da mesma Ação Poderosa. Uso: 3 vezes por descanso longo.",
    dominada: "Não possui mais limitação de uso."
  },
  "previsao-especial": {
    base: "Ao realizar um ataque comum, você ignora qualquer reação ativada por sua ação de ataque; a criatura também perde a reação até o início do próximo turno.",
    dominada: "Escolha uma característica da Maestria Profeta ou Imaculado sem receber os PA que ela poderia conceder."
  },
  "previsao-profetica": {
    base: "Ao usar Técnica ou característica de ação bônus, você pode executar outra de ação bônus como parte da mesma ação. Não pode repetir a anterior nem causar dano. Uso: 1 vez por descanso longo.",
    dominada: "Pode usar até 3 vezes por descanso longo.",
    avancada: "Pode usar até 5 vezes por descanso curto ou longo."
  }
};

const REI = {
  rei: { base: "Ao despertar o Haki do Rei, você recebe Presença Real (onda de vontade em estresse extremo num raio de 9 metros, conforme Desmaiando Inimigos), Carisma do Conquistador (+2 Vontade e limite mínimo 26), Ambição Crescente (+2 PA no nível 10 e em cada nível posterior, retroativamente se adquirido depois) e Espírito Selvagem (vantagem em Testes de Atributo de Vontade contra animais, exceto lendários ou abissais)." },
  "autoridade-do-rei": { base: "Com uma ação, force uma criatura a até 18 m a fazer Salvaguarda de Vontade. Em falha, ela fica Amedrontada até o fim do próximo turno ou cai inconsciente, à sua escolha.", dominada: "Pode usar como ação bônus.", avancada: "Pode usar como reação ao ser alvo de ataque comum." },
  "superacao-majestosa": { base: "Com uma ação bônus, recupere 1 uso de uma característica limitada por dia ou recuperada em descanso curto ou longo, exceto a própria Superação Majestosa. Uso: 1 vez por descanso longo.", dominada: "Pode usar duas vezes antes de descanso longo." },
  "imposicao-do-rei": { base: "Ao acertar ataque comum ou de Técnica, você pode derrotar instantaneamente criatura de ND 2 ou menor suscetível ao desmaio; ela cai a 0 PV, inconsciente por colapso mental conforme a regra Desmaiando Inimigos.", dominada: "O ND máximo passa a 4.", avancada: "O ND máximo passa a 6." },
  "vontade-do-rei": { base: "Após 5 turnos inconsciente a 0 PV, recupere todos os PV e metade dos PP. Dois minutos depois, fica Paralisado por 1 hora e recebe 5 Exaustões, recuperando uma por descanso longo em tempo dobrado.", dominada: "Descansos longos passam a terminar no tempo normal.", avancada: "Exige somente 2 turnos desacordado." },
  "soberania-do-rei": { base: "Com uma ação, por até 1 minuto, Amedronte ou desmaie criaturas escolhidas em 15 m, conforme Desmaiando Inimigos. Quem passar na Salvaguarda e for suscetível ao desmaio gasta 1,5 metro adicional para cada 1,5 metro percorrido dentro da área. Encerrar a aura não exige ação.", dominada: "Alcance passa a 30 m.", avancada: "Alcance passa a 60 m." },
  "presenca-esmagadora": { base: "Criatura hostil sem Haki do Rei que comece o turno a até 3 m deve passar em Salvaguarda de Vontade ou sofrer 2d6 psíquico.", dominada: "Escolha uma característica de Ambição Suprema ou Imaculado sem receber os PA dela.", avancada: "Ao realizar Técnica contra um único alvo com ND, adicione dados extras ao dano iguais ao ND da criatura. Não surte efeito em criaturas sem ND. Uso: 1 vez por descanso longo." },
  "armamento-do-rei": { base: "Uma vez por turno, ao realizar ataque comum, gaste 3 PP para transformá-lo em acerto crítico automático e maximizar todos os dados de dano.", dominada: "De forma passiva, PV perdidos por dano causado por seus ataques não podem ser recuperados até o fim do encontro.", avancada: "De forma passiva, condições com duração predefinida causadas por você não podem ser encerradas antecipadamente por Salvaguardas ou outras características." },
  "emissao-de-autoridade": { base: "Com uma ação, escolha criatura a até 120 m que possa ver ou sentir pelo Haki da Observação. Ela faz Salvaguarda de Vontade CD 18. Em sucesso, recebe desvantagem em uma jogada à sua escolha até o fim do próximo turno dela. Em falha, no próximo turno tem deslocamento 0 e pode realizar apenas uma entre Ação, Ação Poderosa ou Ação Bônus." }
};

export const CORRECTED_TALENT_IDS = new Set(Object.keys({...ARMAMENTO, ...OBSERVACAO, ...REI}));

// Applied to the same shared talent objects used by the tree and HUD.
// This function runs before automation handlers are installed, without a second
// asynchronous ready hook or an extra dynamic import of the system.
export function applyContentFix(systemData) {
  const talents = systemData?.HAKI_TALENTOS_BY_ID;
  if (!talents) throw new Error("Exportação HAKI_TALENTOS_BY_ID ausente.");
  for (const [id, data] of Object.entries({...ARMAMENTO, ...OBSERVACAO, ...REI})) {
    if (talents[id]) Object.assign(talents[id], data);
  }
  // O requisito novo de Chama do Armamento inclui Endurecimento Ofensivo.
  const chama = talents["chama-do-armamento"];
  if (chama?.req?.talentos && !chama.req.talentos.includes("endurecimento-ofensivo")) {
    chama.req.talentos.push("endurecimento-ofensivo");
  }
  // A árvore antiga exibe estes quatro talentos no Estágio Treinado, mas a
  // versão 2.1 os lista no Estágio Perito.
  for (const id of ["antecipar-movimentos", "antevisao-especial", "impeto-antecipado", "previsao-especial"]) {
    const talent = talents[id];
    if (!talent) continue;
    talent.estagio = "perito";
    if (talent.req) talent.req.estagio = "perito";
  }
  console.info(`${ID} | Descrições e formas de Haki corrigidas.`);
}

