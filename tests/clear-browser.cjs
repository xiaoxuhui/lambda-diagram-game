const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
const artifacts=path.join(__dirname,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch({headless:true}),errors=[];let count=0;
  const context=await browser.newContext({viewport:{width:1440,height:1080},hasTouch:true,acceptDownloads:true});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const base=`http://127.0.0.1:${server.address().port}/`;
  const check=async(name,run)=>{await run();console.log(`PASS C${++count} ${name}`);};
  const source=async(text)=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();};
  const empty=async(p)=>{
    assert.equal(await p.locator('#expression').inputValue(),'');assert.equal(await p.locator('.function-item').count(),0);
    assert.equal(await p.locator('#function-name').inputValue(),'');assert.equal(await p.locator('#function-source').inputValue(),'');
    assert.equal(await p.locator('#history-list li').count(),0);assert.equal(await p.locator('#step-count').textContent(),'0');
    assert.equal(await p.locator('#diagram-mount svg').count(),0);assert.ok(await p.locator('#restore-state').isDisabled());
    assert.equal(await p.locator('#run-label').textContent(),'运行');assert.equal(await p.locator('#speed-ms').inputValue(),'600');
    assert.equal(await p.locator('#zoom-label').textContent(),'100%');assert.ok(await p.locator('#mode-free').getAttribute('aria-pressed')==='true');
    const stored=await p.evaluate(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')));
    assert.deepEqual(stored.completed,[]);assert.equal(stored.session.original,null);assert.equal(stored.functionDraft.editing,undefined);
    assert.equal(await p.evaluate(()=>localStorage.getItem('lambda-lab-checkpoint-v2')),null);
    assert.equal(await p.evaluate(()=>localStorage.getItem('lambda-lab-v1')),null);
  };
  const downloadClear=async(p)=>{
    const waiting=p.waitForEvent('download');await p.locator('#clear-all').click();const download=await waiting;
    const file=path.join(artifacts,`clear-save-${count}.json`);await download.saveAs(file);return {file,data:JSON.parse(fs.readFileSync(file,'utf8'))};
  };
  try{
    await page.goto(base);let backup;
    await check('backup is downloadable before all content and saved checkpoints are cleared',async()=>{
      await page.locator('#function-name').fill('ID');await page.locator('#function-source').fill('λx.x');await page.locator('#function-add').click();
      await source('λq.q');await page.locator('#save-state').click();
      await page.locator('#mode-challenge').click();await page.locator('#step').click();await page.locator('#check-answer').click();
      await source('(λx.x) ((λy.y) z)');await page.locator('#step').click();await page.locator('#speed').selectOption('1200');await page.locator('#zoom-in').click();
      await page.locator('[aria-label="编辑函数 ID"]').click();await page.locator('#function-name').fill('RENAMED');await page.locator('#function-source').fill('λx.');
      await page.evaluate(()=>{localStorage.setItem('unrelated-tool','keep');localStorage.setItem('lambda-lab-v1','legacy');});
      backup=await downloadClear(page);assert.equal(backup.data.session.steps,1);assert.deepEqual(backup.data.completed,[1]);
      assert.equal(backup.data.functions[0].name,'ID');assert.equal(backup.data.functionDraft.editing,'ID');assert.equal(backup.data.checkpoint.draft,'λq.q');
      await empty(page);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-tool')),'keep');
      assert.match(await page.locator('#save-feedback').textContent(),/下载/);await page.screenshot({path:path.join(artifacts,'clear-desktop.png'),fullPage:true});
    });
    await check('reload remains empty with no legacy resurrection or stale autosave',async()=>{await page.waitForTimeout(250);await page.reload();await empty(page);});
    await check('importing backup restores current frame, functions, progress, editing and manual checkpoint',async()=>{
      await page.locator('#import-file').setInputFiles(backup.file);await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('存档已导入'));
      assert.equal(await page.locator('#step-count').textContent(),'1');assert.equal(await page.locator('#current-expression').textContent(),'(λy.y) z');
      assert.equal(await page.locator('#function-name').inputValue(),'RENAMED');assert.equal(await page.locator('#function-source').inputValue(),'λx.');
      assert.equal(await page.locator('#progress-text').textContent(),'1 / 5 关已完成');assert.ok(await page.locator('#restore-state').isEnabled());
      await page.locator('#restore-state').click();assert.equal(await page.locator('#expression').inputValue(),'λq.q');
    });
    await check('clearing during automatic execution stops the timer and stays empty',async()=>{
      await source('(λx.x x) (λx.x x)');await page.locator('#speed').selectOption('10');await page.locator('#run').click();
      await page.waitForFunction(()=>Number(document.getElementById('step-count').textContent)>0);const running=await downloadClear(page);
      assert.ok(running.data.session.steps>0);await empty(page);await page.waitForTimeout(250);await empty(page);
    });
    await check('desktop and mobile repeated empty clears download importable backups and fit',async()=>{
      await page.setViewportSize({width:390,height:844});const waiting=page.waitForEvent('download');await page.locator('#clear-all').tap();const file=path.join(artifacts,'clear-empty.json');await (await waiting).saveAs(file);
      const saved=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(saved.draft,'');assert.equal(saved.checkpoint,null);await empty(page);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(artifacts,'clear-mobile.png'),fullPage:true});
    });
    await check('failed export leaves current content and manual checkpoint untouched',async()=>{
      await source('(λx.x) y');await page.locator('#save-state').click();
      await page.evaluate(()=>{window.originalBackup=LambdaDownload.saveBackup;LambdaDownload.saveBackup=()=>{throw Error('injected download failure');};});
      const before=await page.evaluate(()=>localStorage.getItem('lambda-lab-checkpoint-v2'));await page.locator('#clear-all').click();
      assert.equal(await page.locator('#expression').inputValue(),'(λx.x) y');assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-checkpoint-v2')),before);
      assert.match(await page.locator('#save-feedback').textContent(),/injected download failure/);await page.evaluate(()=>LambdaDownload.saveBackup=originalBackup);
    });
    await check('failed storage removal rolls back old data and preserves live content',async()=>{
      await page.evaluate(()=>{window.originalRemove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(key==='lambda-lab-v1')throw Error('injected storage failure');return originalRemove.call(this,key);};});
      const before=await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]);await downloadClear(page);
      assert.equal(await page.locator('#expression').inputValue(),'(λx.x) y');assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]),before);
      assert.match(await page.locator('#save-feedback').textContent(),/injected storage failure/);await page.evaluate(()=>Storage.prototype.removeItem=originalRemove);
    });
    await check('native write failure and legacy bridges cannot clear content',async()=>{
      await page.evaluate(()=>window.LambdaAndroid={saveFile(){},saveFileConfirmed(){return false;}});await page.locator('#clear-all').click();
      assert.equal(await page.locator('#expression').inputValue(),'(λx.x) y');assert.match(await page.locator('#save-feedback').textContent(),/保存失败/);
      await page.evaluate(()=>delete LambdaAndroid.saveFileConfirmed);await page.locator('#clear-all').click();assert.equal(await page.locator('#expression').inputValue(),'(λx.x) y');
      assert.match(await page.locator('#save-feedback').textContent(),/更新安卓版/);
    });
    await check('native success receives complete JSON before clearing',async()=>{
      await page.evaluate(()=>window.LambdaAndroid={saveFile(){},saveFileConfirmed(name,content,mime){window.nativeBackup={name,content,mime,expression:document.getElementById('expression').value};return true;}});
      await page.locator('#clear-all').click();const native=await page.evaluate(()=>nativeBackup);
      assert.equal(native.expression,'(λx.x) y');assert.equal(JSON.parse(native.content).draft,native.expression);assert.equal(native.mime,'application/json');assert.match(native.name,/\.json$/);
      await empty(page);assert.match(await page.locator('#save-feedback').textContent(),/已保存/);
    });
    await check('invalid checkpoint import cannot replace current workspace',async()=>{
      await source('λz.z');const bad=structuredClone(backup.data);bad.checkpoint.session.steps=99;
      await page.locator('#import-file').setInputFiles({name:'bad-checkpoint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
      await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('导入失败'));assert.equal(await page.locator('#expression').inputValue(),'λz.z');
    });
    await check('single-file offline entry supports export, clear, reload and import',async()=>{
      const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));await offline.goto(pathToFileURL(path.resolve(__dirname,'../dist/lambda-lab.html')).href);
      const saved=await downloadClear(offline);await empty(offline);await offline.reload();await empty(offline);
      await offline.locator('#import-file').setInputFiles(saved.file);await offline.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('存档已导入'));
      assert.equal(await offline.locator('#expression').inputValue(),saved.data.draft);await offline.close();
    });
    await check('no browser errors across clearing flows',async()=>assert.deepEqual(errors,[]));
    console.log(`Clear browser checks: ${count} passed, 0 failed.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
