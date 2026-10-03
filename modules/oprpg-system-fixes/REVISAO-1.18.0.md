# System Fixes 1.18.0

Corrige a visibilidade dos cards no Foundry 14 e devolve aos controles de dano a apresentação nativa do OPRPG.

## Alterações

- O modo de mensagem da barra do Foundry 14 é a referência de privacidade. O campo antigo `core.rollMode` podia continuar em `selfroll` quando a barra mostrava Público. Cards criados com esse público antigo reconhecido são corrigidos antes de serem enviados; modos explicitamente fornecidos e listas de destinatários específicas são respeitados.
- Mensagens do Haki, Vidente e concentração de personagens usam a mesma referência atual. Concentração automática de NPC mantém a regra existente de envio ao mestre.
- Uma operação antiga de card não determina a privacidade de uma animação independente. Dados vinculados a um card continuam usando os destinatários daquele card.
- ½ e ¼ das salvaguardas usam os controles nativos, são mutuamente exclusivos e arredondam para baixo. Desmarcar devolve o total inteiro. Os eventos são vinculados novamente quando o Foundry recria o HTML, sem duplicar os eventos no mesmo elemento.
- Removidos o botão Posicionar área e os avisos técnicos de acompanhamento de atividades, inclusive de cards antigos ao renderizar. A lógica de posicionamento automático de áreas continua disponível.
- O diálogo de alvos das técnicas se limita a itens `spell`; armas e características seguem o fluxo nativo.

## Testes reais

Instalado no Foundry 14.367, sistema OPRPG 1.0.20, mundo OP RPG 2.0. Testes feitos na sessão de jogador Leimig pela interface, sem aplicar dano nem gastar recursos das fichas.

1. Antes da correção, barra Público como Usuário e card Vanquish enviado Para: Leimig. Após instalar e recarregar, novo card público, sem destinatário privado.
2. Rolagem de dano desse card: 13; metade 6; quarto 3; desmarcar restaura 13.
3. Card existente Rankyaku, recriado após recarregar: total 15; metade 7; quarto 3; desmarcar restaura 15. Aparência nativa dos controles conferida.
4. Somente para Si: novo card corretamente destinado a Leimig. Barra restaurada para Público como Usuário ao concluir.
5. Vanquish/Cortar abre o card sem o diálogo indevido de alvos de técnica.
6. Cards renderizados sem botão de área e sem o painel técnico de atividades.

Foram criados três cards de arma para teste, dois antes/depois da correção pública e um privado após a correção. Não foram apagados cards históricos nem alterados PV ou PP das criaturas.

A observação simultânea da animação Dice So Nice em outra sessão não foi concluída. Rolagens GM/cego, áreas automáticas, Haki e aplicação de dano foram cobertas por simulações; não se afirma teste real desses fluxos nesta revisão. Foram vistos erros preexistentes do sistema ao registrar listas de magias de compêndios dnd5e ausentes; esta atualização não modifica esse registro.

## Simulações

421 verificações passaram: alvos/interface 220, auditoria 104, regressão 18, duração sustentada 26, regras do livro 53. Os relatórios estão em `tests/*-1.18.0.json`. O validador conferiu sintaxe de 40 arquivos e 145 importações locais. Estes testes usam documentos Foundry simulados, não 421 operações numa mesa real.

## Instalação e retorno

A correção já foi copiada para o módulo instalado nesta máquina. Atualize com F5 as janelas do mestre e jogadores para carregar os arquivos novos. O servidor pode mostrar a versão antiga até o próximo reinício normal do mundo; não foi reiniciado durante os testes.

Para outra instalação, extraia o ZIP e substitua a pasta `Data/modules/oprpg-system-fixes` pela pasta de mesmo nome. Não precisa modificar o sistema OPRPG.

Cópia de segurança anterior nesta área de trabalho: `work/backup-live-fixes-1.17.1`. Para voltar, restaure essa pasta como `Data/modules/oprpg-system-fixes` e atualize os clientes.
