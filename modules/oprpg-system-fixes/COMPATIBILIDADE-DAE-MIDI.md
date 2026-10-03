# Ampliação 1.22.0

A ponte continua parcial. Consulte [REVISAO-1.22.0.md](REVISAO-1.22.0.md) para macros, efeitos periódicos, fases e limites atuais. O motor completo Midi-QOL não é implementado. As seções antigas abaixo registram a implantação anterior.

# Compatibilidade externa — System Fixes 1.20.0

Esta versão adiciona uma ponte parcial para DAE e para alguns dados/macros do Midi-QOL. **Não ativa o Midi-QOL no OPRPG nem oferece todas as funções desses módulos.** A solicitação de compatibilidade total ainda não está concluída.

O DAE instalado é 14.0.14. O Midi-QOL instalado é 14.0.12 e exige D&D5e 5.2.4–5.3.x em seu manifesto. A página oficial lista D&D5e como sistema suportado: https://foundryvtt.com/packages/midi-qol/. Alterar apenas o identificador do OPRPG ou o manifesto do Midi não adapta suas classes, atividades e regras.

## Como utilizar

1. Substitua a pasta `oprpg-system-fixes` pela pasta deste pacote e recarregue todos os clientes.
2. Para o DAE, mantenha suas dependências instaladas e ative **Allow Untested Systems / Permitir sistemas não testados** nas configurações do DAE. Recarregue. O Fixes não liga módulos nem muda essa configuração por conta própria.
3. A opção **Compatibilidade parcial: efeitos DAE e flags/macros Midi-QOL** aparece nas configurações do Fixes. Desligá-la desativa a ponte.
4. Quando a API do DAE está disponível, o Painel Fixes da ficha oferece **Editar efeitos (DAE)**. Os campos de Escudo, Armadura e PP são reconhecidos a partir do esquema do OPRPG, e os campos derivados de máximo/CR são classificados na fase final de efeitos.
5. A execução automática de macros é opcional e começa desligada. Ligue **Compatibilidade: executar macros de itens** apenas para usar as Macros do mundo configuradas nos itens.

Não é preciso ligar o Midi-QOL para a leitura das flags compatíveis. A ponte não altera o identificador do sistema nem cria um objeto falso `MidiQOL`. Se existir um fluxo real de Midi-QOL ativo, deixa as flags e macros sob responsabilidade dele para não executar duas vezes.

## O que está implementado

| Área | Comportamento nesta versão |
| --- | --- |
| Editor de efeitos | Acesso ao editor real do DAE pela ficha, quando sua API estiver preparada. |
| Campos DAE | Registro das flags booleanas de vantagem/desvantagem por atributo/perícia/ataque e classificação de campos OPRPG existentes. Não converte itens de D&D5e para OPRPG. |
| Vantagem/desvantagem Midi | Leitura das flags `all`, `attack.all`, ataques `mwak/rwak/msak/rsak`, `ability.save`, `ability.check` e `skill`. Funciona nas rolagens que passam pelos eventos nativos V2. Flags falsas não ativam vantagem; vantagem e desvantagem simultâneas usam o cancelamento do sistema. |
| Ataque, salvaguarda e dano | Preservados os fluxos já implementados no Fixes, incluindo vários alvos, dano após salvaguarda, controles de metade/quarto e compartilhamento. Não são executados novamente pelo Midi. |
| Dano por integração | API de dano tipado sobre os alvos, usando `Actor.applyDamage` do OPRPG. Preserva seus hooks, camadas e permissões. Com identificador de operação, impede aplicação repetida e grava o recibo junto dos recursos. |
| Efeitos por integração | API delega os efeitos vinculados à atividade ao `DAE.doActivityEffects`. DAE administra criação, remoção, duração, macros de efeitos e encaminhamento ao mestre. A ponte não inventa uma segunda rotina de efeitos. |
| Macros do mundo | Lê o campo `flags.midi-qol.onUseMacroName` com a sintaxe `[postAttackRoll]Nome da Macro`. Encaminha ator, item e contexto à Macro do mundo, respeitando suas permissões. Não executa código fonte importado diretamente. |
| Fases automáticas de macros | `postAttackRoll`, `postDamageRoll` e `postItemRoll` nos eventos nativos de atividade. `postSave` é disponível pela API; a salvaguarda de um ator não identifica por si só o item de origem. `all` é aceito nas fases suportadas. |

Efeitos não passam a ser aplicados automaticamente por toda rolagem de um card customizado. Esse card precisa usar seu fluxo nativo de efeitos ou chamar a API de integração. Aplicar efeitos em alvos que tiveram sucesso/falha continua dependendo da seleção correta pelo fluxo de origem.

## O que permanece sem compatibilidade

O motor completo de Midi-QOL, suas janelas/configurações e todas as APIs esperadas por outros módulos; reações automáticas, contramágica e regras de magias de D&D5e; `OverTime`, `DamageBonusMacro`, `ItemMacro`, `ActivityMacro`; fases de macros anteriores à rolagem; flags condicionais arbitrárias e expressões específicas do Midi; mapeamento automático de todos os efeitos, itens, fichas e macros de D&D5e; integração automática do resultado de salvaguarda com efeitos em todos os cards customizados.

Macros escritas para `MidiQOL.Workflow`, que esperem seus campos e métodos, precisam ser adaptadas. A disponibilidade de uma Macro do mundo não significa que seu código seja compatível com o contexto OPRPG. Referências sem fase usam o padrão `postActiveEffects` do Midi, ainda não adaptado: especifique uma fase suportada.

## API para macros/adaptações

Disponível após o mundo estar pronto, em `game.oprpgFixes.compatibility`:

```js
// Dano numérico tipado aos alvos atuais. O executor precisa controlá-los.
await game.oprpgFixes.compatibility.applyDamage(
  [{value: 12, type: "piercing"}], game.user.targets,
  {multiplier: 0.5, operationId: "id-unico-desta-aplicacao"}
);

// Efeitos não transferidos vinculados à atividade, usando a API real do DAE.
await game.oprpgFixes.compatibility.applyEffects(activity, game.user.targets);

// Executar Macros do mundo configuradas para a fase indicada.
await game.oprpgFixes.compatibility.runItemMacros(item, "postAttackRoll", {total: 20});

// Diagnóstico e editor.
game.oprpgFixes.compatibility.status();
game.oprpgFixes.compatibility.openEffects(actor);
```

O identificador de dano deve ser único para cada aplicação legítima. A ausência dele permite aplicações repetidas. A API de dano não transmite pedidos arbitrários ao mestre; o fluxo de cards do Fixes mantém sua solicitação/revisão já existente.

## Validação

43/43 testes da ponte e 436/436 testes anteriores: **479 verificações aprovadas**. Incluem permissões, múltiplos alvos, cancelamento, concorrência, recibos, flags falsas, preservação de metade/quarto, fases de macros e encaminhamento ao DAE. Foram executados o registro real de specs do DAE 14.0.14 e o método real `Actor.applyDamage` do sistema local, com documentos/APIs auxiliares simulados.

**Não houve teste desta versão em mundo Foundry real.** Isso não certifica o funcionamento de todas as telas, dependências e macros do DAE no OPRPG. O pacote está preparado para essa validação; a instalação local 1.19.2 não foi substituída nesta revisão.
