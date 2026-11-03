const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),S=require('../src/snapshot.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch({headless:true}),base=`http://127.0.0.1:${server.address().port}`,errors=[];let passed=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS P${++passed} ${name}`);};
  try{
    for(const width of [1280,390]){
      const context=await browser.newContext({viewport:{width,height:950},hasTouch:true,acceptDownloads:true}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base);
      const source=async text=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();await page.waitForFunction(()=>!document.getElementById('expression').value||!document.getElementById('run').disabled);};
      const add=async(name,text)=>{await page.locator('#function-name').fill(name);await page.locator('#function-source').fill(text);await page.locator('#function-add').click();await page.waitForFunction(()=>!document.getElementById('function-name').value);assert.ok(await page.locator('#function-error').isHidden());};
      const load=async()=>{const pending=page.waitForEvent('download');await page.locator('#load-default-state').click();const download=await pending,text=fs.readFileSync(await download.path(),'utf8');return {text,data:S.decode(text),name:download.suggestedFilename()};};
      let original;
      await check(`${width}px default load exports the complete old workspace before replacing it`,async()=>{
        await add('USER_ID','λx.x');await page.locator('#custom-data-panel > summary').click();await page.locator('#encoding-name').fill('UserData');await page.locator('#encoding-source').fill('λn.λk.k n');await page.locator('#encoding-save').click();
        await page.locator('#input-format-title').click();await page.locator('#input-format').fill('u{n}');await page.locator('#save-input-format').click();
        await page.locator('#mode-challenge').click();await page.locator('#step').click();await page.locator('#check-answer').click();await page.locator('#mode-free').click();await page.locator('#number-encoding').selectOption('custom:UserData');
        await source('(λx.x) (λy.y)');await page.locator('#step').click();await page.locator('#save-state').click();
        await page.locator('#expression').fill('USER_ID 0_UserData');await page.locator('#function-name').fill('DRAFT');await page.locator('#function-source').fill('λz.z');await page.locator('#input-format').fill('pending{n}');
        original=await load();assert.match(original.name,/lambda-lab-before-default.*\.json$/);assert.equal(original.data.draft,'USER_ID 0_UserData');assert.equal(original.data.functions[0].name,'USER_ID');assert.equal(original.data.dataEncodings[0].inputFormat,'u{n}');
        assert.deepEqual(original.data.completed,[1]);assert.equal(original.data.session.steps,1);assert.equal(original.data.session.dirty,true);assert.equal(original.data.functionDraft.name,'DRAFT');assert.equal(original.data.view.inputFormatDraft.text,'pending{n}');
        assert.ok(original.data.checkpointText);assert.equal(S.decode(original.data.checkpointText).draft,'(λx.x) (λy.y)');
        assert.equal(await page.locator('#function-count').textContent(),'15 个函数');assert.equal(await page.locator('#function-list [data-name="USER_ID"]').count(),0);assert.equal(await page.locator('#number-encoding').inputValue(),'custom:Set');
        assert.equal(await page.locator('#expression').inputValue(),'SET_ADD 1_Set 2_Set');assert.equal(await page.locator('#current-expression').textContent(),'—');assert.equal(await page.locator('#diagram-mount svg').count(),0);assert.ok(await page.locator('#restore-state').isDisabled());
        assert.equal(await page.locator('#progress-text').textContent(),'探索 · 输入 · 归约');assert.equal(await page.locator('#function-name').inputValue(),'');assert.equal(await page.locator('#input-format').inputValue(),'s{n}');assert.equal(await page.locator('#custom-data-panel').evaluate(el=>el.open),false);
        await page.waitForTimeout(250);assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('lambda-lab-v2'))).draft,'SET_ADD 1_Set 2_Set');
      });
      await check(`${width}px the default custom-encoded sum runs to 3_Set`,async()=>{
        await page.locator('#convert').click();await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
        assert.equal(await page.locator('#decoded').textContent(),'3_Set');assert.ok(Number(await page.locator('#step-count').textContent())>0);
      });
      await check(`${width}px loaded functions are editable and automatically persist across reload`,async()=>{
        await add('EXTRA','λq.q');await page.getByRole('button',{name:'编辑函数 SET_SUCC',exact:true}).click();assert.equal(await page.locator('#function-source').inputValue(),'λs.LIST_APPEND s (LIST_ONE s)');
        await page.locator('#function-source').fill('  λs.LIST_APPEND s (LIST_ONE s)  ');await page.locator('#function-add').click();await page.waitForFunction(()=>!document.getElementById('function-name').value);await page.reload();
        assert.equal(await page.locator('#function-count').textContent(),'16 个函数');await page.getByRole('button',{name:'编辑函数 SET_SUCC',exact:true}).click();assert.equal(await page.locator('#function-source').inputValue(),'  λs.LIST_APPEND s (LIST_ONE s)  ');await page.locator('#function-cancel').click();
      });
      await check(`${width}px every repeated load exports its current state and resets to the original default`,async()=>{
        const second=await load();assert.equal(second.data.functions.length,16);assert.ok(second.data.functions.some(fn=>fn.name==='EXTRA'));assert.equal(second.data.functions.find(fn=>fn.name==='SET_SUCC').source,'  λs.LIST_APPEND s (LIST_ONE s)  ');
        assert.equal(await page.locator('#function-count').textContent(),'15 个函数');assert.equal(await page.locator('#current-expression').textContent(),'—');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('.save-bar').screenshot({path:path.join(__dirname,'artifacts',`default-state-${width}.png`)});
      });
      await check(`${width}px importing the automatic backup restores its functions, encodings, progress and checkpoint`,async()=>{
        await page.locator('#import-file').setInputFiles({name:'before-default.json',mimeType:'application/json',buffer:Buffer.from(original.text)});
        await page.waitForFunction(()=>document.getElementById('function-count').textContent==='1 个函数');assert.equal(await page.locator('#expression').inputValue(),'USER_ID 0_UserData');assert.equal(await page.locator('#number-encoding').inputValue(),'custom:UserData');
        assert.equal(await page.locator('#function-name').inputValue(),'DRAFT');assert.equal(await page.locator('#input-format').inputValue(),'pending{n}');assert.ok(await page.locator('#restore-state').isEnabled());await page.locator('#restore-state').click();
        assert.equal(await page.locator('#expression').inputValue(),'(λx.x) (λy.y)');assert.equal(await page.locator('#step-count').textContent(),'1');
      });
      await check(`${width}px failed export and storage changes leave the old workspace intact`,async()=>{
        await page.evaluate(()=>{window.defaultBackupOriginal=LambdaDownload.saveBackup;LambdaDownload.saveBackup=()=>{throw Error('injected export failure');};});
        const before=await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]);await page.locator('#load-default-state').click();
        assert.match(await page.locator('#save-feedback').textContent(),/injected export failure/);assert.equal(await page.locator('#function-count').textContent(),'1 个函数');assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]),before);
        await page.evaluate(()=>{LambdaDownload.saveBackup=defaultBackupOriginal;window.defaultRemoveOriginal=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(key==='lambda-lab-v1')throw Error('injected storage failure');return defaultRemoveOriginal.call(this,key);};});
        await load();assert.match(await page.locator('#save-feedback').textContent(),/injected storage failure/);assert.equal(await page.locator('#function-count').textContent(),'1 个函数');assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]),before);
        await page.evaluate(()=>Storage.prototype.removeItem=defaultRemoveOriginal);
      });
      await check(`${width}px native backup must confirm success before default data replaces the scene`,async()=>{
        await page.evaluate(()=>window.LambdaAndroid={saveFile(){},saveFileConfirmed(){return false;}});await page.locator('#load-default-state').click();assert.equal(await page.locator('#function-count').textContent(),'1 个函数');assert.match(await page.locator('#save-feedback').textContent(),/保存失败/);
        await page.evaluate(()=>window.LambdaAndroid={saveFile(){},saveFileConfirmed(name,content,mime){window.defaultNativeBackup={name,content,mime,draft:document.getElementById('expression').value};return true;}});await page.locator('#load-default-state').click();
        const backup=await page.evaluate(()=>defaultNativeBackup);assert.equal(JSON.parse(backup.content).draft,backup.draft);assert.equal(backup.mime,'application/json');assert.equal(await page.locator('#function-count').textContent(),'15 个函数');
      });await context.close();
    }
    await check('offline HTML loads the default archive with a backup and runs the example',async()=>{
      const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'/dist/lambda-lab.html');
      const pending=page.waitForEvent('download');await page.locator('#load-default-state').click();assert.ok(await pending);assert.equal(await page.locator('#function-count').textContent(),'15 个函数');
      await page.locator('#convert').click();await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('decoded').textContent==='3_Set');await context.close();
    });
    assert.deepEqual(errors,[]);console.log(`Default archive: ${passed} passed, 0 failed; Chromium ${browser.version()}; page errors 0.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
