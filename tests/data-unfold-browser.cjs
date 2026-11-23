const assert=require('node:assert/strict'),path=require('node:path'),C=require('../src/core.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));const browser=await pw.chromium.launch();
  try{for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#number-encoding').selectOption('church');
    const source=async text=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();};
    await source('[1,2]');assert.equal(await page.locator('[data-unfold-hit]').count(),0);assert.ok(await page.locator('#data-functions-control').isHidden());
    await page.locator('#unfold-functions').check();assert.ok(await page.locator('#data-functions-control').isVisible());assert.ok(await page.locator('#data-as-functions').isChecked());
    await page.locator('#data-as-functions').uncheck();await source('2');assert.equal(C.churchNumber(C.parse(await page.locator('#current-expression').textContent())),2);
    assert.equal(await page.locator('[data-unfold-hit]').count(),0);
    await page.locator('#function-name').fill('dataidentity');await page.locator('#function-source').fill('λx.x');await page.locator('#function-add').click();
    await page.waitForSelector('.function-item[data-name="dataidentity"]');await source('dataidentity 2');
    assert.equal(await page.getByRole('button',{name:'点击函数 dataidentity，展开一层',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'点击函数 n2，展开一层',exact:true}).count(),0);
    await source('[1,2]');assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.churchList([C.parse('1'),C.parse('2')])));
    await page.locator('#unfold-functions').uncheck();assert.ok(await page.locator('#data-functions-control').isHidden());assert.ok(await page.locator('#data-as-functions').isDisabled());
    await page.locator('#unfold-functions').check();assert.equal(await page.locator('#data-as-functions').isChecked(),false);
    await page.locator('#save-state').click();await page.reload();assert.ok(await page.locator('#data-functions-control').isVisible());assert.equal(await page.locator('#data-as-functions').isChecked(),false);
    await page.locator('#data-as-functions').check();const count=await page.locator('.function-item').count();
    await source('2');assert.equal(await page.locator('#current-expression').textContent(),'n2');
    await page.getByRole('button',{name:'点击函数 n2，展开一层',exact:true}).click();assert.equal(await page.locator('.diagram-wire-motion canvas').count(),1);
    assert.equal(C.churchNumber(C.parse(await page.locator('#current-expression').textContent())),2);
    await page.locator('#back').click();assert.equal(await page.locator('#current-expression').textContent(),'n2');
    await page.locator('#function-use-current').click();assert.ok(C.equal(C.parse(await page.locator('#function-source').inputValue()),C.parse('2')));
    await source('[1,2]');assert.equal(await page.locator('#current-expression').textContent(),'list1');
    await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#current-expression').textContent(),'list1');assert.ok(await page.locator('#data-as-functions').isChecked());
    await page.getByRole('button',{name:'点击函数 list1，展开一层',exact:true}).click();
    assert.match(await page.locator('#current-expression').textContent(),/n1/);assert.match(await page.locator('#current-expression').textContent(),/n2/);
    await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
    assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.churchList([C.parse('1'),C.parse('2')])));
    assert.equal(await page.locator('.function-item').count(),count);
    await source('[]');assert.equal(await page.locator('#current-expression').textContent(),'list1');
    await page.locator('#decimal-value').click();await page.waitForFunction(()=>!document.getElementById('normal-form').hidden);
    await source('λx.[x,1]');await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
    assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse('λx.[x,1]')));
    assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    console.log(`PASS data functions: conditional toggle, enabled/disabled numerals and lists, saved choice, clicks, replay and lexical scope (${width}px)`);await context.close();
  }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
