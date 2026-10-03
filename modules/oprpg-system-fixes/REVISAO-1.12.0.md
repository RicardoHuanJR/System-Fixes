# System Fixes 1.12.0

## Dano nos alvos

Os botões de dano dos cartões OPRPG passam a usar os tokens marcados como **alvos**. Selecionar ou controlar o personagem não o torna destinatário do dano. Sem alvo, a aplicação é interrompida com um aviso.

- Cartões de ataque, dano e salvaguarda usam o total mostrado, incluindo os controles de metade/um quarto.
- A mesma ficha vinculada a dois tokens recebe uma aplicação. Tokens não vinculados mantêm suas fichas independentes.
- Nos cartões personalizados, o registro de aplicação é salvo junto com o dano na ficha. Um segundo clique no mesmo cartão/atividade/alvo não repete o dano. Para um novo ataque, ative a técnica novamente para criar outro cartão. O histórico de proteção retém as últimas 100 aplicações por ficha.
- O cálculo existente de resistências, armadura, escudo, PV temporários, intangibilidade e proteção de formas continua sendo usado. Vitalidade mantém seu diálogo específico.
- A aplicação exige permissão para alterar todos os alvos. Quando um jogador não tem essa permissão, o mestre precisa aplicar o dano.
- Resumos dos cartões personalizados preservam os destinatários e o sigilo da mensagem original.
- O menu de dano das rolagens e o componente nativo de aplicação também usam os alvos atuais. Seus modificadores e o cálculo nativo são preservados; a prévia acompanha a mudança de alvos.

## Ativação de técnicas e áreas

Técnicas ofensivas, curas em terceiros e atividades que indiquem criaturas/objetos como destinatários pedem alvos quando não há área configurada. O diálogo permite continuar marcando tokens no mapa. Cancelar ou confirmar sem alvos válidos impede a ativação e o gasto de recursos. Efeitos pessoais ficam dispensados.

Técnicas com área verificam cena, tamanho e permissão antes da ativação. Nos cartões personalizados que pulam o fluxo normal do sistema, um posicionamento de área é iniciado após a criação do cartão. Se a instalação já fornece o auxiliar nativo `placeTechniqueTemplates`, ele continua responsável por essa etapa, evitando duplicação.

O botão **Posicionar área** permite tentar novamente ou colocar outro molde. Ele não remove moldes anteriores. Cancelar o posicionamento após o cartão ter sido criado não devolve automaticamente os recursos da ativação. Áreas mostram o alcance; o módulo não decide automaticamente acertos, salvaguardas ou dano para todos os tokens dentro delas.

## Compêndio e artes

O módulo separado **OP RPG — Características do Narrador 1.0.0** contém 176 entradas das páginas 131–140 do livro enviado: 167 características e nove estágios de Haki. Inclui seis novas artes temáticas compartilhadas por categoria. Os itens podem ser arrastados para os NPCs. O painel de artes permite atualizar ícones reconhecidos e restaurar as imagens anteriores.

## Validação e limites

Foram executados testes de regressão e simulações em navegador com o código real dos módulos, eventos de clique e documentos Foundry simulados. Os resultados detalhados estão na pasta `tests`. O compêndio foi compilado e extraído novamente com a ferramenta oficial do Foundry; cada um dos 176 documentos foi comparado com sua fonte.

Esta versão não foi instalada nem testada em uma sessão real da mesa. As simulações não verificam renderização da área pelo canvas do Foundry, concorrência entre dois mestres aplicando dano simultaneamente ou conflitos com todos os módulos da mesa. Os bloqueios de operação são locais ao cliente. O molde usa a implementação de área do sistema instalado.

As correções anteriores de sigilo de dados 3D, múltiplas atividades, treinos, Fruta e efeitos permanecem incluídas. O novo grupo pode ser desativado em Configurações → OPRPG System Fixes → Aplicar dano nos alvos e solicitar alvos/áreas das técnicas, seguido de recarga.
