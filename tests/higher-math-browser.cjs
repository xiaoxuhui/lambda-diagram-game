const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),P=require('../src/presets.js'),M=require('../src/polynomial.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
 if(!server.listening)await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await pw.chromium.launch({headless:true});let passed=0;const errors=[];
 const check=async(name,fn)=>{await fn();console.log(`PASS H${++passed} ${name}`);};
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
   const select=async(name)=>{const i=P.examples.findIndex(e=>e.name.includes(name));assert.ok(i>=0);await page.locator('#examples').selectOption(String(i));};
   const runResult=async(text)=>{await page.locator('#speed-ms').fill('1');await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:180000});assert.equal(await page.locator('#decoded').textContent(),text);};
   const run=(number,kind='Church 数')=>runResult(`${kind} ${number}`);
   await check(`${width}px higher mathematics contains combinations and all choices render`,async()=>{
    assert.equal(await page.locator('#examples optgroup').count(),6);assert.equal(await page.locator('#examples optgroup[label="高等数学"] option').count(),13);
    const combo=page.locator('#examples option').filter({hasText:'组合数'});assert.equal(await combo.evaluate(el=>el.parentElement.label),'高等数学');
    for(const e of P.examples.filter(e=>e.category==='高等数学')){await select(e.name);assert.equal(await page.locator('#expression').inputValue(),e.term);assert.ok(await page.locator('#error-message').isHidden());assert.ok(await page.locator('#diagram-mount line').count()>0);assert.ok((await page.locator('#example-info').textContent()).includes(e.description));}
    assert.equal(await page.locator('#function-count').textContent(),'0 个函数');
   });
   await check(`${width}px original-polynomial symbolic derivative evaluates to 7`,async()=>{await select('符号求导并求值');await run(7,'有理数');});
   await check(`${width}px derivative generation changes when the original polynomial changes`,async()=>{
    await select('生成导函数');assert.match(await page.locator('#example-info').textContent(),/原式：x² \+ 3x/);await runResult('多项式：2x + 3');
    await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#decoded').textContent(),'多项式：2x + 3');
    await page.locator('#expression').fill(M.differentiate([0,0,3]));await page.locator('#convert').click();await runResult('多项式：6x');
   });
   await check(`${width}px original 2x integrates to x squared and x retains its half coefficient`,async()=>{
    await select('生成原函数');assert.match(await page.locator('#example-info').textContent(),/原式：2x/);await runResult('多项式：x²');
    fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('.execution-card').screenshot({path:path.join(__dirname,'artifacts',`symbolic-integral-${width}.png`)});
    await page.locator('#expression').fill(M.integrate([0,1]));await page.locator('#convert').click();await runResult('多项式：1/2x²');
   });
   await check(`${width}px definite integral really runs to 9 and restores`,async()=>{
    await select('定积分');await run(9,'有理数');await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#decoded').textContent(),'有理数 9');await page.locator('#back').click();await page.locator('#step').click();assert.equal(await page.locator('#decoded').textContent(),'有理数 9');
   });
   await check(`${width}px geometric series really sums to 15`,async()=>{await select('等比求和');await run(15);});
   if(width===1280)await check('binomial expression can be edited and actually expands (2+1)^2 to 9',async()=>{
    await select('二项式展开');await page.locator('#expression').fill(`(${P.advanced.binomial}) 2 1 2`);await page.locator('#convert').click();await run(9);
   });
   await check(`${width}px mathematics guidance preserves settings and fits`,async()=>{
    await page.locator('#reduction-order').selectOption('applicative');await page.locator('#reduction-direction').selectOption('right');await select('二项式展开');
    assert.equal(await page.locator('#reduction-order').inputValue(),'applicative');assert.equal(await page.locator('#reduction-direction').inputValue(),'right');assert.match(await page.locator('#example-info').textContent(),/正规序.*从左到右/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await page.locator('#examples').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
    fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('.editor-card').screenshot({path:path.join(__dirname,'artifacts',`higher-math-${width}.png`)});
   });await context.close();
  }
  await check('offline bundle contains and renders the higher mathematics group',async()=>{
   const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/dist/lambda-lab.html');assert.equal(await page.locator('#examples optgroup[label="高等数学"] option').count(),13);await page.locator('#examples').selectOption(String(P.examples.findIndex(e=>e.name.includes('符号求导并求值'))));assert.ok(await page.locator('#example-info').isVisible());assert.ok(await page.locator('#diagram-mount line').count()>0);await context.close();
  });assert.deepEqual(errors,[]);console.log(`Higher mathematics: ${passed} passed, 0 failed; Chromium ${browser.version()}; page errors 0.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
