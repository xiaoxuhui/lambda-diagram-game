const assert=require('node:assert/strict'),path=require('node:path'),C=require('../src/core.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));const browser=await pw.chromium.launch();
  try{for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('#custom-data-panel > summary').click();await page.locator('#encoding-name').fill('Box');await page.locator('#encoding-source').fill('λn.λk.k n');await page.locator('#encoding-reduction-steps').fill('0');await page.locator('#encoding-save').click();
    assert.ok(await page.locator('#encoding-error').isHidden());
    await page.locator('#expression').fill('3_Box');await page.waitForFunction(()=>document.getElementById('encoding-progress').textContent.includes('保留未归约'));
    const initial=await page.locator('#current-expression').textContent();assert.equal(await page.locator('#step-count').textContent(),'0');
    await page.locator('#convert').click();let text=await page.locator('#current-expression').textContent();assert.ok(C.findRedex(C.parse(text)));assert.ok(C.equal(C.parse(text),C.parse('(λn.λk.k n) 3')));assert.notEqual(text,initial);
    assert.equal(await page.locator('#unfold-functions').isChecked(),false);await page.locator('#step').click();assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse('λk.k 3')));
    await page.locator('#back').click();assert.equal(await page.locator('#current-expression').textContent(),text);await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#encoding-reduction-steps').inputValue(),'0');assert.equal(await page.locator('#current-expression').textContent(),text);
    await page.locator('#encoding-table > summary').click();await page.locator('#encoding-table-number').fill('4');await page.waitForTimeout(250);assert.equal(await page.locator('#encoding-table-body tr').count(),0);
    await page.locator('#encoding-table-generate').click();await page.waitForFunction(()=>document.querySelector('#encoding-table-body tr[data-number="4"]'));
    await page.locator('#expression').fill('4_Box');await page.locator('#convert').click();assert.ok(C.findRedex(C.parse(await page.locator('#current-expression').textContent())),'a generated table must not bypass the setting');
    await page.locator('#encoding-reduction-steps').fill('');await page.locator('#encoding-save').click();await page.locator('#expression').fill('4_Box');await page.locator('#convert').click();assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse('λk.k 4')));
    await page.locator('#encoding-new').click();await page.locator('#encoding-name').fill('Steps');await page.locator('#encoding-source').fill('λn.(λa.λk.k a) ((λx.x) n)');
    const original=C.parse('(λn.(λa.λk.k a) ((λx.x) n)) 3');
    for(const budget of [1,2,3,20,0]){
      await page.locator('#encoding-reduction-steps').fill(String(budget));await page.locator('#encoding-save').click();await page.locator('#expression').fill('3_Steps');await page.locator('#convert').click();
      let expected=original;for(let n=0;n<budget;n++){const next=C.step(expected);if(!next)break;expected=next.term;}
      assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),expected),'exact pre-reduction budget '+budget);assert.equal(await page.locator('#step-count').textContent(),'0');
      if(budget===1){await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#encoding-reduction-steps').inputValue(),'1');assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),expected));}
    }
    await page.locator('#encoding-new').click();await page.locator('#encoding-name').fill('Loop');await page.locator('#encoding-source').fill('λn.(λx.x x) (λx.x x)');await page.locator('#encoding-reduction-steps').fill('0');await page.locator('#encoding-save').click();await page.locator('#expression').fill('0_Loop');await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isHidden());assert.equal(await page.locator('#step-count').textContent(),'0');assert.ok(C.findRedex(C.parse(await page.locator('#current-expression').textContent())));
    await page.locator('#encoding-reduction-steps').fill('');await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#encoding-reduction-steps').inputValue(),'','unsaved steps draft is preserved');assert.equal(await page.evaluate(()=>LambdaSnapshot.decodeStartingState(localStorage.getItem('lambda-lab-v2')).dataEncodings.find(e=>e.name==='Loop').reductionSteps),0,'unsaved changes do not silently enable execution');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log(`PASS encoding step budgets: 0/1/2 steps, early completion, no cache shortcut, manual execution, undo, archive and independent numeric drafts (${width}px)`);await context.close();
  }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
