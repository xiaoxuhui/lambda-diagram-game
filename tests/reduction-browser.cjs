const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage(),errors=[];let count=0;
  page.on('pageerror',error=>errors.push(error.message));
  const check=async(name,run)=>{await run();console.log(`PASS R${++count} ${name}`);};
  const source=async(text)=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();};
  const probe=async()=>page.evaluate(()=>{window.attempts=[];const step=LambdaCore.step;LambdaCore.step=term=>{const result=step(term);attempts.push(result!==null);return result;};});
  const runToStop=async()=>{await page.locator('#speed').selectOption('10');await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('run-label').textContent==='运行');};
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/`);await probe();
    await check('single-step tries and reduces inside a lambda body',async()=>{
      await source('λz.(λx.x) z');await page.locator('#step').click();assert.equal(await page.locator('#current-expression').textContent(),'λz.z');assert.equal(await page.locator('#step-count').textContent(),'1');
    });
    await check('neutral outer application runs a nested argument to normal form',async()=>{
      await source('f ((λx.x) ((λy.y) z))');await page.evaluate(()=>attempts=[]);await runToStop();
      assert.equal(await page.locator('#current-expression').textContent(),'f z');assert.equal(await page.locator('#step-count').textContent(),'2');assert.deepEqual(await page.evaluate(()=>attempts),[true,true,false]);
    });
    await check('function side is tried before nested argument then both complete',async()=>{
      await source('((λx.x) f) ((λy.y) z)');await page.locator('#step').click();assert.equal(await page.locator('#current-expression').textContent(),'f ((λy.y) z)');
      await page.locator('#step').click();assert.equal(await page.locator('#current-expression').textContent(),'f z');assert.equal(await page.locator('#step-count').textContent(),'2');
    });
    await check('multiple nested lambda bodies and neutral arguments are reduced automatically',async()=>{
      await source('λa.λb.f ((λx.x) b)');await runToStop();assert.equal(await page.locator('#current-expression').textContent(),'λa.λb.f b');assert.equal(await page.locator('#step-count').textContent(),'1');
    });
    await check('outer normal-order redex discards an unused divergent argument',async()=>{
      await source('(λx.y) ((λz.z z) (λz.z z))');await runToStop();assert.equal(await page.locator('#current-expression').textContent(),'y');assert.equal(await page.locator('#step-count').textContent(),'1');
    });
    await check('normal forms allow actual single-step and run attempts without invented history',async()=>{
      await source('λx.x');await page.evaluate(()=>attempts=[]);assert.ok(await page.locator('#step').isEnabled());await page.locator('#step').click();
      assert.deepEqual(await page.evaluate(()=>attempts),[false]);assert.equal(await page.locator('#step-count').textContent(),'0');assert.equal(await page.locator('#history-list li').count(),1);
      await runToStop();assert.deepEqual(await page.evaluate(()=>attempts),[false,false]);assert.equal(await page.locator('#current-expression').textContent(),'λx.x');assert.equal(await page.locator('#state-badge').textContent(),'已到正规形');
    });
    await check('dirty or invalid expressions remain blocked until conversion succeeds',async()=>{
      await page.locator('#expression').fill('λx.');assert.ok(await page.locator('#step').isDisabled());assert.ok(await page.locator('#run').isDisabled());
      await page.locator('#convert').click();assert.ok(await page.locator('#step').isDisabled());assert.ok(await page.locator('#run').isDisabled());
    });
    await check('offline entry also reduces nested bodies and allows normal-form attempts',async()=>{
      const offline=await context.newPage();offline.on('pageerror',error=>errors.push(error.message));await offline.goto(pathToFileURL(path.resolve(__dirname,'../dist/lambda-lab.html')).href);
      await offline.locator('#expression').fill('λz.f ((λx.x) z)');await offline.locator('#convert').click();await offline.locator('#step').click();
      assert.equal(await offline.locator('#current-expression').textContent(),'λz.f z');await offline.locator('#step').click();assert.equal(await offline.locator('#step-count').textContent(),'1');await offline.close();
    });
    await check('nested reduction flows have no browser errors',async()=>assert.deepEqual(errors,[]));
    console.log(`Reduction browser checks: ${count} passed, 0 failed.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
