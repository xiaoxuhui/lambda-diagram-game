const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const C=require('../src/core.js'),S=require('../src/snapshot.js'),L=require('../src/library.js'),P=require('../src/presets.js'),B=require('../src/example-library.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
const draft='(λx.x) ((λy.y) (λz.z))',seed=S.encode({version:2,draft,functions:L.add([],'mykeep','λx.x'),completed:[1],mode:'free',level:0,session:{original:C.parse(draft),steps:1,dirty:false,halt:''},view:{numberEncoding:'church',decimalPlaces:6,speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''});
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));const browser=await pw.chromium.launch();try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(width===390?pathToFileURL(path.resolve(__dirname,'../index.html')).href:`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(text=>localStorage.setItem('lambda-lab-v2',text),seed);await page.reload();await page.waitForFunction(()=>document.getElementById('step-count').textContent==='1');
  const stored=()=>page.evaluate(()=>LambdaSnapshot.validate(JSON.parse(localStorage.getItem('lambda-lab-v2'))));
  const add=async locator=>{await locator.click();await page.waitForFunction(()=>!document.getElementById('library-add-all').disabled);return page.locator('#library-import-feedback').textContent();};
  const nth=P.examples.findIndex(example=>example.listOperation?.name==='nth'),succ=P.examples.findIndex(example=>example.name.startsWith('后继'));
  await page.locator('#mode-library').click();assert.equal(await page.locator('#lab-screen').isVisible(),false);assert.equal(await page.locator('#guide-panel').isVisible(),false);
  assert.equal(await page.locator('.library-example').count(),P.examples.length);
  await add(page.locator(`.library-example[data-index="${nth}"] button`));
  let current=await stored();assert.equal(current.functions.length,B.collect([nth]).definitions.length+1);
  await page.locator(`.library-example[data-index="${nth}"] input`).check();await page.locator('#library-category').selectOption('基础数学');await page.locator(`.library-example[data-index="${succ}"] input`).check();
  assert.match(await page.locator('#library-selection-count').textContent(),/已选择 2 个/);await add(page.locator('#library-add-selected'));
  current=await stored();assert.equal(current.functions.length,B.collect([nth,succ]).definitions.length+1);
  await page.locator('#library-clear-selection').click();assert.equal(await page.locator('#library-add-selected').isDisabled(),true);
  await page.locator('#library-search').fill('后继');assert.equal(await page.locator('.library-example').count(),1);await page.locator('#library-select-visible').click();assert.match(await page.locator('#library-selection-count').textContent(),/已选择 1 个/);
  await add(page.getByRole('button',{name:'将基础数学整章加入函数库',exact:true}));
  const chapter=P.examples.flatMap((example,index)=>example.category==='基础数学'?[index]:[]);
  current=await stored();assert.equal(current.functions.length,B.collect([nth,...chapter]).definitions.length+1);
  await page.locator('#library-search').fill('没有这个示例');assert.equal(await page.locator('#library-empty').isVisible(),true);assert.equal(await page.locator('#library-select-visible').isDisabled(),true);
  // Failed storage must not install even part of the missing functions.
  await page.waitForTimeout(350);const before=await page.evaluate(()=>localStorage.getItem('lambda-lab-v2'));
  await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='lambda-lab-v2')throw new DOMException('test quota','QuotaExceededError');return window.originalSetItem.call(this,key,value);};});
  assert.match(await add(page.locator('#library-add-all')),/存档写入失败/);assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-v2')),before);
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
  const all=B.collect(P.examples.map((_,index)=>index));
  assert.match(await add(page.locator('#library-add-all')),new RegExp(`已处理 ${P.examples.length} 个示例`));
  const verifyAll=async()=>{const state=await stored();assert.equal(state.functions.length,all.definitions.length+1);for(const definition of all.definitions)assert.equal(state.functions.find(fn=>fn.name===definition.name).source,definition.source);assert.equal(state.draft,draft);assert.equal(state.session.steps,1);assert.deepEqual(state.completed,[1]);assert.ok(state.functions.find(fn=>fn.name==='mykeep'));};
  await verifyAll();await add(page.locator('#library-add-all'));await verifyAll();
  await page.locator('#library-back').click();assert.equal(await page.locator('#expression').inputValue(),draft);assert.equal(await page.locator('#step-count').textContent(),'1');
  await page.getByRole('button',{name:'编辑函数 nth',exact:true}).click();await page.locator('#function-source').fill('λx.broken');await page.locator('#function-add').click();await page.waitForFunction(()=>!document.getElementById('function-add').disabled);
  await page.locator('#mode-library').click();const conflicting=JSON.stringify((await stored()).functions);
  assert.match(await add(page.locator('#library-add-all')),/示例定义不一致：nth/);assert.equal(JSON.stringify((await stored()).functions),conflicting);
  await page.locator('#library-collision-options [data-function-collision="replace"]').click();await add(page.locator('#library-add-all'));await verifyAll();
  await page.reload();await page.locator('#library-panel').waitFor();await verifyAll();assert.equal(await page.locator('#mode-library').getAttribute('aria-pressed'),'true');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.screenshot({path:path.join(__dirname,`artifacts/example-library-${width}.png`)});
  await page.locator('#library-back').click();assert.equal(await page.locator('#step-count').textContent(),'1');
  // Original example and guide entrances continue to work. Selecting an old
  // example intentionally loads its draft, after the history checks above.
  await page.locator('#examples').selectOption(String(nth));await page.locator('#example-add-library').click();assert.match(await page.locator('#example-library-feedback').textContent(),/逐字核对/);
  await page.locator('#mode-guide').click();await page.locator('#guide-example').selectOption(String(nth));await page.locator('#guide-add-library').click();assert.match(await page.locator('#guide-library-feedback').textContent(),/逐字核对/);assert.equal((await stored()).functions.length,all.definitions.length+1);
  console.log(`PASS ${width}px (${width===390?'file':'http'}): individual/multiple/chapter/all, filter-independent batches, exact definitions, duplicate reuse, conflict and storage rollback, old entrances and saved history`);
  await context.close();
 }
}finally{await browser.close();server.close();}})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
