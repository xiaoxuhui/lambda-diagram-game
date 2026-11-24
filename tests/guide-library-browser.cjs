const assert=require('node:assert/strict'),path=require('node:path');
const P=require('../src/presets.js'),C=require('../src/core.js'),G=require('../src/guide.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch();
  try{for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>document.getElementById('storage-status').textContent.includes('已自动保存'));
    await page.locator('#function-name').fill('fac');await page.locator('#function-source').fill('λx.x');await page.locator('#function-add').click();
    await page.waitForFunction(()=>document.querySelector('.function-item[data-name="fac"]'));
    await page.locator('#expression').fill('(λx.x) y');await page.locator('#convert').click();await page.locator('#step').click();
    const original=await page.locator('#current-expression').textContent();
    await page.locator('#function-name').fill('draft');await page.locator('#function-source').fill('λx.');
    await page.locator('#mode-guide').click();
    await page.locator('#guide-example').selectOption(String(P.examples.findIndex(e=>e.name.startsWith('阶乘 · 迭代'))));
    await page.locator('#guide-add-library').click();
    assert.match(await page.locator('#guide-library-feedback').textContent(),/示例定义不一致：fac/);
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')).functionDraft.source==='λx.');
    const saved=await page.evaluate(()=>{
      const s=LambdaSnapshot.decodeStartingState(localStorage.getItem('lambda-lab-v2'));
      return {names:s.functions.map(fn=>fn.name),fac:LambdaCore.format(s.functions.find(fn=>fn.name==='fac').term),draft:s.functionDraft};
    });
    assert.equal(saved.fac,'λx.x');assert.deepEqual(saved.names,['fac']);assert.equal(saved.draft.source,'λx.');
    await page.locator('#guide-add-library').click();assert.match(await page.locator('#guide-library-feedback').textContent(),/示例定义不一致：fac/);
    await page.locator('#guide-all-symbols > summary').click();
    const identity=page.locator('#guide-symbols details').filter({has:page.locator('summary',{hasText:/^id：/})}).last();
    await identity.locator('summary').click();await identity.getByRole('button',{name:'加入函数 id 到函数库',exact:true}).click();
    assert.match(await page.locator('#guide-library-feedback').textContent(),/已加入 1 个函数/);
    await page.locator('#guide-back').click();assert.equal(await page.locator('#expression').inputValue(),'(λx.x) y');
    assert.equal(await page.locator('#current-expression').textContent(),original);assert.equal(await page.locator('#step-count').textContent(),'1');
    assert.equal(await page.locator('#function-source').inputValue(),'λx.');
    await page.getByRole('button',{name:'删除函数 fac',exact:true}).click();
    await page.locator('#mode-guide').click();await page.locator('#guide-example').selectOption(String(P.examples.findIndex(e=>e.name.startsWith('阶乘 · 迭代'))));
    await page.locator('#guide-add-library').click();await page.locator('#guide-back').click();
    await page.locator('#expression').fill('fac 3_church');await page.locator('#number-encoding').selectOption('church');
    await page.locator('#convert').click();await page.locator('#fast-run').click();
    await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
    assert.equal(await page.evaluate(()=>LambdaCore.churchNumber(LambdaCore.parse(document.getElementById('current-expression').textContent))),6);
    for(const [name,input,expected] of [['incmap','[0,2,4]','[1,3,5]'],['sumlist','[2,3,4]','9'],['prodlist','[2,3,4]','24']]){
      const before=await page.evaluate(()=>LambdaSnapshot.decodeStartingState(localStorage.getItem('lambda-lab-v2')).functions.map(fn=>fn.name)),doc=G.lesson(P.examples.find(e=>e.capsule?.name===name));
      await page.locator('#mode-guide').click();await page.locator('#guide-example').selectOption(String(P.examples.findIndex(e=>e.capsule?.name===name)));
      await page.locator('#guide-add-library').click();await page.locator('#guide-back').click();
      assert.equal(await page.locator('.function-item').count(),new Set([...before,...doc.symbols.map(fn=>fn.name)]).size,'each displayed definition is imported exactly once');
      assert.equal(await page.locator(`.function-item[data-name="${name}"]`).count(),1);
      await page.locator('#expression').fill(`${name} ${input}`);await page.locator('#convert').click();await page.locator('#fast-run').click();
      await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
      assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse(expected)),name);
      await page.getByRole('button',{name:`删除函数 ${name}`,exact:true}).click();
    }
    await page.locator('#mode-guide').click();await page.locator('#guide-search').fill('no-such-lesson');assert.ok(await page.locator('#guide-add-library').isDisabled());
    await page.locator('#guide-search').fill('');await page.locator('#guide-example').selectOption(String(P.examples.findIndex(e=>e.name.startsWith('斐波那契'))));
    const before=await page.evaluate(()=>localStorage.getItem('lambda-lab-v2'));
    await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='lambda-lab-v2')throw Error('test storage failure');return original.call(this,key,value);};});
    await page.locator('#guide-add-library').click();assert.match(await page.locator('#guide-library-feedback').textContent(),/加入失败/);
    assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-v2')),before);
    await page.locator('#guide-back').click();assert.equal(await page.locator('.function-item[data-name="fib"]').count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
    console.log(`PASS tutorial library import, collision, persistence, factorial, scene preservation and rollback (${width}px)`);
    await context.close();
  }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
