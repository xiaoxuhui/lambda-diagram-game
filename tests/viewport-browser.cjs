const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await pw.chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let count=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS V${++count} ${name}`);};
  const source=async(text)=>{await page.locator('#number-encoding').selectOption('church');await page.locator('#expression').fill(text);await page.locator('#convert').click();};
  const world=()=>page.evaluate(()=>{const v=document.getElementById('diagram-viewport'),s=document.querySelector('#diagram-mount svg'),b=v.getBoundingClientRect(),r=s.getBoundingClientRect(),scale=Number(s.getAttribute('width'))/Number(s.getAttribute('viewBox').split(' ')[2]);return {x:(b.left+v.clientWidth/2-r.left)/scale,y:(b.top+v.clientHeight/2-r.top)/scale,scrollX:v.scrollLeft,scrollY:v.scrollTop};});
  const center=async()=>{await page.locator('#diagram-viewport').scrollIntoViewIfNeeded();const b=await page.locator('#diagram-viewport').boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
  try{
    await page.goto(base);
    await check('100 percent immediately reveals full-size internal wires',async()=>{await source('20');await page.locator('#actual-size').click();assert.equal(await page.locator('#zoom-label').textContent(),'100%');assert.equal(await page.locator('#fit').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#diagram-mount [data-kind="variable"]').count(),21);});
    await check('wheel zoom preserves content under pointer',async()=>{const c=await center(),before=await world();await page.mouse.move(c.x,c.y);await page.mouse.wheel(0,-400);await page.waitForFunction(()=>document.getElementById('zoom-label').textContent!=='100%');const after=await world();assert.ok(Math.abs(before.x-after.x)<2);assert.ok(Math.abs(before.y-after.y)<2);});
    await check('mouse drag pans enlarged diagram',async()=>{const c=await center(),before=await world();await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x-80,c.y-60,{steps:5});await page.mouse.up();const after=await world();assert.ok(after.scrollX>before.scrollX+50);assert.ok(after.scrollY>before.scrollY+30);});
    await check('up to twenty pixels of accumulated mouse jitter never pans; crossing the threshold starts dragging',async()=>{
      const c=await center(),before=await world();await page.mouse.move(c.x,c.y);await page.mouse.down();
      for(const offset of [2,10,19,20]){await page.mouse.move(c.x-offset,c.y);const after=await world();assert.equal(after.scrollX,before.scrollX);assert.equal(after.scrollY,before.scrollY);}
      await page.mouse.move(c.x-21,c.y);const moved=await world();assert.ok(moved.scrollX>=before.scrollX+20);
      await page.mouse.move(c.x-22,c.y);assert.ok((await world()).scrollX>moved.scrollX);await page.mouse.up();
    });
    await check('manual zoom reaches 1600 percent and retains pan on save restore',async()=>{for(let i=0;i<10;i++)await page.locator('#zoom-in').click();assert.equal(await page.locator('#zoom-label').textContent(),'1600%');const before=await world();await page.locator('#save-state').click();await page.locator('#fit').click();await page.locator('#restore-state').click();const after=await world();assert.equal(await page.locator('#zoom-label').textContent(),'1600%');assert.ok(Math.abs(before.scrollX-after.scrollX)<2);assert.ok(Math.abs(before.scrollY-after.scrollY)<2);await page.reload();assert.equal(await page.locator('#zoom-label').textContent(),'1600%');});
    await check('wheel zoom during automatic reduction remains fixed on later steps',async()=>{await source('(λm n f x.m f (n f x)) 20 20');await page.locator('#speed-ms').fill('400');await page.locator('#actual-size').click();await page.locator('#run').click();const c=await center();await page.mouse.move(c.x,c.y);await page.mouse.wheel(0,-200);await page.waitForFunction(()=>document.getElementById('zoom-label').textContent!=='100%');const zoom=await page.locator('#zoom-label').textContent();assert.equal(await page.locator('#run-label').textContent(),'暂停');await page.waitForFunction(()=>Number(document.getElementById('step-count').textContent)>=2);assert.equal(await page.locator('#zoom-label').textContent(),zoom);await page.locator('#run').click();});
    await check('keyboard zoom and fit reset work',async()=>{await page.locator('#diagram-viewport').focus();await page.locator('#diagram-viewport').press('0');assert.equal(await page.locator('#zoom-label').textContent(),'100%');await page.locator('#diagram-viewport').press('+');assert.equal(await page.locator('#zoom-label').textContent(),'125%');await page.locator('#fit').click();assert.equal(await page.locator('#fit').getAttribute('aria-pressed'),'true');});
    await check('real mobile pinch enlarges the diagram',async()=>{
      const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await mobileContext.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('#expression').fill('20');await p.locator('#convert').click();await p.locator('#actual-size').tap();await p.locator('#diagram-viewport').scrollIntoViewIfNeeded();
      const b=await p.locator('#diagram-viewport').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;const cdp=await mobileContext.newCDPSession(p);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-40,y,id:1},{x:x+40,y,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-75,y,id:1},{x:x+75,y,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await p.waitForFunction(()=>parseInt(document.getElementById('zoom-label').textContent)>100);
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await p.screenshot({path:path.join(__dirname,'artifacts','viewport-mobile.png'),fullPage:true});await mobileContext.close();
    });
    await check('offline build has working zoom navigation',async()=>{const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.resolve(__dirname,'../dist/lambda-lab.html')).href);await p.locator('#actual-size').click();await p.locator('#zoom-in').click();assert.equal(await p.locator('#zoom-label').textContent(),'125%');await p.close();});
    await check('animated zoom accumulates clicks and a step animates individual wires',async()=>{
      await page.emulateMedia({reducedMotion:'no-preference'});await source('(λx.x) 20');
      await page.locator('#actual-size').click();
      await page.waitForFunction(()=>document.querySelector('#zoom-label').textContent==='100%');
      const before=await world();
      const widths=await page.evaluate(async()=>{
        const svg=document.querySelector('#diagram-mount svg'),width=()=>Number(svg.getAttribute('width'));
        const start=width();document.querySelector('#zoom-in').click();document.querySelector('#zoom-in').click();
        return [start,await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(width()))))];
      });
      await page.waitForFunction(()=>document.querySelector('#zoom-label').textContent==='156%');
      const end=Number(await page.locator('#diagram-mount svg').getAttribute('width'));
      assert.ok(widths[0]<widths[1]&&widths[1]<end);
      const after=await world();assert.ok(Math.abs(before.x-after.x)<2&&Math.abs(before.y-after.y)<2);
      const animating=await page.evaluate(()=>{document.querySelector('#step').click();return !!document.querySelector('.diagram-wire-motion canvas');});
      assert.equal(animating,true);assert.equal(await page.locator('#step-count').textContent(),'1');
      await page.locator('.diagram-wire-motion').waitFor({state:'detached'});
    });
    await check('undo reverses line motion for duplicated, moved and discarded arguments',async()=>{
      for(const expression of ['(λx.x x) (λy.y)','(λx.x) (λy.y)','(λx.z) (λy.y)']){
        await source(expression);
        const original=await page.locator('#current-expression').textContent();
        const wireCount=await page.locator('#diagram-mount line').count();
        await page.locator('#step').click();
        await page.locator('.diagram-wire-motion').waitFor({state:'detached'});
        const animated=await page.evaluate(()=>{
          document.querySelector('#back').click();
          return !!document.querySelector('.diagram-wire-motion canvas');
        });
        assert.equal(animated,true);
        assert.equal(await page.locator('#current-expression').textContent(),original);
        assert.equal(await page.locator('#step-count').textContent(),'0');
        assert.equal(await page.locator('#diagram-mount line').count(),wireCount);
        await page.locator('.diagram-wire-motion').waitFor({state:'detached'});
        assert.equal(await page.locator('#diagram-mount svg').evaluate(svg=>getComputedStyle(svg).opacity),'1');
      }
      await source('(λx.x x) (λy.y)');
      assert.equal(await page.evaluate(async()=>{
        document.querySelector('#step').click();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        document.querySelector('#back').click();
        return document.querySelectorAll('.diagram-wire-motion canvas').length;
      }),1);
      await page.locator('.diagram-wire-motion').waitFor({state:'detached'});
      assert.equal(await page.locator('#step-count').textContent(),'0');
    });
    await check('normal, extreme and fast runs animate and preserve every step',async()=>{
      for(const [button,speed] of [['run','600'],['run','10'],['fast-run','10']]){
        await source('(λx.x) ((λy.y) ((λz.z) a))');
        await page.locator('#speed-ms').fill(speed);
        const seen=await page.evaluate(id=>new Promise((resolve,reject)=>{
          const viewport=document.querySelector('#diagram-viewport');
          const timer=setTimeout(()=>{observer.disconnect();reject(Error('No outgoing frame'));},1500);
          const observer=new MutationObserver(()=>{
            const old=viewport.querySelector('.diagram-wire-motion,.diagram-previous');
            if(!old)return;
            clearTimeout(timer);observer.disconnect();
            resolve({canvas:!!old.querySelector('canvas'),hit:old.querySelector('[data-redex-hit]')!==null,
              outgoing:old.getAnimations().length});
          });
          observer.observe(viewport,{childList:true});
          document.getElementById(id).click();
        }),button);
        assert.equal(seen.hit,false);
        if(speed==='600')assert.equal(seen.canvas,true);else assert.equal(seen.canvas||seen.outgoing===1,true);
        await page.waitForFunction(()=>document.querySelector('#step-count').textContent==='3');
        assert.equal(await page.locator('#current-expression').textContent(),'a');
        assert.equal(await page.locator('#history-list li').count(),4);
        await page.locator('.diagram-wire-motion,.diagram-previous').waitFor({state:'detached'});
      }
      await page.emulateMedia({reducedMotion:'reduce'});
      await source('(λx.x) a');
      await page.locator('#fast-run').click();
      await page.waitForFunction(()=>document.querySelector('#step-count').textContent==='1');
      assert.equal(await page.locator('.diagram-wire-motion,.diagram-previous').count(),0);
    });
    await check('RGB, HSV and CMYK update the live palette and persist with the scene',async()=>{
      await page.setViewportSize({width:390,height:844});
      await source('(λx.x) y z');
      const summary=page.locator('#diagram-palette summary'),channels=page.locator('#palette-channels input');
      const set=async(target,mode,values)=>{
        await page.locator('#palette-target').selectOption(target);
        await page.locator('#palette-mode').selectOption(mode);
        for(let i=0;i<values.length;i++)await channels.nth(i).fill(String(values[i]));
      };
      const stroke=(selector,color)=>page.waitForFunction(([selector,color])=>document.querySelector(`#diagram-mount ${selector}`)?.getAttribute('stroke')===color,[selector,color]);
      await summary.click();
      await set('0','RGB',[250,20,30]);await stroke('[data-kind="variable"]:not([stroke-dasharray])','#fa141e');
      await channels.first().fill('256');await stroke('[data-kind="variable"]:not([stroke-dasharray])','#fa141e');
      await set('highlight','HSV',[120,100,100]);await stroke('[data-active]','#00ff00');
      await set('free','CMYK',[100,0,0,0]);await stroke('[data-kind="variable"][stroke-dasharray]','#00ffff');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.evaluate(()=>{window.LambdaAndroid={saveFile(name,content){window.exported=content;}};});
      await page.locator('#export-svg').click();
      const svg=await page.evaluate(()=>window.exported);
      assert.match(svg,/stroke="#fa141e"/);assert.match(svg,/stroke="#00ffff"/);
      await page.locator('#save-state').click();await page.reload();
      await stroke('[data-active]','#00ff00');await stroke('[data-kind="variable"][stroke-dasharray]','#00ffff');
      await summary.click();await page.locator('#palette-reset').click();
      await stroke('[data-active]','#ff91b7');await stroke('[data-kind="variable"][stroke-dasharray]','#aeb9ce');
      await page.locator('#restore-state').click();await stroke('[data-active]','#00ff00');
    });
    await check('viewport navigation has no script errors',async()=>assert.deepEqual(errors,[]));
    console.log(`Viewport browser checks: ${count} passed, 0 failed.`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
