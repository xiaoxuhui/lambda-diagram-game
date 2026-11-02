const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),C=require('../src/core.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch({headless:true}),base=`http://127.0.0.1:${server.address().port}`,errors=[];let passed=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS F${++passed} ${name}`);};
  try{
    for(const width of [1280,390]){
      const context=await browser.newContext({viewport:{width,height:950},hasTouch:true,acceptDownloads:true}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base);
      const format=async template=>{
        if(!await page.locator('#input-format-panel').evaluate(panel=>panel.open))await page.locator('#input-format-title').click();
        await page.locator('#input-format').fill(template);await page.locator('#save-input-format').click();assert.ok(await page.locator('#input-format-error').isHidden());
      };
      const source=async(text,label)=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();await page.waitForFunction(label=>document.getElementById('decoded').textContent===label,label);assert.ok(await page.locator('#error-message').isHidden());};
      await check(`${width}px Church prefix and suffix forms work while standard suffixes remain valid`,async()=>{
        await format('C{n}');assert.match(await page.locator('#input-format-preview').textContent(),/C3/);await source('C3','Church 数 3');
        await format('{n}c');await source('3c','Church 数 3');await source('3_church','Church 数 3');await source('3_丘奇数','Church 数 3');
        await source('λC3.C3','I · 恒等函数');await format('C{n}');await source('λC3.C3','I · 恒等函数');
        await source('C3','Church 数 3');await page.locator('#toast').waitFor({state:'hidden'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('.editor-card').screenshot({path:path.join(__dirname,'artifacts',`input-format-configured-${width}.png`)});
      });
      await check(`${width}px decimal templates accept signs and fractional values`,async()=>{
        await page.locator('#number-encoding').selectOption('decimal');await format('{n}d');await source('-1.25d','小数 -1.25');
        await source('C2','Church 数 2');await source('0.5_decimal','小数 0.5');
      });
      await check(`${width}px custom bracket syntax prepares data without changing the graph`,async()=>{
        await page.locator('#custom-data-panel > summary').click();await page.locator('#encoding-name').fill('Box');await page.locator('#encoding-source').fill('λn.λk.k n');await page.locator('#encoding-save').click();
        await format('[{n}]');const previous=await page.locator('#current-expression').textContent();await page.locator('#expression').fill('[3]');
        await page.waitForFunction(()=>document.getElementById('encoding-progress').textContent.includes('已归约就绪'));
        assert.equal(await page.locator('#current-expression').textContent(),previous);await page.locator('#convert').click();await page.waitForFunction(()=>document.getElementById('decoded').textContent==='3_Box');
        assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse('λk.k 3')));await source('3_Box','3_Box');
      });
      await check(`${width}px custom syntax is accepted in functions and their original source stays editable`,async()=>{
        await page.locator('#function-name').fill('VALUE');await page.locator('#function-source').fill('[3]');await page.locator('#function-add').click();await page.waitForFunction(()=>document.getElementById('function-count').textContent==='1 个函数');
        await source('VALUE','3_Box');await page.getByRole('button',{name:'编辑函数 VALUE',exact:true}).click();assert.equal(await page.locator('#function-source').inputValue(),'[3]');
        await page.locator('#function-name').fill('RENAMED');await page.locator('#function-add').click();assert.ok(await page.locator('#function-error').isHidden());await source('RENAMED','3_Box');
      });
      await check(`${width}px invalid or conflicting templates do not replace the active format`,async()=>{
        await page.locator('#input-format').fill('C{n}');await page.locator('#save-input-format').click();assert.ok(await page.locator('#input-format-error').isVisible());await source('[3]','3_Box');
        await page.locator('#input-format').fill('{n}');await page.locator('#save-input-format').click();assert.ok(await page.locator('#input-format-error').isVisible());
        await page.locator('#input-format').fill('Draft{n}');await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#input-format').inputValue(),'Draft{n}');
        await source('[3]','3_Box');assert.equal(await page.locator('#input-format-title').textContent(),'输入形式 · [3]');
      });
      await check(`${width}px formats survive backup, clear and import`,async()=>{
        const pending=page.waitForEvent('download');await page.locator('#clear-all').click();const download=await pending,backup=fs.readFileSync(await download.path(),'utf8');
        assert.equal(await page.locator('#input-format').inputValue(),'{n}_church');
        await page.locator('#import-file').setInputFiles({name:'input-formats.json',mimeType:'application/json',buffer:Buffer.from(backup)});
        await page.waitForFunction(()=>document.getElementById('number-encoding').value==='custom:Box');await source('[3]','3_Box');
        await page.locator('#number-encoding').selectOption('decimal');await source('-0.5d','小数 -0.5');await page.locator('#number-encoding').selectOption('church');await source('C3','Church 数 3');
      });
      await check(`${width}px reset restores the standard input form and layout stays compact`,async()=>{
        if(!await page.locator('#input-format-panel').evaluate(panel=>panel.open))await page.locator('#input-format-title').click();
        await page.locator('#reset-input-format').click();assert.equal(await page.locator('#input-format').inputValue(),'{n}_church');
        await source('3_church','Church 数 3');await page.locator('#expression').fill('C3');await page.locator('#convert').click();await page.waitForFunction(()=>document.getElementById('decoded').textContent==='1 个自由变量');
        await page.locator('#input-format-title').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('.editor-card').screenshot({path:path.join(__dirname,'artifacts',`input-format-${width}.png`)});
      });await context.close();
    }
    await check('offline build supports a saved Church prefix syntax',async()=>{
      const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'/dist/lambda-lab.html');
      await page.locator('#input-format-title').click();await page.locator('#input-format').fill('C{n}');await page.locator('#save-input-format').click();
      await page.locator('#expression').fill('C4');await page.locator('#convert').click();await page.waitForFunction(()=>document.getElementById('decoded').textContent==='Church 数 4');await context.close();
    });
    assert.deepEqual(errors,[]);console.log(`Input formats: ${passed} passed, 0 failed; Chromium ${browser.version()}; page errors 0.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
