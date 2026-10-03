# Revisão do OPRPG System Fixes 1.9.2

## Entrega e instalação

Revisão feita sobre o módulo 1.9.1 e o sistema fornecido, **OPRPG 1.0.21-local.2**. O ZIP contém apenas o módulo. Os arquivos do sistema e os dados do mundo não foram alterados nesta revisão.

Substitua a pasta `Data/modules/oprpg-system-fixes` pela pasta de mesmo nome do ZIP, reinicie o Foundry e atualize o navegador com Ctrl+F5. Confirme a versão **1.9.2** no gerenciador de módulos. Crie cards novos: resultados incorretos já gravados no histórico não são recalculados.

## Resultado dos testes

**96 casos aprovados: 78 de auditoria funcional e 18 de regressão.** Um caso de conservação do dano percorre **300 combinações** de dano, resistência, redução, armadura, escudo, PV temporário e PV. Esses 300 cenários estão dentro dos 96 casos, não representam 300 testes adicionais independentes.

Os testes executaram as funções reais do módulo em Microsoft Edge sem janela, com DOM e propagação de eventos reais. Atores, mensagens, relógio, hooks e dados do Foundry foram simulados. Cinco casos de integração executaram métodos extraídos do sistema enviado: Vigor, Uso Alternativo, Intangibilidade, Power Up TAM e aplicação de dano em camadas. Outros casos reproduziram a criação tardia de cards e sua serialização.

**Não houve sessão em um mundo real do Foundry.** Esta entrega cobre os grupos funcionais do Fixes em simulações; não certifica todas as combinações de talentos, itens, módulos externos ou múltiplos clientes. O diagnóstico do menu passou a declarar que verifica instalação, não validação funcional.

## Correções principais

- **Múltiplas atividades:** mantém o reparo da reconexão de eventos após o acerto salvar e recriar o card; impede que cliques repetidos escapem para o dano da primeira atividade. Aceita partes adicionais da configuração nativa, inclusive dano-base de armas. Preserva PA, escala e Foco Agressivo; acrescenta os caminhos nativos de Ultimato e Estágio de Foco. O crítico automático mantém os dados e tipos de cada parcela, separados do dano-base.
- **Akuma:** lê e grava as flags usadas efetivamente pelo sistema. Identifica técnicas e efeitos marcados pelo sistema; não confunde qualquer efeito de 60 segundos com Power Up. O benefício de Uso Alternativo fica restrito ao uso da atividade, restaura o consumo temporário mesmo após erro e reconhece um card criado depois do retorno do método nativo.
- **Logia e Predador:** um contador antigo não transforma Zoan em Logia; valores falsos não habilitam Predador. Intangibilidade temporária não atravessa a troca de combate. Predador tem trava contra chamadas simultâneas e respeita o teto efetivo de PV.
- **Power Up:** SAV aceita diferentes formatos de habilidade e evita consumo duplicado pelo mesmo pedido. DMG reconhece rolagens concluídas mesmo quando repetem o total anterior. RED conta também o dano excedente aos PV atuais para romper a forma corretamente.
- **Escudo:** resistência, imunidade e vulnerabilidade são aplicadas antes das camadas quando os tipos são recuperáveis. Todas as parcelas desmarcadas não significam selecionar tudo. A correção de uma escrita duplicada exige vínculo explícito com a mesma transação, preservando curas e danos independentes.
- **Despertar e Haki:** leitura das flags nativas, detecção dos usos de Armamento, relógio iniciado em zero, gasto por turno e Explosão de Poder protegidos contra chamadas repetidas. O HUD pode ser instalado novamente após um contrato inválido ser corrigido. Descansos aceitam os formatos usados nos fluxos simulados.
- **Cura:** instalação repetida não cria recursão, botões sobrevivem à recriação do HTML e cliques concorrentes não aplicam a mesma cura duas vezes. Cura automática respeita PV máximo efetivo. Texto visual idêntico não realimenta o observador de alterações.
- **Fórmulas e NPC:** opções de atualização são preservadas, entradas não são alteradas desnecessariamente e compêndios normalizados em memória ainda são persistidos. A sanitização de SVG aceita contextos congelados, referências compartilhadas e ciclos sem executar getters.

## Cobertura por área

| Área | Comportamentos exercitados |
|---|---|
| Fórmulas | Referências, idempotência, criação, atualização, opções e persistência de compêndio |
| Cura/PV temporários | Limite, teto efetivo, reserva maior, exceções, auto-cura, reconexão e clique repetido |
| Atividades/acerto/labels | Primeira e segunda atividades, dano direto, acerto seguido de recriação, eventos e configuração nativa |
| Dano e crítico | Fórmulas customizadas, modificador, PA/escala, Ultimato/Foco, crítico automático e preparação do manual |
| Escudo/tipos | Ordem das camadas, conservação, Verdadeiro, resistência/imunidade/vulnerabilidade, mistura, expiração e transações |
| Akuma | Flags, Uso Alternativo, custos não relacionados, cancelamento/erro, criação tardia de card e efeitos |
| Power Up | TAM via método nativo; SAV, DMG, RED, expiração e dano excedente |
| Logia/Predador | Tipo de fruta, intangibilidade, bypass, limites, concorrência e descanso |
| Haki | Talentos, HUD, Antevisão, concentração, fila de ações, recursos e descanso |
| Armamento/Despertar | Recarga, formas selecionadas, início do relógio, autoridade, consumo por turno e Explosão |
| NPC | Objetos congelados, getters, referências/ciclos e wrapper assíncrono |
| API/diagnóstico | Instalação dos acessos públicos e consultas sem modificar o ator |

## Otimizações

Foram eliminadas normalizações e consultas de configuração repetidas na mesma preparação de labels, alterações idênticas no DOM, conexões duplicadas de eventos e mutações evitáveis nos dados de rolagem. As travas usam identidade dos objetos em memória, sem depender de marcas persistidas no HTML. Não foi medido um ganho de FPS ou tempo em um mundo real; os testes verificam os comportamentos que evitam trabalho repetido.

## Limites e decisões explícitas

- **Chama do Armamento no dano interceptado de múltiplas atividades:** o piso e o bônus avançado do fork local ainda não são reproduzidos integralmente. Essa combinação permanece uma limitação conhecida, não foi marcada como corrigida.
- **Seleção individual de parcelas e crítico manual misto:** não há validação integral do fluxo nativo. Se os valores separados não puderem ser recuperados, o módulo não inventa uma divisão por tipo; o diagnóstico registra a mistura não resolvida.
- Para metade/quarto com parcelas conhecidas, aplica-se o fator a cada parcela e distribui-se a sobra de arredondamento pela maior fração, com desempate na ordem original. Isso conserva o total inteiro exibido; é uma política explícita do Fixes, não uma regra confirmada em mesa.
- O vínculo SAV ainda depende do alvo/habilidade pendente; salvaguardas de outras origens intercaladas exigem confirmação no mundo real.
- No sistema `-local.`, o carregamento principal continua delegando a cura ao próprio fork para evitar aplicar dois reparos sobre o mesmo fluxo. A suíte de cura exercita o código do módulo isoladamente; não afirma que ele está instalado nesse fork.
- Importações e ciclo completo `init/ready`, sincronização entre clientes, permissões reais, HUD visual completo, imagens de token e integrações como Argon/Dice So Nice precisam de validação no Foundry. As declarações históricas de compatibilidade do manifesto foram preservadas, sem ampliar versões verificadas com base apenas em simulações.

## Reproduzir

Com Node.js, Playwright e Microsoft Edge instalados:

```text
node tests/audit.cjs CAMINHO_DO_MODULO
node tests/regression.cjs CAMINHO_DO_MODULO
```

A variável opcional `OPRPG_TEST_PLAYWRIGHT` indica uma instalação existente do Playwright. `tests/native-contracts.json` contém os trechos de métodos nativos usados pela simulação. Os resultados desta entrega estão em `tests/audit-1.9.2.json` e `tests/regression-1.9.2.json`. Resultados históricos têm suítes diferentes e não devem ser comparados pela contagem bruta de falhas.
