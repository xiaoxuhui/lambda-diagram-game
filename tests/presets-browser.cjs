const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
const P=require('../src/presets.js');process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
 if(!server.listening)await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`,browser=await pw.chromium.launch({headless:true});let passed=0;const errors=[];
 const check=async(name,fn)=>{await fn();console.log(`PASS A${++passed} ${name}`);};
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
   const select=async(fragment)=>{const i=P.examples.findIndex(e=>e.name.includes(fragment));assert.ok(i>=0,fragment);await page.locator('#examples').selectOption(String(i));return P.examples[i];};
   const run=async(number)=>{await page.locator('#speed-ms').fill('1');await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:180000});assert.equal(await page.locator('#decoded').textContent(),`Church 数 ${number}`);};
   await check(`${width}px grouped choices all render complete diagrams and descriptions`,async()=>{
    assert.equal(await page.locator('#examples option').count(),P.examples.length+1);assert.equal(await page.locator('#examples optgroup').count(),6);
    assert.equal(await page.locator('#examples optgroup[label="高等数学"] option').count(),11);
    for(const e of P.examples.filter(e=>e.expected!==undefined)){await select(e.name);assert.equal(await page.locator('#expression').inputValue(),e.term);assert.ok(await page.locator('#diagram-mount line').count()>0);assert.ok(await page.locator('#error-message').isHidden());assert.ok((await page.locator('#example-info').textContent()).includes(e.description));}
    assert.equal(await page.locator('#function-count').textContent(),'0 个函数');
   });
   await check(`${width}px recursive guidance preserves the player's order and direction`,async()=>{
    await page.locator('#reduction-order').selectOption('applicative');await page.locator('#reduction-direction').selectOption('right');await select('Y 递归');
    assert.equal(await page.locator('#reduction-order').inputValue(),'applicative');assert.equal(await page.locator('#reduction-direction').inputValue(),'right');assert.match(await page.locator('#example-info').textContent(),/正规序.*从左到右/);
    await page.locator('#reduction-order').selectOption('normal');await page.locator('#reduction-direction').selectOption('left');
   });
   await check(`${width}px iterative 3! runs to 6, saves and restores`,async()=>{
    await select('迭代计算');await run(6);await page.locator('#save-state').click();const steps=await page.locator('#step-count').textContent();await page.reload();assert.equal(await page.locator('#decoded').textContent(),'Church 数 6');assert.equal(await page.locator('#step-count').textContent(),steps);assert.ok(await page.locator('#example-info').isHidden());
    await page.locator('#back').click();assert.equal(Number(await page.locator('#step-count').textContent()),Number(steps)-1);await page.locator('#step').click();assert.equal(await page.locator('#decoded').textContent(),'Church 数 6');
   });
   await check(`${width}px C(4,2) really runs to 6 and every step remains available`,async()=>{
    await select('组合数');await run(6);const steps=Number(await page.locator('#step-count').textContent());assert.ok(steps>1);assert.equal(await page.locator('#history-list li').count(),steps+1);
   });
   if(width===1280){
    await check('desktop explicit Y factorial runs to 6',async()=>{await select('Y 递归');await run(6);});
    await check('desktop recursive Fibonacci runs to 5',async()=>{await select('斐波那契');await run(5);});
   }
   await check(`${width}px editing hides stale guidance and controls fit`,async()=>{
    await select('组合数');const box=await page.locator('#examples').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('.editor-card').screenshot({path:path.join(__dirname,'artifacts',`advanced-examples-${width}.png`)});
    await page.locator('#expression').fill('2');assert.ok(await page.locator('#example-info').isHidden());await page.locator('#convert').click();assert.equal(await page.locator('#decoded').textContent(),'Church 数 2');
   });await context.close();
  }
  await check('rebuilt standalone HTML includes advanced examples and runs',async()=>{
   const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/dist/lambda-lab.html');
   assert.equal(await page.locator('#examples option').count(),P.examples.length+1);await page.locator('#examples').selectOption(String(P.examples.findIndex(e=>e.name.includes('迭代计算'))));assert.ok(await page.locator('#example-info').isVisible());assert.ok(await page.locator('#diagram-mount line').count()>0);await context.close();
  });
  assert.deepEqual(errors,[]);console.log(`Advanced examples: ${passed} passed, 0 failed; Chromium ${browser.version()}; page errors 0.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
