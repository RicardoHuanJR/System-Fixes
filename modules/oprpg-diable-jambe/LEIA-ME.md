# Diable Jambe

1. Extraia o ZIP em `Data/modules/`. O arquivo deve ficar em `Data/modules/oprpg-diable-jambe/module.json`.
2. Reinicie o Foundry, ative **OPRPG — Diable Jambe** no mundo e recarregue os clientes.
3. Crie uma macro do tipo **Script** com o conteúdo de `Diable-Jambe-macro.js`.
4. Selecione um token e execute a macro. Ela cria o efeito **Diable Jambe** na ficha. Execute novamente para desligá-lo.

## Usando o DAE

Você pode dispensar a macro de ativação: crie um efeito chamado exatamente **Diable Jambe**, com duração de 60 segundos, e use o DAE para aplicá-lo ao próprio personagem e ligar/desligar. Não coloque uma fórmula adicional nas alterações do efeito: o módulo acrescenta a parcela de Fogo. O efeito precisa estar aplicado no personagem; em um item, configure sua transferência/aplicação ao próprio personagem. O módulo reconhece o nome do efeito, seu estado habilitado e sua duração. Não é necessário Midi-QOL. O DAE controla o efeito; este módulo faz a leitura do grau e dado na rotina de dano do OP RPG. A compatibilidade do DAE com `oprpg-system` é independente desta automação.

Enquanto o efeito está ativo, técnicas dos graus 1–7 com atividades de ataque, salvaguarda ou dano recebem uma parcela adicional de Fogo: metade do grau cadastrado, arredondada para baixo, mínimo de um dado. O tamanho do dado vem da primeira parcela de dano da atividade utilizada. Exemplos: grau 3 em d10 → +1d10 de Fogo; grau 4 em d6 → +2d6; grau 7 em d4 → +3d4.

Não muda os dados cadastrados da técnica. A atividade de cura não recebe o bônus. Em fórmula personalizada, copia o primeiro dado com faces numéricas, como d6; fórmulas sem um dado identificável não recebem o bônus. Em atividades com parcelas diferentes, copia o dado da primeira parcela. Usa o grau cadastrado, sem aumentar o bônus por escalonamento temporário.

O efeito deixa de conceder dano após 60 segundos do relógio do mundo. Fora de combate, esse relógio depende de o mestre avançar o tempo; não é um cronômetro de tempo real. O ícone expirado pode continuar na ficha, mas o bônus fica inativo. A macro seguinte substitui o efeito expirado.

Este pacote implementa somente o dano adicional das técnicas solicitado. Não automatiza resistência a Fogo, +1d4 de ataques comuns, três usos por descanso ou a reação adicional. A ativação e a condição de usar chutes ficam sob controle do jogador/mestre: ative para as técnicas aplicáveis e desative para as demais.

Validado com testes simulados de cálculo, efeito ligado/desligado/expirado, dados variados, atividades de cura, repetição e integração com a leitura de dano do System Fixes 1.19.2. Não foi testado numa sessão real do Foundry. Recomendado usar junto ao System Fixes atualizado, que consulta a configuração atual ao rolar dano; cards antigos do sistema que reutilizem fórmulas armazenadas podem exigir gerar novamente a mensagem depois de ativar o efeito.
