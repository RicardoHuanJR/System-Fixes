// Browser fixture: actual CORE component classes/templates; Foundry documents are simulated.
// Usage: ARGON_CORE_DIR=/checkout/of/core node tests/argon-browser-server.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const core = path.resolve(process.env.ARGON_CORE_DIR || path.join(root,'.local-reference/argon-core'));
const handlebars = path.resolve(process.env.HANDLEBARS_DIR || path.join(root,'.local-reference/test-runtime/node_modules/handlebars'));
const types = {'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.hbs':'text/plain','.html':'text/html','.svg':'image/svg+xml','.json':'application/json'};
http.createServer((req,res)=>{
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file;
  if (url.endsWith('/scripts/app/CoreHud.js')) {
    res.setHeader('Content-Type','text/javascript');
    return res.end('export const PARTIALS_PATH="/modules/enhancedcombathud/templates/partials/"; export const localize=x=>game.i18n.localize(x);');
  }
  if (url.endsWith('/scripts/app/tooltip.js')) {
    res.setHeader('Content-Type','text/javascript'); return res.end('export class Tooltip {}');
  }
  if (url.endsWith('/scripts/lib/utils.js')) {
    res.setHeader('Content-Type','text/javascript'); return res.end('export class HandlebarsApplication {} export const mergeClone=(a,b)=>({...a,...b});');
  }
  if (url.startsWith('/icons/')) {
    res.setHeader('Content-Type','image/svg+xml');
    if (url.includes('weapon')) return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#172b22"/><path d="m7 26 19-20M18 6h8v8M5 19l8 8" fill="none" stroke="#88d7ae" stroke-width="3"/></svg>');
    if (url.includes('technique')) return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#17232f"/><path d="m18 3-12 15h9l-1 11 12-16h-9Z" fill="#95cbef"/></svg>');
    if (url.includes('reaction')) return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#302025"/><path d="m16 4 11 4v9c-1 6-7 10-11 12-4-2-10-6-11-12V8Z" fill="none" stroke="#eda9b8" stroke-width="3"/></svg>');
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#d2b76b" d="M16 2 29 16 16 30 3 16Z"/><circle cx="16" cy="16" r="5" fill="#202630"/></svg>');
  }
  if (url === '/handlebars.js') file=path.join(handlebars,'dist/handlebars.js');
  else if (url.startsWith('/modules/enhancedcombathud/')) file=path.join(core,url.slice('/modules/enhancedcombathud/'.length));
  else if (url==='/' || url==='/tests/argon-browser.html') file=path.join(root,'tests/argon-browser.html');
  else if (url.startsWith('/modules/oprpg-system-fixes/')) file=path.join(root,url);
  else {res.writeHead(404);return res.end();}
  if (![root,core,handlebars].some(base=>file.startsWith(base+path.sep))) {res.writeHead(403); return res.end();}
  try {res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
  catch {res.writeHead(404);res.end();}
}).listen(4173,'127.0.0.1',()=>console.log('Argon simulated browser fixture: http://127.0.0.1:4173'));
