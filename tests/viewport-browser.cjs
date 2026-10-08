const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await pw.chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1080}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let count=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS V${++count} ${name}`);};
  const source=async(text)=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();};
  const world=()=>page.evaluate(()=>{const v=document.getElementById('diagram-viewport'),s=document.querySelector('#diagram-mount svg'),b=v.getBoundingClientRect(),r=s.getBoundingClientRect(),scale=Number(s.getAttribute('width'))/Number(s.getAttribute('viewBox').split(' ')[2]);return {x:(b.left+v.clientWidth/2-r.left)/scale,y:(b.top+v.clientHeight/2-r.top)/scale,scrollX:v.scrollLeft,scrollY:v.scrollTop};});
  const center=async()=>{await page.locator('#diagram-viewport').scrollIntoViewIfNeeded();const b=await page.locator('#diagram-viewport').boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
  try{
    await page.goto(base);
    await check('100 percent immediately reveals full-size internal wires',async()=>{await source('20');await page.locator('#actual-size').click();assert.equal(await page.locator('#zoom-label').textContent(),'100%');assert.equal(await page.locator('#fit').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#diagram-mount [data-kind="variable"]').count(),21);});
    await check('wheel zoom preserves content under pointer',async()=>{const c=await center(),before=await world();await page.mouse.move(c.x,c.y);await page.mouse.wheel(0,-400);await page.waitForFunction(()=>document.getElementById('zoom-label').textContent!=='100%');const after=await world();assert.ok(Math.abs(before.x-after.x)<2);assert.ok(Math.abs(before.y-after.y)<2);});
    await check('mouse drag pans enlarged diagram',async()=>{const c=await center(),before=await world();await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x-80,c.y-60,{steps:5});await page.mouse.up();const after=await world();assert.ok(after.scrollX>before.scrollX+50);assert.ok(after.scrollY>before.scrollY+30);});
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
    await check('viewport navigation has no script errors',async()=>assert.deepEqual(errors,[]));
    console.log(`Viewport browser checks: ${count} passed, 0 failed.`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
