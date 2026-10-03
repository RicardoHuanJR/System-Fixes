# OPRPG — Modificadores de Acerto e Dano

Módulo para Foundry VTT 14 que adiciona o botão **Modificador** abaixo de
**Acerto** e de **Dano** nos cards de ataque do sistema OPRPG.

## Instalação

1. Copie a pasta `oprpg-chat-modifiers` para a pasta `Data/modules` da sua
   instalação do Foundry VTT.
2. Reinicie o Foundry ou pressione `F5`.
3. No mundo, abra **Gerenciar Módulos** e ative
   **OPRPG — Modificadores de Acerto e Dano**.

## Uso

Antes de rolar Acerto ou Dano, clique no botão **Modificador** e informe uma
fórmula, por exemplo `1d10`, `2` ou `1d4 + 2`. Quando a rolagem correspondente
for feita, o módulo rola e soma automaticamente o modificador; ele fica
destacado no detalhamento. O modificador de dano também entra no botão
**Aplicar**.

## Observação

O módulo identifica cards com a classe `jujutsu-card` e os botões nativos
`jj-attack` e `jj-damage`. Ele não depende de editar `character-sheet.mjs`.
Se você usar este módulo, pode desfazer a alteração direta feita anteriormente
nesse arquivo para evitar botões duplicados.
