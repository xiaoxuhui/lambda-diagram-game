const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');const P=require('../src/presets.js');
const artifacts=path.join(__dirname,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await playwright.chromium.launch({headless:true});console.log(`Workspace browser: Chromium ${browser.version()}`);
  const context=await browser.newContext({viewport:{width:1440,height:1080},hasTouch:true,acceptDownloads:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let pass=0;
  const check=async(name,fn)=>{await fn();pass++;console.log(`PASS W${String(pass).padStart(2,'0')} ${name}`);};
  const source=async(text)=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();};
  const add=async(name,text)=>{await page.locator('#function-name').fill(name);await page.locator('#function-source').fill(text);await page.locator('#function-add').click();};
  const row=name=>page.locator('.function-item').filter({has:page.locator('strong',{hasText:new RegExp('^'+name+'$')})});
  const upload=async(text,name='test-save.json')=>{await page.locator('#import-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForFunction(()=>!document.getElementById('save-feedback').hidden);};
  let saveFile,exported;
  try {
    await page.goto(base);
    await check('create named function and invoke it',async()=>{
      await add('ID','λx.x');assert.equal(await row('ID').count(),1);await source('ID (λy.y)');
      assert.equal(await page.locator('#current-expression').textContent(),'(λx.x) (λy.y)');await page.locator('#step').click();assert.equal(await page.locator('#current-expression').textContent(),'λy.y');
    });
    await check('name button inserts at editor cursor with safe spacing',async()=>{
      await page.locator('#expression').fill('f');await page.locator('#expression').evaluate(e=>{e.focus();e.setSelectionRange(1,1);});
      await row('ID').getByRole('button',{name:'插入函数 ID'}).click();assert.equal(await page.locator('#expression').inputValue(),'f ID');
    });
    await check('function shortcut keyboard works in separate definition field',async()=>{
      await page.locator('#function-source').fill('x.x');await page.locator('#function-source').evaluate(e=>{e.focus();e.setSelectionRange(0,0);});
      await page.locator('[data-function-insert="λ"]').tap();assert.equal(await page.locator('#function-source').inputValue(),'λx.x');
    });
    await check('duplicate and invalid definitions are rejected',async()=>{
      await add('ID','λx y.x');assert.match(await page.locator('#function-error').textContent(),/已存在/);assert.equal(await row('ID').count(),1);
      await add('1Invalid','λx.x');assert.match(await page.locator('#function-error').textContent(),/函数名/);
      await add('BAD','λx.');assert.ok(await page.locator('#function-error').isVisible());assert.equal(await row('BAD').count(),0);
    });
    await check('using current expression creates a reusable definition',async()=>{
      await source('λf x.f (f x)');await page.locator('#function-use-current').click();
      assert.equal(await page.locator('#function-source').inputValue(),'λf.λx.f (f x)');await page.locator('#function-name').fill('TWO');await page.locator('#function-add').click();
      await source('TWO');assert.equal(await page.locator('#decoded').textContent(),'Church 数 2');
    });
    await check('free definition expansion avoids capturing local variables',async()=>{
      await add('FREE','λx.y');await source('λy.FREE');assert.equal(await page.locator('#current-expression').textContent(),'λy1.λx.y');
      assert.equal(await page.locator('#diagram-mount [stroke-dasharray]').count(),1);
    });
    await check('deleting dependency preserves compiled composite and old run',async()=>{
      await add('COPY','ID');await source('ID (λy.y)');await row('ID').getByRole('button',{name:'删除函数 ID'}).click();
      assert.equal(await row('ID').count(),0);await page.locator('#step').click();assert.equal(await page.locator('#current-expression').textContent(),'λy.y');
      await source('COPY');assert.equal(await page.locator('#decoded').textContent(),'I · 恒等函数');
      await source('ID');assert.equal(await page.locator('#current-expression').textContent(),'ID');
    });
    await check('manual save retains an intermediate frame and preferences',async()=>{
      await source(P.examples[5].term);await page.locator('#step').click();await page.locator('#step').click();await page.locator('#speed').selectOption('1200');
      await page.locator('#zoom-in').click();await page.locator('#history-details').evaluate(e=>e.open=true);
      await page.locator('#save-state').click();saveFile={current:await page.locator('#current-expression').textContent(),zoom:await page.locator('#zoom-label').textContent()};
      assert.match(await page.locator('#save-feedback').textContent(),/已保存/);assert.ok(await page.locator('#restore-state').isEnabled());
      await page.locator('#step').click();await source('λz.z');await row('TWO').getByRole('button',{name:'删除函数 TWO'}).click();
      await page.locator('#restore-state').click();assert.equal(await page.locator('#step-count').textContent(),'2');assert.equal(await page.locator('#current-expression').textContent(),saveFile.current);
      assert.equal(await page.locator('#zoom-label').textContent(),saveFile.zoom);assert.equal(await page.locator('#speed').inputValue(),'1200');assert.equal(await row('TWO').count(),1);assert.ok(await page.locator('#history-details').evaluate(e=>e.open));
    });
    await check('automatic save survives reload at exact frame with undo history',async()=>{
      await page.locator('#step').click();const current=await page.locator('#current-expression').textContent();await page.reload();
      assert.equal(await page.locator('#step-count').textContent(),'3');assert.equal(await page.locator('#current-expression').textContent(),current);
      assert.equal(await page.locator('#history-list li').count(),4);await page.locator('#back').click();assert.equal(await page.locator('#step-count').textContent(),'2');
    });
    await check('restoring saved running scene always pauses and can resume',async()=>{
      await page.locator('#run').click();await page.locator('#save-state').click();const count=await page.locator('#step-count').textContent();await page.locator('#restore-state').click();
      assert.equal(await page.locator('#run-label').textContent(),'运行');await page.waitForTimeout(1300);assert.equal(await page.locator('#step-count').textContent(),count);
      await page.locator('#step').click();assert.equal(Number(await page.locator('#step-count').textContent()),Number(count)+1);
    });
    await check('unfinished function draft is saved and restored',async()=>{
      await page.locator('#function-name').fill('NEXT');await page.locator('#function-source').fill('λx.');await page.locator('#save-state').click();
      await page.locator('#function-name').fill('OTHER');await page.locator('#restore-state').click();assert.equal(await page.locator('#function-name').inputValue(),'NEXT');assert.equal(await page.locator('#function-source').inputValue(),'λx.');
    });
    await check('export and import restore functions, progress, input, and frame',async()=>{
      await page.locator('#mode-challenge').click();await page.locator('#step').click();await page.locator('#check-answer').click();
      await source(P.examples[5].term);await page.locator('#step').click();await page.locator('#step').click();
      const current=await page.locator('#current-expression').textContent(),progress=await page.locator('#progress-text').textContent();
      const wait=page.waitForEvent('download');await page.locator('#export-state').click();const download=await wait;const file=path.join(artifacts,'workspace-save.json');await download.saveAs(file);exported=fs.readFileSync(file,'utf8');
      assert.equal(JSON.parse(exported).version,2);await row('COPY').getByRole('button',{name:'删除函数 COPY'}).click();await source('λq.q');
      await page.locator('#import-file').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('存档已导入'));
      assert.equal(await page.locator('#step-count').textContent(),'2');assert.equal(await page.locator('#current-expression').textContent(),current);assert.equal(await page.locator('#progress-text').textContent(),progress);assert.equal(await row('COPY').count(),1);
    });
    await check('edited unconverted draft and old frame restore together',async()=>{
      await page.locator('#expression').fill('λz.');await page.locator('#save-state').click();await source('λq.q');await page.locator('#restore-state').click();
      assert.equal(await page.locator('#expression').inputValue(),'λz.');assert.equal(await page.locator('#step-count').textContent(),'2');assert.equal(await page.locator('#state-badge').textContent(),'已编辑 · 请转换');assert.ok(await page.locator('#step').isDisabled());
    });
    await check('invalid JSON import leaves current scene intact',async()=>{
      const before=await page.locator('#expression').inputValue();await upload('{');await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('导入失败'));
      assert.equal(await page.locator('#expression').inputValue(),before);assert.equal(await row('COPY').count(),1);
    });
    await check('invalid AST import cannot alter current library',async()=>{
      const s=JSON.parse(exported);s.session.original={type:'var',name:'<bad>'};await upload(JSON.stringify(s));await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('变量名不合法'));
      assert.equal(await row('COPY').count(),1);assert.equal(await page.locator('#expression').inputValue(),'λz.');
    });
    await check('oversized import is rejected before replacing state',async()=>{
      await upload(' '.repeat(2*1024*1024+1));await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('2 MiB'));
      assert.equal(await page.locator('#expression').inputValue(),'λz.');
    });
    await check('legacy v1 imports draft and existing progress',async()=>{
      await upload(JSON.stringify({version:1,draft:'λq.q',mode:'challenge',level:1,completed:[1,2]}));await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('存档已导入'));
      assert.equal(await page.locator('#expression').inputValue(),'λq.q');assert.equal(await page.locator('#progress-text').textContent(),'2 / 5 关已完成');assert.equal(await page.locator('#function-count').textContent(),'0 个函数');
    });
    await check('first-load legacy storage migration preserves progress',async()=>{
      const legacyContext=await browser.newContext();await legacyContext.addInitScript(()=>localStorage.setItem('lambda-lab-v1',JSON.stringify({version:1,draft:'λz.z',mode:'challenge',level:2,completed:[1,3,5]})));
      const p=await legacyContext.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
      assert.equal(await p.locator('#progress-text').textContent(),'3 / 5 关已完成');assert.equal(await p.locator('#expression').inputValue(),'λz.z');
      const stored=await p.evaluate(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')));assert.equal(stored.version,2);assert.deepEqual(stored.completed,[1,3,5]);await legacyContext.close();
    });
    await check('storage failure reports clearly and still allows file export',async()=>{
      const blocked=await browser.newContext();await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('storage disabled');}}));
      const p=await blocked.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('#save-state').click();assert.match(await p.locator('#save-feedback').textContent(),/导出存档/);
      const wait=p.waitForEvent('download');await p.locator('#export-state').click();const download=await wait;assert.match(download.suggestedFilename(),/\.json$/);await blocked.close();
    });
    await check('desktop and mobile function/save controls fit and touch works',async()=>{
      await page.locator('#mode-free').click();await add('ID','λx.x');await source('ID (λy.y)');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(artifacts,'workspace-desktop.png'),fullPage:true});
      await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.locator('#save-state').tap();await page.locator('#expression').fill('f');await page.locator('#expression').evaluate(e=>e.setSelectionRange(1,1));await row('ID').getByRole('button',{name:'插入函数 ID'}).tap();assert.equal(await page.locator('#expression').inputValue(),'f ID');
      await row('ID').getByRole('button',{name:'删除函数 ID'}).tap();assert.equal(await row('ID').count(),0);await page.locator('#restore-state').tap();assert.equal(await row('ID').count(),1);
      await page.screenshot({path:path.join(artifacts,'workspace-mobile.png'),fullPage:true});
    });
    await check('more than 32 functions can be created, invoked, deleted and restored',async()=>{
      await page.setViewportSize({width:1440,height:1080});
      for(let i=0;i<40;i++)await add(`COUNT${i}`,'λx.x');
      assert.equal(await page.locator('.function-item').count(),41);assert.equal(await page.locator('#function-count').textContent(),'41 个函数');assert.ok(await page.locator('#function-error').isHidden());
      await source('COUNT39 (λy.y)');await page.locator('#step').click();assert.equal(await page.locator('#current-expression').textContent(),'λy.y');
      await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('.function-item').count(),41);
      const stored=await page.evaluate(()=>localStorage.getItem('lambda-lab-v2'));
      await row('COUNT39').getByRole('button',{name:'删除函数 COUNT39'}).click();assert.equal(await page.locator('.function-item').count(),40);
      await page.locator('#restore-state').click();assert.equal(await page.locator('.function-item').count(),41);
      await row('COUNT39').getByRole('button',{name:'删除函数 COUNT39'}).click();await upload(stored);
      await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('存档已导入'));
      assert.equal(await page.locator('.function-item').count(),41);assert.equal(await page.locator('#function-count').textContent(),'41 个函数');
    });
    await check('offline build can add, save, reload, and resume',async()=>{
      const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));await offline.goto(pathToFileURL(path.resolve(__dirname,'../dist/lambda-lab.html')).href);
      await offline.locator('#function-name').fill('IDENTITY');await offline.locator('#function-source').fill('λx.x');await offline.locator('#function-add').click();
      await offline.locator('#step').click();await offline.locator('#save-state').click();await offline.reload();assert.equal(await offline.locator('#step-count').textContent(),'1');assert.equal(await offline.locator('.function-item').count(),1);assert.equal(await offline.locator('#current-expression').textContent(),'λy.y');await offline.close();
    });
    await check('no JavaScript errors across workspace flows',async()=>assert.deepEqual(errors,[]));
    console.log(`Workspace browser checks: ${pass} passed, 0 failed.`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
