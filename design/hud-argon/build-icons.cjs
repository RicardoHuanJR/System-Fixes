const fs=require('node:fs');
const dir='design/hud-argon/icones';fs.mkdirSync(dir,{recursive:true});
const accent='var(--icon-accent,#cd79a7)';
const path=(d,color='currentColor')=>`<path d="${d}" fill="${color}" stroke="none"/>`;
const line=(d,color='currentColor',width=1.9)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const petals=path('M16 11C10 8 11 4 16 2c5 2 6 6 0 9ZM13 12C6 14 3 9 4 6c5-1 9 2 9 6ZM19 12c7 2 10-3 9-6-5-1-9 2-9 6Z',accent);
const cutlass=path('M10 20C19 16 25 9 27 3c2 10-4 20-12 22Z')+line('M7 18c5 1 9 5 9 9',accent,2.5)+line('m9 23-5 5', 'currentColor',3)+path('m4 26 3 3-3 2-3-3Z',accent);
const glyphs={
 sword:cutlass,
 bolt:`<g transform="translate(1 4) scale(.86)">${cutlass}</g><g transform="translate(31 4) scale(-.86 .86)">${cutlass}</g>`+path('m16 2 3 5-3 7-3-7Z',accent),
 clock:line('M16 2v5M16 25v5M2 16h5M25 16h5M6 6l4 4M22 22l4 4M26 6l-4 4M10 22l-4 4',accent,2.5)+`<circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="2"/>`+path('m16 9 3 7-3 7-3-7Z')+path('m9 16 7-3 7 3-7 3Z',accent),
 shield:line('m16 3 11 4v9c0 6-7 11-11 14C12 27 5 22 5 16V7Z', 'currentColor',2)+path('M12 19C18 15 22 10 23 7c1 7-3 13-8 16Z',accent)+line('m9 18 7 6M12 22l-3 4'),
 other:path('m16 1 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z')+path('m16 7 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z',accent)+path('m16 12 3 4-3 4-3-4Z','#281322'),
 star:line('m16 3 4 8 9 1-6 6 2 10-9-5-9 5 2-10-6-6 9-1Z', 'currentColor',2)+path('m16 11 2 5-2 6-2-6Z',accent),
 info:line('m16 2 10 6v16l-10 6-10-6V8Z')+line('M16 14v9M13 23h6')+path('m16 7 2 2-2 2-2-2Z',accent),
 close:line('m8 8 16 16M24 8 8 24','currentColor',2.5)+line('m6 11 5-5M21 26l5-5M21 6l5 5M6 21l5 5',accent,1.8),
 search:line('m10 12 12-7 5 8-14 6ZM10 12l3 7-5 3-5-7ZM23 4l5 10', 'currentColor',2)+line('m6 21-3 5M10 23l-3 5',accent)+line('m17 8 4 7',accent),
 sheet:line('M8 8V5c0-3 5-3 5 0v19c0 3 5 3 5 0V7h8v17c0 5-5 6-10 6H7V8ZM13 5h10c4 0 5 3 5 5')+line('M16 12h6M16 17h6',accent)+path('m20 21 2 3-2 3-2-3Z',accent),
 minus:line('M5 16h9M18 16h9','currentColor',2.3)+path('m16 12 2 4-2 4-2-4Z',accent),
 effects:petals+path('M14 15C6 15 5 21 8 27c5-1 8-6 6-12ZM18 15c8 0 9 6 6 12-5-1-8-6-6-12Z')+path('m16 13 3 7-3 11-3-11Z',accent),
 haki:line('M7 21V12c0-3 4-3 4 0V7c0-3 4-3 4 0V5c0-3 4-3 4 0v3c0-3 4-3 4 0v9l4-3 2 3-6 11H11Z')+line('M11 13v4M15 10v7M19 10v7',accent,1.5)+path('m15 23 3-3 3 3-3 6Z',accent),
 walk:path('M11 3h10v13l8 5v6H5v-8l6-3Z')+line('M5 30h24M14 8h4M14 12h4','#d8ae71',2)+path('m22 18 4 2-4 3-3-2Z',accent),
 flame:path('M16 2c2 8 11 9 11 19 0 13-22 13-22 0 0-5 4-8 7-11-1 5 1 8 3 8 4-4 2-10 1-16Z')+path('M16 17c3 4 7 6 6 10-1 5-12 4-12-1 0-4 5-6 6-9Z',accent)+path('M6 6c4 0 6 2 6 5-4 0-6-2-6-5Z',accent),
 spark:path('M17 2 5 19h9l-1 12 14-19h-9Z')+path('M4 3c5 0 7 2 7 5C6 9 3 7 4 3ZM23 23c5-1 7 1 7 5-4 1-7-1-7-5Z',accent),
 frost:line('M16 3v27M4 9l24 14M4 23 28 9M12 5l4 4 4-4M12 28l4-4 4 4M4 14l5-2-1-5M24 26l-1-6 6-1M3 19l6 1-1 6M24 6l-1 6 6 1')+path('m16 11 4 5-4 5-4-5Z',accent),
 dodge:line('M3 9h9M2 16h7M3 23h9',accent,2)+path('M23 3c6 5 6 15 0 25l-4-4c5-7 5-13 0-17Z')+line('m16 25 6 5',accent,2.5),
 ready:line('M8 3h16M8 29h16M10 5c0 7 4 7 6 11-2 4-6 4-6 11M22 5c0 7-4 7-6 11 2 4 6 4 6 11')+path('m12 7 4 7 4-7ZM11 26l5-7 5 7Z',accent),
 dash:path('m6 5 11 4-4 8 15 5v6H3v-9l4-3Z')+line('M4 31h24M18 4l8-2M20 9h10M21 14l7 2',accent,2)+line('m7 21 6 1','#201525',2),
 hide:path('M16 2C7 7 4 15 3 28l8-5 5 7 5-7 8 5C28 15 25 7 16 2Z')+path('M16 8c-5 3-7 7-6 12l6-3 6 3c1-5-1-9-6-12Z','#211321')+line('m12 14 3 1M17 15l3-1',accent,1.7),
 potion:line('M11 3h10M12 3v7L5 21c-4 8 26 10 22 0l-7-11V3M9 18h14')+path('M8 21c-3 5 19 6 16 0Z',accent)+path('m16 9 2 3-2 3-2-3Z',accent)
};
const svg=(body,colored=false)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" ${colored?'style="color:#f2e8d5"':''}>${body}</svg>`;
for(const [key,body]of Object.entries(glyphs))fs.writeFileSync(`${dir}/${key}.svg`,svg(body,true));
const file='design/hud-argon/preview.html';let html=fs.readFileSync(file,'utf8');
html=html.replace(/^const (?:paths|iconGlyphs)=.*;$/m,`const iconGlyphs=${JSON.stringify(glyphs)};`);
html=html.replace(/^const icon=\(name\)=>.*;$/m,'const icon=(name)=>`<svg class="orchid-icon" viewBox="0 0 32 32" aria-hidden="true">${iconGlyphs[name]||iconGlyphs.other}</svg>`;');
const replacements={akuma:'effects',haki:'haki','crossed-swords':'sword','fire-spell-cast':'flame','bolt-spell-cast':'spark','shield-bash':'shield','ice-spell-cast':'frost','drink-me':'potion','dodging':'dodge','clockwork':'ready','run':'dash','invisible':'hide','cloak-dagger':'hide'};
const assets=Object.fromEntries(Object.entries(replacements).map(([old,key])=>[old,'data:image/svg+xml;base64,'+Buffer.from(svg(glyphs[key],true)).toString('base64')]));
html=html.replace(/^Object.assign\(assets,.*\);\n?/gm,'');
html=html.replace('const economies=',`Object.assign(assets,${JSON.stringify(assets)});\nconst economies=`);
html=html.replace(/\.tab svg\{width:20px;height:20px;--icon-accent:#a64172\}[^\n]*\n/g,'');
html=html.replace('</style>','.tab svg{width:20px;height:20px;--icon-accent:#a64172}.tab[aria-expanded=true] svg{--icon-accent:#ebc482}.tools svg{width:14px;height:14px;--icon-accent:#d38db5}.mini svg{width:16px;height:16px;--icon-accent:#dfb774}.mini.star[aria-pressed=true] svg path:first-child{fill:#e5be79;stroke:#e5be79}.mini.star[aria-pressed=true] svg path:last-child{fill:#342031}.use img{padding:2px}.movement svg{--icon-accent:#d38db5}\n</style>');
fs.writeFileSync(file,html);
const names={sword:'Ação · sabre',bolt:'Poderosa · lâminas cruzadas',clock:'Bônus · roda de navegação',shield:'Reação · aparar',other:'Livre · rosa dos ventos',star:'Favorito',info:'Informação',close:'Fechar',search:'Busca · luneta',sheet:'Ficha · pergaminho',minus:'Recolher',effects:'Efeitos · orquídea',haki:'Haki',walk:'Movimento',flame:'Técnica · chama',spark:'Técnica · impacto',frost:'Técnica · gelo',dodge:'Esquivar',ready:'Preparar',dash:'Disparada',hide:'Esconder',potion:'Item · frasco'};
const specimen=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orquídea Negra · iconografia</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#110e15;color:#f2e8d5;font:14px Arial,sans-serif}h1{font-size:24px;margin:0 0 10px}p{color:#cdb7d0;margin:0 0 26px;font-size:13px}h2{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#dfa9cb;margin:30px 0 12px}.icons{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0 18px}figure{margin:0;min-width:0;padding:18px 0;border-top:1px solid #51394d}figure>svg{width:56px;height:56px;display:block;margin-bottom:12px}figcaption{font-size:12px;line-height:18px;min-height:36px}small{display:flex;gap:10px;align-items:center;color:#cdb7d0;font-size:11px;margin-top:10px}small svg:first-child{width:22px;height:22px}small svg:last-child{width:14px;height:14px}a{color:#f0c5de}@media(max-width:600px){body{padding:20px}.icons{grid-template-columns:repeat(3,minmax(0,1fr))}}</style><h1>Orquídea Negra / iconografia</h1><p>Desenhos vetoriais próprios para a prévia. Lâminas, instrumentos de bordo e pétalas compartilham a mesma espessura e paleta.</p><h2>Economia de ações</h2><div class="icons">${Object.keys(glyphs).slice(0,5).map(item).join('')}</div><h2>Consulta e atividades</h2><div class="icons">${Object.keys(glyphs).slice(5).map(item).join('')}</div><p style="margin-top:30px"><a href="preview.html">Voltar ao HUD interativo</a> · Amostras pequenas: 22 e 14 px.</p></html>`;
function item(key){const v=svg(glyphs[key],true);return `<figure>${v}<figcaption>${names[key]}</figcaption><small>${v}${v}</small></figure>`;}
fs.writeFileSync('design/hud-argon/icones.html',specimen);
console.log({icons:Object.keys(glyphs).length,referenceImageUsed:false});
