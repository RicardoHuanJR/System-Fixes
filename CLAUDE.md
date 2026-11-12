# Codebase overview

Módulos independentes de compatibilidade para OP RPG/Foundry V14. O adaptador Argon ativo está dentro de `modules/oprpg-system-fixes/scripts/argon-hud`; o adaptador separado 6.4.1 é referência histórica e não deve ser ativado junto.

JavaScript ES modules, CSS e pipeline Python/GitHub Actions. Use APIs nativas de atividades para consumo e efeitos; não copie fontes oficiais ou licenças individuais de `.local-reference`.

Mapa: [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md). Testes: `node --test tests/argon-integrated.mjs` e `python -m unittest discover -s tests -p 'test_*.py'`. Não afirmar validação em Foundry real a partir da simulação.
