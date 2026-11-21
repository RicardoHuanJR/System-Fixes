// Real CORE components, simulated documents; this is not a live Foundry test.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(process.env.ARGON_FIXTURE_URL || 'http://127.0.0.1:4173');
  await page.waitForFunction(()=>window.ready);
  const action=page.getByRole('button',{name:/^Ação: /});
  const panel=page.locator('.argon-oprpg-list.show');
  await action.click();
  const flags=await page.evaluate(()=>JSON.stringify(fixtureActor.flags));
  await panel.getByRole('button',{name:'Armas',exact:true}).click();
  await panel.getByRole('searchbox').fill('nenhuma-correspondencia');
  await panel.getByRole('button',{name:'Limpar busca e filtros',exact:true}).click();
  assert.equal(await panel.getByRole('searchbox').inputValue(),'');
  assert.equal(await panel.getByRole('button',{name:'Todas',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>JSON.stringify(fixtureActor.flags)),flags);
  assert.ok(await panel.locator('.argon-oprpg-activity:visible').count()>10);
  // Selects and checkboxes retain native keyboard behavior.
  await panel.getByRole('button',{name:'Armas',exact:true}).click();
  await panel.locator('summary').click();
  const checkbox=panel.getByRole('checkbox');await checkbox.focus();await checkbox.press('ArrowDown');
  assert.equal(await checkbox.evaluate(el=>document.activeElement===el),true);
  const select=panel.getByLabel('Conjunto de armas',{exact:true});await select.focus();await select.press('ArrowUp');
  assert.equal(await select.evaluate(el=>document.activeElement===el),true);
  await panel.getByRole('button',{name:'Todas',exact:true}).click();
  const rows=panel.locator('.argon-oprpg-activity:visible,.argon-oprpg-basic:visible');
  await rows.first().focus();await rows.first().press('End');
  assert.equal(await rows.last().evaluate(el=>document.activeElement===el),true);
  const finalBounds=await rows.last().boundingBox(),scrollBounds=await panel.locator('.argon-oprpg-rows').boundingBox();
  assert.ok(finalBounds.y>=scrollBounds.y && finalBounds.y+finalBounds.height<=scrollBounds.y+scrollBounds.height);
  await rows.last().press('Home');assert.equal(await rows.first().evaluate(el=>document.activeElement===el),true);
  const info=panel.getByRole('button',{name:'Detalhes de Ação de teste 24 — Área de alcance',exact:true});
  await info.click();
  const sheet=panel.getByRole('button',{name:'Abrir ficha do item',exact:true});
  await page.evaluate(()=>{window.itemSheetCount=0;fixtureActor.items.get('i24').sheet.render=()=>{window.itemSheetCount++;};});
  await sheet.click();assert.equal(await page.evaluate(()=>window.itemSheetCount),1);
  assert.equal(await page.evaluate(()=>window.executed),undefined);
  await sheet.focus();await page.evaluate(()=>ui.ARGON.refresh());
  assert.equal(await sheet.evaluate(el=>document.activeElement===el),true,'refresh restores the new item sheet control');
  await sheet.press('Escape');assert.equal(await panel.isVisible(),true);assert.equal(await info.getAttribute('aria-expanded'),'false');
  assert.equal(await info.evaluate(el=>document.activeElement===el),true);
  await info.press('Escape');assert.equal(await panel.count(),0);
  // Prepared totals differ from the base modifier; no roll occurs on opening.
  await page.evaluate(()=>{fixtureActor.system.abilities.dex.check={value:5};fixtureActor.system.abilities.dex.save={value:7};return ui.ARGON.refresh();});
  const dex=page.getByRole('button',{name:'Testes de Destreza',exact:true});await dex.click();await page.locator('.argon-oprpg-drawer').waitFor({state:'visible'});
  const drawer=page.locator('.argon-oprpg-drawer');
  for(const [label,value] of [['Teste de Destreza','+5'],['Salvaguarda de Destreza','+7'],['Furtividade','+6']]) {
   const row=drawer.getByRole('button',{name:label,exact:true});
   assert.equal(await row.locator('strong').textContent(),value);
   assert.equal(await row.evaluate(el=>document.getElementById(el.getAttribute('aria-describedby'))?.textContent),value);
  }
  assert.equal(await page.evaluate(()=>window.testRoll),undefined);
  await page.getByRole('button',{name:'Testes de Força',exact:true}).click();await page.getByRole('region',{name:'Força',exact:true}).waitFor();
  assert.equal(await drawer.getByRole('button',{name:'Teste de Força',exact:true}).locator('strong').textContent(),'Mod. +2');
  await drawer.getByRole('button',{name:'Fechar testes e atalhos',exact:true}).click();
  // Native effects open a full-sized list and do not toggle until explicitly chosen.
  await page.evaluate(()=>{
   window.effectUpdates=0;
   fixtureActor.effects=Array.from({length:8},(_,i)=>({id:'effect'+i,uuid:'Actor.actor.ActiveEffect.effect'+i,name:'Efeito '+i,img:'/icons/reaction.svg',description:'',isOwner:true,disabled:false,update:async()=>{window.effectUpdates++;}}));
   fixtureActor.temporaryEffects=fixtureActor.effects;return ui.ARGON.refresh();
  });
  const effects=page.locator('.portrait-hud > .effects-container');
  assert.equal(await effects.getByRole('button').count(),8);
  const rail=await effects.boundingBox(),stats=await page.locator('.argon-oprpg-portrait-stats').boundingBox();
  assert.ok(rail.y+rail.height<=stats.y,'effect rail must end above resources');
  const effect=effects.getByRole('button',{name:'Consultar efeito: Efeito 0',exact:true});await effect.click();
  await page.getByRole('region',{name:'Efeitos',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.effectUpdates),0);
  assert.equal(await drawer.getByRole('button',{name:/^Ativo: Efeito/}).count(),8);
  const effectRow=drawer.getByRole('button',{name:'Ativo: Efeito 0',exact:true});assert.ok((await effectRow.boundingBox()).height>=32);
  await effectRow.press('Enter');assert.equal(await page.evaluate(()=>window.effectUpdates),1);
  await effectRow.press('Escape');assert.equal(await effect.evaluate(el=>document.activeElement===el),true);
  await effect.press('Enter');assert.equal(await effect.getAttribute('aria-expanded'),'true');
  await drawer.getByRole('button',{name:'Fechar testes e atalhos',exact:true}).click();
  const lastEffect=effects.getByRole('button').last();await lastEffect.focus();
  assert.ok(await effects.evaluate(el=>el.scrollTop)>0);
  const last=await lastEffect.boundingBox();assert.ok(last.y>=rail.y && last.y+last.height<=rail.y+rail.height);
  await lastEffect.press('Enter');await page.getByRole('region',{name:'Efeitos',exact:true}).waitFor();
  await page.evaluate(()=>{fixtureActor.effects=[];fixtureActor.temporaryEffects=[];return ui.ARGON.refresh();});
  await drawer.getByText('Nenhum efeito nesta ficha.',{exact:true}).waitFor();
  await drawer.getByRole('button',{name:'Fechar testes e atalhos',exact:true}).click();
  assert.equal(await page.locator('.argon-oprpg-portrait-photo').evaluate(el=>document.activeElement===el),true,'removed effect trigger returns focus to the portrait');
  // Simulated native chrome is an obstruction only while visible.
  await page.setViewportSize({width:900,height:700});
  await page.evaluate(()=>{
   const sidebar=document.createElement('aside');sidebar.id='sidebar';sidebar.style.cssText='position:fixed;right:0;top:0;width:360px;height:100vh';document.body.append(sidebar);
   const hotbar=document.createElement('div');hotbar.id='hotbar';hotbar.style.cssText='position:fixed;left:100px;top:400px;width:440px;height:48px';document.body.append(hotbar);
  });
  await action.click();
  const obstruction=await panel.boundingBox();assert.ok(obstruction.x+obstruction.width<=532 && obstruction.y+obstruction.height<=392);
  const chromeBefore=await page.locator('#sidebar').getAttribute('style');
  await panel.getByRole('button',{name:'Fechar',exact:true}).click();await dex.click();await page.locator('.argon-oprpg-drawer').waitFor({state:'visible'});
  const drawerBlocked=await drawer.boundingBox();assert.ok(drawerBlocked.x+drawerBlocked.width<=532 && drawerBlocked.y+drawerBlocked.height<=392);
  assert.equal(await page.locator('#sidebar').getAttribute('style'),chromeBefore);
  await page.screenshot({path:path.resolve('.local-reference/hud-chrome-safe.png')});
  await drawer.getByRole('button',{name:'Fechar testes e atalhos',exact:true}).click();
  await page.evaluate(()=>{document.querySelector('#sidebar').style.width='645px';});await action.click();
  const constrained=await panel.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),search:el.querySelector('input').getBoundingClientRect().toJSON(),header:el.querySelector('.argon-oprpg-list-header').getBoundingClientRect().toJSON(),narrow:el.classList.contains('argon-oprpg-narrow')}));
  assert.ok(constrained.rect.right<=247 && constrained.rect.width<320 && constrained.narrow);
  assert.ok(constrained.search.bottom<=constrained.header.bottom);
  await panel.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.evaluate(()=>{document.querySelector('#sidebar').style.visibility='hidden';document.querySelector('#hotbar').hidden=true;});await action.click();
  const unblocked=await panel.boundingBox();assert.equal(unblocked.width,380);assert.ok(unblocked.x>=260);
  await panel.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.evaluate(()=>{document.querySelector('#sidebar').remove();document.querySelector('#hotbar').remove();});
  // The larger text preference changes CSS sizes, never CORE scale or actor data.
  await page.evaluate(()=>{window.originalSettingsGet=game.settings.get;game.settings.get=(id,key)=>key==='argonTextSize'?'large':window.originalSettingsGet(id,key);return ui.ARGON.refresh();});
  for(const viewport of [{width:1440,height:900},{width:867,height:453},{width:390,height:844},{width:320,height:700}]) {
   await page.setViewportSize(viewport);await action.click();
   const geometry=await panel.evaluate(el=>({panel:el.getBoundingClientRect().toJSON(),search:el.querySelector('input').getBoundingClientRect().toJSON(),header:el.querySelector('.argon-oprpg-list-header').getBoundingClientRect().toJSON(),size:getComputedStyle(el.querySelector('.action-element-title')).fontSize,transform:getComputedStyle(document.querySelector('#hud')).transform}));
   assert.equal(geometry.size,'15px');assert.equal(geometry.transform,'none');
   assert.ok(geometry.panel.y>=0 && geometry.panel.x>=0 && geometry.panel.right<=viewport.width && geometry.panel.bottom<=viewport.height);
   assert.ok(geometry.search.bottom<=geometry.header.bottom);
   const identity=await page.locator('.portrait-hud').evaluate(el=>({photo:el.querySelector('.argon-oprpg-portrait-photo').getBoundingClientRect().toJSON(),stats:el.querySelector('.argon-oprpg-portrait-stats').getBoundingClientRect().toJSON(),attributes:el.querySelector('.argon-oprpg-attributes').getBoundingClientRect().toJSON()}));
   assert.ok(identity.attributes.y>=identity.photo.bottom && identity.attributes.y>=identity.stats.bottom);
   await page.screenshot({path:path.resolve('.local-reference/hud-large-text-'+viewport.width+'.png')});
   await panel.getByRole('button',{name:'Fechar',exact:true}).click();await dex.click();await page.locator('.argon-oprpg-drawer').waitFor({state:'visible'});
   const roll=drawer.getByRole('button',{name:'Furtividade',exact:true});await roll.focus();await page.evaluate(()=>ui.ARGON.refresh());
   const focused=await roll.boundingBox(),visible=await drawer.boundingBox();assert.ok(focused.y>=visible.y && focused.y+focused.height<=visible.y+visible.height);
   await roll.press('Escape');
  }
  // Read-only actors cannot gain item sheet access or inspect private totals.
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>{fixtureActor.isOwner=false;fixtureActor.testUserPermission=()=>false;return ui.ARGON.refresh();});
  await action.click();await panel.getByRole('button',{name:'Detalhes de Ação de teste 24 — Área de alcance',exact:true}).click();
  assert.equal(await panel.getByRole('button',{name:'Abrir ficha do item',exact:true}).count(),0);
  await panel.locator('[data-entry-key="i24:a1"]').press('F2');assert.equal(await page.evaluate(()=>window.itemSheetCount),1);
  await panel.getByRole('button',{name:'Fechar',exact:true}).click();await dex.click();await page.locator('.argon-oprpg-drawer').waitFor({state:'visible'});assert.equal(await drawer.locator('.argon-oprpg-roll-bonus').count(),0);
  assert.deepEqual(errors,[]);
  console.log('Refinement checks passed: totals, item sheets, effects, reset, keyboard, native chrome, larger text and permissions.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
