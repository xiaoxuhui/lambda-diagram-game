const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}`,browser=await pw.chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1080},acceptDownloads:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));let count=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS M${++count} ${name}`);};
  const source=async(p,text)=>{await p.locator('#expression').fill(text);await p.locator('#convert').click();};
  const hit=(p,name)=>p.locator(`[data-redex-hit][aria-label^="点击 λ${name} "]`);
  const current=p=>p.locator('#current-expression').textContent();
  const center=async locator=>{await locator.scrollIntoViewIfNeeded();const b=await locator.boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
  try{
    await page.goto(base);
    await check('top lambda bar click contracts once and back/reset keep the full history',async()=>{
      await source(page,'(λx.x) y');assert.equal(await page.locator('[data-redex-hit]').count(),1);
      await hit(page,'x').click();assert.equal(await current(page),'y');assert.equal(await page.locator('#step-count').textContent(),'1');
      await page.locator('#back').click();assert.equal(await current(page),'(λx.x) y');await hit(page,'x').click();await page.locator('#reset').click();assert.equal(await current(page),'(λx.x) y');
    });
    await check('a non-default nested redex can be selected before the outer one',async()=>{
      await source(page,'(λx.x) ((λy.y) z)');await hit(page,'y').click();assert.equal(await current(page),'(λx.x) z');
      await page.locator('#step').click();assert.equal(await current(page),'z');assert.equal(await page.locator('#history-list li').count(),3);
    });
    await check('save/reload/restore/export/import retain the chosen order and undo',async()=>{
      await page.locator('#save-state').click();await page.reload();assert.equal(await current(page),'z');await page.locator('#back').click();assert.equal(await current(page),'(λx.x) z');
      await page.locator('#restore-state').click();assert.equal(await current(page),'z');
      const download=page.waitForEvent('download');await page.locator('#export-state').click();const file=await (await download).path();
      const backup=JSON.parse(fs.readFileSync(file,'utf8'));assert.deepEqual(backup.session.paths,[['arg'],null]);
      await source(page,'λq.q');await page.locator('#import-file').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('current-expression').textContent==='z');
      await page.locator('#back').click();assert.equal(await current(page),'(λx.x) z');await page.locator('#back').click();assert.equal(await current(page),'(λx.x) ((λy.y) z)');
    });
    await check('lambda-body selection preserves free variables during capture avoidance',async()=>{
      await source(page,'λz.f ((λx.λy.x) y)');await hit(page,'x').click();
      assert.equal(await page.evaluate(()=>LambdaCore.equal(LambdaCore.parse(document.getElementById('current-expression').textContent),LambdaCore.parse('λz.f (λq.y)'))),true);
    });
    await check('ordinary bars and dirty expressions do not contract',async()=>{
      await source(page,'λz.(λx.x) z');const bar=await center(page.locator('[data-kind="abstraction"]').last());await page.mouse.click(bar.x,bar.y);assert.equal(await page.locator('#step-count').textContent(),'0');
      await page.locator('#expression').fill('λq.q');assert.equal(await hit(page,'x').getAttribute('aria-disabled'),'true');
      const p=await center(hit(page,'x'));await page.mouse.click(p.x,p.y);assert.equal(await page.locator('#step-count').textContent(),'0');
      await page.locator('#convert').click();assert.equal(await page.locator('[data-redex-hit]').count(),0);
    });
    await check('dragging from a reduction bar pans without reducing',async()=>{
      await source(page,'(λx.x) y');const p=await center(hit(page,'x'));await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+45,p.y+30,{steps:4});await page.mouse.up();
      assert.equal(await page.locator('#step-count').textContent(),'0');
    });
    await check('pointer cancellation never executes a reduction',async()=>{
      const p=await center(hit(page,'x')),cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();
      assert.equal(await page.locator('#step-count').textContent(),'0');
    });
    await check('keyboard Enter and Space activate selectable bars',async()=>{
      await source(page,'(λx.x) ((λy.y) z)');await hit(page,'y').focus();await hit(page,'y').press('Enter');assert.equal(await current(page),'(λx.x) z');
      await hit(page,'x').focus();await hit(page,'x').press(' ');assert.equal(await current(page),'z');
    });
    await check('clicking during automatic running stops the timer then performs one selected step',async()=>{
      await source(page,'(λx.x) ((λy.y) z)');await page.locator('#speed-ms').fill('60000');await page.locator('#run').click();await hit(page,'y').click();
      assert.equal(await current(page),'(λx.x) z');assert.equal(await page.locator('#run-label').textContent(),'运行');assert.equal(await page.locator('#step-count').textContent(),'1');
    });
    await check('a target captured before the diagram changes cannot affect the new frame',async()=>{
      await source(page,'(λx.x) ((λy.y) z)');const p=await center(hit(page,'y'));await page.mouse.move(p.x,p.y);await page.mouse.down();
      await page.evaluate(()=>document.getElementById('step').click());await page.mouse.up();assert.equal(await current(page),'(λy.y) z');assert.equal(await page.locator('#step-count').textContent(),'1');
    });
    await check('mobile taps work after zoom, and a pinch starting on the bar does not contract',async()=>{
      const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
      await source(p,'(λx.x) ((λy.y) z)');await p.locator('#actual-size').tap();await p.locator('#zoom-in').tap();await hit(p,'y').tap();assert.equal(await current(p),'(λx.x) z');
      await source(p,'(λx.x) y');const point=await center(hit(p,'x')),cdp=await mobile.newCDPSession(p);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:1},{x:point.x+45,y:point.y+25,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-15,y:point.y,id:1},{x:point.x+65,y:point.y+25,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await p.locator('#step-count').textContent(),'0');
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await p.screenshot({path:path.join(__dirname,'artifacts','manual-reduction-mobile.png'),fullPage:true});await mobile.close();
    });
    await check('real touch jitter within ten pixels keeps the viewport fixed and reduces once on release',async()=>{
      const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
      await source(p,'(λx.x) 20');await p.locator('#actual-size').tap();await p.locator('#zoom-in').tap();
      const cdp=await mobile.newCDPSession(p);
      await p.evaluate(()=>{const v=document.getElementById('diagram-viewport');v.scrollLeft=20;v.scrollTop=20;});
      const start=await center(hit(p,'x')),position=()=>p.evaluate(()=>{const v=document.getElementById('diagram-viewport');return [v.scrollLeft,v.scrollTop];}),before=await position();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,id:1}]});
      for(const offset of [3,7,10]){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x-offset,y:start.y,id:1}]});assert.deepEqual(await position(),before);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await p.locator('#step-count').textContent(),'1');assert.equal(await p.locator('[data-redex-hit]').count(),0);await mobile.close();
    });
    await check('offline single-file build keeps all diagram lines and manual order',async()=>{
      const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.resolve(__dirname,'../dist/lambda-lab.html')).href);
      await source(p,'g 900 ((λx.x) y)');await hit(p,'x').click();assert.equal(await p.locator('#diagram-mount line').count(),3611);assert.equal(await p.locator('#step-count').textContent(),'1');await p.close();
    });
    await check('click reduction produces no browser errors',async()=>assert.deepEqual(errors,[]));
    console.log(`Manual reduction browser checks: ${count} passed, 0 failed.`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
