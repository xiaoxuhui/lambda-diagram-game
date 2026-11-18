const assert=require('node:assert/strict'),path=require('node:path');
const C=require('../src/core.js'),P=require('../src/presets.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));let count=0;
  const check=async(name,fn)=>{await fn();console.log(`PASS FIB${++count} ${name}`);};
  const source=async text=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();assert.ok(await page.locator('#error-message').isHidden());};
  const paused=()=>page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已暂停'&&document.getElementById('run-status').textContent.includes('尚未确认'),null,{timeout:10000});
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const body=C.format(C.parse(P.examples.find(e=>e.name.startsWith('斐波那契')).term).fn);
    await page.locator('#function-name').fill('MYFIB');await page.locator('#function-source').fill(body);await page.locator('#function-add').click();
    await page.getByRole('button',{name:'插入函数 MYFIB',exact:true}).waitFor();
    await check('normal running of unapplied Fibonacci continues past the fast growth window',async()=>{
      await source('MYFIB');await page.locator('#speed').selectOption('180');
      await page.locator('#run').click();
      // Nine timed steps take more than the configured one-second window.
      // Before this fix the growth guard stopped this same run after ~1 second.
      await page.waitForFunction(()=>Number(document.getElementById('step-count').textContent)>=9,null,{timeout:6000});
      assert.equal(await page.locator('#state-badge').textContent(),'正在归约');
      assert.equal(await page.locator('#fast-run').textContent(),'快速运行');
      assert.doesNotMatch(await page.locator('#run-status').textContent(),/保护性暂停/);
      await page.locator('#run').click();assert.equal(await page.locator('#run-label').textContent(),'运行');
    });
    await check('saved Fibonacci with no arguments pauses fast running without claiming a proven infinite loop',async()=>{
      await source('MYFIB');await page.locator('#fast-run').click();await paused();
      assert.doesNotMatch(await page.locator('#run-status').textContent(),/检测到.*无限|检测到.*循环/);
      assert.ok(Number(await page.locator('#step-count').textContent())>0);
      const snapshot=await page.locator('#current-expression').textContent();
      await page.waitForTimeout(150);assert.equal(await page.locator('#current-expression').textContent(),snapshot);
    });
    await check('continued fast running resumes the current step and pauses again; manual step and undo still work',async()=>{
      const before=Number(await page.locator('#step-count').textContent());
      await page.locator('#fast-run').click();await paused();
      const after=Number(await page.locator('#step-count').textContent());assert.ok(after>before);
      await page.locator('#step').click();assert.equal(Number(await page.locator('#step-count').textContent()),after+1);
      await page.locator('#back').click();assert.equal(Number(await page.locator('#step-count').textContent()),after);
    });
    await check('no-argument quick evaluation can pause, continue, pause again and cancel',async()=>{
      await source('MYFIB');await page.locator('#decimal-value').click();
      await page.locator('#continue-value').waitFor({state:'visible',timeout:10000});
      assert.match(await page.locator('#decimal-value-result').textContent(),/尚未确认/);
      assert.match(await page.locator('#decimal-value-result').textContent(),/等待时长/);
      await page.locator('#continue-value').click();
      await page.locator('#continue-value').waitFor({state:'visible',timeout:10000});
      assert.match(await page.locator('#decimal-value-result').textContent(),/等待时长/);
      await page.locator('#decimal-value').click();assert.ok(await page.locator('#continue-value').isHidden());
      assert.ok(await page.locator('#decimal-value-result').isHidden());
    });
    await check('the same saved Fibonacci accepts 5 and returns 5 through both evaluation modes',async()=>{
      await source('MYFIB 5');await page.locator('#decimal-value').click();
      await page.waitForFunction(()=>document.getElementById('decimal-value-result').textContent==='Church 数 5');
      await source('MYFIB 5');await page.locator('#fast-run').click();
      await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形',null,{timeout:10000});
      assert.equal(C.churchNumber(C.parse(await page.locator('#current-expression').textContent())),5);
    });
    await check('normal run keeps its selected mode for decimal shifts and the Lambda interpreter',async()=>{
      const shift=P.examples.find(e=>e.decimalOperation==='SHR');
      await source(P.inputSourceFor(shift));await page.locator('#speed').selectOption('1200');
      await page.locator('#run').click();
      assert.equal(await page.locator('#state-badge').textContent(),'正在归约');
      assert.ok(await page.locator('#decimal-value-result').isHidden());
      assert.equal(await page.locator('#step-count').textContent(),'0');
      await page.locator('#run').click();
      const interpreter=await page.evaluate(()=>LambdaMeta.compile('(λx.x) y'));
      await source(interpreter);await page.locator('#run').click();
      assert.equal(await page.locator('#state-badge').textContent(),'正在归约');
      assert.equal(await page.locator('#fast-run').textContent(),'快速运行');
      await page.waitForTimeout(100);assert.equal(await page.locator('#step-count').textContent(),'0');
      await page.locator('#run').click();
    });
    await check('the observation setting survives saving and reloading; offline build includes it',async()=>{
      await page.locator('#growth-window').selectOption('3000');await page.locator('#save-state').click();await page.reload();
      await page.waitForFunction(()=>document.getElementById('growth-window').value==='3000');
      assert.equal(await page.locator('#growth-window').inputValue(),'3000');
      const offline=await browser.newPage();await offline.goto(`http://127.0.0.1:${server.address().port}/dist/lambda-lab.html`);
      assert.equal(await offline.locator('#growth-window').inputValue(),'1000');assert.ok(await offline.evaluate(()=>!!window.LambdaRunGuard));await offline.close();
    });
    assert.deepEqual(errors,[]);console.log(`Fibonacci guard: ${count} passed, 0 failed.`);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
