const assert=require('node:assert/strict'),path=require('node:path'),P=require('../src/presets.js'),B=require('../src/boolean-circuits.js'),C=require('../src/core.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));const browser=await pw.chromium.launch();
  try{for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    assert.equal(await page.locator('#examples optgroup[label="布尔逻辑与电路"] option').count(),20);
    const samples=width===1280?B.examples:B.examples.filter(e=>['halfadd','fulladd','delay','delayi','delayat'].includes(e.booleanCircuit.name));
    for(const example of samples){
      await page.locator('#examples').selectOption(String(P.examples.findIndex(e=>e.name===example.name)));
      assert.equal(await page.locator('#unfold-functions').isChecked(),false);assert.equal(await page.locator('[data-unfold-hit]').count(),0);
      await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
      assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse(example.expected)),example.name);
      if(['halfadd','fulladd','delay'].includes(example.booleanCircuit.name))assert.ok((await page.locator('#decoded').textContent()).includes(B.read(C.parse(example.expected))));
    }
    const delay=P.examples.find(e=>e.booleanCircuit?.name==='delay');await page.locator('#examples').selectOption(String(P.examples.indexOf(delay)));
    await page.locator('#mode-guide').click();await page.locator('#guide-example').selectOption(String(P.examples.indexOf(delay)));
    assert.equal(await page.locator('#guide-inputs tbody tr').count(),7);assert.equal(await page.locator('#guide-flow tbody tr').count(),6);
    assert.match(await page.locator('#guide-principle').textContent(),/不是等待一秒/);
    await page.locator('#guide-add-library').click();await page.locator('#guide-back').click();assert.equal(await page.locator('.function-item').count(),1);
    await page.locator('#expression').fill('delay 3_church 1_bool 0_bool 1_bool');await page.locator('#convert').click();await page.locator('#step').click();
    const current=await page.locator('#current-expression').textContent();await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#current-expression').textContent(),current);assert.equal(await page.locator('#unfold-functions').isChecked(),false);
    await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');assert.equal(await page.locator('#decoded').textContent(),'布尔输出 [假，真，假]');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
    console.log(`PASS boolean circuits: gates, adders, ordered inputs, delay, tutorial, one-entry import, saved progress and unfolding stays off (${width}px)`);await context.close();
  }
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/dist/lambda-lab.html`);assert.equal(await page.locator('#examples optgroup[label="布尔逻辑与电路"] option').count(),20);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
