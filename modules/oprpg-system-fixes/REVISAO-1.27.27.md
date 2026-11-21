# System Fixes 1.27.27 — leitura das atividades e estados de uso

Primeiro lote do plano de refinamento: identificar a atividade escolhida e tornar o andamento do uso mais claro.

- Nas atividades expandidas, nome do item e variante recebem tratamento separado. A variante tem destaque em orquídea e pode quebrar linhas; o nome completo permanece no título e no nome acessível. Nomes de itens contendo travessão e caracteres de HTML são tratados como texto, sem separar pelo travessão errado nem inserir HTML.
- Custo e alcance ficam na linha secundária; execução e indisponibilidade usam uma linha própria. Dados de recursos exigem propriedade, mestre ou permissão de observador. A ficha sem permissão de consulta não recebe metadados de recursos.
- Ao usar uma atividade, as demais atividades do mesmo item nos painéis existentes refletem o uso pendente. A proteção nativa já existente contra uso concorrente é preservada. Ao cancelar, voltam ao estado disponível conforme o sistema, sem marcar ações como gastas pelo HUD.
- Atividades indisponíveis preservam texto legível e explicação. O status e os metadados possuem descrições acessíveis; o ícone de detalhes e a estrela continuam independentes da execução.
- No cenário de referência, continuam cinco atividades completas no painel de 380 px. A alternativa visual empilhada foi comparada localmente: usava 61 px por linha no grupo testado, contra 49 px na opção em linha. Variantes extensas podem aumentar a altura para preservar sua leitura.
- Nenhum gasto de PP, efeito ou dano é calculado novamente pelo HUD. Outros módulos e licenças preservados.

## Verificação

27 testes Node, regressão Python do importador e Chromium com classes/templates reais do CORE 5.0.2 e documentos simulados. O navegador verifica identidade do item/atividade, manutenção do custo/alcance ao usar e ficar indisponível, sincronização de estados entre variantes, bloqueio de clique concorrente pelo evento nativo do CORE, cancelamento, permissões, nomes extensos, caracteres especiais, descrições acessíveis e seleção da variante exata. Inclui cancelamento após fechar o HUD e preserva as regressões de busca, foco, fotos, atalhos e posicionamento.

Não foi executado em Foundry real. Capturas novas: hud-activity-pending.png, hud-activity-unavailable.png e hud-activity-long-name.png. Imagens e dados de teste são substitutos.

## Instalação e rollback

Manifesto permanente: https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json.

Retorno: https://github.com/RicardoHuanJR/System-Fixes/releases/download/v1.27.26/oprpg-system-fixes.zip. Backups locais: .local-reference/backup-before-1.27.27.zip e .local-reference/rollback-before-1.27.27.bundle. Base: 3c979ffdc8fd5c42d754acae54333c33b2a1917c.
