# Fixes 1.9.3 — duração sustentada e cura automática

## O que foi corrigido

O sistema recebido reconhecia uma técnica permanente na ativação, mas, ao iniciar o turno, verificava apenas custo constante/concentração. Sem custo, apagava a técnica das ativas. A cura automática rodava em outro evento assíncrono e podia curar uma única vez antes dessa remoção. O final do combate também apagava todas as técnicas, inclusive permanentes.

O Fixes substitui apenas os três eventos reconhecidos de manutenção, cura por turno e limpeza ao apagar combate. A manutenção e a cura passam a executar em sequência: conferir prazo → conferir/pagar custo → curar. O sistema base não é alterado.

## Comportamento da versão 1.9.3

| Configuração | Comportamento |
|---|---|
| Permanente (`perm`) | Não expira por passagem de turnos ou por apagar o combate. Pode ser desativada manualmente. |
| Até dissipar (`disp`) / até dissipar ou ativar (`dstr`) | Não são apagadas pelo relógio nem pelo fim do combate; a dissipação/ativação correspondente continua dependendo do fluxo nativo ou de desativação manual. |
| Rodadas | Expira após a quantidade configurada, na posição de turno em que foi ativada. |
| Turnos | Conta passagens entre combatentes, não apenas os turnos do dono. |
| Minutos, horas etc. | Usa o tempo do mundo; pode continuar fora do combate até o prazo terminar. |
| Especial | Sem expiração automática inferida; desativação manual ou por outra regra. |
| Custo constante/concentração | Paga no começo do turno do dono; se não puder pagar, desativa antes de curar. O prazo finito ainda é respeitado. |
| Limite total de cura esgotado | A técnica pode continuar ativa, mas a cura normal não se repete até recuperar saldo. Permanente não significa cura ilimitada. |

Técnicas medidas em rodadas/turnos encerram quando o combate é apagado. As durações permanentes e de tempo real são preservadas, inclusive se possuírem custo. A cura por turno e a cobrança de manutenção acontecem em combate; esta alteração não cria cura automática contínua fora dele.

Clocks e a última passagem processada ficam na entrada da técnica no ator. A fila por ator e o marcador de passagem evitam cobrar/curar duas vezes em eventos concorrentes. Uma duração instantânea explícita não volta a herdar a duração permanente do item. Atividades excluídas são removidas das ativas. A desativação manual não é revertida pelo reparo.

O reparo também funciona no fork `1.0.21-local.2`, mesmo quando o restante do patch de cura é delegado ao sistema. A consulta ao limite nativo de cura foi ajustada para esse caminho.

## Testes

**121 casos aprovados:** 25 de duração/manutenção, 78 da auditoria geral e 18 de regressão. Os 25 incluem um teste de controle que reproduz o defeito original sem o reparo. A auditoria geral contém um teste com 300 combinações de absorção de dano.

Os novos testes carregam o código real de ativação, manutenção e cura do sistema enviado junto com as funções do Fixes. Foram simulados documentos, eventos, recursos, tempo do mundo e uma cura fixa. Cobertura adicional: múltiplas técnicas no mesmo ator, reativação com novo prazo, retomada de entrada antiga sem relógio, proteção de cliente sem autoridade, eventos repetidos, passagem rápida de turnos, reserva de PV temporário, fim/início de combate, exclusão de atividade e instalação repetida.

As suítes anteriores usam DOM real no Edge com dependências Foundry simuladas. **Não foi executado um mundo real do Foundry.** Não se trata de um reparo geral para toda a duração de Active Effects: o alvo é a manutenção de técnicas no HUD “Ativas” e a cura associada. Dissipação, gatilhos específicos de `dstr`, quebra de concentração por outras regras e alterações de iniciativa durante um efeito precisam de validação no mundo. As demais limitações da 1.9.2 continuam documentadas naquela revisão.

Se os eventos do sistema não corresponderem aos reconhecidos, o instalador preserva os eventos existentes e registra aviso, em vez de correr o risco de duplicar cobrança/cura. O diagnóstico passa a mostrar “Duração sustentada e ordem da cura”.

## Instalar

1. Substitua a pasta `Data/modules/oprpg-system-fixes` pela pasta de mesmo nome do ZIP.
2. Reinicie o Foundry, atualize o navegador e confirme **1.9.3** no gerenciador de módulos.
3. Encerre e ative novamente a técnica de cura para iniciar uma duração nova. Uma técnica já removida pelo defeito antigo não é reativada automaticamente.

Entradas antigas ainda ativas, mas sem relógio, começam a contagem quando o reparo as encontra; não é possível reconstruir com segurança o momento da ativação antiga. Para verificar, use uma técnica permanente sem custo e saldo de cura suficiente, passe três turnos do dono e confira a permanência em “Ativas”.

## Reproduzir os testes

```text
node tests/sustained.cjs CAMINHO_DO_SISTEMA CAMINHO_DO_MODULO
node tests/audit.cjs CAMINHO_DO_MODULO
node tests/regression.cjs CAMINHO_DO_MODULO
```

A primeira suíte precisa apenas de Node.js e dos arquivos do sistema enviado. As outras precisam também de Playwright e Microsoft Edge, conforme a revisão anterior. Resultados: `tests/sustained-1.9.3.json`, `tests/audit-1.9.3.json` e `tests/regression-1.9.3.json`.
