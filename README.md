# System Fixes 1.26.3

Compatibilidade com Modificadores de Chat 1.2.1: acerto e dano persistentes, troca e remoção sem duplicação, sigilo das animações. 734 verificações simuladas aprovadas e testes reais na cópia da ficha. Veja [revisão](modules/oprpg-system-fixes/REVISAO-1.26.3.md) e [checklist de compatibilidade](COMPATIBILIDADE.md).

# System Fixes 1.26.2

Compatibilidade com Modificadores de Chat 1.2.0: acerto e dano persistentes, troca e remoção sem duplicação, sigilo das animações. 733 verificações simuladas aprovadas e testes reais na cópia da ficha. Veja [revisão](modules/oprpg-system-fixes/REVISAO-1.26.2.md) e [checklist de compatibilidade](COMPATIBILIDADE.md).

# System Fixes 1.26.1

Correção do dano das automações nos cartões com uma única atividade e do conflito com o preparo legado de Haki. 717 verificações simuladas aprovadas. Diable Jambe testado em Foundry real na cópia da ficha: dado de fogo separado no cartão. Veja [revisão 1.26.1](modules/oprpg-system-fixes/REVISAO-1.26.1.md).

# System Fixes 1.26.0

Ativação pelo item original e atalhos, explicação de dano por alvo e revisão da ficha. 712 verificações simuladas aprovadas. Testes reais de ativação, consumo, desativação, revisão e dano realizados em uma cópia da ficha, com jogador e mestre conectados. A cobertura real é parcial; as demais automações dos livros continuam pendentes. Veja [revisão 1.26.0](modules/oprpg-system-fixes/REVISAO-1.26.0.md).

# System Fixes 1.25.0

Primeira etapa das automações de personagens: usos nativos na aba, coordenação pelo mestre e novos efeitos. 680 verificações simuladas aprovadas. As demais automações e testes em Foundry real continuam pendentes. Veja [revisão 1.25.0](modules/oprpg-system-fixes/REVISAO-1.25.0.md).

# System Fixes — módulos da mesa OPRPG

Repositório público da mesa: [RicardoHuanJR/System-Fixes](https://github.com/RicardoHuanJR/System-Fixes). Os módulos são distribuídos individualmente nos arquivos das releases.

## Instalação no Foundry

Na configuração do Foundry, abra **Módulos adicionais → Instalar módulo → URL do manifest** e informe um dos links:

| Módulo | Manifest para instalação e atualização |
|---|---|
| System Fixes | https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-system-fixes.json |
| Antifraude | https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-antifraude.json |
| Detector de rolagens suspeitas | https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-detector-fraude.json |
| Modificadores de acerto e dano | https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-chat-modifiers.json |
| Compatibilidade Argon OPRPG | https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/enhancedcombathud-oprpg-system.json |
| Diable Jambe | https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-diable-jambe.json |

Usar esses manifests registra a origem para atualizações futuras. Uma instalação local antiga sem campo `manifest` pode precisar de reinstalação pelo link para registrar essa origem; preserve o ID do módulo. Não é necessário apagar fichas ou configurações do mundo.

A release v1.21.0 inclui seleção automática por área, pedidos individuais de salvaguarda e Controle Cirúrgico no System Fixes. Veja modules/oprpg-system-fixes/REVISAO-1.21.0.md para os limites e testes. Os demais módulos mantêm suas versões; Diable Jambe ainda não foi consolidado.

A distribuição v1.21.1 adiciona a integração Argon OPRPG 6.4.0. O System Fixes continua na versão 1.21.0. A integração exige Argon Core (enhancedcombathud) 5.0.1 instalado separadamente; o Core não é distribuído aqui.

## Organização

- `modules/enhancedcombathud-oprpg-system`: integração OPRPG do Argon, com licença e avisos de autoria preservados.
- `modules/oprpg-system-fixes`: correções e automações da mesa, incluindo Haki integrado.
- `modules/oprpg-antifraude`: permanece separado.
- `modules/oprpg-detector-fraude`: permanece separado.
- `modules/oprpg-chat-modifiers`: permanece separado; fonte do ZIP enviado em 02/10/2026.
- `modules/oprpg-diable-jambe`: fonte preservada para avaliar incorporação posterior no Fixes.

Módulos externos e compêndios oficiais permanecem fora deste repositório. Alguns compêndios instalados contêm chaves individuais de licença; não devem ser copiados para cá. Também não incluir mundos, fichas da mesa, senhas, configurações do servidor ou PDFs dos livros.

Não foi atribuída uma nova licença aos arquivos de terceiros. Antes de distribuir publicamente, confirmar a autorização de redistribuição dos autores das contribuições; preservar seus avisos de autoria e licença existentes.

## Publicação e atualizações

O fluxo de publicação gera um ZIP separado e um manifest separado para cada módulo. Assim o Foundry pode atualizar cada um sem instalar o antifraude ou os modificadores dentro do Fixes.

As próximas versões podem ser publicadas pelo fluxo **Publicar módulos**, com uma etiqueta de versão. O script calcula as URLs usando o repositório real, sem gravar endereços fictícios nos fontes.

Em um repositório privado, os links dos arquivos de release normalmente exigem autenticação. O instalador de módulos do Foundry não recebe automaticamente a autenticação do navegador; a distribuição pública dos artefatos ou instalação local continuará necessária nesse caso.

Preparar e validar localmente:

```text
python scripts/build_release.py --repository RicardoHuanJR/System-Fixes --tag v1.21.1
```

## Próxima etapa

As áreas e Controle Cirúrgico foram incorporados ao Fixes 1.21.0, com 522 verificações simuladas. Falta o teste desta versão em mundo real e a consolidação dos demais módulos próprios, conforme PROXIMA-ETAPA.md.


