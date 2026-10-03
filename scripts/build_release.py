"""Gera os arquivos de release sem alterar os fontes dos módulos."""
from pathlib import Path
import argparse, hashlib, json, re, subprocess, zipfile
from urllib.parse import quote

def build(repository, tag, output=None):
    if not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?/[A-Za-z0-9_.-]+',repository) or repository.split('/')[-1] in {'.','..'}:
        raise ValueError('Use o nome real CONTA/REPOSITORIO, sem espaços.')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+',tag):
        raise ValueError('Etiqueta de versão inválida.')
    root=Path(__file__).resolve().parent.parent
    output=Path(output) if output else root/'dist'
    output.mkdir(parents=True,exist_ok=True)
    rows=[]
    for manifest in sorted((root/'modules').glob('*/module.json')):
        source=manifest.parent
        data=json.loads(manifest.read_text(encoding='utf-8-sig'))
        module=data['id']
        if module!=source.name or not re.fullmatch(r'[a-z0-9-]+',module):
            raise ValueError('ID de módulo inválido: '+source.name)
        if data.get('flags',{}).get('licensee'):
            raise ValueError('Manifest contém credencial individual de licença: '+module)
        for key in ('esmodules','scripts','styles'):
            for name in data.get(key,[]):
                asset=(source/name).resolve()
                if not asset.is_relative_to(source.resolve()) or not asset.is_file():
                    raise ValueError('Arquivo declarado ausente ou externo: '+module+'/'+name)
        for file in sorted(source.rglob('*')):
            if file.suffix in ('.js','.mjs','.cjs'):
                check=subprocess.run(['node','--check',str(file)],capture_output=True,text=True)
                if check.returncode:raise ValueError(file.name+': '+check.stderr)
        url='https://github.com/'+repository
        data.update(url=url,manifest=f'{url}/releases/latest/download/{module}.json',
                    download=f'{url}/releases/download/{quote(tag,safe="")}/{module}.zip')
        encoded=(json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
        (output/(module+'.json')).write_bytes(encoded)
        archive=output/(module+'.zip')
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
            for file in sorted(source.rglob('*')):
                if not file.is_file():continue
                relative=file.relative_to(source)
                if any(p in {'.git','node_modules','__pycache__','tests'} for p in relative.parts):continue
                if file.is_symlink():raise ValueError('Link simbólico não permitido: '+str(relative))
                z.writestr((Path(module)/relative).as_posix(),encoded if relative.as_posix()=='module.json' else file.read_bytes())
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            assert z.read(module+'/module.json')==encoded
        rows.append({'id':module,'version':data['version'],'manifest':data['manifest'],
                     'download':data['download'],'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()})
    assert rows, 'Nenhum módulo encontrado'
    (output/'release-index.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    (output/'SHA256SUMS.txt').write_text(''.join(r['sha256']+'  '+r['id']+'.zip\n' for r in rows),encoding='utf-8')
    (output/'RELEASE-NOTES.md').write_text('Módulos OPRPG — '+tag+'\n\n'+''.join('- '+r['id']+' '+r['version']+'\n' for r in rows)+'\nCompatibilidade e validação conforme a documentação de cada módulo.\n',encoding='utf-8')
    return rows

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--repository',required=True)
    parser.add_argument('--tag',required=True)
    parser.add_argument('--output')
    args=parser.parse_args()
    print(json.dumps({'modules':len(build(args.repository,args.tag,args.output))},ensure_ascii=False))
