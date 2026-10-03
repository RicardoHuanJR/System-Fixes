# Fixes 1.10.0 — treinos grátis e aba Fruta

## Usar os treinos grátis

Na aba **Treinamentos**, o mestre encontra uma barra **Treinos grátis**, com quantidade e botão **Conceder**. Cada crédito paga um treinamento inteiro, independentemente do preço normal em PT. O jogador usa **Usar treino grátis** junto ao treinamento desejado. Os botões pagos continuam disponíveis.

Incluídos: **Auto-Aperfeiçoamento**, **Genialidade Inusitada** e os treinamentos de **Gerais, Armas e Espécie** presentes no catálogo nativo. Não foram acrescentadas categorias antigas de Nen que o próprio sistema removeu da aba atual.

- O crédito substitui os PT, não os requisitos, pré-requisitos, espécie, tutor ou tempo de treino. A confirmação pede que tempo e tutor sejam atendidos; assim como no fluxo nativo, não há calendário automático de treinamento.
- As compras visíveis nessa aba não exigem rolagem no código recebido. Essa regra foi preservada.
- Cancelar não consome crédito. Cliques concorrentes no mesmo cliente não repetem a compra.
- Desfazer um treinamento simples gratuito devolve um crédito, sem gerar PT. Treinamentos com dependentes aprendidos precisam ser desfeitos na ordem inversa.
- O contador de PT gastos exclui os benefícios gratuitos. Auto-Aperfeiçoamento respeita o teto 20. Genialidade registra a liberação de técnica, como o fluxo nativo; a técnica é criada separadamente na aba correspondente.
- Os créditos são concedidos pela interface do mestre; jogadores proprietários da ficha podem gastá-los. Não há concessão automática por descanso ou nível.

## Criação de técnicas e manifestações

O botão da aba Fruta agora usa a criação de itens embutidos do próprio ator, valida o grau e abre o editor do item criado. A janela permite escolher nome e atividade inicial: **Utilidade, Ataque, Salvaguarda ou Cura**.

A atividade é um ponto de partida editável. Fórmulas de dano/cura começam em **0**, para não atribuir poder ou custos sem autorização da regra da técnica. Configure fórmula, alvos, custo e duração no editor nativo. O grau e as marcas que fazem o item aparecer na aba Fruta são gravados corretamente.

Mantidos os limites nativos: cinco técnicas auxiliares; duas manifestações para Logia/Paramécia, ou três com Despertar; uma para Zoan Mítica, ou duas com Despertar. Zoan comum/ancestral não cria manifestações por esse botão. Cancelamentos e cliques repetidos não criam itens extras.

## Outras correções da aba Fruta

### Power Up

- Ativar calcula o custo pelas opções escolhidas e desconta PP uma única vez. Encerrar não cobra novamente.
- Após usar, exige descanso curto/longo para nova ativação, conforme a descrição já existente no sistema.
- O efeito vence com 60 segundos do tempo do mundo. A versão anterior já tratava partes do ciclo de exclusão; esta acrescenta o controle explícito de tempo e a restauração dos tokens ativos.
- A imagem e as escalas originais de cada token ativo são preservadas e restauradas. Não são substituídas cegamente pelo token padrão da ficha.
- Tamanho aumenta um passo até Enorme. Um personagem já Colossal não encolhe ao ativar a opção.
- Se a criação do efeito falhar, não cobra PP. Se a atualização do ator falhar, remove o efeito recém-criado.
- A geração/atualização do item Power Up preserva seu ID e outras personalizações. Acrescenta uma atividade que aciona a mesma rotina da aba, sem cobrar duas vezes. O botão principal da aba continua funcionando.

### Formas e traços Zoan

O efeito de traços é atualizado no lugar, evitando apagar/recriar em toda mudança. Duplicatas do efeito do próprio sistema são removidas. Mudanças de forma/tipo/opções da fruta atualizam os efeitos; mudar para outra fruta remove os bônus Zoan, preservando efeitos alheios.

Além dos cinco bônus fixos já previstos no sistema (Criatura Robusta, Visão Noturna, Animal Grande, Deslocamento Animal e Voo), foram acrescentados:

- Percepção às Cegas: alcance de 6 m nas formas animal/híbrida.
- Eco Localização: alcance de 9 m nas formas animal/híbrida, suspenso quando a condição nativa Surdo está presente.
- Escalador e Escalada Aracnídea: deslocamento de escalada inteiro ou metade, conforme a descrição.
- Casco Protetor: bônus fixo de +2 na defesa nas formas animal/híbrida.

Alcances de movimento/sentidos são convertidos para pés quando essa é a unidade da ficha. Bônus que devem prevalecer sobre um valor menor usam o modo de melhoria do Active Effect. Seleções desconhecidas, de categoria errada ou além dos limites atuais não entram no efeito. As escolhas gravadas são preservadas, para que o usuário possa revisá-las ao mudar subtipo/Despertar; não são apagadas automaticamente.

As ações de aspecto são validadas antes de executar, e usam trava contra cliques concorrentes. A recuperação de Vigor/Uso Alternativo também reconhece o descanso longo informado na configuração do evento.

## Limites explícitos

Esta revisão **não automatiza todos os traços narrativos ou condicionais**. Por exemplo: a reação de entrar/sair do Casco Protetor, agarramentos, mergulhos, situações de percepção por sentido específico, escolha de perícia/resistência, Regeneração, Surto de Adrenalina e recuperação após cair a zero continuam exigindo resolução manual ou uma atividade configurada para a regra. Os bônus fixos acima são a automação adicionada; não substituem essas decisões.

Os itens recém-criados ainda precisam ser configurados com os números e regras da técnica. A aba não possui um catálogo completo capaz de deduzir isso apenas pelo grau. Despertar mantém os ajustes nativos de limites; este pacote não inventa poderes de uma fruta específica.

As travas evitam concorrência no mesmo cliente. Não foi executada uma sessão real com vários clientes, módulos externos ou reconexões. Tokens fora dos tokens ativos do ator não receberam validação. As limitações já registradas nas revisões 1.9.2/1.9.3 continuam válidas.

## Testes e instalação

**160 casos passaram:** 39 novos de treinamento/Fruta, 78 de auditoria geral, 18 de regressão e 25 de duração sustentada. A suíte de duração inclui um controle que reproduz o defeito antigo sem reparo; a auditoria geral contém 300 combinações em um teste de conservação do dano.

Os testes novos usam as tabelas reais de treinamentos/traços e métodos extraídos da ficha do sistema **1.0.21-local.2** enviado. Executam DOM e cliques reais no Edge, com atores, diálogos e persistência do Foundry simulados. Foram exercitados requisitos, cancelamento, custo zero, devoluções, caminhos pagos, múltiplos cliques, criação e abertura de itens, limites, preservação do item Power Up, custo/descanso/expiração, restauração de token, formas e eventos de atualização. **Não é certificação em um mundo real do Foundry.**

Para instalar, substitua `Data/modules/oprpg-system-fixes` pela pasta do ZIP, reinicie o Foundry e atualize o navegador. Confirme **1.10.0**. O sistema base e os arquivos do mundo não foram alterados durante o desenvolvimento. Os créditos começam em zero; o mestre concede os desejados após instalar.

Resultados estão na pasta `tests`, em arquivos identificados como `1.10.0`. Para repetir os testes novos, com Node.js, Playwright e Microsoft Edge:

```text
node tests/features.cjs CAMINHO_DO_MODULO
```

`feature-fixtures.json` contém os trechos do sistema usados nos testes. A variável opcional `OPRPG_TEST_PLAYWRIGHT` aponta para uma instalação existente do Playwright. As instruções das outras suítes estão nos relatórios anteriores.
