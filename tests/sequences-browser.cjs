const assert=require('node:assert/strict'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
const C=require('../src/core.js'),P=require('../src/presets.js');
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));const browser=await pw.chromium.launch();
  try{for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.getElementById('storage-status').textContent.includes('已自动保存'));
    await page.locator('#sequences-panel > summary').click();
    const original=await page.locator('#current-expression').textContent();await page.locator('#sequence-count').fill('4');await page.locator('#sequence-load').click();
    assert.equal(await page.locator('#current-expression').textContent(),original,'loading never runs or converts the current diagram');
    await page.locator('#convert').click();await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
    assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.churchList([0,1,1,2].map(n=>C.parse(String(n))))));
    await page.locator('#sequence-guide').click();assert.match(await page.locator('#guide-title').textContent(),/A000045/);assert.match(await page.locator('#guide-principle').textContent(),/未.*求值|没有预先生成/);
    await page.locator('#guide-category').selectOption('无限列表');await page.locator('#guide-search').fill('45');assert.ok((await page.locator('#guide-example option').allTextContents()).some(text=>text.includes('A000045')));
    await page.locator('#guide-back').click();await page.locator('#sequence-id').fill('401715');await page.locator('#sequence-id').press('Tab');
    const unchanged=await page.locator('#expression').inputValue();await page.locator('#sequence-load').click();assert.match(await page.locator('#sequence-status').textContent(),/尚无内置生成规则/);assert.equal(await page.locator('#expression').inputValue(),unchanged);
    await page.locator('#sequence-rule').fill('λn.λf.λx.f (n f x)');await page.locator('#sequence-rule-save').click();await page.waitForFunction(()=>document.getElementById('sequence-status').textContent.includes('规则已保存'));
    assert.equal(await page.locator('.function-item[data-name="a401715"]').count(),1);
    await page.locator('#sequence-count').fill('3');await page.locator('#sequence-load').click();await page.locator('#convert').click();await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
    assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.churchList([1,2,3].map(n=>C.parse(String(n))))));
    await page.locator('#sequence-rule').fill('λn.');await page.locator('#save-state').click();await page.reload();
    assert.equal(await page.locator('#sequence-id').inputValue(),'401715');assert.equal(await page.locator('#sequence-rule').inputValue(),'λn.');assert.equal(await page.locator('.function-item[data-name="a401715"]').count(),1);
    await page.locator('#sequence-rule-save').click();await page.waitForFunction(()=>document.getElementById('sequence-status').textContent.startsWith('保存失败'));
    assert.equal(await page.locator('.function-item[data-name="a401715"]').count(),1);
    await page.locator('#sequence-id').fill('45');await page.locator('#sequence-id').press('Tab');await page.locator('#sequence-infinite').click();assert.match(await page.locator('#sequence-status').textContent(),/完整正规形不会结束/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
    console.log(`PASS sequences: numeric input, actual prefixes, tutorials, custom rule, missing rule, draft recovery and infinite source (${width}px)`);await context.close();
  }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
