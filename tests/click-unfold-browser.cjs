const assert=require('node:assert/strict'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch();
  try{for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,reducedMotion:'no-preference'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('#number-encoding').selectOption('church');await page.locator('#unfold-functions').check();
    for(const [name,source] of [['inner','λx.x'],['outer','inner']]){
      await page.locator('#function-name').fill(name);await page.locator('#function-source').fill(source);await page.locator('#function-add').click();
      await page.waitForSelector(`.function-item[data-name="${name}"]`);
    }
    const current=()=>page.locator('#current-expression').textContent();
    const source=async text=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();};
    const hit=name=>page.getByRole('button',{name:`点击函数 ${name}，展开一层`,exact:true});
    await source('(λz.z) (outer arg)');
    // Click the visible name itself, through the transparent diagram hit area.
    const label=page.locator('#diagram-mount text').filter({hasText:'outer'}).first();await label.scrollIntoViewIfNeeded();const box=await label.boundingBox();
    await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
    assert.equal(await current(),'(λz.z) (inner arg)');assert.equal(await page.locator('#step-count').textContent(),'1');
    assert.equal(await page.locator('.diagram-wire-motion canvas').count(),1);
    await hit('inner').focus();await hit('inner').press('Enter');assert.equal(await current(),'(λz.z) ((λx.x) arg)');
    await page.locator('#save-state').click();await page.reload();
    assert.equal(await current(),'(λz.z) ((λx.x) arg)');
    const choices=await page.evaluate(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')).session.choices);
    assert.deepEqual(choices,[[0,{unfold:['arg','fn']}],[1,{unfold:['arg','fn']}]]);
    await page.locator('#back').click();assert.equal(await current(),'(λz.z) (inner arg)');assert.equal(await page.locator('.diagram-wire-motion canvas').count(),1);
    await page.locator('#back').click();assert.equal(await current(),'(λz.z) (outer arg)');
    for(const strategy of ['normal','applicative'])for(const direction of ['left','right']){
      await page.locator('#reduction-order').selectOption(strategy);await page.locator('#reduction-direction').selectOption(direction);
      await source('outer outer');
      if(width===390)await hit('outer').last().tap();else await hit('outer').last().click();
      assert.equal(await current(),'outer inner');assert.equal(await page.locator('#step-count').textContent(),'1');
    }
    await source('λouter.keep outer (inner arg)');assert.equal(await page.locator('[data-unfold-hit]').count(),1);
    assert.equal(await hit('outer').count(),0);await hit('inner').press(' ');assert.equal(await current(),'λouter.keep outer ((λx.x) arg)');
    await source('outer');await page.locator('#expression').fill('changed');assert.equal(await hit('outer').getAttribute('aria-disabled'),'true');
    await source('outer');await hit('outer').scrollIntoViewIfNeeded();const center=await hit('outer').boundingBox();const x=center.x+center.width/2,y=center.y+center.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+20,y);await page.mouse.up();assert.equal(await current(),'inner');
    await source('outer');await hit('outer').scrollIntoViewIfNeeded();const start=await hit('outer').boundingBox();await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
    await page.mouse.move(start.x+start.width/2+35,start.y+start.height/2);await page.mouse.up();assert.equal(await current(),'outer');
    await page.locator('#speed-ms').fill('60000');await page.locator('#run').click();await hit('outer').click();assert.equal(await current(),'inner');
    assert.equal(await page.locator('#run-label').textContent(),'运行');assert.equal(await page.locator('#step-count').textContent(),'1');
    await page.locator('#unfold-functions').uncheck();await source('outer');assert.equal(await page.locator('[data-unfold-hit]').count(),0);assert.equal(await current(),'λx.x');
    assert.deepEqual(errors,[]);console.log(`PASS click unfolding: names, one layer, animation, undo, replay, four orders, scope and 20px gestures (${width}px)`);
    await context.close();
  }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
