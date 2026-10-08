const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let playwright;
try { playwright=require('playwright'); }
catch { playwright=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright')); }
const { chromium }=playwright;
const artifact=path.resolve(__dirname,'artifacts');fs.mkdirSync(artifact,{recursive:true});
process.env.PORT='0';
const server=require('../scripts/serve.cjs');
const C=require('../src/core.js'),P=require('../src/presets.js');

(async()=>{
  if(!server.listening) await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true});
  console.log(`Browser: Chromium ${browser.version()}`);
  const context=await browser.newContext({viewport:{width:1440,height:1080},acceptDownloads:true,hasTouch:true});
  const page=await context.newPage();let passed=0;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const check=async(name,fn)=>{await fn();passed++;console.log(`PASS I${String(passed).padStart(2,'0')} ${name}`);};
  const source=async(s)=>{await page.locator('#expression').fill(s);await page.locator('#convert').click();};
  const normal=async()=>{await page.locator('#speed').selectOption('180');await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');};
  try {
    await page.goto(base);
    await check('initial diagram and next-redex highlight',async()=>{
      assert.equal(await page.locator('#diagram-mount svg').count(),1);
      assert.equal(await page.locator('#diagram-mount [data-active]').count(),2);
      assert.equal(await page.locator('#current-expression').textContent(),'(λx.x) (λy.y)');
    });
    await check('shortcut inserts λ at cursor',async()=>{
      await page.locator('#expression').fill('x.x');
      await page.locator('#expression').evaluate(el=>{el.focus();el.setSelectionRange(0,0);});
      await page.locator('[data-insert="λ"]').click();
      assert.equal(await page.locator('#expression').inputValue(),'λx.x');
      assert.equal(await page.locator('#expression').evaluate(el=>el.selectionStart),1);
    });
    await check('shortcut replaces selection',async()=>{
      await page.locator('#expression').fill('abc');
      await page.locator('#expression').evaluate(el=>{el.focus();el.setSelectionRange(1,2);});
      await page.locator('[data-insert="λ"]').click();
      assert.equal(await page.locator('#expression').inputValue(),'aλc');
    });
    await check('paired brackets wrap selected text',async()=>{
      await page.locator('#expression').fill('λx.x');
      await page.locator('#expression').evaluate(el=>{el.focus();el.setSelectionRange(0,4);});
      await page.locator('#pair-key').click();assert.equal(await page.locator('#expression').inputValue(),'(λx.x)');
      assert.deepEqual(await page.locator('#expression').evaluate(el=>[el.selectionStart,el.selectionEnd]),[1,5]);
    });
    await check('Ctrl+Enter converts without losing editor content',async()=>{
      await page.locator('#expression').fill('λx.x');await page.locator('#expression').press('Control+Enter');
      assert.equal(await page.locator('#current-expression').textContent(),'λx.x');assert.equal(await page.locator('#state-badge').textContent(),'已到正规形');
    });
    await check('step, history, back, and reset remain consistent',async()=>{
      await source('(λx.x)(λy.y)');await page.locator('#step').click();
      assert.equal(await page.locator('#current-expression').textContent(),'λy.y');assert.equal(await page.locator('#step-count').textContent(),'1');
      await page.locator('#history-details summary').click();assert.equal(await page.locator('#history-list li').count(),2);
      await page.locator('#back').click();assert.equal(await page.locator('#step-count').textContent(),'0');
      await page.locator('#step').click();await page.locator('#reset').click();assert.equal(await page.locator('#step-count').textContent(),'0');
    });
    await check('capture avoidance is visible and free wire stays dashed',async()=>{
      await source('(λx.λy.x) y');await page.locator('#step').click();
      assert.equal(await page.locator('#current-expression').textContent(),'λy1.y');
      assert.equal(await page.locator('#diagram-mount [stroke-dasharray]').count(),1);
    });
    await check('automatic run and pause stop the timer',async()=>{
      await source(P.examples[5].term);await page.locator('#speed').selectOption('1200');await page.locator('#run').click();
      assert.equal(await page.locator('#run-label').textContent(),'暂停');
      await page.locator('#run').click();const count=await page.locator('#step-count').textContent();
      await page.waitForTimeout(1300);assert.equal(await page.locator('#step-count').textContent(),count);
    });
    await check('Church arithmetic runs to 5',async()=>{
      await normal();assert.equal(await page.locator('#decoded').textContent(),'Church 数 5');
      assert.ok(await page.locator('#step').isDisabled());
    });
    await check('editing during execution cancels stale timer and controls',async()=>{
      await source(P.examples[5].term);await page.locator('#speed').selectOption('1200');await page.locator('#run').click();
      await page.locator('#expression').fill('λz.z');assert.ok(await page.locator('#step').isDisabled());
      assert.equal(await page.locator('#state-badge').textContent(),'已编辑 · 请转换');await page.waitForTimeout(1300);
      assert.equal(await page.locator('#step-count').textContent(),'0');
    });
    await check('bad input gives location and clears executable state',async()=>{
      await source('λx.');assert.ok(await page.locator('#error-message').isVisible());
      assert.match(await page.locator('#error-message').textContent(),/第 4 个字符/);
      assert.ok(await page.locator('#run').isDisabled());assert.equal(await page.locator('#diagram-mount svg').count(),0);
    });
    await check('input size limit is explained',async()=>{
      await source('x'.repeat(1501));assert.match(await page.locator('#error-message').textContent(),/1500/);
    });
    await check('cycle auto-stops after first repeated state',async()=>{
      await source('(λx.x x)(λx.x x)');await page.locator('#speed').selectOption('180');await page.locator('#run').click();
      await page.waitForFunction(()=>document.getElementById('run-status').textContent.includes('重复'));
      assert.equal(await page.locator('#step-count').textContent(),'1');assert.equal(await page.locator('#run-label').textContent(),'运行');
      assert.ok(await page.locator('#step').isEnabled());
    });
    await check('zoom controls and fit change SVG size',async()=>{
      await source(P.examples[5].term);const w=await page.locator('#diagram-mount svg').getAttribute('width');
      await page.locator('#zoom-in').click();assert.ok(Number(await page.locator('#diagram-mount svg').getAttribute('width'))>Number(w));
      await page.locator('#zoom-out').click();await page.locator('#fit').click();
      assert.equal(await page.locator('#diagram-mount svg').getAttribute('width'),w);
    });
    await check('SVG export is a valid self-contained diagram',async()=>{
      const downloadPromise=page.waitForEvent('download');await page.locator('#export-svg').click();const download=await downloadPromise;
      await download.saveAs(path.join(artifact,'lambda-diagram.svg'));
      const svg=fs.readFileSync(path.join(artifact,'lambda-diagram.svg'),'utf8');assert.match(svg,/xmlns=/);assert.match(svg,/data-kind="abstraction"/);assert.match(svg,/<rect/);
    });
    await check('help and example selector work',async()=>{
      await page.locator('#help-toggle').click();assert.ok(await page.locator('#help-panel').isVisible());await page.locator('#help-toggle').click();
      await page.locator('#examples').selectOption('3');assert.equal(await page.locator('#decoded').textContent(),'Church 数 2');
    });
    await check('challenge requires normal form and hints toggle',async()=>{
      await page.locator('#mode-challenge').click();await page.locator('#check-answer').click();
      assert.match(await page.locator('#challenge-feedback').textContent(),/还有可归约/);
      await page.locator('#hint-toggle').click();assert.ok(await page.locator('#hint').isVisible());
      await page.locator('#hint-toggle').click();assert.ok(await page.locator('#hint').isHidden());
    });
    await check('all five challenge flows complete through real clicks',async()=>{
      for(let i=0;i<5;i++) {
        await page.locator('#level-list button').nth(i).click();await normal();await page.locator('#check-answer').click();
        assert.match(await page.locator('#challenge-feedback').textContent(),/完成/);
      }
      assert.equal(await page.locator('#progress-text').textContent(),'5 / 5 关已完成');
    });
    await check('alpha-equivalent user answer is accepted',async()=>{
      await page.locator('#level-list button').first().click();await source('(λz.z) (λq.q)');await page.locator('#step').click();
      await page.locator('#check-answer').click();assert.match(await page.locator('#challenge-feedback').textContent(),/完成/);
    });
    await check('incorrect normal form is rejected',async()=>{
      await source('λx.λy.x');await page.locator('#check-answer').click();assert.match(await page.locator('#challenge-feedback').textContent(),/还不是/);
    });
    await check('draft and progress survive reload',async()=>{
      await source('λa.a');await page.reload();assert.equal(await page.locator('#expression').inputValue(),'λa.a');
      assert.equal(await page.locator('#progress-text').textContent(),'5 / 5 关已完成');
    });
    await check('desktop has no horizontal overflow and controls are visible',async()=>{
      await page.locator('#mode-free').click();await source(P.examples[5].term);await page.locator('#history-details').evaluate(el=>el.open=false);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(artifact,'desktop.png'),fullPage:true});
    });
    await check('mobile touch input and controls stay within viewport',async()=>{
      await page.setViewportSize({width:390,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      for(const id of ['convert','run','step','back','reset','export-svg']) {const b=await page.locator('#'+id).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=391,id);}
      await page.locator('#expression').fill('x.x');await page.locator('#expression').evaluate(el=>{el.focus();el.setSelectionRange(0,0);});
      await page.locator('[data-insert="λ"]').tap();await page.locator('#convert').tap();assert.equal(await page.locator('#decoded').textContent(),'I · 恒等函数');
      await page.screenshot({path:path.join(artifact,'mobile.png'),fullPage:true});
    });
    await check('mobile challenge layout has no overflow',async()=>{
      await page.locator('#mode-challenge').click();await page.locator('#level-list button').last().click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(artifact,'mobile-challenge.png'),fullPage:true});
    });
    await check('long variable label cannot escape diagram',async()=>{
      await page.locator('#mode-free').click();await source('variable'.repeat(100));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.ok((await page.locator('#diagram-mount text').textContent()).includes('…'));
    });
    await check('offline built HTML runs without network requests',async()=>{
      const offline=await context.newPage();const requests=[];
      offline.on('pageerror',e=>errors.push(e.message));offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
      await offline.goto(pathToFileURL(path.resolve(__dirname,'../dist/lambda-lab.html')).href);
      await offline.locator('#step').click();assert.equal(await offline.locator('#current-expression').textContent(),'λy.y');
      assert.deepEqual(requests,[]);await offline.close();
    });
    await check('inaccessible storage does not break calculation',async()=>{
      const isolated=await browser.newContext();await isolated.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('storage unavailable');}});});
      const p=await isolated.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('#step').click();
      assert.equal(await p.locator('#current-expression').textContent(),'λy.y');await isolated.close();
    });
    await check('no browser JavaScript errors',async()=>assert.deepEqual(errors,[]));
    console.log(`Browser checks: ${passed} passed, 0 failed.`);
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
