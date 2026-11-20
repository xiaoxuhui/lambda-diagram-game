const assert=require('node:assert/strict'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
const C=require('../src/core.js'),S=require('../src/snapshot.js'),L=require('../src/library.js');
const draft='(λx.x) ((λy.y) (λz.z))';
const seed=S.encode({version:2,draft,functions:[],completed:[],mode:'free',level:0,
  session:{original:C.parse(draft),steps:1,dirty:false,halt:''},
  view:{numberEncoding:'church',speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},
  selection:{start:0,end:0},error:''});
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}`,browser=await pw.chromium.launch({headless:true});
  let passed=0;const errors=[];
  async function setup(text,recover=false){const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
    await page.evaluate(text=>localStorage.setItem('lambda-lab-v2',text),text);
    if(recover)await page.goto(base+'/?recover=1');else await page.reload();
    return {context,page};}
  async function check(name,fn){await fn();console.log('PASS',++passed,name);}
  try{
    await check('corrupt auto-save survives startup, refresh and pagehide byte for byte',async()=>{
      const raw='{ broken original save', {context,page}=await setup(raw);
      await page.locator('#export-original-save').waitFor();await page.waitForTimeout(300);
      assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-v2')),raw);
      await page.reload();await page.locator('#export-original-save').waitFor();
      await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
      assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-v2')),raw);
      const pending=page.waitForEvent('download');await page.locator('#export-original-save').click();
      const stream=await(await pending).createReadStream();let value='';for await(const c of stream)value+=c.toString();assert.equal(value,raw);
      await context.close();
    });
    await check('recovery mode saves added functions and unfinished edits without deleting stored steps',async()=>{
      const {context,page}=await setup(seed,true);
      await page.locator('#function-name').fill('kept');await page.locator('#function-source').fill('λx.x');await page.locator('#function-add').click();
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')).functions.length===1);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')).session.steps),1);
      await page.locator('#function-name').fill('unfinished');await page.locator('#function-source').fill('λx.');await page.waitForTimeout(300);
      await page.reload();assert.equal(await page.locator('#function-count').textContent(),'1 个函数');
      assert.equal(await page.locator('#function-name').inputValue(),'unfinished');assert.equal(await page.locator('#function-source').inputValue(),'λx.');
      await page.goto(base);assert.equal(await page.locator('#step-count').textContent(),'1');
      assert.equal(await page.locator('#current-expression').textContent(),C.format(S.decode(seed).term));
      assert.equal(await page.locator('#function-count').textContent(),'1 个函数');await context.close();
    });
    await check('stale second tab cannot overwrite newer saved state',async()=>{
      const {context,page}=await setup(seed),other=await context.newPage();await other.goto(base);
      await page.locator('#expression').fill('λnewest.newest');await page.waitForTimeout(350);
      const latest=await page.evaluate(()=>localStorage.getItem('lambda-lab-v2'));
      await other.locator('#expression').fill('λstale.stale');await other.waitForTimeout(350);
      await other.evaluate(()=>dispatchEvent(new Event('pagehide')));
      assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-v2')),latest);
      assert.match(await other.locator('#save-feedback').textContent(),/另一个页面/);
      const previous=await page.evaluate(()=>localStorage.getItem('lambda-lab-previous-v2'));
      assert.equal(S.decodeStartingState(previous).draft,draft);await context.close();
    });
    await check('recovery draft edits preserve old history until a new conversion starts',async()=>{
      const {context,page}=await setup(seed,true);
      await page.locator('#expression').fill('λedited.edited');await page.waitForTimeout(350);
      let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')));
      assert.equal(saved.draft,'λedited.edited');assert.equal(saved.session.steps,1);assert.equal(saved.session.dirty,true);
      await page.locator('#expression').fill(draft);await page.locator('#convert').click();await page.waitForTimeout(350);
      saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')));
      assert.equal(saved.session.steps,0);assert.equal(saved.session.dirty,false);
      await page.locator('#step').click();await page.waitForFunction(()=>document.getElementById('step-count').textContent==='1');
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('lambda-lab-v2')).session.steps===1);await page.goto(base);
      assert.equal(await page.locator('#step-count').textContent(),'1');await context.close();
    });
    await check('storage quota failure leaves original auto-save intact',async()=>{
      const {context,page}=await setup(seed),before=await page.evaluate(()=>localStorage.getItem('lambda-lab-v2'));
      await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='lambda-lab-previous-v2')throw new DOMException('full','QuotaExceededError');return set.call(this,key,value);};});
      await page.locator('#expression').fill('λunsaved.unsaved');await page.waitForTimeout(350);
      assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-v2')),before);
      assert.match(await page.locator('#storage-status').textContent(),/不可用/);await context.close();
    });
    await check('manual save rolls back its checkpoint and reports an auto-save write failure',async()=>{
      const {context,page}=await setup(seed);await page.locator('#save-state').click();
      const before=await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]);
      await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='lambda-lab-v2')throw Error('injected auto write failure');return set.call(this,key,value);};});
      await page.locator('#expression').fill('λunsaved.unsaved');await page.locator('#save-state').click();
      assert.match(await page.locator('#save-feedback').textContent(),/未能保存|失败/);
      assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]),before);await context.close();
    });
    await check('stale manual save cannot overwrite another tab auto-save or checkpoint',async()=>{
      const {context,page}=await setup(seed);await page.locator('#save-state').click();
      const newer=JSON.parse(seed);newer.draft='λnewest.newest';newer.session={original:C.parse(newer.draft),steps:0,dirty:false,halt:''};
      const text=S.encode(newer);await page.evaluate(text=>{localStorage.setItem('lambda-lab-v2',text);localStorage.setItem('lambda-lab-checkpoint-v2',text);},text);
      await page.locator('#save-state').click();
      assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]),[text,text]);
      assert.match(await page.locator('#save-feedback').textContent(),/另一个页面|其他页面/);await context.close();
    });
    await check('failed import leaves both saved keys and the visible scene unchanged',async()=>{
      const {context,page}=await setup(seed);await page.locator('#save-state').click();const previous=await page.locator('#current-expression').textContent();
      const before=await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]);
      const target=JSON.parse(seed);target.draft='λimported.imported';target.functions=L.add([],'importedfunction','λx.x');target.session={original:C.parse(target.draft),steps:0,dirty:false,halt:''};
      const text=S.encodeBackup(target,S.encode(target));
      await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='lambda-lab-v2')throw Error('injected import write failure');return set.call(this,key,value);};});
      await page.locator('#import-file').setInputFiles({name:'injected.json',mimeType:'application/json',buffer:Buffer.from(text)});
      await page.waitForFunction(()=>document.getElementById('save-feedback').textContent.includes('导入'));
      assert.match(await page.locator('#save-feedback').textContent(),/导入失败/);
      assert.equal(await page.locator('#current-expression').textContent(),previous);assert.equal(await page.locator('#function-count').textContent(),'0 个函数');
      assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]),before);await context.close();
    });
    await check('failed checkpoint restore leaves the visible scene and auto-save unchanged',async()=>{
      const {context,page}=await setup(seed);await page.locator('#save-state').click();
      await page.locator('#expression').fill('λcurrent.current');await page.locator('#convert').click();await page.waitForTimeout(350);
      const current=await page.locator('#current-expression').textContent(),before=await page.evaluate(()=>localStorage.getItem('lambda-lab-v2'));
      await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='lambda-lab-v2')throw Error('injected restore write failure');return set.call(this,key,value);};});
      await page.locator('#restore-state').click();assert.match(await page.locator('#save-feedback').textContent(),/失败/);
      assert.equal(await page.locator('#current-expression').textContent(),current);assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-v2')),before);await context.close();
    });
    await check('checkpoint write failure rolls back an already-written auto-save',async()=>{
      const {context,page}=await setup(seed);await page.locator('#save-state').click();const before=await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]);
      await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='lambda-lab-checkpoint-v2')throw Error('injected checkpoint write failure');return set.call(this,key,value);};});
      await page.locator('#expression').fill('λpending.pending');await page.locator('#save-state').click();assert.match(await page.locator('#save-feedback').textContent(),/未能保存/);
      assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('lambda-lab-v2'),localStorage.getItem('lambda-lab-checkpoint-v2')]),before);await context.close();
    });
    await check('manual save cannot replace a protected invalid original with the default scene',async()=>{
      const raw='{ protected original',{context,page}=await setup(raw);await page.locator('#export-original-save').waitFor();
      await page.locator('#save-state').click();assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-v2')),raw);
      assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-checkpoint-v2')),null);assert.match(await page.locator('#save-feedback').textContent(),/保护/);await context.close();
    });
    assert.deepEqual(errors,[]);console.log(`Save protection: ${passed} passed.`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
