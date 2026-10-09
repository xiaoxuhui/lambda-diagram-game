const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1080},hasTouch:true}),page=await context.newPage(),errors=[];let count=0;
  page.on('pageerror',e=>errors.push(e.message));
  const check=async(name,run)=>{await run();console.log(`PASS P${++count} ${name}`);};
  const source=async(text)=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();};
  async function assertDiagram(p){
    assert.equal(await p.evaluate(()=>{
      const t=LambdaCore.parse(document.getElementById('current-expression').textContent,Infinity),expected=LambdaDiagram.layout(t,LambdaCore.findRedex(t)?.path??null);
      const actual=[...document.querySelectorAll('#diagram-mount line')];
      return actual.length===expected.lines.length&&expected.lines.every((line,i)=>{
        const el=actual[i];return ['x1','x2','y1','y2'].every(key=>Number(el.getAttribute(key))===line[key])&&el.getAttribute('stroke')===(line.active?'#ff91b7':line.color)&&el.getAttribute('data-kind')===line.kind&&el.querySelector('title').textContent===LambdaDiagram.lineTitle(line);
      });
    }),true);
  }
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await check('large expression keeps every wire and text occurrence after a sparse step',async()=>{
      await source('g 1800 ((λx.x) y)');await page.evaluate(()=>{window.originalSvg=document.querySelector('#diagram-mount svg');window.originalLine=document.querySelector('#diagram-mount line');});
      await page.locator('#step').click();assert.equal(await page.locator('#diagram-mount line').count(),7211);
      assert.equal((await page.locator('#current-expression').textContent()).match(/\bf\b/g).length,1801);assert.equal(await page.locator('#history-list li').count(),2);
      assert.equal(await page.evaluate(()=>originalSvg===document.querySelector('#diagram-mount svg')&&originalLine===document.querySelector('#diagram-mount line')),true);
      await assertDiagram(page);
    });
    await check('normal attempts and mode refresh reuse all unchanged SVG and history nodes',async()=>{
      await page.evaluate(()=>{window.historyNode=document.querySelector('#history-list li');window.mutations=[];window.observer=new MutationObserver(entries=>mutations.push(...entries));observer.observe(document.getElementById('diagram-mount'),{childList:true,subtree:true});});
      await page.locator('#step').click();await page.locator('#mode-free').click();await page.waitForTimeout(10);
      assert.equal(await page.evaluate(()=>originalSvg===document.querySelector('#diagram-mount svg')&&historyNode===document.querySelector('#history-list li')&&mutations.length===0),true);
      await page.evaluate(()=>observer.disconnect());
    });
    await check('back and repeat preserve full history and exactly reproduce geometry',async()=>{
      await page.locator('#back').click();assert.equal(await page.locator('#step-count').textContent(),'0');assert.equal(await page.locator('#history-list li').count(),1);await assertDiagram(page);
      await page.locator('#step').click();assert.equal(await page.locator('#history-list li').count(),2);await assertDiagram(page);
    });
    await check('incremental rendering handles changed binders, free labels, active paths and capture avoidance',async()=>{
      for(const text of ['(λx.λy.x) y','λz.f ((λx.x) z)','(λx.x x) (λa.a)','(λx.x) (λy.y)']){
        await source(text);await assertDiagram(page);await page.locator('#step').click();await assertDiagram(page);
      }
    });
    await check('dirty highlights and subsequent conversion remain correct',async()=>{
      await source('f ((λx.x) y)');assert.equal(await page.locator('#diagram-mount [data-active]').count(),2);
      await page.locator('#expression').fill('λz.z');assert.equal(await page.locator('#diagram-mount [data-active]').count(),0);
      await page.locator('#convert').click();await assertDiagram(page);
    });
    await check('automatic running, zoom, export and restore retain complete structure on mobile',async()=>{
      await page.setViewportSize({width:390,height:844});await source('f ((λx.x) ((λy.y) z))');await page.locator('#speed').selectOption('10');await page.locator('#run').tap();
      await page.waitForFunction(()=>document.getElementById('run-label').textContent==='运行');assert.equal(await page.locator('#current-expression').textContent(),'f z');
      await page.locator('#zoom-in').tap();await page.locator('#save-state').tap();await source('λq.q');await page.locator('#restore-state').tap();await assertDiagram(page);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.evaluate(()=>{window.LambdaAndroid={saveFile(name,content,mime){window.exported={name,content,mime};}};});await page.locator('#export-svg').tap();
      const exported=await page.evaluate(()=>window.exported);assert.equal((exported.content.match(/<line /g)||[]).length,await page.locator('#diagram-mount line').count());
    });
    await check('offline entry uses the same optimized renderer and exact diagram',async()=>{
      const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));await offline.goto(pathToFileURL(path.resolve(__dirname,'../dist/lambda-lab.html')).href);
      await offline.locator('#expression').fill('g 900 ((λx.x) y)');await offline.locator('#convert').click();await offline.locator('#step').click();assert.equal(await offline.locator('#diagram-mount line').count(),3611);await assertDiagram(offline);await offline.close();
    });
    await check('optimized flows have no browser errors',async()=>assert.deepEqual(errors,[]));
    console.log(`Performance browser checks: ${count} passed, 0 failed.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
