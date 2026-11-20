const assert=require('node:assert/strict'),path=require('node:path'),C=require('../src/core.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
 if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
 const browser=await pw.chromium.launch(),errors=[];
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}`);
   await page.locator('#number-encoding').selectOption('church');await page.locator('#unfold-functions').check();
   await page.locator('#function-name').fill('fn');await page.locator('#function-source').fill('λx.x x');await page.locator('#function-add').click();await page.waitForSelector('.function-item[data-name="fn"]');
   await page.locator('#expression').fill('keep (fn arg)');await page.locator('#convert').click();
   await page.evaluate(()=>{
    let id=0;const frames=new Map();
    window.requestAnimationFrame=callback=>{frames.set(++id,callback);return id;};window.cancelAnimationFrame=key=>frames.delete(key);
    window.tickWires=offset=>{const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(performance.now()+offset);};
   });
   await page.locator('#step').click();
   assert.equal(await page.locator('.diagram-wire-motion canvas').count(),1);assert.equal(await page.locator('.diagram-previous').count(),0);
   assert.equal(await page.locator('#diagram-mount svg').evaluate(svg=>svg.style.opacity),'0');
   const initial=await page.locator('.diagram-wire-motion canvas').evaluate(canvas=>canvas.toDataURL());
   await page.evaluate(()=>tickWires(50));
   const midway=await page.locator('.diagram-wire-motion canvas').evaluate(canvas=>canvas.toDataURL());assert.notEqual(midway,initial,'expanded lines move during the animation');
   await page.locator('#back').click();assert.equal(await page.locator('.diagram-wire-motion canvas').count(),1);
   assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse('keep (fn arg)')));
   await page.evaluate(()=>tickWires(1000));assert.equal(await page.locator('.diagram-wire-motion').count(),0);
   await page.locator('#step').click();await page.evaluate(()=>tickWires(1000));
   assert.equal(await page.locator('.diagram-wire-motion').count(),0);assert.notEqual(await page.locator('#diagram-mount svg').evaluate(svg=>svg.style.opacity),'0');
   await page.locator('#back').click();await page.evaluate(()=>tickWires(1000));
   await page.locator('#speed-ms').fill('600');await page.locator('#run').click();await page.waitForSelector('.diagram-wire-motion canvas');await page.locator('#run').click();await page.evaluate(()=>tickWires(1000));
   assert.equal(await page.locator('.diagram-wire-motion').count(),0);
   console.log('PASS',width+'px: unfolding has moving wire frames, interrupted undo reverses smoothly, normal run animates and cleans up');
   await context.close();
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
