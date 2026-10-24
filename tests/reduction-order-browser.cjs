const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await pw.chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:1000},hasTouch:true,acceptDownloads:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let count=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS O${++count} ${name}`);};
  const source=async(p,text)=>{await p.locator('#number-encoding').selectOption('church');await p.locator('#expression').fill(text);await p.locator('#convert').click();};
  const current=p=>p.locator('#current-expression').textContent();
  const order=(p,value)=>p.locator('#reduction-order').selectOption(value);
  const nested='(λx.x) ((λy.y) z)',divergent='(λx.y) ((λz.z z) (λz.z z))';
  try{
    await page.goto(base);
    await check('default normal order and applicative order highlight and contract their own next redex',async()=>{
      assert.equal(await page.locator('#reduction-order').inputValue(),'normal');await source(page,nested);
      assert.match(await page.locator('#diagram-mount [data-active][data-kind="abstraction"] title').textContent(),/λx/);await page.locator('#step').click();assert.equal(await current(page),'(λy.y) z');
      await source(page,nested);await order(page,'applicative');assert.match(await page.locator('#diagram-mount [data-active][data-kind="abstraction"] title').textContent(),/λy/);
      assert.match(await page.locator('#next-explanation').textContent(),/自由出现的 y/);await page.locator('#step').click();assert.equal(await current(page),'(λx.x) z');
    });
    await check('applicative order reduces function-body then argument then outer application',async()=>{
      await source(page,'(λx.(λa.a) x) ((λy.y) z)');await order(page,'applicative');await page.locator('#step').click();assert.equal(await current(page),nested);
      await page.locator('#step').click();assert.equal(await current(page),'(λx.x) z');await page.locator('#step').click();assert.equal(await current(page),'z');
    });
    await check('normal discards unused divergence while applicative execution continues until manually paused',async()=>{
      await source(page,divergent);await order(page,'normal');await page.locator('#step').click();assert.equal(await current(page),'y');
      await source(page,divergent);await order(page,'applicative');const before=await current(page);await page.locator('#speed-ms').fill('10');await page.locator('#run').click();
      await page.waitForFunction(()=>Number(document.getElementById('step-count').textContent)>=3);assert.equal(await page.locator('#run-label').textContent(),'暂停');await page.locator('#run').click();assert.equal(await current(page),before);
    });
    await check('changing order during running retains execution and changes the pending next step',async()=>{
      await source(page,nested);await order(page,'normal');await page.locator('#speed-ms').fill('60000');await page.locator('#run').click();await order(page,'applicative');
      assert.equal(await page.locator('#run-label').textContent(),'暂停');assert.equal(await page.locator('#step-count').textContent(),'0');await page.locator('#speed-ms').fill('60');
      await page.waitForFunction(()=>Number(document.getElementById('step-count').textContent)>=1);if(await page.locator('#run-label').textContent()==='暂停')await page.locator('#run').click();
      assert.equal(await page.locator('#history-list li').nth(1).locator('code').textContent(),'(λx.x) z');
    });
    await check('applicative preference and mixed-order history survive reload, manual save, import and undo',async()=>{
      await source(page,nested);await order(page,'applicative');await page.locator('#step').click();await page.locator('#save-state').click();await page.reload();
      assert.equal(await page.locator('#reduction-order').inputValue(),'applicative');assert.equal(await current(page),'(λx.x) z');
      await order(page,'normal');await page.locator('#step').click();await page.locator('#save-state').click();
      const event=page.waitForEvent('download');await page.locator('#export-state').click();const file=await (await event).path(),saved=JSON.parse(fs.readFileSync(file,'utf8'));
      assert.deepEqual(saved.session.paths,[['arg'],null]);assert.equal(saved.version,3);await source(page,'λq.q');await order(page,'applicative');await page.locator('#restore-state').click();assert.equal(await current(page),'z');assert.equal(await page.locator('#reduction-order').inputValue(),'normal');
      await source(page,'λq.q');await page.locator('#import-file').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('current-expression').textContent==='z');await page.locator('#back').click();assert.equal(await current(page),'(λx.x) z');await page.locator('#back').click();assert.equal(await current(page),nested);
    });
    await check('clear resets order, backup restores it, and legacy saves default to normal',async()=>{
      await source(page,nested);await order(page,'applicative');await page.locator('#step').click();await page.locator('#save-state').click();const event=page.waitForEvent('download');await page.locator('#clear-all').click();const file=await (await event).path();
      assert.equal(await page.locator('#reduction-order').inputValue(),'normal');await page.locator('#import-file').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('current-expression').textContent==='(λx.x) z');assert.equal(await page.locator('#reduction-order').inputValue(),'applicative');
      const legacy=JSON.parse(fs.readFileSync(file,'utf8'));delete legacy.view.strategy;delete legacy.session.paths;legacy.version=2;legacy.session.steps=0;
      await page.locator('#import-file').setInputFiles({name:'old-order.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await page.waitForFunction(()=>document.getElementById('reduction-order').value==='normal');assert.equal(await current(page),nested);
    });
    await check('manual top-bar selection can override the automatic order',async()=>{
      await source(page,divergent);await order(page,'applicative');await page.locator('[data-redex-hit][aria-label^="点击 λx "]').click();assert.equal(await current(page),'y');
      assert.equal(await page.locator('#reduction-order').inputValue(),'applicative');assert.equal(await page.locator('#step-count').textContent(),'1');
    });
    await check('mobile selector fits and offline HTML uses the same applicative behavior',async()=>{
      const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
      await source(p,nested);await order(p,'applicative');await p.locator('#step').tap();assert.equal(await current(p),'(λx.x) z');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await p.locator('.execution-card').screenshot({path:path.join(__dirname,'artifacts','reduction-order-mobile.png')});await mobile.close();
      const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));await offline.goto(pathToFileURL(path.resolve(__dirname,'../dist/lambda-lab.html')).href);await source(offline,nested);await order(offline,'applicative');await offline.locator('#step').click();assert.equal(await current(offline),'(λx.x) z');await offline.close();
    });
    const direction=(p,value)=>p.locator('#reduction-direction').selectOption(value),siblings='(λa.a) u ((λb.b) v)';
    await check('both strategies select rightmost highlights and explanations without reversing the diagram',async()=>{
      assert.equal(await page.locator('#reduction-direction').inputValue(),'left');
      for(const strategy of ['normal','applicative']){
        await source(page,siblings);await order(page,strategy);await direction(page,'right');
        assert.match(await page.locator('#diagram-mount [data-active][data-kind="abstraction"] title').textContent(),/λb/);
        assert.match(await page.locator('#next-explanation').textContent(),/自由出现的 b/);assert.match(await page.locator('#strategy-hint').textContent(),/右侧/);
        await page.locator('#step').click();assert.equal(await current(page),'(λa.a) u v');
      }
      await source(page,'(λx.(λa.a) x) ((λb.b) z)');await order(page,'normal');await page.locator('#step').click();assert.equal(await current(page),'(λa.a) ((λb.b) z)');
      await source(page,'(λx.(λa.a) x) ((λb.b) z)');await order(page,'applicative');await page.locator('#step').click();assert.equal(await current(page),'(λx.(λa.a) x) z');
    });
    await check('changing direction while running preserves history and changes the pending step',async()=>{
      await source(page,siblings);await order(page,'normal');await direction(page,'left');await page.locator('#speed-ms').fill('60000');await page.locator('#run').click();await direction(page,'right');
      assert.equal(await page.locator('#run-label').textContent(),'暂停');assert.equal(await page.locator('#step-count').textContent(),'0');await page.locator('#speed-ms').fill('60');
      await page.waitForFunction(()=>Number(document.getElementById('step-count').textContent)>=1);if(await page.locator('#run-label').textContent()==='暂停')await page.locator('#run').click();
      assert.equal(await page.locator('#history-list li').nth(1).locator('code').textContent(),'(λa.a) u v');
    });
    await check('direction and mixed history survive refresh checkpoints backup import undo and legacy reset',async()=>{
      await source(page,siblings);await order(page,'normal');await direction(page,'right');await page.locator('#step').click();await page.locator('#save-state').click();await page.reload();
      assert.equal(await page.locator('#reduction-direction').inputValue(),'right');assert.equal(await current(page),'(λa.a) u v');
      await direction(page,'left');await page.locator('#step').click();await page.locator('#save-state').click();await source(page,'λq.q');await direction(page,'right');await page.locator('#restore-state').click();
      assert.equal(await page.locator('#reduction-direction').inputValue(),'left');assert.equal(await current(page),'u v');await direction(page,'right');
      const event=page.waitForEvent('download');await page.locator('#clear-all').click();const file=await (await event).path(),saved=JSON.parse(fs.readFileSync(file,'utf8'));
      assert.equal(saved.view.direction,'right');assert.deepEqual(saved.session.paths,[['arg'],null]);assert.equal(await page.locator('#reduction-direction').inputValue(),'left');
      await page.locator('#import-file').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('current-expression').textContent==='u v');assert.equal(await page.locator('#reduction-direction').inputValue(),'right');
      await page.locator('#back').click();assert.equal(await current(page),'(λa.a) u v');await page.locator('#back').click();assert.equal(await current(page),siblings);
      delete saved.view.direction;delete saved.session.paths;saved.version=2;saved.session.steps=1;
      await page.locator('#import-file').setInputFiles({name:'legacy-direction.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
      await page.waitForFunction(()=>document.getElementById('reduction-direction').value==='left');assert.equal(await current(page),'u ((λb.b) v)');
    });
    await check('right direction works on mobile offline and manual selection overrides it',async()=>{
      await source(page,siblings);await direction(page,'right');await page.locator('[data-redex-hit][aria-label^="点击 λa "]').click();assert.equal(await current(page),'u ((λb.b) v)');
      const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
      await source(p,siblings);await direction(p,'right');await p.locator('#step').tap();assert.equal(await current(p),'(λa.a) u v');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.locator('.execution-card').screenshot({path:path.join(__dirname,'artifacts','reduction-direction-mobile.png')});await mobile.close();
      const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));await offline.goto(pathToFileURL(path.resolve(__dirname,'../dist/lambda-lab.html')).href);
      await source(offline,siblings);await direction(offline,'right');await order(offline,'applicative');await offline.locator('#step').click();assert.equal(await current(offline),'(λa.a) u v');await offline.close();
    });
    await check('order and direction selection produce no page errors',async()=>assert.deepEqual(errors,[]));
    console.log(`Reduction order browser checks: ${count} passed, 0 failed.`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
