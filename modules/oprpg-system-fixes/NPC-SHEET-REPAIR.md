# NPC Sheet Repair I — OPRPG System Fixes 1.8.4

## Sintoma observado

Ao preparar a ficha nativa de NPC no OPRPG 1.0.20, o Chromium/Foundry pode registrar repetidamente erros de SVG entre os contextos de Manipulação e Treinamentos:

- `<svg> attribute width: Unexpected end of attribute. Expected length, "".`
- `<svg> attribute height: Unexpected end of attribute. Expected length, "".`
- `<svg> attribute viewBox: Unexpected end of attribute. Expected number, "0 0 ".`

Os logs apontam para os métodos nativos:

- `_prepareManipulationContext`
- `_prepareTrainingsContext`

O sistema oficial não é alterado.

## Reparo 1.8.4

O módulo importa a própria classe `NPCSheet` já carregada pelo sistema e envolve somente os dois métodos acima. O contexto recebido e o valor retornado são percorridos de forma conservadora e apenas strings SVG malformadas são corrigidas.

Também existe uma guarda extremamente restrita em `TextEditor.enrichHTML`: ela só modifica o HTML enquanto um dos dois métodos de preparação da ficha NPC está em execução. Fora desse intervalo o `TextEditor` se comporta exatamente como antes.

Correções aplicadas apenas quando o atributo está inválido:

- `width=""` → `width="1em"`
- `height=""` → `height="1em"`
- `viewBox="0 0 "` ou vazio → `viewBox="0 0 512 512"`

SVGs já válidos não são modificados. Data URIs SVG codificadas/percent-encoded e base64 também são tratadas.

### Hotfix getter-safe (1.8.4)

O contexto da ficha pode referenciar objetos que expõem propriedades por getters de compatibilidade. Percorrê-los com `value[key]` pode executar getters como `CONFIG.DND5E.spellcastingTypes` e gerar avisos de depreciação mesmo sem usar essa API diretamente. A 1.8.4 inspeciona `Object.getOwnPropertyDescriptors()` e só percorre propriedades de dados; accessors são preservados sem serem avaliados.

O sanitizador continua copy-on-write e não modifica Arrays/Objects congelados.

## Desempenho

- nenhum `MutationObserver` global;
- nenhum `setInterval`;
- nenhuma varredura contínua de DOM;
- nenhum hook por frame;
- o sanitizador só entra em modo ativo durante `_prepareManipulationContext` e `_prepareTrainingsContext`.

## Diagnóstico

```js
OPRPG_FIXES_NPC_SHEET_STATUS()
```

Campos importantes:

- `installed`: patch localizado e instalado;
- `nativeMethodsPatched`: normalmente 2;
- `prepareCalls`: número de preparações interceptadas;
- `svgStringsRepaired`: quantidade de strings realmente alteradas;
- `textEditorGuard`: guarda escopada instalada;
- `sourceAudit`: leitura somente-diagnóstico do `npc-sheet.mjs` servido pelo próprio Foundry.

## Teste recomendado

1. Reiniciar o Foundry e executar `Ctrl+F5`.
2. Limpar o Console.
3. Abrir uma ficha NPC que anteriormente produzia os erros.
4. Alternar/abrir as áreas relacionadas a Manipulações e Treinamentos.
5. Executar `OPRPG_FIXES_NPC_SHEET_STATUS()`.

Se os três erros SVG não voltarem e `prepareCalls > 0`, o caminho nativo foi reparado. `svgStringsRepaired > 0` confirma que o módulo encontrou o markup inválido em runtime.
