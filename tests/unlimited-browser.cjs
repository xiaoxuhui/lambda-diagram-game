const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
const Y='λf.(λx.f (x x)) (λx.f (x x))';
const ZERO='λn.n (λx.λt f.f) (λt f.t)';
const PRED='λn f x.n (λg h.h (g f)) (λu.x) (λu.u)';
const MULT='λm n f.m (n f)';
const factorial=`(${Y}) (λr n.(${ZERO}) n 1 ((${MULT}) n (r ((${PRED}) n)))) 3`;
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));
  const browser=await pw.chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));let passed=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS U${++passed} ${name}`);};
  const source=async(s)=>{await page.locator('#expression').fill(s);await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isHidden());};
  const run=async(answer)=>{await page.locator('#speed-ms').fill('1');await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:180000});assert.equal(await page.locator('#decoded').textContent(),`Church 数 ${answer}`);};
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await check('3! completes all 646 steps, keeps every history frame and reloads',async()=>{
      await source(factorial);await run(6);assert.equal(await page.locator('#step-count').textContent(),'646');
      assert.equal(await page.locator('#history-list li').count(),647);
      await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#step-count').textContent(),'646');assert.equal(await page.locator('#decoded').textContent(),'Church 数 6');
      await page.locator('#back').click();assert.equal(await page.locator('#step-count').textContent(),'645');await page.locator('#step').click();assert.equal(await page.locator('#decoded').textContent(),'Church 数 6');
    });
    await check('2^10 completes all 2048 steps, renders every one of 4099 lines',async()=>{
      await source('(λb e.e b) 2 10');await run(1024);
      assert.equal(await page.locator('#step-count').textContent(),'2048');assert.equal(await page.locator('#history-list li').count(),2049);
      assert.equal(await page.locator('#diagram-mount line').count(),4099);
      assert.equal(await page.locator('#diagram-mount [data-kind="variable"]').count(),1025);
      await page.locator('#actual-size').click();assert.equal(await page.locator('#zoom-label').textContent(),'100%');
      fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('.diagram-card').screenshot({path:path.join(__dirname,'artifacts','unlimited-power.png')});
      await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#decoded').textContent(),'Church 数 1024');assert.equal(await page.locator('#history-list li').count(),2049);
    });
    await check('repeated states continue past 200 and manual pause freezes the count',async()=>{
      await source('(λx.x x) (λx.x x)');await page.locator('#speed-ms').fill('1');await page.locator('#run').click();
      await page.waitForFunction(()=>Number(document.getElementById('step-count').textContent)>205,null,{timeout:15000});assert.equal(await page.locator('#run-label').textContent(),'暂停');
      await page.locator('#run').click();const n=await page.locator('#step-count').textContent();await page.waitForTimeout(100);assert.equal(await page.locator('#step-count').textContent(),n);
    });
    await check('browser JavaScript stays error free',async()=>assert.deepEqual(errors,[]));
    console.log(`Unlimited browser checks: ${passed} passed, 0 failed.`);
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
