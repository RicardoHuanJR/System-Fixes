# Revisão System Fixes 1.26.3 e Modificadores de Chat 1.2.1

O modificador passa a guardar escolhas e resultados em flags próprias. Acompanha a finalização do acerto nativo sem depender de redesenho. O bônus de dano é integrado ao estado tipado do Fixes para não desaparecer quando o cartão é refeito. Trocar ou remover o bônus usa o total original. Cartões antigos já marcados como aplicados não recebem outra soma ao atualizar.

Os destinatários da animação seguem a própria mensagem. Dados usam Roll.evaluate normal, preservando o caminho interceptado pelo anti-fraude. Não alteramos os termos dos dados originais para simular um bônus. O tipo de um modificador de dano só é herdado quando todas as partes têm o mesmo tipo conhecido; partes mistas ou sem tipo não são convertidas automaticamente em fogo.

## Compatibilidade e validação

734 testes simulados aprovados, incluindo 17 novos casos de interação Modificadores/Fixes: acerto, persistência, troca, remoção, penalidade, zero, clique concorrente, finalização sem render, dano tipado, frações, privacidade, proteção de cartões antigos e tipo desconhecido.

Teste real em Foundry 14.367/OPRPG 1.0.20, jogador com mestre conectado, somente Miyabi (Cópia): acerto 15+9+2=26, preservado ao recarregar; dano 11+2=13; trocar por +5 deu 16; metade 8 e quarto 4; remover restaurou 11; O botão Cancelar pode devolver a ação cancel no Foundry; a revisão 1.2.1 normaliza essa resposta para não gravá-la como fórmula. Anti-fraude ativo conforme registro do cliente. Nenhum dano aplicado e ficha original preservada.

Anti-fraude e detector: contratos de Roll/termos e hooks revistos, sem substituição de totais dos Roll originais. Argon: mantém o lançamento das atividades/cartões nativos; não foi feito teste real pela HUD nesta rodada. DAE e demais módulos externos: permanecem separados; testes de interfaces existentes aprovados, sem promessa de compatibilidade integral com módulos não exercitados. O Diable antigo continua desativado para evitar duplicação.

Cada atualização deverá ter uma conferência conjunta dos caminhos alterados. Essa exigência foi registrada em AGENTS.md da área de trabalho e no checklist do repositório. Cobertura real é parcial.

Cancelamento conferido novamente no Foundry após a correção: botão +2 e acerto 26 preservados.
