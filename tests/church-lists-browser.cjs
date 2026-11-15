const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const C=require('../src/core.js'),P=require('../src/presets.js');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
process.env.PORT='0';const server=require('../scripts/serve.cjs');
(async()=>{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const browser=await pw.chromium.launch({headless:true}),base=`http://127.0.0.1:${server.address().port}`,errors=[];let passed=0;
  const examples=P.examples.filter(e=>e.category==='丘奇列表');
  const run=async(page,example)=>{
    await page.locator('#examples').selectOption(String(P.examples.indexOf(example)));
    assert.equal(await page.locator('#expression').inputValue(),example.term);
    assert.equal(await page.locator('#number-encoding').inputValue(),example.encoding);
    assert.ok((await page.locator('#example-info').textContent()).includes(example.expectedLabel||example.description));
    assert.ok(await page.locator('#diagram-mount line').count()>0);
    await page.locator('#fast-run').click();
    await page.waitForFunction(()=>document.getElementById('state-badge').textContent==='已到正规形');
    assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse(example.expected)),example.name);
    if(example.expectedLabel?.startsWith('丘奇列表'))assert.equal(await page.locator('#decoded').textContent(),example.expectedLabel.split('（')[0]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    console.log(`PASS L${++passed} ${example.name}`);
  };
  try{
    for(const width of [1280,390]){
      const context=await browser.newContext({viewport:{width,height:950},hasTouch:true}),page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
      assert.equal(await page.locator('#examples optgroup[label="丘奇列表"] option').count(),13);
      for(const example of examples)await run(page,example);
      await page.locator('#number-encoding').selectOption('list');
      await page.locator('#expression').fill('[12, 3_church]');
      await page.locator('#convert').click();
      assert.equal(await page.locator('#decoded').textContent(),'丘奇列表 [12, 3]');
      await page.locator('#expression').fill('[]');
      await page.locator('#convert').click();
      assert.equal(await page.locator('#decoded').textContent(),'丘奇列表 []');
      await run(page,examples.at(-1));
      await page.locator('#save-state').click();const source=await page.locator('#expression').inputValue();
      await page.reload();assert.equal(await page.locator('#expression').inputValue(),source);
      assert.ok(C.equal(C.parse(await page.locator('#current-expression').textContent()),C.parse(examples.at(-1).expected)));
      assert.equal(await page.locator('#decoded').textContent(),'丘奇列表 [2, 3]');
      console.log(`PASS L${++passed} ${width}px list result survives saved-state reload`);
      fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
      await page.screenshot({path:path.join(__dirname,'artifacts',`church-lists-${width}.png`),fullPage:true});
      await context.close();
    }
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/dist/lambda-lab.html');await run(page,examples.find(e=>e.name.includes('反转')));
    assert.deepEqual(errors,[]);console.log(`Church lists: ${passed} passed, 0 failed; Chromium ${browser.version()}; page errors 0.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
