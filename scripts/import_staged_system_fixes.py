"""Importa um ZIP validado do System Fixes sem tocar nos outros módulos."""
from __future__ import annotations

import json
import os
import re
import shutil
import stat
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
INCOMING = ROOT / "incoming"
MODULE = "oprpg-system-fixes"
DEST = ROOT / "modules" / MODULE


def main():
    bundles = sorted(INCOMING.glob("oprpg-system-fixes-v*.zip"))
    if not bundles:
        print("Nenhum pacote novo aguardando importação.")
        imported = False
    else:
        if len(bundles) != 1:
            raise RuntimeError("Apenas um pacote do System Fixes pode ser importado por vez.")
        package = bundles[0]
        match = re.fullmatch(r"oprpg-system-fixes-v(\d+\.\d+\.\d+)\.zip", package.name)
        if not match:
            raise ValueError("Nome do pacote inválido.")
        # Published archives may remain in incoming; never overwrite newer source code.
        current = json.loads((DEST / "module.json").read_text(encoding="utf-8-sig")) if (DEST / "module.json").exists() else {}
        version_tuple = lambda value: tuple(map(int, value.split(".")))
        if re.fullmatch(r"\d+\.\d+\.\d+", current.get("version", "")) and version_tuple(match.group(1)) <= version_tuple(current["version"]):
            print(f"Ignorado {package.name}: fonte {current['version']} já é igual ou mais recente.")
            if os.environ.get("GITHUB_OUTPUT"):
                with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
                    output.write("imported=false\n")
            return
        with zipfile.ZipFile(package) as archive:
            bad = archive.testzip()
            if bad:
                raise ValueError(f"ZIP corrompido: {bad}")
            infos = archive.infolist()
            if len(infos) > 1000:
                raise ValueError("Pacote grande demais.")
            with tempfile.TemporaryDirectory() as temp:
                staging = Path(temp)
                total = 0
                for info in infos:
                    path = PurePosixPath(info.filename)
                    if path.is_absolute() or ".." in path.parts or not path.parts or path.parts[0] != MODULE:
                        raise ValueError(f"Caminho inseguro no ZIP: {info.filename}")
                    if stat.S_IFMT(info.external_attr >> 16) == stat.S_IFLNK:
                        raise ValueError(f"Link simbólico não permitido: {info.filename}")
                    if len(path.parts) == 1 and info.is_dir():
                        continue
                    if len(path.parts) < 2:
                        raise ValueError(f"Arquivo inesperado: {info.filename}")
                    destination = staging.joinpath(*path.parts[1:])
                    if info.is_dir():
                        destination.mkdir(parents=True, exist_ok=True)
                        continue
                    total += info.file_size
                    if total > 15_000_000:
                        raise ValueError("Pacote descompactado excede 15 MB.")
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(info) as source, destination.open("wb") as output:
                        shutil.copyfileobj(source, output)
                manifest = json.loads((staging / "module.json").read_text(encoding="utf-8-sig"))
                if manifest.get("id") != MODULE or manifest.get("version") != match.group(1):
                    raise ValueError("ID ou versão do manifesto não correspondem ao pacote.")
                for key in ("esmodules", "styles", "scripts"):
                    for filename in manifest.get(key, []):
                        candidate = staging / filename
                        if not candidate.resolve().is_relative_to(staging.resolve()) or not candidate.is_file():
                            raise ValueError(f"Arquivo ausente ou inseguro: {filename}")
                for language in manifest.get("languages", []):
                    candidate = staging / language.get("path", "")
                    if not candidate.resolve().is_relative_to(staging.resolve()) or not candidate.is_file():
                        raise ValueError("Idioma declarado ausente.")
                if DEST.exists():
                    shutil.rmtree(DEST)
                shutil.copytree(staging, DEST)
        print(f"Importado {package.name}: versão {match.group(1)}.")
        imported = True
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write(f"imported={'true' if imported else 'false'}\n")


if __name__ == "__main__":
    main()
