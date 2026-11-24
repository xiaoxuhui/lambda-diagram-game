const assert=require('node:assert/strict'),path=require('node:path');
const P=require('../src/presets.js'),G=require('../src/guide.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch();
  const cases=[['整数除法','8_church 4_church',2],['开根号','9_church 3_church',2],['对数','3_church 8_church',1],['超对数','2_church 4_church',2],['超根号','3_church 2_church',1],['超超根号','2_church 1_church',2],['超超对数','2_church 2_church',1]];
  try{for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('#function-name').fill('quot');await page.locator('#function-source').fill('λx.x');await page.locator('#function-add').click();
    for(const [prefix,args,expected] of cases){
      const index=P.examples.findIndex(e=>!e.decimalOperation&&e.name.startsWith(prefix+' ·')),doc=G.lesson(P.examples[index]);
      const main=G.libraryNames(doc)[0],actualName=main;
      await page.locator('#examples').selectOption(String(index));
      const before=await page.locator('#expression').inputValue(),diagram=await page.locator('#current-expression').textContent();
      await page.locator('#function-name').fill('draft');await page.locator('#function-source').fill('λx.');
      await page.locator('#example-add-library').click();
      assert.match(await page.locator('#example-library-feedback').textContent(),new RegExp(actualName));
      assert.equal(await page.locator('#expression').inputValue(),before);assert.equal(await page.locator('#current-expression').textContent(),diagram);
      assert.equal(await page.locator('#function-source').inputValue(),'λx.');
      if(prefix==='整数除法'){
        assert.match(await page.locator('#example-library-feedback').textContent(),/示例定义不一致：quot/);
        assert.equal(await page.locator('.function-item[data-name="quot2"]').count(),0);
        await page.getByRole('button',{name:'删除函数 quot',exact:true}).click();await page.locator('#example-add-library').click();
      }
      const count=await page.locator('.function-item').count();
      await page.locator('#example-add-library').click();assert.equal(await page.locator('.function-item').count(),count);
      await page.locator('#expression').fill(actualName+' '+args);await page.locator('#convert').click();await page.locator('#fast-run').click();
      await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
      assert.equal(await page.evaluate(()=>LambdaCore.churchNumber(LambdaCore.parse(document.getElementById('current-expression').textContent))),expected);
      await page.locator('#mode-guide').click();await page.locator('#guide-example').selectOption(String(index));
      assert.ok(await page.locator('#guide-input-section').isVisible());assert.ok(await page.locator('#guide-add-library').isEnabled());
      assert.equal(await page.locator('#guide-steps table tbody tr').count(),doc.steps[4][3].rows.length);
      await page.locator('#guide-add-library').click();assert.match(await page.locator('#guide-library-feedback').textContent(),/已有相同定义，已准备好/);
      await page.locator('#guide-back').click();
    }
    await page.reload();
    assert.equal(await page.locator('.function-item[data-name="quot"]').count(),1);assert.equal(await page.locator('.function-item[data-name="quot2"]').count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
    console.log(`PASS inverse example imports, changed arguments, detailed tutorials and persistence (${width}px)`);
    await context.close();
  }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
