const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),C=require('../src/core.js'),P=require('../src/presets.js'),D=require('../src/decimal.js'),G=require('../src/guide.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
 if(!server.listening)await new Promise(r=>server.once('listening',r));
 const browser=await pw.chromium.launch({headless:true}),base=`http://127.0.0.1:${server.address().port}`,errors=[];let passed=0;
 const check=async(name,fn)=>{await fn();console.log(`PASS C${++passed} ${name}`);};
 const runUntilNormal=async page=>{
  const started=Date.now();await page.locator('#fast-run').click();
  for(;;){
   await page.waitForFunction(()=>['已到正规形','已暂停'].includes(document.getElementById('state-badge').textContent),null,{timeout:30000});
   if(await page.locator('#state-badge').textContent()==='已到正规形')return;
   assert.match(await page.locator('#run-status').textContent(),/观察窗口/, 'Only the timed growth safeguard may be continued');
   assert.ok(Date.now()-started<180000,'Known finite challenge should finish');await page.locator('#fast-run').click();
  }
 };
 const finish=async page=>{
  await runUntilNormal(page);
  await page.locator('#check-answer').click();assert.match(await page.locator('#challenge-feedback').textContent(),/完成/);
 };
 try{
  const context=await browser.newContext({viewport:{width:1280,height:950}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#mode-challenge').click();
  await check('desktop offers all six stages and rejects unfinished answers',async()=>{
   assert.equal(await page.locator('#challenge-count').textContent(),'30');assert.equal(await page.locator('#stage-select option').count(),6);assert.equal(await page.locator('#level-list button').count(),5);
   await page.locator('#check-answer').click();assert.match(await page.locator('#challenge-feedback').textContent(),/还有可归约/);
  });
  await check('answers require an explicit click and reset on close, reload, restore and stage changes',async()=>{
   assert.ok(await page.locator('#hint').isVisible());assert.ok(await page.locator('#challenge-target').isHidden());assert.equal(await page.locator('#target-expression').textContent(),'');
   await page.locator('#answer-toggle').click();assert.ok(await page.locator('#challenge-target').isVisible());assert.equal(await page.locator('#answer-toggle').getAttribute('aria-expanded'),'true');assert.equal(await page.locator('#target-expression').textContent(),P.levels[0].target);
   await page.locator('#answer-toggle').click();assert.ok(await page.locator('#challenge-target').isHidden());assert.equal(await page.locator('#target-expression').textContent(),'');
   await page.locator('#answer-toggle').click();await page.locator('#save-state').click();await page.reload();assert.ok(await page.locator('#challenge-target').isHidden());assert.equal(await page.locator('#answer-toggle').getAttribute('aria-expanded'),'false');
   await page.locator('#answer-toggle').click();await page.locator('#restore-state').click();assert.ok(await page.locator('#challenge-target').isHidden());
   await page.locator('#answer-toggle').click();await page.locator('#stage-select').selectOption('2');assert.ok(await page.locator('#challenge-target').isHidden());assert.equal(await page.locator('#target-label').textContent(),'');await page.locator('#stage-select').selectOption('1');
  });
  for(const level of P.levels)await check(`desktop level ${level.id} reduces and advances through real controls`,async()=>{
   assert.equal(await page.locator('#level-title').textContent(),level.name);
   assert.ok(await page.locator('#challenge-target').isHidden());assert.ok(await page.locator('#hint').isVisible());assert.equal(await page.locator('#target-expression').textContent(),'');assert.equal(await page.locator('#target-label').textContent(),'');assert.equal(await page.locator('#hint').textContent(),G.catalog().text(level.hint));
   assert.equal(await page.locator('#number-encoding').inputValue(),level.encoding??'church');
   if(level.decimalPlaces!==undefined)assert.equal(await page.locator('#decimal-places').inputValue(),String(level.decimalPlaces));
   await finish(page);assert.ok(await page.locator('#challenge-target').isHidden());assert.equal(await page.locator('#progress-text').textContent(),`${level.id} / 30 关已完成`);
   if(level.id<30){if(level.id%5===0)assert.equal(await page.locator('#next-level').textContent(),'下一阶段 →');await page.locator('#next-level').click();}
  });
  await check('all thirty records and final stage survive refresh and saved-state restore',async()=>{
   assert.match(await page.locator('#challenge-feedback').textContent(),/30 关全部完成/);assert.ok(await page.locator('#next-level').isHidden());await page.locator('#save-state').click();await page.reload();
   await page.waitForFunction(()=>document.getElementById('progress-text').textContent==='30 / 30 关已完成');
   assert.equal(await page.locator('#progress-text').textContent(),'30 / 30 关已完成');assert.equal(await page.locator('#stage-select').inputValue(),'6');assert.equal(await page.locator('#level-title').textContent(),P.levels[29].name);
   assert.equal(await page.locator('#level-list button.completed').count(),5);await page.locator('#check-answer').click();assert.match(await page.locator('#challenge-feedback').textContent(),/30 关全部完成/);
   fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('#challenge-panel').screenshot({path:path.join(__dirname,'artifacts','challenges-desktop.png')});
  });await context.close();
  const mobile=await browser.newContext({viewport:{width:390,height:950},hasTouch:true}),phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base);await phone.locator('#mode-challenge').click();
  await check('mobile selects every stage with five levels and no horizontal overflow',async()=>{
   for(const stage of P.stages){await phone.locator('#stage-select').selectOption(String(stage.id));assert.equal(await phone.locator('#level-list button').count(),5);assert.match(await phone.locator('#level-list button').first().textContent(),new RegExp(`^${stage.levelIds[0]} `));assert.ok(await phone.locator('#hint').isVisible());assert.ok(await phone.locator('#challenge-target').isHidden());assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  });
  await check('mobile lambda-internal reduction, decimals and symbolic integral can pass',async()=>{
   await phone.locator('#stage-select').selectOption('2');await phone.locator('#level-list button').nth(3).click();await finish(phone);
   await phone.locator('#stage-select').selectOption('5');await finish(phone);assert.equal(await phone.locator('#decoded').textContent(),'小数 0.3');
   await phone.locator('#stage-select').selectOption('6');await phone.locator('#level-list button').nth(3).click();await finish(phone);assert.ok(await phone.locator('#challenge-target').isHidden());assert.equal(await phone.locator('#target-expression').textContent(),'');await phone.locator('#answer-toggle').click();assert.equal(await phone.locator('#target-expression').textContent(),'1/2x²');await phone.locator('#answer-toggle').click();assert.ok(await phone.locator('#challenge-target').isHidden());
   await phone.locator('#challenge-panel').screenshot({path:path.join(__dirname,'artifacts','challenges-mobile.png')});
  });
  await check('mobile approximate decimal cannot pass exact division target',async()=>{
   await phone.locator('#stage-select').selectOption('5');await phone.locator('#level-list button').nth(3).click();await phone.locator('#decimal-places').fill('2');await phone.locator('#expression').fill(D.expression('DIV',['1_decimal','8_decimal'],2));await phone.locator('#convert').click();await runUntilNormal(phone);
   assert.equal(await phone.locator('#decoded').textContent(),'小数 0.12');await phone.locator('#check-answer').click();assert.match(await phone.locator('#challenge-feedback').textContent(),/还不是/);
  });await mobile.close();
  await check('legacy five-level progress restores and continues into stage two',async()=>{
   const ctx=await browser.newContext(),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
   const raw={version:2,draft:'5',functions:[],completed:[1,2,3,4,5],mode:'challenge',level:4,session:{original:C.parse('5'),steps:0,dirty:false,halt:''},view:{speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''};
   await p.addInitScript(raw=>localStorage.setItem('lambda-lab-v2',JSON.stringify(raw)),raw);await p.goto(base);assert.equal(await p.locator('#progress-text').textContent(),'5 / 30 关已完成');assert.equal(await p.locator('#stage-select').inputValue(),'1');
   await p.locator('#check-answer').click();await p.locator('#next-level').click();assert.equal(await p.locator('#stage-select').inputValue(),'2');assert.equal(await p.locator('#level-title').textContent(),P.levels[5].name);await ctx.close();
  });
  await check('offline HTML includes stages, selects decimals and completes a symbolic challenge',async()=>{
   const ctx=await browser.newContext(),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/dist/lambda-lab.html');await p.locator('#mode-challenge').click();assert.equal(await p.locator('#stage-select option').count(),6);
   await p.locator('#stage-select').selectOption('5');assert.equal(await p.locator('#number-encoding').inputValue(),'decimal');await p.locator('#stage-select').selectOption('6');await p.locator('#level-list button').nth(2).click();await finish(p);await ctx.close();
  });
  assert.deepEqual(errors,[]);console.log(`Challenge browser: ${passed} passed, 0 failed; Chromium ${browser.version()}; page errors 0.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
