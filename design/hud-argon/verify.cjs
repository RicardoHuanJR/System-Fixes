const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1400,height:800},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('design/hud-argon/preview.html')).href);
  await page.waitForFunction(()=>window.preview && [...document.images].every(i=>i.complete&&i.naturalWidth));
  const original=await page.locator('.stats').innerText();
  const originalCrestLoaded=await page.locator('.panel-head strong').evaluate(async el=>{
   const source=getComputedStyle(el,'::before').backgroundImage.slice(5,-2);
   return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth>0);img.onerror=()=>resolve(false);img.src=source;});
  });
  assert.equal(originalCrestLoaded,true);
  assert.equal(require('node:fs').readFileSync('design/hud-argon/preview.html','utf8').includes('orquidea.png'),false);
  const contrast=await page.evaluate(()=>{
   const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
   const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
   const results=[];
   for(const el of document.querySelectorAll('strong,small,button,summary,dt,dd,.foot span,header span,.hint,#notice')){
    if(!el.getClientRects().length || !el.textContent.trim())continue;
    let parent=el,bg;
    while(parent){const values=rgb(getComputedStyle(parent).backgroundColor);if(values.length===3 || values[3]===1){bg=values;break;}parent=parent.parentElement;}
    if(!bg)bg=[52,59,60];const fg=rgb(getComputedStyle(el).color),a=lum(fg),b=lum(bg);results.push({text:el.textContent.slice(0,24),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
   }
   return results.sort((a,b)=>a.ratio-b.ratio)[0];
  });
  assert.ok(contrast.ratio>=4.5,JSON.stringify(contrast));
  await page.screenshot({path:'design/hud-argon/cena-desktop.png'});
  const hud=await page.locator('#hud').boundingBox(), panel=await page.locator('#panel').boundingBox();
  const geometry=await page.locator('.tab').evaluateAll(buttons=>buttons.map(button=>({
   clip:getComputedStyle(button).clipPath,transform:getComputedStyle(button).transform,
   italic:getComputedStyle(button).fontStyle,
   width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height,
   iconY:button.querySelector('svg').getBoundingClientRect().y
  })));
  assert.ok(geometry.every(b=>b.clip==='none'&&b.transform==='none'&&b.italic==='normal'&&b.width===60&&b.height===48));
  assert.equal(new Set(geometry.map(b=>b.iconY)).size,1,'icons must align horizontally');
  await page.locator('.bar').screenshot({path:'design/hud-argon/botoes-retos.png'});
  assert.equal(Math.round(hud.height),122);assert.ok(hud.width<=510);
  await page.screenshot({path:'design/hud-argon/detalhe-hud.png',clip:{x:12,y:panel.y-8,width:520,height:800-panel.y}});
  await page.getByRole('button',{name:'Detalhes',exact:true}).click();
  await page.locator('.details').waitFor({state:'visible'});
  await page.screenshot({path:'design/hud-argon/detalhes-atividade.png',clip:{x:12,y:(await page.locator('#panel').boundingBox()).y-8,width:520,height:800-(await page.locator('#panel').boundingBox()).y}});
  await page.getByRole('button',{name:'Reação',exact:true}).first().click();
  assert.equal(await page.locator('.entry').count(),2);
  await page.locator('.use').first().click();assert.match(await page.locator('#toast').innerText(),/Prévia/);
  assert.equal(await page.locator('.stats').innerText(),original);
  await page.locator('#query').fill('zzzz');assert.equal(await page.locator('.entry').count(),0);
  await page.locator('#query').fill('');await page.keyboard.press('Escape');assert.equal(await page.locator('#panel').isVisible(),false);
  await page.getByRole('button',{name:'Recolhido',exact:true}).click();
  await page.screenshot({path:'design/hud-argon/recolhido.png'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.querySelector('#toast').textContent='');
  await page.getByRole('button',{name:'Ação',exact:true}).first().click();
  const mobile=await page.locator('#panel').boundingBox();assert.ok(mobile.x>=0 && mobile.x+mobile.width<=390 && mobile.y>120);
  assert.ok(mobile.y+mobile.height<(await page.locator('#hud').boundingBox()).y);
  await page.screenshot({path:'design/hud-argon/mobile.png'});
  const tools=await page.locator('.tools').boundingBox(),stats=await page.locator('.stats').boundingBox();
  assert.ok(stats.y+stats.height<=tools.y,'stats must stay above portrait controls');
  await page.locator('#query').fill('espada');assert.equal(await page.locator('.entry').count(),1);
  await page.locator('.use').first().focus();await page.keyboard.press('i');assert.equal(await page.locator('.details').count(),1);
  assert.deepEqual(errors,[]);
  await page.setViewportSize({width:867,height:453});
  await page.getByRole('button',{name:'Ação',exact:true}).first().click();
  const landscape=await page.locator('#panel').boundingBox();assert.ok(landscape.y>=0&&landscape.y+landscape.height<=453);
  await page.screenshot({path:'design/hud-argon/tela-baixa.png'});
  console.log({originalCrestLoaded,minimumTextContrast:contrast});
  console.log(JSON.stringify({desktop:hud,mobilePanel:mobile,imagesLoaded:true,search:true,details:true,nativeResourcesUntouched:true,errors}));
  const specimen=await browser.newPage({viewport:{width:1100,height:1200},deviceScaleFactor:2});
  specimen.on('pageerror',e=>errors.push(e.message));
  await specimen.goto(pathToFileURL(path.resolve('design/hud-argon/icones.html')).href);
  assert.equal(await specimen.locator('figure').count(),22);
  await specimen.screenshot({path:'design/hud-argon/colecao-icones.png',fullPage:true});
  const primary=await specimen.locator('.icons').first().boundingBox();
  await specimen.screenshot({path:'design/hud-argon/icones-principais.png',clip:{x:16,y:8,width:1068,height:primary.y+primary.height}});
  assert.deepEqual(errors,[]);
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
