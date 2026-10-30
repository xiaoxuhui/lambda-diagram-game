const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),C=require('../src/core.js'),D=require('../src/decimal.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
 if(!server.listening)await new Promise(r=>server.once('listening',r));const browser=await pw.chromium.launch({headless:true}),base=`http://127.0.0.1:${server.address().port}`;let passed=0;const errors=[];
 const check=async(name,fn)=>{await fn();console.log(`PASS D${++passed} ${name}`);};
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:950},hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
   const source=async(s)=>{await page.locator('#expression').fill(s);await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isHidden(),s);};
   const operation=async(op,a,b)=>source(D.expression(op,[a,b],Number(await page.locator('#decimal-places').inputValue())));
   const fast=async(result)=>{await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:240000});assert.equal(await page.locator('#decoded').textContent(),result);};
   await check(`${width}px default integer, signed and long decimal input uses lists`,async()=>{
    assert.equal(await page.locator('#number-encoding').inputValue(),'decimal');assert.equal(await page.locator('#decimal-places').inputValue(),'6');
    for(const [s,want] of [['3','小数 3'],['-0.125','小数 -0.125'],['9007199254740993.25','小数 9007199254740993.25']]){await source(s);assert.equal(await page.locator('#decoded').textContent(),want);}
   });
   await check(`${width}px exact addition preserves every beta step and backtracking`,async()=>{
    await operation('ADD','0.1','0.2');await fast('小数 0.3');const n=Number(await page.locator('#step-count').textContent());assert.ok(n>100);assert.equal(await page.locator('#history-list li').count(),n+1);
    await page.locator('#back').click();assert.equal(Number(await page.locator('#step-count').textContent()),n-1);await page.locator('#step').click();assert.equal(await page.locator('#decoded').textContent(),'小数 0.3');
   });
   await check(`${width}px subtraction gives negative values and decimal multiplication is exact`,async()=>{
    await operation('SUB','1','2');await fast('小数 -1');await operation('MUL','0.2','0.3');await fast('小数 0.06');
   });
   await check(`${width}px long division marks exact versus truncated results`,async()=>{
    await page.locator('#decimal-places').fill('3');await page.locator('#examples').selectOption({label:'列表小数除法 · 1 ÷ 8 → 0.125'});assert.equal(await page.locator('#expression').inputValue(),D.expression('DIV',['1','8'],3));await fast('小数 0.125');
    const before=await page.locator('#expression').inputValue();await page.locator('#decimal-places').fill('2');assert.equal(await page.locator('#expression').inputValue(),before);await operation('DIV','1','3');await fast('小数 ≈ 0.33');await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#decoded').textContent(),'小数 ≈ 0.33');assert.equal(await page.locator('#decimal-places').inputValue(),'2');
   });
   await check(`${width}px zero division reports an error and invalid precision is rejected`,async()=>{
    await operation('DIV','1','0');await fast('错误：除数不能为0');await page.locator('#decimal-places').fill('-1');await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isVisible());await page.locator('#decimal-places').fill('2');
   });
   await check(`${width}px decimal function source, state and defaults survive reload`,async()=>{
    const definition='λx.'+D.expression('ADD',['x','0.1']);assert.ok(definition.length>1500);
    await page.locator('#function-name').fill('INC');await page.locator('#function-source').fill(definition);await page.locator('#function-add').click();assert.ok(await page.locator('#function-error').isHidden());await source('INC 0.2');await fast('小数 0.3');await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#number-encoding').inputValue(),'decimal');assert.equal(await page.locator('#decoded').textContent(),'小数 0.3');
    await page.getByRole('button',{name:'编辑函数 INC',exact:true}).click();assert.equal(await page.locator('#function-source').inputValue(),definition);await page.locator('#function-cancel').click();
   });
   await check(`${width}px former builtin names are free and custom DEC_ADD runs`,async()=>{
    for(const name of ['ADD','DEC_ADD','DECADD']){await source(name+' 0.1 0.2');assert.equal(await page.locator('#decoded').textContent(),'1 个自由变量');}
    await page.locator('#function-name').fill('DEC_ADD');await page.locator('#function-source').fill('λa b.a');await page.locator('#function-add').click();assert.ok(await page.locator('#function-error').isHidden());await source('DEC_ADD 0.1 0.2');await fast('小数 0.1');
   });
   await check(`${width}px long complete source and function definition survive reload without truncation`,async()=>{
    const text=D.expression('ADD',['0.1','0.2'])+' '.repeat(12000);await source(text);assert.equal(await page.locator('#char-count').textContent(),`${text.length} 字符`);await fast('小数 0.3');
    await page.locator('#function-name').fill('LONG');await page.locator('#function-source').fill(text);await page.locator('#function-add').click();assert.ok(await page.locator('#function-error').isHidden());await page.locator('#save-state').click();await page.reload();assert.equal(await page.locator('#expression').inputValue(),text);assert.equal(await page.locator('#decoded').textContent(),'小数 0.3');
    await page.getByRole('button',{name:'编辑函数 LONG',exact:true}).click();assert.equal(await page.locator('#function-source').inputValue(),text);await page.locator('#function-cancel').click();
   });
   await check(`${width}px Church compatibility remains explicit and controls fit`,async()=>{
    await page.locator('#number-encoding').selectOption('church');await source('3');assert.equal(await page.locator('#decoded').textContent(),'Church 数 3');await page.locator('#number-encoding').selectOption('decimal');await source('-12.375');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await page.locator('#number-encoding').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('.editor-card').screenshot({path:path.join(__dirname,'artifacts',`decimal-${width}.png`)});
   });await context.close();
  }
  await check('standalone file defaults to decimal data without external dependencies',async()=>{
   const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/dist/lambda-lab.html');assert.equal(await page.locator('#number-encoding').inputValue(),'decimal');await page.locator('#expression').fill('-0.5');await page.locator('#convert').click();assert.equal(await page.locator('#decoded').textContent(),'小数 -0.5');await context.close();
  });
  await check('old v2 frame remains Church encoded while new typing defaults to decimal lists',async()=>{
   const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   const raw={version:2,draft:'2',functions:[],completed:[],mode:'free',level:0,session:{original:C.parse('2'),steps:0,dirty:false,halt:''},view:{speed:600,scale:1,autoFit:true,panX:0,panY:0,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''};
   await page.addInitScript(raw=>localStorage.setItem('lambda-lab-v2',JSON.stringify(raw)),raw);await page.goto(base);assert.equal(await page.locator('#decoded').textContent(),'Church 数 2');assert.equal(await page.locator('#number-encoding').inputValue(),'decimal');
   await page.locator('#expression').fill('-0.25');await page.locator('#convert').click();assert.equal(await page.locator('#decoded').textContent(),'小数 -0.25');await context.close();
  });
  await check('decimal presets do not accidentally call an old custom ADD function',async()=>{
   const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
   for(const name of ['ADD','SUB','MUL','DIV','DEC_ADD','DEC_SUB','DEC_MUL','DEC_DIV']){await page.locator('#function-name').fill(name);await page.locator('#function-source').fill('λa b.a');await page.locator('#function-add').click();}
   await page.locator('#examples').selectOption({label:'列表小数加法 · 0.1 + 0.2 → 0.3'});const text=await page.locator('#expression').inputValue();assert.ok(text.length>1500);assert.equal(text,D.expression('ADD',['0.1','0.2']));assert.equal(C.freeVars(C.parseInput(text)).size,0);await page.locator('#fast-run').click();await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:120000});assert.equal(await page.locator('#decoded').textContent(),'小数 0.3');assert.equal(await page.locator('#function-count').textContent(),'8 个函数');await context.close();
  });assert.deepEqual(errors,[]);console.log(`Decimal browser: ${passed} passed, 0 failed; Chromium ${browser.version()}; page errors 0.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
