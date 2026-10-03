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
| Diable Jambe | https://github.com/RicardoHuanJR/System-Fixes/releases/latest/download/oprpg-diable-jambe.json |

Usar esses manifests registra a origem para atualizações futuras. Uma instalação local antiga sem campo `manifest` pode precisar de reinstalação pelo link para registrar essa origem; preserve o ID do módulo. Não é necessário apagar fichas ou configurações do mundo.

A primeira release mantém o System Fixes 1.20.1 e as versões atuais dos demais módulos. Não contém ainda a nova seleção automática por área nem a consolidação do Diable Jambe.

## Organização

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
python scripts/build_release.py --repository RicardoHuanJR/System-Fixes --tag v1.20.1
```

## Próxima etapa

O escopo das áreas e Controle Cirúrgico está descrito em `PROXIMA-ETAPA.md`. Nenhuma dessas novas mecânicas foi incorporada ao pacote 1.20.1 apenas por preparar este repositório.
