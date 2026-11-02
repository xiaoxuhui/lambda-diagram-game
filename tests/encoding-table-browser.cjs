const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch({headless:true}),base=`http://127.0.0.1:${server.address().port}`,errors=[];let passed=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS T${++passed} ${name}`);};
  try{
    for(const width of [1280,390]){
      const context=await browser.newContext({viewport:{width,height:950},hasTouch:true,acceptDownloads:true}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base);
      const define=async(name,source)=>{
        if(!await page.locator('#encoding-name').isVisible())await page.locator('#custom-data-panel > summary').click();
        await page.locator('#encoding-new').click();await page.locator('#encoding-name').fill(name);await page.locator('#encoding-source').fill(source);await page.locator('#encoding-save').click();assert.ok(await page.locator('#encoding-error').isHidden());
      };
      const generate=async number=>{
        if(!await page.locator('#encoding-table').evaluate(panel=>panel.open))await page.locator('#encoding-table-title').click();
        await page.locator('#encoding-table-number').fill(number);await page.locator('#encoding-table-generate').click();
        await page.waitForFunction(()=>document.getElementById('encoding-table-status').textContent.startsWith('已加入'));
        assert.equal(await page.locator(`#encoding-table-body tr[data-number="${number}"]`).count(),1);
      };
      const source=async text=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isHidden());};
      const fast=async()=>{await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');};
      await check(`${width}px generates and displays mappings without changing the main session`,async()=>{
        await define('Box','λn.λk.k n');const original=await page.locator('#current-expression').textContent();
        await generate('0');await generate('3');assert.equal(await page.locator('#encoding-table-body tr').count(),2);assert.equal(await page.locator('#current-expression').textContent(),original);
        await source('3');await fast();assert.equal(await page.locator('#decoded').textContent(),'3_Box');
        assert.ok((await page.locator('#current-expression').textContent()).startsWith('λk.'));
      });
      await check(`${width}px alpha-renamed expressions match and manual entries replace existing numbers`,async()=>{
        await source('λrenamed.renamed (λf x.f (f x))');await page.locator('#encoding-table-number').fill('2');await page.locator('#encoding-table-current').click();assert.equal(await page.locator('#decoded').textContent(),'2_Box');
        await generate('2');assert.equal(await page.locator('#encoding-table-body tr').count(),3);
        await page.getByRole('button',{name:'载入对照项 3',exact:true}).click();assert.equal(await page.locator('#decoded').textContent(),'3_Box');
        await page.getByRole('button',{name:'编辑对照项 2',exact:true}).click();assert.equal(await page.locator('#encoding-table-number').inputValue(),'2');
      });
      await check(`${width}px partial or free current expressions cannot enter the table`,async()=>{
        await source('(λx.x) 1_church');await page.locator('#encoding-table-current').click();assert.match(await page.locator('#encoding-table-status').textContent(),/正规形/);
        await source('λx.free');await page.locator('#encoding-table-current').click();assert.match(await page.locator('#encoding-table-status').textContent(),/闭合/);
        assert.equal(await page.locator('#encoding-table-body tr').count(),3);
      });
      await check(`${width}px tables survive save, export-before-clear, import and reload`,async()=>{
        await source('3_Box');await fast();await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#decoded').textContent(),'3_Box');assert.equal(await page.locator('#encoding-table-body tr').count(),3);
        const pending=page.waitForEvent('download');await page.locator('#clear-all').click();const download=await pending,backup=fs.readFileSync(await download.path(),'utf8');
        assert.equal(await page.locator('#encoding-table-body tr').count(),0);
        await page.locator('#import-file').setInputFiles({name:'table-backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
        await page.waitForFunction(()=>document.getElementById('encoding-table-body').rows.length===3);assert.equal(await page.locator('#decoded').textContent(),'3_Box');
        if(!await page.locator('#encoding-table').evaluate(panel=>panel.open))await page.locator('#encoding-table-title').click();
        await page.getByRole('button',{name:'删除对照项 0',exact:true}).click();assert.equal(await page.locator('#encoding-table-body tr').count(),2);
      });
      await check(`${width}px editing source clears stale mappings and renaming preserves them`,async()=>{
        await page.getByRole('button',{name:'编辑数据编码 Box',exact:true}).click();await page.locator('#encoding-name').fill('Wrapped');await page.locator('#encoding-save').click();assert.equal(await page.locator('#encoding-table-body tr').count(),2);
        await source('3_Wrapped');await fast();assert.equal(await page.locator('#decoded').textContent(),'3_Wrapped');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#toast').waitFor({state:'hidden'});
        fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.screenshot({path:path.join(__dirname,'artifacts',`encoding-table-${width}.png`),fullPage:true});
        await page.locator('#encoding-source').fill('λn.n');await page.locator('#encoding-save').click();assert.equal(await page.locator('#encoding-table-body tr').count(),0);
      });
      await check(`${width}px ambiguous encodings list every matching numeral`,async()=>{
        await define('Constant','λn.λx y.x');await generate('0');await generate('1');await source('7_Constant');await fast();
        assert.equal(await page.locator('#decoded').textContent(),'0_Constant / 1_Constant / 7_Constant（多项匹配）');
      });
      await check(`${width}px endless generators remain cancelable`,async()=>{
        await define('Loop','λn.(λx.x x) (λx.x x)');if(!await page.locator('#encoding-table').evaluate(panel=>panel.open))await page.locator('#encoding-table-title').click();await page.locator('#encoding-table-number').fill('0');await page.locator('#encoding-table-generate').click();
        await page.waitForFunction(()=>document.getElementById('encoding-table-status').textContent.startsWith('正在归约'));
        await page.locator('#encoding-table-cancel').click();assert.match(await page.locator('#encoding-table-status').textContent(),/取消/);assert.equal(await page.locator('#encoding-table-body tr').count(),0);assert.ok(await page.locator('#encoding-table-generate').isEnabled());
      });await context.close();
    }
    await check('offline HTML generates a table and recognizes a converted numeral',async()=>{
      const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'/dist/lambda-lab.html');
      await page.locator('#custom-data-panel > summary').click();await page.locator('#encoding-name').fill('Offline');await page.locator('#encoding-source').fill('λn.λk.k n');await page.locator('#encoding-save').click();
      await page.locator('#encoding-table-title').click();await page.locator('#encoding-table-number').fill('4');await page.locator('#encoding-table-generate').click();await page.waitForFunction(()=>document.getElementById('encoding-table-body').rows.length===1);
      await page.locator('#expression').fill('4');await page.locator('#convert').click();await page.locator('#step').click();assert.equal(await page.locator('#decoded').textContent(),'4_Offline');await context.close();
    });
    assert.deepEqual(errors,[]);console.log(`Encoding tables: ${passed} passed, 0 failed; Chromium ${browser.version()}; page errors 0.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
