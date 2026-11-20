const assert=require('node:assert/strict'),path=require('node:path'),C=require('../src/core.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';
const hall=process.env.LAMBDA_HALL_HTML_PATH;
const server=hall?require('node:http').createServer((req,res)=>res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(require('node:fs').readFileSync(hall))).listen(0,'127.0.0.1'):require('../scripts/serve.cjs');
(async()=>{
 if(!server.listening)await new Promise(r=>server.once('listening',r));
 const browser=await pw.chromium.launch(),errors=[];let passed=0;
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#number-encoding').selectOption('church');
   await page.locator('#function-name').fill('idfn');await page.locator('#function-source').fill('λx.x');await page.locator('#function-add').click();
   await page.waitForSelector('.function-item[data-name="idfn"]');assert.equal(await page.locator('#unfold-functions').isChecked(),false);
   await page.locator('#expression').fill('idfn');await page.locator('#convert').click();assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse('λx.x')));
   console.log('PASS',++passed,width+'px: disabled mode expands all functions before displaying the diagram');
   await page.locator('#unfold-functions').check();
   for(const [name,source] of [['nestedinner','λx.x'],['nestedmiddle','nestedinner'],['nestedouter','nestedmiddle']]){
    await page.locator('#function-name').fill(name);await page.locator('#function-source').fill(source);await page.locator('#function-add').click();await page.waitForSelector('.function-item[data-name="'+name+'"]');
   }
   await page.locator('#expression').fill('nestedouter');await page.locator('#convert').click();
   for(const expected of ['nestedmiddle','nestedinner','λx.x']){await page.locator('#step').click();assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse(expected)));}
   await page.locator('#back').click();assert.equal(await page.locator('#current-expression').textContent(),'nestedinner');
   console.log('PASS',++passed,width+'px: nested function calls expand one layer and undo restores the function name');
   for(const strategy of ['normal','applicative'])for(const direction of ['left','right']){
    await page.locator('#reduction-order').selectOption(strategy);await page.locator('#reduction-direction').selectOption(direction);
    await page.locator('#expression').fill('(λx.x) idfn');await page.locator('#convert').click();assert.match(await page.locator('#current-expression').textContent(),/idfn/);
    await page.locator('#step').click();
    if(strategy==='normal'){assert.equal(await page.locator('#current-expression').textContent(),'idfn');assert.equal(await page.locator('#state-badge').textContent(),'可以归约');assert.match(await page.locator('#next-explanation').textContent(),/展开函数/);}
    await page.locator('#speed-ms').fill('1');await page.locator(direction==='left'?'#run':'#fast-run').click();
    await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
    assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse('λx.x')));
    console.log('PASS',++passed,width+'px: '+strategy+'/'+direction+' unfolds remaining functions and finishes normally');
   }
   await page.locator('#expression').fill('idfn');await page.locator('#convert').click();await page.locator('#decimal-value').click();
   await page.waitForFunction(()=>!document.getElementById('normal-form').hidden);await page.locator('#normal-form summary').click();
   await page.waitForFunction(()=>document.getElementById('normal-form-expression').textContent.length>0);
   assert.ok(C.equal(C.parse(await page.locator('#normal-form-expression').textContent()),C.parse('λx.x')));
   await page.locator('#expression').fill('(λx.x) idfn');await page.locator('#reduction-order').selectOption('normal');await page.locator('#convert').click();await page.locator('#step').click();
   await page.locator('#save-state').click();await page.reload();if(hall)await page.locator('#restore-state').click();
   await page.waitForFunction(()=>document.getElementById('current-expression').textContent==='idfn');assert.equal(await page.locator('#unfold-functions').isChecked(),true);
   await page.locator('#back').click();assert.equal(await page.locator('#step-count').textContent(),'0');await page.locator('#fast-run').click();
   await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
   assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse('λx.x')));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   console.log('PASS',++passed,width+'px: function-only quick value, v5 save/reload, undo and resume');await context.close();
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
