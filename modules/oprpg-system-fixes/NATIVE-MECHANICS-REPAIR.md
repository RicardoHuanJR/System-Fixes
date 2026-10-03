# OPRPG Native Mechanics Repair

A estratégia deste módulo é **reparar as mecânicas que já existem no OPRPG**, em vez de criar subsistemas paralelos.

## Fase I — Pontos de Escudo

No OPRPG 1.0.20, `Actor.applyDamage()` já consome `system.shieldPoints.value` antes de PV temporários e PV. Porém os cards customizados da ficha usam um helper privado separado, `_applyLayeredDamageToActor`, cuja ordem original é:

1. Redução de Dano;
2. Pontos de Armadura;
3. PV temporários;
4. PV.

O helper não inclui Pontos de Escudo. A 1.4.0 mantém o helper original e altera somente o update que ele produz:

1. Redução de Dano (nativo);
2. Pontos de Armadura (nativo);
3. **Pontos de Escudo (Fixes 1.4.0)**;
4. PV temporários (nativo);
5. PV (nativo).

O fluxo de Pontos de Vitalidade quando `auraOn === false` continua prevalecendo, exatamente como no código oficial.

## Diagnóstico

```js
OPRPG_FIXES_NATIVE_AUDIT()
OPRPG_FIXES_SHIELD_STATUS()
game.oprpgFixes.previewShieldDamage(actor, 25)
```

## Próximas auditorias

- Resistência a Contundente/Cortante/Perfurante enquanto Endurecimento Defensivo possui Escudo.
- ACERTO de Items com múltiplas Activities.
- Save/Damage/Heal com múltiplas Activities e labels do Item.
- Akuma no Mi: Uso Alternativo, Intangibilidade, Power Up e ciclo de efeitos.
- Traços Zoan que já possuem UI/dados mas ainda não executam mecânica.


## 1.6.0 — Native Repair III

### Tipos de dano
O card customizado agora é reparado antes das camadas locais: quando o tipo pode ser resolvido, o valor é enviado para `Actor.calculateDamage()` com limiar de dano ignorado, preservando especificamente as regras de resistência/imunidade/vulnerabilidade do Actor sem aplicar dano duas vezes.

### Dano misto
- multi-Activity do Fixes: guarda `{total, types}` de cada parte e consegue resolver cada parcela;
- card nativo com um único tipo: o total inteiro usa esse tipo;
- card nativo misto sem total por parte: não é repartido por estimativa.

### Uso Alternativo
O estado `system.akuma.usoAltUsado` passou a ter efeito sobre consumo real. O patch prefere uma ponte na `Activity.use()` original e mantém um fallback limitado por tempo para caminhos customizados do sistema.

### Power Up
A versão 1.6.0 corrige apenas o ciclo de vida do estado `active` associado ao Active Effect nativo. SAV/DMG/RED permanecem pendentes para uma fase posterior, evitando implementar interpretações sem contexto suficiente.


## Fase IV — Akuma combat repair (1.7.0)

### Power Up SAV
O card registra apenas os alvos selecionados no momento da Técnica. O próximo teste de Salvaguarda correspondente desses atores recebe desvantagem pelos hooks de rolagem do DND5E/OPRPG.

### Power Up DMG
A opção adiciona `min(5, grau)` dados usando o mesmo tamanho de dado da Técnica quando isso é inequívoco. Técnicas com partes de dano de denominações diferentes são deixadas sem automação em vez de inferir um dado incorreto.

### Power Up RED
O dano final do pipeline OPRPG alimenta um acumulador da transformação. Enquanto o limiar `10 × nível` não é atingido, a parcela que chegaria aos PV é restaurada. Ao romper o limiar, a transformação é encerrada e o Active Effect rastreado é removido.

### Intangibilidade
No nível 6+ é considerada de controle total. Antes disso, o incremento do contador nativo de usos arma uma proteção temporária até o início do próximo turno. Haki do Armamento e Kairoseki são detectados por dados/texto quando possível. Inimigo natural continua sob decisão do Narrador e possui bypass manual.

### Predador
O módulo captura o dano efetivamente causado pelo atacante no pipeline do card e entrega esse valor ao botão nativo de Predador. A cura é limitada a `5 × nível` acumulados e o PP a `nível`, com 1 PP por uso; limites são limpos em descanso longo.


## Native Repair V — Haki / Estágio Desperto

### Escudo
A recarga automática agora usa um timestamp em `flags.oprpg-system-fixes.shieldRecharge` e o tempo do mundo. O flag registra o início do intervalo de 10 minutos e é reiniciado por eventos de Armamento reconhecidos.

### Estágio Desperto
A fonte de verdade continua sendo o estado nativo da Akuma/Active Effect. O Fixes apenas observa o ciclo e cobra Liberação Cansativa no fim do turno. Em 0 PP, encerra a representação nativa que conseguiu identificar.

### Haki
Ataque Infuso usa correspondência de forma de ataque e alimenta o bypass de Intangibilidade da Native Repair IV. O módulo não tenta remover resistências não sobrenaturais de Zoan sem metadados que permitam distinguir sua origem.

## NPC Sheet Repair I (1.8.1)

A ficha de NPC apresentou SVGs com dimensões/viewBox vazios ao preparar Manipulações e Treinamentos. O módulo corrige somente strings inválidas nos contextos nativos e mantém a classe/template oficial. Status: `OPRPG_FIXES_NPC_SHEET_STATUS()`.
