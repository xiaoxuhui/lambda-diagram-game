const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const C=require('../src/core.js'),P=require('../src/presets.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch({headless:true}),base=`http://127.0.0.1:${server.address().port}`,errors=[];let passed=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS E${++passed} ${name}`);};
  try{
    for(const width of [1280,390]){
      const context=await browser.newContext({viewport:{width,height:950},hasTouch:true,acceptDownloads:true}),page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
      const source=async text=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isHidden(),text);};
      const fast=async()=>{await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');};
      const result=async expected=>assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse(expected)),expected);
      const add=async(name,source)=>{
        if(!await page.locator('#encoding-name').isVisible())await page.locator('#custom-data-panel summary').click();
        await page.locator('#encoding-new').click();await page.locator('#encoding-name').fill(name);await page.locator('#encoding-source').fill(source);await page.locator('#encoding-save').click();
        assert.ok(await page.locator('#encoding-error').isHidden());
      };
      await check(`${width}px unsuffixed numbers stay Church regardless of selected menu`,async()=>{
        assert.equal(await page.locator('#number-encoding').inputValue(),'church');
        await source('3');await result('3');await page.locator('#number-encoding').selectOption('decimal');await source('3');await result('3');
        assert.match(await page.locator('#expression-encoding').textContent(),/丘奇数/);
        await source('-0.5_decimal');assert.equal(await page.locator('#decoded').textContent(),'小数 -0.5');assert.match(await page.locator('#expression-encoding').textContent(),/列表小数/);
      });
      await check(`${width}px lambda button inserts into the converter cursor and replaces a selection`,async()=>{
        await page.locator('#custom-data-panel summary').click();
        await page.locator('#encoding-source').fill('n.n');await page.locator('#encoding-source').evaluate(field=>field.setSelectionRange(0,0));
        await page.locator('#encoding-lambda').click();assert.equal(await page.locator('#encoding-source').inputValue(),'λn.n');
        assert.ok(await page.locator('#encoding-source').evaluate(field=>document.activeElement===field&&field.selectionStart===1));
        await page.locator('#encoding-source').evaluate(field=>field.setSelectionRange(0,2));await page.locator('#encoding-lambda').click();
        assert.equal(await page.locator('#encoding-source').inputValue(),'λ.n');
        await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#encoding-source').inputValue(),'λ.n');
      });
      await check(`${width}px save and select a named converter without claiming its function name`,async()=>{
        await add('Box','λn.λk.k n');assert.equal(await page.locator('#number-encoding').inputValue(),'custom:Box');
        assert.match(await page.locator('#number-note').textContent(),/3_Box/);assert.equal(await page.locator('#function-count').textContent(),'0 个函数');
        await source('3_Box');assert.equal(await page.locator('#step-count').textContent(),'0');assert.equal(await page.locator('#state-badge').textContent(),'可以归约');
        await page.locator('#step').click();await result('λk.k 3');assert.equal(await page.locator('#step-count').textContent(),'1');assert.match(await page.locator('#expression-encoding').textContent(),/Box/);
      });
      await check(`${width}px multiple and Chinese encodings can mix with builtins`,async()=>{
        await add('后继','λn.λf x.f (n f x)');await source('2_后继');await fast();await result('3');
        await source('λf.f 2 3_Box 0.5_decimal');await fast();const label=await page.locator('#expression-encoding').textContent();
        assert.match(label,/丘奇数/);assert.match(label,/Box/);assert.match(label,/列表小数/);
      });
      await check(`${width}px editing converter keeps the already compiled term until reconversion`,async()=>{
        await source('3_Box');await fast();const old=await page.locator('#current-expression').textContent();
        const count=await page.locator('#encoding-list .function-item').count();
        await page.getByRole('button',{name:'编辑数据编码 Box',exact:true}).click();assert.equal(await page.locator('#encoding-source').inputValue(),'λn.λk.k n');
        assert.equal(await page.locator('#encoding-save').textContent(),'保存修改');assert.equal(await page.locator('#encoding-edit-status').textContent(),'正在编辑：Box');
        await page.locator('#encoding-source').fill('λn.λk.k n n');await page.locator('#encoding-save').click();assert.equal(await page.locator('#current-expression').textContent(),old);
        assert.equal(await page.locator('#encoding-list .function-item').count(),count);assert.equal(await page.locator('#encoding-list [data-encoding-name="Box"] code').textContent(),'λn.λk.k n n');
        await page.locator('#convert').click();await fast();await result('λk.k 3 3');assert.equal(await page.locator('#decoded').textContent(),'自定义数据');
      });
      await check(`${width}px functions accept custom literals and retain provenance through names`,async()=>{
        await page.locator('#function-name').fill('VALUE');await page.locator('#function-source').fill('2_Box');await page.locator('#function-add').click();assert.ok(await page.locator('#function-error').isHidden());
        await source('VALUE');await fast();await result('λk.k 2 2');assert.match(await page.locator('#expression-encoding').textContent(),/Box/);
        await page.getByRole('button',{name:'编辑函数 VALUE',exact:true}).click();assert.equal(await page.locator('#function-source').inputValue(),'2_Box');await page.locator('#function-cancel').click();
      });
      await check(`${width}px invalid converter and suffixes show errors without losing saved encodings`,async()=>{
        await add('Temp','λn.n');await page.locator('#encoding-source').fill('λn.missing');await page.locator('#encoding-save').click();assert.match(await page.locator('#encoding-error').textContent(),/自由变量/);
        for(const text of ['3_Unknown','3_','-1_Box','0.5_Box','0.1']){
          await page.locator('#expression').fill(text);await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isVisible(),text);
        }
        await source('3_Temp');await fast();await result('3');
      });
      await check(`${width}px saved state restores definitions, draft, selected encoding and run history`,async()=>{
        await page.locator('#number-encoding').selectOption('custom:Box');await source('3_Box');await fast();
        await page.locator('#encoding-source').fill('λn.λk.k n');await page.locator('#save-state').click();await page.reload();
        assert.equal(await page.locator('#number-encoding').inputValue(),'custom:Box');assert.equal(await page.locator('#encoding-source').inputValue(),'λn.λk.k n');await result('λk.k 3 3');
        assert.match(await page.locator('#expression-encoding').textContent(),/Box/);await page.locator('#back').click();assert.equal(await page.locator('#step-count').textContent(),'0');await page.locator('#step').click();await result('λk.k 3 3');
      });
      await check(`${width}px deletion preserves compiled functions and restore recovers encoding`,async()=>{
        await page.getByRole('button',{name:'删除数据编码 Box',exact:true}).click();assert.equal(await page.locator('#number-encoding option[value="custom:Box"]').count(),0);await result('λk.k 3 3');
        await source('VALUE');await fast();await result('λk.k 2 2');assert.match(await page.locator('#expression-encoding').textContent(),/Box/);
        await page.getByRole('button',{name:'编辑函数 VALUE',exact:true}).click();await page.locator('#function-name').fill('RENAMED');await page.locator('#function-add').click();assert.ok(await page.locator('#function-error').isHidden());
        await page.locator('#restore-state').click();assert.equal(await page.locator('#number-encoding option[value="custom:Box"]').count(),1);await result('λk.k 3 3');
      });
      await check(`${width}px decimal example remains exact and labelled`,async()=>{
        const example=P.examples.find(e=>e.decimalOperation==='ADD');await page.locator('#examples').selectOption(String(P.examples.indexOf(example)));
        assert.match(await page.locator('#expression').inputValue(),/0\.1_decimal/);await fast();assert.equal(await page.locator('#decoded').textContent(),'小数 0.3');assert.match(await page.locator('#expression-encoding').textContent(),/列表小数/);
      });
      await check(`${width}px export-before-clear and import roundtrip all encodings and checkpoint`,async()=>{
        const pending=page.waitForEvent('download');await page.locator('#clear-all').click();const download=await pending,backup=fs.readFileSync(await download.path(),'utf8');
        assert.equal(await page.locator('#number-encoding option[data-custom-encoding]').count(),0);assert.equal(await page.locator('#encoding-name').inputValue(),'');
        await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
        await page.waitForFunction(()=>document.getElementById('number-encoding').options.length===5);assert.equal(await page.locator('#decoded').textContent(),'小数 0.3');
        await page.locator('#restore-state').click();await result('λk.k 3 3');
      });
      await check(`${width}px long names and converter inputs fit and remain editable`,async()=>{
        await page.locator('#number-encoding').selectOption('custom:Box');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.locator('#toast').waitFor({state:'hidden'});
        fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.screenshot({path:path.join(__dirname,'artifacts',`custom-data-${width}.png`),fullPage:true});
      });await context.close();
    }
    await check('offline build includes custom converter editing and execution',async()=>{
      const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/dist/lambda-lab.html');
      await page.locator('#custom-data-panel summary').click();await page.locator('#encoding-name').fill('Own');await page.locator('#encoding-source').fill('λn.n');await page.locator('#encoding-save').click();
      await page.locator('#expression').fill('4_Own');await page.locator('#convert').click();await page.locator('#step').click();assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse('4')));assert.equal(await page.locator('#decoded').textContent(),'自定义数据');await context.close();
    });
    assert.deepEqual(errors,[]);console.log(`Custom data: ${passed} passed, 0 failed; Chromium ${browser.version()}; page errors 0.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
