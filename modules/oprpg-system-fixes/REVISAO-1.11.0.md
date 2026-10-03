# System Fixes 1.11.0

## O que muda

- **Sigilo de rolagens:** chamadas diretas do sistema ao Dice So Nice passam a receber os destinatários da mensagem ou o modo de rolagem. Corrige o caminho encontrado que transmitia os dados para todos. Inclui cartões de ataque, dano e cura, bônus de dano do Fixes e cura automática. Cartões privados preservam o público original após mudar o modo do chat. Sem Dice So Nice, as rolagens continuam funcionando.
- **Técnicas da fruta:** criação com fórmula, tipo de dano, custo PP, alcance, quantidade de alvos e duração, incluindo permanente. Valores inválidos impedem a criação; o editor nativo abre para configurar detalhes. Duplicação pelo painel gera novos identificadores de atividades, evitando compartilhar a manutenção com a original. Inclui o reparo da lixeira da 1.10.2.
- **Treinos:** mantém a escolha entre gastar PT e receber gratuitamente. Registra origem, observação, custo e alterações; permite desfazer o último aprendizado compatível, sem devolver PT de treinos gratuitos. Se pontos, campos afetados ou itens mudaram, o desfazer é bloqueado. Genialidade deve ser desfeita pelo fluxo nativo após revisar técnicas dependentes.
- **Painel System Fixes:** acesso pelas Configurações da barra lateral e pelo botão de ferramentas no cabeçalho da ficha. Consulta manutenções, duração, custo por turno, próxima aplicação, efeitos da ficha, recarga de escudo, histórico, diagnósticos e grupos habilitados. Prolonga uma unidade ou encerra a manutenção selecionada.
- **Prévias:** calculadora de dano pelas camadas de redução, armadura, escudo, PV temporários e PV; cura respeita o teto e PVT respeita a maior reserva. É uma simulação manual: informe dano já ajustado por resistências e vulnerabilidades. Efeitos condicionais de fruta/Haki e outros módulos podem alterar o resultado real. A prévia não aplica dano nem gasta recursos.
- **Histórico:** registra mudanças de PV, PVT, PP, escudo, armadura e PT no mesmo update. Guarda no máximo 100 entradas por ficha, sem criar mensagens públicas.
- **Proteção contra cliques concorrentes:** treinos, criação/exclusão/duplicação de técnicas e operações do painel compartilham um bloqueio por ficha no cliente. Não é uma transação distribuída entre dois usuários simultâneos.
- **Configurações:** grupos de correções podem ser desativados individualmente para diagnóstico. Recarregue o mundo após mudar. A opção de privacidade controla a proteção adicional das chamadas legadas; as rolagens produzidas pelo próprio Fixes continuam enviando destinatários explícitos.
- **Backups:** mestre pode exportar a ficha pelo painel em JSON próprio para importação nativa. Antes de persistir normalizações de fórmulas em lote, o módulo solicita download das fontes originais. Se o exportador não estiver disponível, a persistência é adiada. Guarde o arquivo baixado; backups de fórmulas são registros de recuperação por UUID, não um importador automático de mundo.

## Instalar

1. Feche o Foundry e guarde uma cópia da pasta atual `Data/modules/oprpg-system-fixes`.
2. Extraia a pasta `oprpg-system-fixes` do ZIP em `Data/modules`, substituindo a anterior.
3. Abra o mundo e confirme **1.11.0** na lista de módulos. Recarregue também a janela de cada jogador.
4. Abra Configurações → **Painel System Fixes**. Na ficha, o botão de ferramentas abre o mesmo painel.

O ZIP é um módulo completo. Não substitua a pasta do sistema OPRPG e não instale duas cópias do Fixes.

## Validação

Testes automatizados: 78 de auditoria, 18 de regressão, 25 de duração/cura e 89 de funcionalidades, incluindo cliques e formulários reais em um navegador com documentos Foundry simulados. Total esperado: **210 testes**. Os relatórios de execução ficam em `tests/*-1.11.0.json`.

Na mesa OP RPG 2.0 foi confirmado pela interface: Foundry 14.367, OPRPG 1.0.20, Dice So Nice 6.3.0 e Fixes instalado 1.10.1. A nova versão ainda não estava instalada durante essa inspeção. Portanto, a aceitação final com mestre e jogador reais continua pendente; os testes locais não provam a integração com todos os 37 módulos ativos.

Verificar após instalar: NPC em Público, Somente para Si, Privado para Mestres e Cego para Mestres, conferindo tanto cartão quanto animação. Repetir acerto, dano, cura e múltiplas atividades; depois recarregar o chat e usar um cartão privado antigo. Não publicar dados reservados durante o teste: use um NPC de teste e fórmulas sem informações da campanha.

Em operações nativas sobrepostas cujo público não possa ser determinado com segurança, a animação usa a interseção dos destinatários ou é suprimida. Um contexto nativo ambíguo que não finalize pode manter essa restrição até a mensagem atualizar ou o cliente recarregar.

## Limites desta entrega

O painel altera a duração de **manutenções do OPRPG**, não substitui o editor de Active Effects. Efeitos associados à técnica aparecem no aviso de exclusão, mas devem ser revisados na aba Efeitos. Prévia automática contextual antes de cada botão Aplicar e coordenação de operações entre clientes permanecem como evoluções futuras. Múltiplas atividades mantêm a correção e persistência anteriores, agora cobertas também pela camada de sigilo.

Referências de implementação: [API oficial do Dice So Nice](https://riccisi.gitlab.io/foundryvtt-dice-so-nice/api/roll/), código do OPRPG fornecido pelo usuário e testes locais.
