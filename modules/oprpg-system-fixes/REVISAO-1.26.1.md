# RevisÃ£o System Fixes 1.26.1

CorreÃ§Ã£o do dano das automaÃ§Ãµes em cartÃµes com uma Ãºnica atividade.

## Causa e correÃ§Ãµes

O interceptador do botÃ£o Dano exigia duas atividades no item. Ataques como Bica ficavam no cÃ¡lculo legado do OPRPG, que nÃ£o passava pelos hooks dos bÃ´nus. Agora atividades de ataque, salvaguarda e dano com partes de dano usam o mesmo cÃ¡lculo por partes e tipos; cura permanece fora desse interceptador.

O painel nativo #jj-dmg-panel .jj-panel-label agora mostra as fÃ³rmulas e tipos calculados. O preparo legado do Haki deixa o cÃ¡lculo para o interceptador quando ele estÃ¡ presente, evitando rejeitar dados adicionais sÃ³ porque a quantidade de rolagens difere das partes originais.

Foram revistas as rotas compartilhadas de Diable/Ifrit/Hell Memories, Ultramarine, Overclock, Controle Corporal, bÃ´nus de efeitos e macros. Regras manuais e pendÃªncias dos livros continuam identificadas como tal. Nenhuma regra usa Aura para decidir dano ou Vitalidade.

## ValidaÃ§Ã£o

717 testes simulados aprovados, incluindo clique do cartÃ£o com atividade Ãºnica, dano de fogo persistido e exibido, automaÃ§Ã£o desativada sem bÃ´nus, Overclock elÃ©trico e exclusÃ£o de cura. A validaÃ§Ã£o em Foundry real desta correÃ§Ã£o ainda estÃ¡ em andamento.
