const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));const browser=await pw.chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let passed=0;
  const check=async(name,fn)=>{await fn();passed++;console.log(`PASS N${passed} ${name}`);};
  const source=async(text)=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();};
  const add=async(name,text)=>{await page.locator('#function-name').fill(name);await page.locator('#function-source').fill(text);await page.locator('#function-add').click();};
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await check('3 expands into a rendered Church numeral',async()=>{await source('3');assert.equal(await page.locator('#current-expression').textContent(),'λf.λx.f (f (f x))');assert.equal(await page.locator('#decoded').textContent(),'Church 数 3');assert.equal(await page.locator('#diagram-mount [data-kind="variable"]').count(),4);});
    await check('zero is FALSE / Church 0',async()=>{await source('0');assert.equal(await page.locator('#decoded').textContent(),'FALSE / Church 数 0');});
    await check('ADD 2 3 computes 5 with named function',async()=>{await add('ADD','λm n f x.m f (n f x)');await source('ADD 2 3');await page.locator('#speed').selectOption('180');await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');assert.equal(await page.locator('#decoded').textContent(),'Church 数 5');});
    await check('numeric function definitions save and restore',async()=>{await add('TWO','2');await source('TWO');await page.locator('#save-state').click();await source('1');await page.locator('#restore-state').click();assert.equal(await page.locator('#decoded').textContent(),'Church 数 2');await page.reload();assert.equal(await page.locator('#expression').inputValue(),'TWO');assert.equal(await page.locator('#decoded').textContent(),'Church 数 2');});
    await check('invalid numbers show errors without executable stale state',async()=>{for(const s of ['9999999999999999999999999','-1','3.5']){await source(s);assert.ok(await page.locator('#error-message').isVisible());assert.ok(await page.locator('#run').isDisabled());}await source('3');});
    await check('mobile layout remains usable and JavaScript error free',async()=>{await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.screenshot({path:path.join(__dirname,'artifacts','numeral-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);});
    console.log(`Numeral browser checks: ${passed} passed, 0 failed.`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
