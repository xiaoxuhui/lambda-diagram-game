const assert=require('node:assert/strict'),path=require('node:path'),C=require('../src/core.js'),Compiler=require('../src/combinator-compiler.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));const browser=await pw.chromium.launch();
  try{for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('#number-encoding').selectOption('church');assert.ok(await page.locator('#compiler-special').isChecked());
    const diagram=await page.locator('#current-expression').textContent();await page.locator('#compiler-special').uncheck();
    assert.equal(await page.locator('#current-expression').textContent(),diagram);assert.equal(await page.locator('#unfold-functions').isChecked(),false);
    await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#compiler-special').isChecked(),false);
    for(const [basis,id] of [['optimized','compile-combinators'],['sk','compile-sk'],['bckw','compile-bckw']]){
      const source='λa.λb.b',expected=await Compiler.compileTerm(C.parse(source),{basis,specialize:false});await page.locator('#expression').fill(source);await page.locator('#'+id).click();
      await page.waitForFunction(()=>!document.getElementById('compiler-special').disabled&&document.getElementById('combinator-status').textContent.includes('无特殊化简'));
      assert.equal(await page.locator('#expression').inputValue(),expected.source);assert.equal(await page.locator('#unfold-functions').isChecked(),false);
      await page.locator('#expression').fill(expected.source+' a b');await page.locator('#convert').click();await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');assert.equal(await page.locator('#current-expression').textContent(),'b');
    }
    await page.locator('#compiler-special').check();await page.locator('#expression').fill('λa.λb.b');await page.locator('#compile-bckw').click();await page.waitForFunction(()=>document.getElementById('expression').value==='c k');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log(`PASS standard conversion in all three bases, independent switch, saved choice, actual results and special mode recovery (${width}px)`);await context.close();
  }
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/dist/lambda-lab.html`);assert.equal(await page.locator('#compiler-special').count(),1);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
