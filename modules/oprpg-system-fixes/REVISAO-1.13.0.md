# System Fixes 1.13.0 — correções da revisão do livro

28/09/2026. Pacote: `oprpg-system-fixes-1.13.0.zip`.

## Instalação

1. Feche o Foundry e mantenha uma cópia da pasta atual `Data/modules/oprpg-system-fixes` para poder voltar à versão anterior.
2. Extraia o ZIP. Substitua aquela pasta pela pasta `oprpg-system-fixes` contida no arquivo. Não deixe uma pasta `oprpg-system-fixes` dentro de outra de mesmo nome.
3. Abra o Foundry, mantenha o módulo ativado e recarregue a página do mestre e dos jogadores.
4. Confira a versão **1.13.0** na lista de módulos.

O pacote contém apenas o Fixes. Não substitui o sistema OPRPG nem os compêndios do Narrador. A instalação na mesa não foi realizada nesta entrega.

## Correções

- **Escudo:** a resistência física fica limitada à reserva restante. Com 1 ponto de Escudo e um golpe físico de 20, sem outras defesas, passam 18 de dano aos PV. Os caminhos nativo e de cartão foram ajustados, incluindo parcelas de tipos diferentes e resistência própria do personagem.
- **Reserva de redução:** uma reserva consumível que absorveu apenas parte de seu valor preserva o restante. A opção legada de redução persistente continua separada.
- **Novas técnicas:** combate começa com Ação Poderosa; auxiliar começa com Ação Bônus, com opção de Reação. O formulário oferece Ácido, Psíquico, Trovejante e Energia, e identifica o dano Verdadeiro pelo nome correto.
- **Validação básica de criação:** rejeita cura de 1º grau, custo acima do limite e dano direto de auxiliares/MPs comuns. O mestre pode registrar uma exceção justificada. Técnicas de graus superiores verificam nível; 6º e 7º graus exigem despertar. Ainda é necessário conferir efeitos específicos, dados, CD, modelo de usuário e requisitos no editor.
- **Manifestações:** orçamento virtual separado do consumo de PP, teto bruto de 12 pontos, opções de ativação e limite obrigatório para cura. MP não cobra PP. A recuperação dos usos deve ser configurada conforme a habilidade; não foi imposto um descanso arbitrário. Passiva usa a ativação Especial aceita pelo sistema e fica identificada no item.
- **Rascunhos:** itens com campos ainda incompletos, como CD de salvaguarda, são identificados como rascunho e abrem no editor. Isso não impede que o mestre conclua uma regra especial.
- **Lendárias:** ações recuperam no início do turno; resistências reconhecem o armazenamento atual e o legado, impedem gasto repetido na mesma mensagem e atualizam a indicação visual de sucesso. Mensagens ocultas não são reveladas.
- **PV negativos:** registra dano posterior em 0 PV, descontando as proteções anteriores; o golpe que derruba não entra nesse acumulador. Cura positiva o reinicia. Morte por dano maciço ou limite de negativos é sinalizada para conferência do mestre, sem destruir a ficha nem resolver automaticamente nocaute/poderes especiais.
- **Descanso:** recupera PP, restaura metade dos Dados de Vida pelo caminho nativo, limita o benefício longo a uma vez a cada 24 horas do relógio do mundo e exige PV positivo no início. O descanso curto normal usa 30 minutos. Dados de Aura foram retirados do fluxo de descanso de personagens.

## Escolhas e controles

Em **Configurações do módulo → PP no descanso com Exaustão**, escolha:

- **Perguntar:** padrão. Ao concluir descanso iniciado com Exaustão, a janela pede qual interpretação usar. Cancelar não conclui a recuperação.
- **Página 278:** não recupera PP se iniciou exausto.
- **Página 36:** recupera metade do máximo de PP se terminou exausto, limitada ao máximo; se terminou sem Exaustão, recupera tudo.

O grupo **Livro 2.1: lendárias, descanso e registro de PV negativos** pode ser desativado nas opções do Fixes, após recarregar, para comparar com o comportamento anterior.

Na ficha, o mestre encontra **Regras do livro: descanso e PV negativos**. O controle permite:

- Ativar PV negativos para um NPC especial; NPCs comuns não recebem essa regra automaticamente.
- Registrar outro impedimento de recuperação de PP.
- Conferir ou ajustar o acumulador de PV negativos.
- Liberar excepcionalmente um novo descanso, quando o relógio do mundo não representa o tempo passado na narrativa.

Filho da Noite identificado pelo item de espécie não recebe descanso longo comum; sua meditação e a escolha dos benefícios continuam manuais. O módulo avisa essa exceção.

## Fichas e técnicas já existentes

As correções de dano, lendárias e descanso passam a valer após recarregar. As novas regras do criador valem para itens criados por ele. **Itens antigos não são reescritos automaticamente:** revise a ativação das técnicas já cadastradas no editor, para preservar alterações e exceções feitas pelo mestre. Não foi feita migração integral dos compêndios para o livro 2.1.

Dano Brutal e a redação conflitante de Queimado permanecem sujeitos à interpretação da mesa; esta versão não escolhe silenciosamente uma delas.

## Validação

Os resultados completos estão em `VALIDACAO-SYSTEM-FIXES-1.13.0.json` e nas suítes incluídas no pacote. Foram testados código real do módulo, métodos extraídos do sistema e cliques em formulários com DOM de navegador, usando documentos/relógios simulados. Também há cenários de conservação de dano e limites do Escudo.

Não houve importação nem teste com mestre e jogador conectados ao Foundry real nesta entrega. Sigilo visual, permissões e interação com outros módulos ainda precisam ser conferidos na mesa instalada.
