const assert=require('node:assert/strict'),path=require('node:path'),P=require('../src/presets.js'),C=require('../src/core.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));const browser=await pw.chromium.launch();
  try{for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const pair=P.examples.find(e=>e.name.startsWith('序对除法'));
    await page.locator('#examples').selectOption(String(P.examples.indexOf(pair)));
    assert.equal(await page.locator('#unfold-functions').isChecked(),false);
    const initial=await page.locator('#current-expression').textContent();assert.equal(C.freeVars(C.parse(initial)).size,0);assert.equal(await page.locator('[data-unfold-hit]').count(),0);
    assert.equal(await page.locator('#step-count').textContent(),'0');
    await page.locator('#step').click();assert.notEqual(await page.locator('#current-expression').textContent(),initial);
    await page.locator('#back').click();assert.equal(await page.locator('#current-expression').textContent(),initial);
    await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#current-expression').textContent(),initial);
    await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
    assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse(pair.expected)));
    const sin=P.examples.find(e=>e.decimalOperation==='SIN');await page.locator('#examples').selectOption(String(P.examples.indexOf(sin)));
    const state=await page.evaluate(()=>{const s=LambdaSnapshot.decodeStartingState(localStorage.getItem('lambda-lab-v2'));return {nodes:LambdaCore.inspect(s.session.original).nodes,definitions:s.session.functionDefinitions?.length??0,free:[...LambdaCore.freeVars(s.session.original)]};});
    assert.ok(state.nodes<10000);assert.equal(state.definitions,0);assert.deepEqual(state.free,[]);assert.equal(await page.locator('.function-item').count(),0);
    assert.equal(await page.locator('[data-unfold-hit]').count(),0);
    await page.locator('#growth-window').selectOption('10000');await page.locator('#decimal-value').click();
    await page.waitForFunction(()=>document.getElementById('decimal-value-result').textContent.startsWith('小数'),{},{timeout:20000});
    assert.match(await page.locator('#decimal-value-result').textContent(),/-?0\.479425/);
    await page.locator('#unfold-functions').check();await page.locator('#data-as-functions').uncheck();await page.locator('#convert').click();assert.ok(await page.locator('[data-unfold-hit]').count()>0);
    await page.locator('#save-state').click();
    await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('lambda-lab-v2'));s.view.unfoldFunctions=false;localStorage.setItem('lambda-lab-v2',JSON.stringify(s));});
    await page.reload();assert.equal(await page.locator('#unfold-functions').isChecked(),false);assert.ok(await page.locator('#run').isDisabled());assert.match(await page.locator('#toast').textContent(),/隐式函数定义与历史已保留/);
    await page.locator('#convert').click();assert.equal(await page.locator('[data-unfold-hit]').count(),0);assert.equal(C.freeVars(C.parse(await page.locator('#current-expression').textContent())).size,0);
    await page.locator('#expression').fill('10000');await page.locator('#number-encoding').selectOption('church');await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isHidden());
    assert.equal(await page.locator('#diagram-mount line').count(),40003);assert.equal(await page.locator('#state-badge').textContent(),'已到正规形');
    assert.deepEqual(errors,[]);console.log(`PASS helper binding respects the switch, plain Lambda evaluation, undo, restore, old-session recovery and deep diagram conversion (${width}px)`);await context.close();
  }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
