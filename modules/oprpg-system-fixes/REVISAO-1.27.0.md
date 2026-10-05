# Revisão conjunta — 1.27.0

## Resultado e alcance

System Fixes 1.27.0, Argon OPRPG 6.4.1, Anti-Fraude 1.4.1 e Detector 1.3.2. Modificadores de Chat permanece 1.2.1. Módulos externos permanecem separados.

771 verificações simuladas aprovadas: auditoria 104, regressão 18, manutenção 26, alvos/cartões 418, regras 53, integração externa 48, catálogo 67 e suporte 37. Cobrem os caminhos compartilhados alterados: acerto, dano, público/privado, persistência, alvos, efeitos, cancelamento e dados. As integrações anti-fraude/detector usam testes isolados de protocolo e rolagem; a suíte de alvos/cartões executa Fixes com Modificadores. Instalação conjunta não prova compatibilidade de todas as combinações possíveis.

Teste real após instalar os arquivos: sessão de jogador, módulos ativos conferidos no gerenciador, cartão da Miyabi (Cópia), cancelamento preservou +2 e total26; troca +2→+3 resultou em27; bônus de dano +2 elevou11→13; metade=6, quarto=3; remoção retornou a11. O cartão foi restaurado ao estado inicial. Recursos/PV não foram alterados. A ferramenta do mestre não aparece para o jogador. Validação real de sorteio com mestre recarregado, de Argon e das novas janelas de configuração ainda está pendente. Testes reais de versões anteriores não contam como validação da 1.27.0. O servidor conserva números antigos dos manifestos até reiniciar, embora os arquivos novos estejam instalados. Não houve medição comparativa de FPS nem garantia de ausência de travamentos.

## Correções

- Recálculos de efeitos na mesma ficha são agrupados por ciclo. Fichas sintéticas diferentes permanecem independentes.
- Argon agrupa ajustes de layout e libera a observação de elementos removidos.
- Observadores de cartões encerram após resultado inválido ou após 30 segundos, inclusive cancelamento.
- Cancelar configurações de técnica, efeito periódico e catálogo não grava flags nem encerra efeitos.
- Textos de automação com caracteres corrompidos foram corrigidos; editor moderno é preferido no Foundry 14.
- Anti-Fraude valida quantidade/faces e resposta do mestre, usa resultados 1..faces e limita a espera a 15 segundos. Preserva minimização/maximização e processamento nativo dos modificadores.
- Detector examina todas as rolagens da mensagem; um mestre ativo coordena os alertas, com deduplicação limitada. Operadores e números são validados e textos são escapados.
- Diagnóstico mostra versões, dependências e sobreposições conhecidas; não desativa módulos automaticamente.

## Melhorias de mecânica

Ferramenta exclusiva do mestre em Configurações: **Mestre: avaliar encontro**. Usa as tabelas de XP do Guia do Narrador 2.0, pp.45–46; separa XP ajustado para dificuldade do XP real para recompensa. Considera tamanho do grupo e criaturas relevantes. Não altera fichas. Terreno, controle, ações lendárias e ondas ainda exigem julgamento do mestre.

Mantidas as divisões weapon=ataque comum, feat=característica/ação lendária, spell=técnica. Aura e Zetsu não interferem no dano; PV, temporários, armadura, escudo e resistências continuam nos caminhos OPRPG. Controle Cirúrgico permanece por atividade. Automações de monstros não são adicionadas ao catálogo de personagens.

## Livros: método e decisões

Foi feita varredura integral do texto extraído: 341 páginas do Jogador 2.1 e 171 do Narrador 2.0 (512 páginas), com inventário por página e revisão dirigida das regras relacionadas ao código. Isso não equivale a leitura visual detalhada de todas as páginas; páginas de capa sem texto e ilustrações não são auditadas pela extração. O PDF original do Jogador não está mais no caminho antigo; foi usada a extração local preservada anteriormente.

| Domínio | Decisão para o sistema |
|---|---|
| Personagens, raças, classes e estilos | Efeitos vinculados à característica de origem, nível, usos e atividade; escolhas não são inferidas por nome do ataque. Catálogo atual mantido e revisado. |
| Técnicas, graus, custos e treinamento | Categoria e grau vêm da fonte; treinamento grátis continua uma escolha explícita ao aprender; PP e usos não podem ser cobrados duas vezes. |
| Combate, resistências e cura | Reduções antes de resistência, arredondamento para baixo; resistência repetida não acumula; cura limitada ao máximo e temporários separados. |
| Áreas | Geometria do mapa e salvaguarda individual; estimativa de alvos do Narrador p.115 é alternativa para teatro da mente, não substitui tokens reais. |
| Exploração, profissões e equipamentos | Dependem de tempo, materiais e escolhas do mestre; não convertidos em bônus automáticos universais. |
| Encontros e experiência do mestre | Calculadora adicionada, recompensa separada da dificuldade. |
| Criação de inimigos | Valores virtuais de ND não alteram PV ou dano real. Ações lendárias, técnicas e armas continuam categorias distintas. |
| Descanso, moral, turbas e outras variantes | Opções de mesa; não ativadas silenciosamente nem impostas a jogadores. |

Próximas melhorias possíveis: assistente de profissão com materiais/tempo, contador optativo de recursos de estilos (ex.: Carateca), diário de decisões de descanso e ferramenta do mestre para turbas. Exigem configuração explícita de fonte e recursos, sem adivinhar regras a partir de texto livre.

## Módulos que podem ser dispensados nesta mesa

- Diable Jambe antigo: manter desativado; automação consolidada no Fixes.
- Argon D&D5e: adaptador de outro sistema; usar núcleo Argon + adaptador OPRPG.
- Midi-QOL: não fornece suporte completo ao OPRPG por estar instalado; dispensável se não houver macros específicas dependentes dele. A ponte Fixes não promete todas as funções Midi.
- Flash Rolls 5e e Challenge Armor: candidatos a remover se não forem usados em outro mundo D&D5e; não identificados como necessários no OPRPG.
- Combat Utility Belt e Token Action HUD Core: verificar uso próprio antes de remover; não são dependências dos cinco módulos próprios.
- Not Your Turn e Your Turn: sobreposição parcial, mas bloqueio de turno e aviso não são a mesma função; escolher conforme a necessidade.

Nenhum módulo externo foi desinstalado. SmallTime + Simple Calendar e fog manual + fog nativo podem coexistir com funções diferentes. DAE, Dice So Nice, socketlib, lib-wrapper e núcleo Argon permanecem separados.

## Limitações observadas

A mesa apresenta referências de conteúdo D&D5e ausente no registro nativo do OPRPG. É problema separado dos módulos próprios; instalar outro sistema apenas para ocultar o erro não é a correção proposta. Detector depende de dados estruturados da rolagem: não valida qualquer HTML livre como se fosse uma rolagem autoritativa. Anti-Fraude não impede toda manipulação de um cliente arbitrariamente modificado.

## Regra para futuras atualizações

Preservar o checklist COMPATIBILIDADE.md e AGENTS.md. Antes de entregar/publicar, testar as interações alteradas e registrar simulação versus Foundry real. Não consolidar módulos externos.
