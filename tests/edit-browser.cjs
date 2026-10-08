const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));const browser=await pw.chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1200,height:900},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));let count=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS E${++count} ${name}`);};
  const add=async(name,source)=>{await page.locator('#function-name').fill(name);await page.locator('#function-source').fill(source);await page.locator('#function-add').click();};
  const edit=async(name)=>page.getByRole('button',{name:`编辑函数 ${name}`,exact:true}).click();
  const source=async(s)=>{await page.locator('#expression').fill(s);await page.locator('#convert').click();};
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);await add('ID','λx.x');await add('COPY','ID');
    await check('edit loads full definition and saving changes replaces the original function',async()=>{
      await source('ID (λz.z)');await edit('ID');assert.equal(await page.locator('#function-name').inputValue(),'ID');assert.equal(await page.locator('#function-source').inputValue(),'λx.x');assert.equal(await page.locator('#function-add').textContent(),'保存修改 ✓');
      await page.locator('#function-source').fill('λx y.y');await page.locator('#function-add').click();assert.equal(await page.locator('.function-item').count(),2);
      await page.locator('#step').click();assert.equal(await page.locator('#current-expression').textContent(),'λz.z');
      await source('ID (λz.z)');await page.locator('#step').click();assert.equal(await page.locator('#current-expression').textContent(),'λy.y');
      await source('COPY');assert.equal(await page.locator('#current-expression').textContent(),'λx.x');assert.ok(await page.locator('#function-cancel').isHidden());
    });
    await check('invalid source and rename collision leave the original function intact',async()=>{
      await edit('ID');await page.locator('#function-source').fill('λx.');await page.locator('#function-add').click();assert.ok(await page.locator('#function-error').isVisible());
      assert.equal(await page.locator('.function-item[data-name="ID"] > code').textContent(),'λx.λy.y');
      await page.locator('#function-source').fill('λx.x');await page.locator('#function-name').fill('COPY');await page.locator('#function-add').click();assert.match(await page.locator('#function-error').textContent(),/已存在/);assert.equal(await page.locator('.function-item').count(),2);
    });
    await check('cancel discards draft and returns to add mode',async()=>{await page.locator('#function-cancel').click();assert.equal(await page.locator('#function-name').inputValue(),'');assert.equal(await page.locator('#function-source').inputValue(),'');assert.equal(await page.locator('#function-add').textContent(),'新增函数 +');assert.equal(await page.locator('.function-item[data-name="ID"] > code').textContent(),'λx.λy.y');});
    await check('renaming preserves function count and new name is callable',async()=>{await edit('ID');await page.locator('#function-name').fill('IDENTITY');await page.locator('#function-source').fill('λx.x');await page.locator('#function-add').click();assert.equal(await page.locator('.function-item[data-name="ID"]').count(),0);assert.equal(await page.locator('.function-item').count(),2);await source('IDENTITY (λz.z)');await page.locator('#step').click();assert.equal(await page.locator('#current-expression').textContent(),'λz.z');});
    await check('unfinished edit survives save, reload, restore and import',async()=>{
      await edit('IDENTITY');await page.locator('#function-name').fill('NEWNAME');await page.locator('#function-source').fill('λx.');await page.locator('#save-state').click();await page.reload();
      assert.equal(await page.locator('#function-add').textContent(),'保存修改 ✓');assert.equal(await page.locator('#function-source').inputValue(),'λx.');assert.equal(await page.locator('#function-name').inputValue(),'NEWNAME');
      const saved=await page.evaluate(()=>localStorage.getItem('lambda-lab-v2'));
      await page.locator('#function-cancel').click();await page.locator('#restore-state').click();assert.equal(await page.locator('#function-add').textContent(),'保存修改 ✓');
      await page.locator('#function-cancel').click();await page.locator('#import-file').setInputFiles({name:'edit.json',mimeType:'application/json',buffer:Buffer.from(saved)});await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('存档已导入'));
      assert.equal(await page.locator('#function-add').textContent(),'保存修改 ✓');await page.locator('#function-source').fill('λz.z');await page.locator('#function-add').click();assert.equal(await page.locator('.function-item[data-name="NEWNAME"]').count(),1);assert.equal(await page.locator('.function-item').count(),2);
    });
    await check('deleting the function currently being edited exits edit mode',async()=>{await edit('NEWNAME');await page.getByRole('button',{name:'删除函数 NEWNAME',exact:true}).click();assert.equal(await page.locator('#function-add').textContent(),'新增函数 +');assert.ok(await page.locator('#function-cancel').isHidden());await page.reload();assert.equal(await page.locator('.function-item').count(),1);});
    await check('mobile edit buttons fit and touch editing works',async()=>{
      await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'编辑函数 COPY',exact:true}).tap();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      for(const id of ['function-add','function-cancel']){const b=await page.locator('#'+id).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=390);}
      fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('.function-card').screenshot({path:path.join(__dirname,'artifacts','edit-mobile.png')});
      await page.locator('#function-source').fill('λx y.x');await page.locator('#function-add').tap();assert.equal(await page.locator('.function-item[data-name="COPY"] > code').textContent(),'λx.λy.x');
    });
    await check('offline build supports editing',async()=>{const offline=await browser.newPage();offline.on('pageerror',e=>errors.push(e.message));await offline.goto(pathToFileURL(path.resolve(__dirname,'../dist/lambda-lab.html')).href);await offline.locator('#function-name').fill('F');await offline.locator('#function-source').fill('λx.x');await offline.locator('#function-add').click();await offline.getByRole('button',{name:'编辑函数 F',exact:true}).click();await offline.locator('#function-source').fill('λx y.y');await offline.locator('#function-add').click();assert.equal(await offline.locator('.function-item').count(),1);assert.equal(await offline.locator('.function-item > code').textContent(),'λx.λy.y');await offline.close();});
    await check('large expanded functions load and save without truncation',async()=>{await page.setViewportSize({width:1200,height:900});await add('BIG','1024');await edit('BIG');assert.ok((await page.locator('#function-source').inputValue()).length>1500);await page.locator('#function-add').click();assert.ok(await page.locator('#function-error').isHidden());await source('BIG');assert.equal(await page.locator('#decoded').textContent(),'Church 数 1024');});
    await check('no browser JavaScript errors',async()=>assert.deepEqual(errors,[]));
    console.log(`Edit browser checks: ${count} passed, 0 failed.`);
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
