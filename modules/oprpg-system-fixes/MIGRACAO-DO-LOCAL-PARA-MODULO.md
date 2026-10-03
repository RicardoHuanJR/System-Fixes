# Migrar do OPRPG local para o módulo de correções

## Objetivo
Voltar a usar o `oprpg-system` oficial, permitindo atualizar o sistema normalmente, e manter as correções no módulo `oprpg-system-fixes`.

## Passos
1. **Faça backup da pasta do mundo.**
2. Feche o Foundry.
3. Remova a pasta `Data/systems/oprpg-system` que contém `1.0.21-local.x`.
4. Instale novamente o **OPRPG System oficial** pelo Foundry ou pelo manifesto oficial.
5. Extraia `oprpg-system-fixes` para `Data/modules/oprpg-system-fixes`.
6. Abra a cópia do mundo como GM e ative **OPRPG System Fixes & Compatibility**.
7. Reinicie o mundo e faça `Ctrl+F5`.
8. Execute:

```js
OPRPG_FIXES_SELF_TEST()
```

## Sobre `systemMigrationVersion`
O fork local pode ter gravado uma versão de migração mais alta no mundo. O OPRPG oficial só executa migrações quando a versão declarada pelo sistema é mais nova que a registrada no mundo, portanto voltar ao 1.0.20 não força uma migração reversa. Uma futura versão oficial mais nova poderá voltar a disparar sua própria migração normalmente.

## Não use os dois mecanismos ao mesmo tempo
O módulo detecta versões `-local.` e desativa a parte de Cura/PV Temporários para evitar duplicação, mas a configuração recomendada é:

- OPRPG System: **oficial**
- OPRPG System Fixes: **ativo**
- Argon OPRPG: opcional
- Compêndio OP RPG Inimigos: opcional
