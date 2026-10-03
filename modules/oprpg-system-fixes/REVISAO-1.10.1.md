# Fixes 1.10.1 — escolha no aprendizado e botões da Fruta

## Treinamentos

O sistema de créditos foi retirado do fluxo. No próprio botão **Aprender**, a janela oferece:

- **Gastar N PT**, usando o custo nativo;
- **Recebido gratuitamente**, com origem **Concedido pelo mestre** ou **Recebido de uma característica**;
- **Cancelar**.

A mesma escolha existe no Auto-Aperfeiçoamento e na Genialidade. Falta de PT não bloqueia a abertura da janela. Gastar PT sem saldo não conclui o aprendizado. Requisitos e pré-requisitos continuam sendo verificados: esta opção dispensa o custo, sem conceder automaticamente exceções às outras regras.

Não há barra de créditos, botão extra de treino grátis ou exigência de o mestre conceder créditos antes. A origem gratuita fica registrada na ficha. Desfazer um treino gratuito não gera PT nem créditos. Treinos gratuitos da versão anterior continuam reconhecidos como gratuitos; os antigos números de créditos são preservados nos dados, mas ficam sem uso e sem interface.

## Botões “+” da aba Fruta

A versão anterior testava a função de criação diretamente, mas não demonstrava que o clique da ficha real chegava a essa função. A 1.10.1 conecta a criação aos botões da aplicação efetivamente renderizada, além de reparar as classes de ficha registradas no Foundry. Isso cobre uma ficha cuja classe é diferente da classe de código-fonte importada pelo módulo.

O clique no ícone interno do botão também é tratado. O reparo é reconectado após recriar a aba ou abrir outra ficha, sem duplicar eventos. O clique é interceptado antes de cair no despacho nativo que pode ignorar a ação. Erros de criação são mostrados em uma notificação explícita e no console, em vez de apenas não criar o item.

Técnicas e manifestações continuam usando itens embutidos do ator, com grau/limites nativos. A janela permite nome e atividade inicial; depois abre o editor. As fórmulas iniciais continuam em zero para serem preenchidas conforme a técnica.

**A causa exata da falha na sessão do usuário não foi confirmada com logs do Foundry.** Foi acrescentada e testada a conexão de clique que faltava à cobertura anterior, incluindo uma classe de ficha diferente, ícone interno, recriação do HTML e leitura real dos campos do diálogo.

## Testes

**161 casos aprovados:** 40 de treinamento/Fruta/interface, 78 de auditoria geral, 18 de regressão e 25 de duração. A suíte nova substitui os testes da interface de créditos removida. Os resultados históricos não representam o comportamento atual dessa interface.

Os testes usam DOM e cliques reais no Edge, regras e métodos do sistema enviado, com documentos/diálogos do Foundry simulados. Os callbacks do diálogo de criação também foram testados com um formulário HTML real. Não houve execução dentro de um mundo real do Foundry; os demais limites das revisões anteriores permanecem.

Para reproduzir a suíte atual de treinamento/Fruta, com Node.js, Playwright e Edge:

```text
node tests/features.cjs CAMINHO_DO_MODULO
```

## Instalar

Substitua a pasta `Data/modules/oprpg-system-fixes`, reinicie o Foundry e atualize o navegador com Ctrl+F5. Confirme **1.10.1**, feche e abra novamente a ficha. Use o botão normal **Aprender** para escolher o pagamento, e o **+** da seção desejada para criar uma técnica ou manifestação.
